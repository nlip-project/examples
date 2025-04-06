/**
 * Network utilities for communicating with the backend server
 */

// import { envSignal } from '../context/app-context.js';

const BASE_URL = 'https://druid.eecs.umich.edu';
// const BASE_URL = 'https://localhost:443'; // for testing largedataupload locally
const API_ENDPOINTS = {
  nlip: `${BASE_URL}/nlip`,
  upload: `${BASE_URL}/upload`,
};

// ===== NLIP message format Definitions =====
type Format =
  | 'text'
  | 'binary'
  | 'token'
  | 'structured'
  | 'location'
  | 'generic';
type Subformat =
  | 'english'
  | 'jpeg'
  | 'jpg'
  | 'png'
  | 'gif'
  | 'bmp'
  | 'conversation'
  | 'authentication'
  | 'uri';

interface Submessage {
  label?: string | number;
  format: Format;
  subformat: Subformat;
  content: string;
}

interface Message {
  control?: boolean;
  format: Format;
  subformat: Subformat;
  content: string;
  submessages?: Submessage[];
}

interface APIResponse {
  control?: boolean;
  format: Format;
  subformat: Subformat;
  content: string;
  submessages?: Submessage[];
}

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
  id: string;
  image?: {
    data: string;
    type: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  lastUpdated: number;
}

// ===== State Management =====
let hasSentInitialMessage = false;
let serverStoresChatHistory = false;

// ===== Initialization and Setup =====
export async function sendInitialMessage(): Promise<void> {
  if (hasSentInitialMessage) {
    return;
  }

  // Simulate server response indicating it doesn't store chat history
  serverStoresChatHistory = false;
  hasSentInitialMessage = true;

  // For now, just set the flags without making an actual request
  // In the future, this would be replaced with actual server communication
  /*
  const request: Message = {
    format: 'text',
    subformat: 'english',
    content: 'NLIP_INIT',
  };

  try {
    const response = await fetch(`${API_ENDPOINTS.nlip}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: APIResponse = await response.json();
    if (data.format !== 'text' || data.subformat !== 'english') {
      throw new Error('Invalid response format for initial message');
    }

    // Check if server stores chat history
    const storeHistoryLabel = data.submessages?.find(
      (msg) => msg.label === 'store_chat_history'
    );
    serverStoresChatHistory = storeHistoryLabel?.content === 'true';

    hasSentInitialMessage = true;
  } catch (error) {
    console.error('Error sending initial message:', error);
    throw error;
  }
  */
}

// ===== Chat History Management =====
function formatChatHistory(session: ChatSession): string {
  const history = session.messages
    .map((msg) => `${msg.type === 'user' ? 'user' : 'AI'}: ${msg.content}`)
    .join('\n');
  console.log('Formatted chat history:', history);
  return history;
}

function getCurrentChatSession(): ChatSession | null {
  // Check if localStorage is available
  if (typeof localStorage === 'undefined') {
    console.error('localStorage is not available');
    return null;
  }

  // Log all localStorage keys for debugging
  console.log(
    'localStorage keys:',
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
  );

  const savedSessions = localStorage.getItem('chat-sessions');
  console.log('chat-sessions value:', savedSessions);

  if (!savedSessions) {
    console.log('No chat sessions found');
    return null;
  }

  try {
    const sessions: ChatSession[] = JSON.parse(savedSessions);
    console.log('Number of sessions:', sessions.length);

    if (sessions.length === 0) {
      console.log('No sessions available');
      return null;
    }

    const currentSessionId = sessions[0].id;
    const currentSession = sessions.find((s) => s.id === currentSessionId);

    if (!currentSession) {
      console.log('Current session not found');
      return null;
    }

    console.log('Current session messages:', currentSession.messages.length);
    return currentSession;
  } catch (error) {
    console.error('Error parsing sessions:', error);
    return null;
  }
}

// ===== Message Sending Functions =====
export async function sendTextMessage(
  text: string,
  includeHistory = true
): Promise<string> {
  // Ensure initial message has been sent
  await sendInitialMessage();

  let content = text;
  if (!serverStoresChatHistory && includeHistory) {
    const currentSession = getCurrentChatSession();
    if (currentSession) {
      const history = formatChatHistory(currentSession);
      content = `${history}\n${text}`;
      console.log('Final message content with history:', content);
    }
  }

  const request: Message = {
    format: 'text',
    subformat: 'english',
    content,
  };

  console.log('Sending request:', request);

  try {
    const response = await fetch(`${API_ENDPOINTS.nlip}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: APIResponse = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error sending text message:', error);
    throw error;
  }
}

export async function sendImageMessage(
  prompt: string,
  base64Image: string,
  mimeType: string,
  includeHistory = true
): Promise<string> {
  const imageFormat = mimeType.split('/')[1].toLowerCase() as Subformat;

  // Validate image format
  if (!['jpeg', 'jpg', 'png', 'gif', 'bmp'].includes(imageFormat)) {
    throw new Error(
      'Unsupported image format. Please use JPEG, PNG, GIF, or BMP.'
    );
  }

  let content = prompt || 'What do you see in this image?';
  if (!serverStoresChatHistory && includeHistory) {
    const currentSession = getCurrentChatSession();
    if (currentSession) {
      const history = formatChatHistory(currentSession);
      content = `${history}\n${content}`;
      console.log('Final message content with history:', content);
    }
  }

  const request: Message = {
    format: 'text',
    subformat: 'english',
    content,
    submessages: [
      {
        format: 'binary',
        subformat: imageFormat,
        content: base64Image,
      },
    ],
  };

  console.log('Sending request:', request);

  try {
    const response = await fetch(`${API_ENDPOINTS.nlip}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: APIResponse = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error sending image message:', error);
    throw error;
  }
}

// ===== File Upload Functions =====
export async function requestUploadUrl(): Promise<string> {
  const request: Message = {
    control: true,
    format: 'text',
    subformat: 'english',
    content: 'request_upload_url',
  };

  try {
    const response = await fetch(`${API_ENDPOINTS.nlip}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: APIResponse = await response.json();
    if (data.format !== 'structured' || data.subformat !== 'uri') {
      throw new Error('Invalid response format for upload URL');
    }
    return data.content;
  } catch (error) {
    console.error('Error requesting upload URL:', error);
    throw error;
  }
}

export async function handleFileUpload(
  file: File
): Promise<{ message?: string; url?: string }> {
  try {
    // First, get the upload URL
    const uploadUrl = await requestUploadUrl();

    // Now upload the file
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse
        .text()
        .catch(() => 'Unknown error');
      throw new Error(`Upload failed: ${errorText}`);
    }

    const responseData = await uploadResponse.json().catch(() => null);
    return {
      message: `Successfully uploaded ${file.name}!`,
      url: responseData?.url,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
