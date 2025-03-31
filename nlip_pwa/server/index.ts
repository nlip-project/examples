import http from 'http';
import path from 'path';
import { SpeechClient, protos } from '@google-cloud/speech';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';

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

// Multer for file uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS
app.use(
  cors({
    origin: [
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'https://voice.pipzza.pw',
      'http://voice.pipzza.pw',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
);

// Store active streams and SSE clients by session ID
const activeStreams = new Map<string, any>();
const sseClients = new Map<string, any>();

// Batch transcription API endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const audioBytes = req.file.buffer.toString('base64');
    const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
      audio: { content: audioBytes },
      config: {
        encoding:
          protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
            .WEBM_OPUS,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await speechClient.recognize(request);
    const transcription =
      response.results?.map(
        (result: protos.google.cloud.speech.v1.ISpeechRecognitionResult) =>
          result.alternatives?.[0]?.transcript || ''
      ) || [];
    const finalTranscription = transcription.join('\n');

    res.json({ transcription: finalTranscription });
  } catch (err) {
    console.error('Error in batch transcription:', err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Unknown error' });
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

  // Send an initial connection message
  res.write('data: {"connected":true}\n\n');

  // Store the client connection
  sseClients.set(sessionId, res);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`SSE client disconnected: ${sessionId}`);
    sseClients.delete(sessionId);

    // Clean up any active stream
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
  console.log(`Start stream request for session: ${sessionId}`);

  // Wait briefly for SSE connection to be established
  const maxRetries = 5;
  const retryDelay = 100; // ms
  let retries = 0;

  while (!sseClients.has(sessionId) && retries < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retries++;
  }

  // Check if we have a client connection
  const client = sseClients.get(sessionId);
  if (!client) {
    console.error(
      `No SSE connection found for session: ${sessionId} after ${retries} retries`
    );
    return res
      .status(400)
      .json({
        error:
          'No active SSE connection for this session. Please refresh and try again.',
      });
  }

  try {
    // Create a new streamingRecognize request
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
        console.error('Streaming error:', err);
        const client = sseClients.get(sessionId);
        if (client) {
          client.write(
            `event: streamError\ndata: ${JSON.stringify({
              error: err.toString(),
            })}\n\n`
          );
        }
      })
      .on('data', (data) => {
        if (data.results && data.results[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;

          const client = sseClients.get(sessionId);
          if (client) {
            client.write(
              `event: transcriptionData\ndata: ${JSON.stringify({
                transcript,
                isFinal,
              })}\n\n`
            );
          }
        }
      });

    // Store the stream for this session
    activeStreams.set(sessionId, recognizeStream);
    console.log(`Stream started successfully for session: ${sessionId}`);
    res.status(200).json({ status: 'Stream started' });
  } catch (error) {
    console.error(`Error creating stream for session ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to create streaming session' });
  }
});

// Handle audio data
app.post(
  '/audio/:sessionId',
  express.raw({ type: 'audio/*', limit: '1mb' }),
  (req, res) => {
    const sessionId = req.params.sessionId;
    const recognizeStream = activeStreams.get(sessionId);

    if (!recognizeStream) {
      console.error(`No active stream found for session: ${sessionId}`);
      return res
        .status(400)
        .json({
          error:
            'No active stream for this session. Please start a new recording.',
        });
    }

    try {
      recognizeStream.write(req.body);
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
  console.log(`API Server listening on port ${PORT}`);
});
