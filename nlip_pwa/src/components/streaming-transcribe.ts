/* stylelint-disable */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  createStreamConnection,
  sendAudioData,
  startStream,
  stopStream,
} from '../helpers/stream-client.js';

interface Transcript {
  transcript: string;
  isFinal: boolean;
  edited?: boolean;
}

@customElement('streaming-transcribe')
export class StreamingTranscribe extends LitElement {
  @property({ type: Boolean }) hideUI = false;
  @state() private isRecording = false;
  @state() private isTranscribing = false;
  @state() private currentTranscript = '';
  @state() private isFinal = false;

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;

  constructor() {
    super();
    this.sessionId = Math.random().toString(36).substring(7);
  }

  async startRecording() {
    try {
      // Set up SSE connection first
      this.eventSource = createStreamConnection(this.sessionId!);
      
      // Wait for connection to be established
      await new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.eventSource!.addEventListener('open', () => {
          clearTimeout(connectionTimeout);
          resolve(true);
        });

        this.eventSource!.addEventListener('error', (event) => {
          clearTimeout(connectionTimeout);
          reject(new Error('Failed to establish SSE connection'));
        });

        this.eventSource!.addEventListener('transcriptionData', (event) => {
          const data = JSON.parse(event.data);
          this.currentTranscript = data.transcript;
          this.isFinal = data.isFinal;
          this.dispatchEvent(new CustomEvent('transcription-update', {
            detail: { transcript: this.currentTranscript, isFinal: this.isFinal }
          }));
        });

        this.eventSource!.addEventListener('streamError', (event) => {
          console.error('Stream error:', event.data);
          this.stopRecording();
        });
      });

      // Start the stream on the server
      await startStream(this.sessionId!);

      // Set up audio recording
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          await this.sendAudioChunk(event.data);
        }
      };

      this.mediaRecorder.start(100); // Send chunks every 100ms
      this.isRecording = true;
      this.isTranscribing = true;

    } catch (error) {
      console.error('Error starting recording:', error);
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      throw error;
    }
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      this.isTranscribing = false;

      // Stop the stream on the server
      await stopStream(this.sessionId!);

      // Close SSE connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      // Clear audio chunks
      this.audioChunks = [];
    }
  }

  private async sendAudioChunk(chunk: Blob) {
    try {
      await sendAudioData(this.sessionId!, chunk, 'audio/webm;codecs=opus');
    } catch (error) {
      console.error('Error sending audio chunk:', error);
    }
  }

  render() {
    if (this.hideUI) {
      return html``;
    }

    return html`
      <div class="container">
        <button
          class="record-button ${this.isRecording ? 'recording' : ''}"
          @click=${this.isRecording ? this.stopRecording : this.startRecording}
        >
          ${this.isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        ${this.isTranscribing ? html`
          <div class="transcription ${this.isFinal ? 'final' : ''}">
            ${this.currentTranscript || 'Listening...'}
          </div>
        ` : ''}
      </div>
    `;
  }

  static styles = css`
    .container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .record-button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      background-color: #007bff;
      color: white;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .record-button:hover {
      background-color: #0056b3;
    }

    .record-button.recording {
      background-color: #dc3545;
      animation: pulse 1.5s infinite;
    }

    .transcription {
      min-height: 2rem;
      padding: 0.5rem;
      border-radius: 4px;
      background-color: #f8f9fa;
    }

    .transcription.final {
      background-color: #e9ecef;
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }
  `;
}
