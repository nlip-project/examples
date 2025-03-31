/**
 * Helper functions for Server-Sent Events (SSE) streaming transcription.
 */

/**
 * Creates an EventSource connection for streaming transcription
 */
import { API_BASE_URL } from '../config.js';

export function createStreamConnection(
  sessionId: string,
  baseUrl = API_BASE_URL
): EventSource {
  if (!('EventSource' in window)) {
    throw new Error('Server-Sent Events are not supported in this browser');
  }

  return new EventSource(`${baseUrl}/stream/${sessionId}`);
}

/**
 * Sends audio data to the server
 */
export async function sendAudioData(
  sessionId: string,
  audioData: Blob,
  contentType: string,
  baseUrl = API_BASE_URL
): Promise<void> {
  await fetch(`${baseUrl}/audio/${sessionId}`, {
    method: 'POST',
    body: audioData,
    headers: {
      'Content-Type': contentType,
    },
  });
}

/**
 * Starts a new transcription stream
 */
export async function startStream(
  sessionId: string,
  baseUrl = API_BASE_URL
): Promise<void> {
  await fetch(`${baseUrl}/start/${sessionId}`, {
    method: 'POST',
  });
}

/**
 * Stops a transcription stream
 */
export async function stopStream(
  sessionId: string,
  baseUrl = API_BASE_URL
): Promise<void> {
  await fetch(`${baseUrl}/stop/${sessionId}`, {
    method: 'POST',
  });
}
