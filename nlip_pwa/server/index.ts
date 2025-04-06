import http from 'http';
import path from 'path';
import { SpeechClient, protos } from '@google-cloud/speech';
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express setup
const app = express();
const server = http.createServer(app);

// Initialize Google Speech client
let speechClient: SpeechClient;
try {
  const keyFilePath = path.join(
    __dirname,
    '..',
    '..',
    'nlip-pwa-89f5620f7edd.json'
  );
  speechClient = new SpeechClient({ keyFilename: keyFilePath });
} catch (error) {
  try {
    speechClient = new SpeechClient();
  } catch (fallbackError) {
    throw new Error(
      'Could not initialize Google Speech client. Please check your credentials.'
    );
  }
}

// Enable CORS
app.use(
  cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
);

// Add JSON body parsing
app.use(express.json());

// Store active streams and SSE clients by session ID
const activeStreams = new Map<string, any>();
const sseClients = new Map<string, any>();

// OVON Assistant Manifest endpoint
app.get('/manifest', (req, res) => {
  try {
    const manifestPath = path.join(__dirname, 'assistant-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    res.json(manifest);
  } catch (error) {
    console.error('Error serving manifest:', error);
    res.status(500).json({ error: 'Failed to serve manifest' });
  }
});

// SSE endpoint for streaming transcription
app.get('/stream/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log(`Client connected to SSE stream: ${sessionId}`);

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.set(sessionId, res);

  req.on('close', () => {
    console.log(`SSE client disconnected: ${sessionId}`);
    sseClients.delete(sessionId);
    const stream = activeStreams.get(sessionId);
    if (stream) {
      stream.end();
      activeStreams.delete(sessionId);
    }
  });
});

// Start a new transcription stream
app.post('/start/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const envelope = req.body;

  // Validate OVON envelope
  if (
    !envelope?.ovon?.conversation?.id ||
    envelope.ovon.conversation.id !== sessionId
  ) {
    return res
      .status(400)
      .json({ error: 'Invalid OVON envelope or session ID mismatch' });
  }

  // Wait for SSE connection
  const maxRetries = 5;
  const retryDelay = 100;
  let retries = 0;

  while (!sseClients.has(sessionId) && retries < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retries++;
  }

  const client = sseClients.get(sessionId);
  if (!client) {
    return res.status(400).json({ error: 'No active SSE connection' });
  }

  try {
    const recognizeStream = speechClient
      .streamingRecognize({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          model: 'latest_long',
        },
        interimResults: true,
      })
      .on('error', (err) => {
        const errorEnvelope = {
          ovon: {
            schema: { version: '0.9.4' },
            conversation: { id: sessionId },
            sender: {
              speakerUri: 'tag:nlip-pwa,2025:0001',
              serviceUrl: 'http://localhost:3000',
            },
            events: [
              {
                eventType: 'utterance',
                parameters: {
                  dialogEvent: {
                    speakerUri: 'tag:nlip-pwa,2025:0001',
                    span: { startTime: new Date().toISOString() },
                    features: {
                      text: {
                        mimeType: 'text/plain',
                        tokens: [{ value: `Error: ${err.toString()}` }],
                      },
                    },
                  },
                },
              },
            ],
          },
        };
        client.write(`data: ${JSON.stringify(errorEnvelope)}\n\n`);
      })
      .on('data', (data) => {
        if (data.results?.[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;

          const transcriptionEnvelope = {
            ovon: {
              schema: { version: '0.9.4' },
              conversation: { id: sessionId },
              sender: {
                speakerUri: 'tag:nlip-pwa,2025:0001',
                serviceUrl: 'http://localhost:3000',
              },
              events: [
                {
                  eventType: 'utterance',
                  parameters: {
                    dialogEvent: {
                      speakerUri: 'tag:nlip-pwa,2025:0001',
                      span: { startTime: new Date().toISOString() },
                      features: {
                        text: {
                          mimeType: 'text/plain',
                          tokens: [{ value: transcript }],
                        },
                      },
                    },
                  },
                },
              ],
            },
          };
          client.write(`data: ${JSON.stringify(transcriptionEnvelope)}\n\n`);
        }
      });

    activeStreams.set(sessionId, recognizeStream);
    res.status(200).json({ status: 'Stream started' });
  } catch (error) {
    console.error(`Error creating stream for session ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to create streaming session' });
  }
});

// Handle audio data
app.post(
  '/audio/:sessionId',
  express.raw({ type: 'application/json', limit: '1mb' }),
  (req, res) => {
    const sessionId = req.params.sessionId;
    const envelope = req.body;

    // Validate OVON envelope
    if (
      !envelope?.ovon?.conversation?.id ||
      envelope.ovon.conversation.id !== sessionId
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid OVON envelope or session ID mismatch' });
    }

    const recognizeStream = activeStreams.get(sessionId);
    if (!recognizeStream) {
      return res
        .status(400)
        .json({ error: 'No active stream for this session' });
    }

    try {
      // Extract audio data from OVON envelope
      const audioData =
        envelope.ovon.events[0]?.parameters?.dialogEvent?.features?.audio
          ?.tokens[0]?.value;
      if (!audioData) {
        return res.status(400).json({ error: 'No audio data in envelope' });
      }

      // Convert base64 to buffer and write to stream
      const audioBuffer = Buffer.from(audioData, 'base64');
      recognizeStream.write(audioBuffer);
      res.status(200).json({ status: 'Audio received' });
    } catch (error) {
      console.error(`Error processing audio for session ${sessionId}:`, error);
      res.status(500).json({ error: 'Failed to process audio data' });
    }
  }
);

// Stop a transcription stream
app.post('/stop/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const recognizeStream = activeStreams.get(sessionId);

  if (recognizeStream) {
    recognizeStream.end();
    activeStreams.delete(sessionId);
    console.log(`Stream ended for session: ${sessionId}`);
  }

  res.status(200).json({ status: 'Stream stopped' });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
