import { createContext } from '@lit/context';
import { signal } from '@lit-labs/signals';

// Chat state interface
export interface ChatState {
  userPrompt: string;
  aiResponse: string;
  isLoading: boolean;
}

// Create chat state context
export const chatContext = createContext<ChatState>('chat-state');

// Create environment signal
export const envSignal = signal('https://druid.eecs.umich.edu');

// Chat state controller
export class ChatStateController {
  private state = signal<ChatState>({
    userPrompt: '',
    aiResponse: '',
    isLoading: false,
  });

  get chatState(): ChatState {
    return this.state.get();
  }

  updateState(updates: Partial<ChatState>) {
    this.state.set({
      ...this.state.get(),
      ...updates,
    });
  }

  resetState() {
    this.state.set({
      userPrompt: '',
      aiResponse: '',
      isLoading: false,
    });
  }
}

// Environment configuration
export const SERVER_URL = 'https://druid.eecs.umich.edu';
