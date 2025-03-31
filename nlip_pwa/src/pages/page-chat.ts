/**
 * Copyright (c) IBM, Corp. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* stylelint-disable */
import { SignalWatcher } from '@lit-labs/signals';
import { Router } from '@vaadin/router';
import { html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { ref, createRef } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Marked } from 'marked';

import {
  sendTextMessage,
  sendImageMessage,
  handleFileUpload,
} from '../components/network.js';
import { PageElement } from '../helpers/page-element.js';
import { chatInputStyles } from '../styles/chat-input.js';
import { StreamingTranscribe } from '../components/streaming-transcribe.js';

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

@customElement('page-chat')
export class PageChat extends SignalWatcher(PageElement) {
  @state() private messages: ChatMessage[] = [];
  @query('#chat-input') chatInput?: HTMLTextAreaElement;
  @query('#image-input') imageInput?: HTMLInputElement;
  @query('#document-input') documentInput?: HTMLInputElement;
  @state() private showSuccessPopup = false;
  @state() private showErrorPopup = false;
  @state() private errorMessage = '';
  @state() private isAiTyping = false;
  @state() private showScrollButton = false;
  @state() private selectedMessageId: string | null = null;
  @state() private showContextMenu = false;
  @state() private contextMenuX = 0;
  @state() private contextMenuY = 0;
  @state() private editingMessageId: string | null = null;
  @state() private showUploadMenu = false;
  @state() private previewImage: string | null = null;
  @state() private previewDocumentName: string | null = null;
  @state() private isRecording = false;
  @state() private isSpeechSupported = true;
  @state() private isTranscribing = false;
  @state() private currentTranscription = '';
  @state() private isTyping = false;
  @state() private currentPartial = '';
  @state() private partialTranscriptions: string[] = [];

  private static readonly STORAGE_KEY = 'chat-history';
  private _typingTimeout: NodeJS.Timeout | null = null;
  private documentClickHandler: (e: MouseEvent) => void;
  private documentInputRef = createRef<HTMLInputElement>();

  // Marked configuration without the 'mangle' property
  private marked = new Marked({
    breaks: true,
    gfm: true,
    silent: true,
  });

  @query('streaming-transcribe')
  private transcribeElement!: StreamingTranscribe;

  constructor() {
    super();
    this.documentClickHandler = this.onDocumentClick.bind(this);
    // Add scroll event listener with throttling
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolledFromBottom =
            document.documentElement.scrollHeight -
            window.innerHeight -
            window.scrollY;
          this.showScrollButton = scrolledFromBottom > 200;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  private onDocumentClick(e: MouseEvent) {
    if (
      this.showContextMenu &&
      !(e.target as Element).closest('.context-menu')
    ) {
      this.hideContextMenu();
    }
  }

  private loadChatHistory() {
    const savedHistory = localStorage.getItem(PageChat.STORAGE_KEY);
    if (savedHistory) {
      this.messages = JSON.parse(savedHistory);
    }
  }

  private saveChatHistory() {
    localStorage.setItem(PageChat.STORAGE_KEY, JSON.stringify(this.messages));
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private addMessage(
    type: 'user' | 'ai',
    content: string,
    image?: { data: string; type: string } | null
  ) {
    const message: ChatMessage = {
      type,
      content,
      timestamp: Date.now(),
      id: this.generateMessageId(),
      ...(image && { image }),
    };
    this.messages = [...this.messages, message];
    this.saveChatHistory();
    this.scrollToBottom();
  }

  private scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }

  private showSuccess() {
    this.showSuccessPopup = true;
    this.showErrorPopup = false;
    setTimeout(() => {
      this.showSuccessPopup = false;
    }, 3000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.showErrorPopup = true;
    this.showSuccessPopup = false;
    setTimeout(() => {
      this.showErrorPopup = false;
    }, 5000);
  }

  private async handleSend() {
    if (!this.chatInput?.value) return;

    const userMessage = this.chatInput.value;
    const pendingImageData = sessionStorage.getItem('pendingImageData');
    const pendingDocumentData = sessionStorage.getItem('pendingDocumentData');
    const pendingDocumentContent = sessionStorage.getItem(
      'pendingDocumentContent'
    );

    const messageContent = userMessage;
    let imageData: { data: string; type: string } | null = null;
    let documentData = null;

    try {
      // Handle file upload if there's a pending file
      if (pendingImageData) {
        const imageInfo = JSON.parse(pendingImageData);
        const file = await fetch(imageInfo.data)
          .then((res) => res.blob())
          .then((blob) => new File([blob], 'image', { type: imageInfo.type }));
        await handleFileUpload(file);
        imageData = {
          data: imageInfo.data,
          type: imageInfo.type,
        };
        sessionStorage.removeItem('pendingImageData');
      } else if (pendingDocumentData && pendingDocumentContent) {
        const docInfo = JSON.parse(pendingDocumentData);
        const file = await fetch(pendingDocumentContent)
          .then((res) => res.blob())
          .then(
            (blob) => new File([blob], docInfo.name, { type: docInfo.type })
          );
        await handleFileUpload(file);
        documentData = {
          name: docInfo.name,
          type: docInfo.type,
          content: pendingDocumentContent,
        };
        sessionStorage.removeItem('pendingDocumentData');
        sessionStorage.removeItem('pendingDocumentContent');
      }

      // Add user message to chat
      this.addMessage('user', messageContent, imageData);
      this.chatInput.value = '';
      this.clearPreview();
      this.isAiTyping = true;

      let aiResponse: string;
      if (imageData) {
        aiResponse = await sendImageMessage(
          messageContent,
          imageData.data.split(',')[1],
          imageData.type
        );
      } else if (documentData) {
        // Send document content as base64 string
        const base64Content = documentData.content.split(',')[1];
        const request = {
          format: 'text',
          subformat: 'english',
          content: messageContent,
          submessages: [
            {
              format: 'binary',
              subformat: documentData.type.split('/')[1],
              content: base64Content,
            },
          ],
        };

        const response = await fetch('https://druid.eecs.umich.edu/nlip/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`Failed to process document: ${response.statusText}`);
        }

        const data = await response.json();
        aiResponse = data.content;
      } else {
        aiResponse = await sendTextMessage(messageContent);
      }

      this.isAiTyping = false;
      if (aiResponse) {
        // Check if response contains /upload/
        if (aiResponse.includes('/upload/')) {
          this.addMessage('ai', 'Successfully uploaded file');
        } else {
          this.addMessage('ai', aiResponse);
        }
        this.showSuccess();
      }
    } catch (error) {
      this.isAiTyping = false;
      console.error('Error sending message:', error);
      this.showError('Failed to send message. Please try again.');
    }
  }

  private handleImageSelect() {
    this.imageInput?.click();
  }

  private async handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (
      !['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(file.type)
    ) {
      this.showError(
        'Please select a valid image file (JPEG, PNG, GIF, or BMP)'
      );
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        const chatInput = this.renderRoot?.querySelector(
          '.chat-input'
        ) as HTMLTextAreaElement;
        if (chatInput) {
          if (!chatInput.value.trim()) {
            chatInput.value = 'What do you see in this image?';
          }
          chatInput.focus();
          chatInput.setSelectionRange(
            chatInput.value.length,
            chatInput.value.length
          );
        }

        this.previewImage = e.target.result as string;
        this.previewDocumentName = null;

        sessionStorage.setItem(
          'pendingImageData',
          JSON.stringify({
            data: e.target.result,
            type: file.type,
          })
        );
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  private async handleDocumentUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Reset the file input
    if (this.documentInputRef.value) {
      this.documentInputRef.value.value = '';
    }

    // Set up the chat input and preview
    const chatInput = this.renderRoot?.querySelector(
      '.chat-input'
    ) as HTMLTextAreaElement;
    if (chatInput) {
      if (!chatInput.value.trim()) {
        chatInput.value = `Please analyze this document: ${file.name}`;
      }
      chatInput.focus();
      chatInput.setSelectionRange(
        chatInput.value.length,
        chatInput.value.length
      );
    }

    // Set preview document name
    this.previewDocumentName = file.name;
    this.previewImage = null;

    // Store the file information for later use
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        sessionStorage.setItem(
          'pendingDocumentData',
          JSON.stringify({
            name: file.name,
            type: file.type,
          })
        );
        sessionStorage.setItem(
          'pendingDocumentContent',
          e.target.result as string
        );
      }
    };
    reader.readAsDataURL(file);
  }

  private closeUploadMenu = (e: MouseEvent) => {
    if (!(e.target as Element).closest('.button-group')) {
      this.showUploadMenu = false;
      document.removeEventListener('click', this.closeUploadMenu);
    }
  };

  private toggleUploadMenu() {
    this.showUploadMenu = !this.showUploadMenu;
    if (this.showUploadMenu) {
      // Add click listener with a small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', this.closeUploadMenu);
      });
    }
  }

  private renderMessageContent(message: ChatMessage) {
    if (message.type === 'ai') {
      return html`<div class="message-content markdown">
        ${unsafeHTML(this.marked.parse(message.content) as string)}
      </div>`;
    }

    return html`<div class="message-content">${message.content}</div>`;
  }

  private handleMessageInteraction(
    event: MouseEvent | TouchEvent,
    messageId: string
  ) {
    const isLongPress = event.type === 'touchstart';
    if (isLongPress) {
      event.preventDefault();
      const touch = (event as TouchEvent).touches[0];
      this.showMessageContextMenu(touch.clientX, touch.clientY, messageId);
    } else if (event.type === 'contextmenu') {
      event.preventDefault();
      const mouseEvent = event as MouseEvent;
      this.showMessageContextMenu(
        mouseEvent.clientX,
        mouseEvent.clientY,
        messageId
      );
    }
  }

  private showMessageContextMenu(x: number, y: number, messageId: string) {
    this.selectedMessageId = messageId;
    this.contextMenuX = x;
    this.contextMenuY = y;
    this.showContextMenu = true;
  }

  private hideContextMenu() {
    this.showContextMenu = false;
    this.selectedMessageId = null;
  }

  private copyMessage() {
    const message = this.messages.find((m) => m.id === this.selectedMessageId);
    if (message) {
      navigator.clipboard.writeText(message.content);
      this.showSuccess();
    }
    this.hideContextMenu();
  }

  private startEditMessage() {
    this.editingMessageId = this.selectedMessageId;
    this.hideContextMenu();

    // Add a small delay to allow the container to expand first
    requestAnimationFrame(() => {
      const textarea = this.renderRoot.querySelector(
        '.editing-input'
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(
          textarea.value.length,
          textarea.value.length
        );

        // Scroll the textarea into view with some padding
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  private cancelEdit() {
    this.editingMessageId = null;
  }

  private saveEditedMessage(event: Event, messageId: string) {
    const textarea = event.target as HTMLTextAreaElement;
    const messageIndex = this.messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && textarea.value.trim()) {
      const updatedMessages = [...this.messages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: textarea.value.trim(),
      };
      this.messages = updatedMessages;
      this.saveChatHistory();
      this.showSuccess();
    }
    this.editingMessageId = null;
  }

  private resendMessage() {
    const message = this.messages.find((m) => m.id === this.selectedMessageId);
    if (message) {
      if (this.chatInput) {
        this.chatInput.value = message.content;
      }
      this.handleSend();
    }
    this.hideContextMenu();
  }

  private clearPreview() {
    this.previewImage = null;
    this.previewDocumentName = null;
    sessionStorage.removeItem('pendingImageData');
    sessionStorage.removeItem('pendingDocumentData');
    sessionStorage.removeItem('pendingDocumentContent');
  }

  private clearChatHistory() {
    if (
      confirm(
        'Are you sure you want to clear the chat history? This cannot be undone.'
      )
    ) {
      this.messages = [];
      localStorage.removeItem(PageChat.STORAGE_KEY);
      this.showSuccess();
      this.requestUpdate();
    }
  }

  private handleTranscriptionUpdate(event: CustomEvent) {
    const { transcript, isFinal } = event.detail;
    console.log(
      '[PageChat] Received transcription update:',
      transcript,
      'isFinal:',
      isFinal
    );

    const input = this.renderRoot?.querySelector(
      '.chat-input'
    ) as HTMLTextAreaElement;
    const inputContainer = this.renderRoot?.querySelector(
      '.chat-input-container'
    );

    if (input && inputContainer) {
      // Always update the input value and current transcription
      input.value = transcript;
      this.currentTranscription = transcript;

      if (!isFinal) {
        // Handle partial transcription
        this.currentPartial = transcript;
        inputContainer.classList.add('typing');
        this.isTyping = true;

        // Reset typing state after delay if no new updates
        if (this._typingTimeout) {
          clearTimeout(this._typingTimeout);
        }
        this._typingTimeout = setTimeout(() => {
          if (this.currentPartial === transcript) {
            inputContainer.classList.remove('typing');
            this.isTyping = false;
          }
        }, 1000);
      } else {
        // Handle final transcription
        console.log('[PageChat] Applying final transcription to input');
        inputContainer.classList.remove('typing');
        this.isTyping = false;
        this.currentPartial = '';
      }

      this.requestUpdate();
    } else {
      console.error(
        '[PageChat] Input element not found for transcription update'
      );
    }
  }

  private async toggleTranscription() {
    console.log(
      '[PageChat] Toggle transcription called, isRecording:',
      this.isRecording
    );
    if (!this.transcribeElement) {
      console.error('[PageChat] Transcribe element not found');
      return;
    }

    if (!this.isRecording) {
      try {
        console.log('[PageChat] Starting recording...');
        this.isRecording = true;
        this.isTranscribing = true;
        this.currentPartial = '';
        this.partialTranscriptions = [];
        await this.transcribeElement.startRecording();
        console.log('[PageChat] Recording started successfully');
      } catch (error) {
        console.error('[PageChat] Error starting transcription:', error);

        // Show user-friendly error message
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          this.showError(
            'Microphone access denied. Please allow microphone access and try again.'
          );
        } else if (
          error instanceof DOMException &&
          error.name === 'NotFoundError'
        ) {
          this.showError(
            'No microphone found. Please connect a microphone and try again.'
          );
        } else {
          this.showError('Could not start recording. Please try again.');
        }

        this.isRecording = false;
        this.isTranscribing = false;
      }
    } else {
      try {
        console.log('[PageChat] Stopping recording...');
        await this.transcribeElement.stopRecording();
        console.log('[PageChat] Recording stopped successfully');
        this.isRecording = false;
        this.isTranscribing = false;
      } catch (error) {
        console.error('[PageChat] Error stopping transcription:', error);
        this.isRecording = false;
        this.isTranscribing = false;
      }
    }
  }

  private handleMicrophoneClick() {
    console.log(
      'Microphone clicked, isSpeechSupported:',
      this.isSpeechSupported
    );
    if (this.isSpeechSupported) {
      console.log('Speech is supported, calling toggleTranscription');
      this.toggleTranscription();
    } else {
      console.log('Speech is not supported');
    }
  }

  private _handleInput(e: Event) {
    const input = e.target as HTMLTextAreaElement;
    this.currentTranscription = input.value;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="success-popup ${this.showSuccessPopup ? 'show' : ''}">
        Message sent successfully!
      </div>

      <div class="error-popup ${this.showErrorPopup ? 'show' : ''}">
        ${this.errorMessage}
      </div>

      <div class="header">
        <h2>Chat</h2>
        <button class="clear-history-button" @click=${this.clearChatHistory}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
          Clear History
        </button>
      </div>

      <div class="chat-container">
        ${this.messages.map(
          (message) => html`
            <div
              class="message ${message.type}-message ${message.id ===
              this.selectedMessageId
                ? 'selected'
                : ''} ${message.id === this.editingMessageId ? 'editing' : ''}"
              @contextmenu=${(e: MouseEvent) =>
                this.handleMessageInteraction(e, message.id)}
              @touchstart=${(e: TouchEvent) => {
                const timer = setTimeout(
                  () => this.handleMessageInteraction(e, message.id),
                  500
                );
                const clearTimer = () => clearTimeout(timer);
                e.target?.addEventListener('touchend', clearTimer, {
                  once: true,
                });
                e.target?.addEventListener('touchmove', clearTimer, {
                  once: true,
                });
              }}
            >
              <div class="message-header">
                ${message.type === 'user' ? 'You' : 'AI'}
              </div>
              ${this.editingMessageId === message.id
                ? html`
                    <div class="editing-input-container">
                      <textarea
                        class="editing-input"
                        .value=${message.content}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            this.saveEditedMessage(e, message.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            this.cancelEdit();
                          }
                        }}
                      ></textarea>
                      <div class="editing-actions">
                        <button
                          class="editing-button cancel-button"
                          @click=${this.cancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          class="editing-button save-button"
                          @click=${(e: Event) =>
                            this.saveEditedMessage(e, message.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  `
                : this.renderMessageContent(message)}
              ${message.image
                ? html`
                    <div class="message-image">
                      <img
                        src="${message.image.data}"
                        alt="User uploaded content in chat"
                      />
                    </div>
                  `
                : ''}
            </div>
          `
        )}
        ${this.isAiTyping
          ? html`
              <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
              </div>
            `
          : ''}
      </div>

      <div
        class="context-menu ${this.showContextMenu ? 'show' : ''}"
        style="left: ${this.contextMenuX}px; top: ${this.contextMenuY}px;"
      >
        <button class="context-menu-item" @click=${this.copyMessage}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
            />
          </svg>
          Copy
        </button>
        <button class="context-menu-item" @click=${this.startEditMessage}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            />
          </svg>
          Edit
        </button>
        <button class="context-menu-item" @click=${this.resendMessage}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
            />
          </svg>
          Resend
        </button>
      </div>

      <button
        class="scroll-button ${this.showScrollButton ? 'show' : ''}"
        @click=${this.scrollToBottom}
        aria-label="Scroll to bottom"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
            transform="rotate(180 12 12)"
          />
        </svg>
      </button>

      <div class="chat-input-container ${this.isTyping ? 'typing' : ''}">
        <div class="chat-input-wrapper">
          ${this.previewImage || this.previewDocumentName
            ? html`
                <div class="file-preview">
                  <div class="preview-header">
                    <span
                      >${this.previewImage
                        ? 'Image Preview'
                        : 'Document Preview'}</span
                    >
                    <button class="preview-close" @click=${this.clearPreview}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path
                          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                        />
                      </svg>
                    </button>
                  </div>
                  ${this.previewImage
                    ? html`<img
                        class="preview-image"
                        src="${this.previewImage}"
                        alt="Preview"
                      />`
                    : html`
                        <div class="preview-document">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path
                              d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                            />
                          </svg>
                          <span>${this.previewDocumentName}</span>
                        </div>
                      `}
                </div>
              `
            : ''}
          ${this.isSpeechSupported
            ? html`
                <button
                  class="audio ${this.isRecording ? 'recording' : ''}"
                  @click=${this.handleMicrophoneClick}
                  title="${this.isRecording
                    ? 'Stop recording'
                    : 'Start voice input'}"
                >
                  ${this.isRecording
                    ? html`<svg viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" />
                      </svg>`
                    : html`<svg viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                        />
                        <path
                          d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                        />
                      </svg>`}
                </button>
              `
            : ''}
          <textarea
            id="chat-input"
            class="chat-input"
            placeholder="Type your message here..."
            .value=${this.currentTranscription}
            @input=${this._handleInput}
          ></textarea>
          <div class="button-group">
            <div style="position: relative;">
              <button
                class="image-upload-button"
                @click=${() => this.toggleUploadMenu()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                  />
                </svg>
              </button>
              <div class="upload-menu ${this.showUploadMenu ? 'show' : ''}">
                <button
                  class="upload-option"
                  @click=${() => this.handleImageSelect()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                    ></path>
                  </svg>
                  Upload Image
                </button>
                <button
                  class="upload-option"
                  @click=${() => this.documentInputRef.value?.click()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                    ></path>
                  </svg>
                  Upload Document
                </button>
              </div>
            </div>
            <button class="send-button" @click=${this.handleSend}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <input
        type="file"
        id="image-input"
        class="hidden-file-input"
        accept="image/jpeg,image/png,image/gif,image/bmp"
        @change=${this.handleImageUpload}
      />

      <input
        ${ref(this.documentInputRef)}
        type="file"
        id="document-input"
        class="hidden-file-input"
        accept=".pdf,.doc,.docx,.txt"
        @change=${this.handleDocumentUpload}
      />

      <streaming-transcribe
        hideUI
        @transcription-update=${this.handleTranscriptionUpdate}
      ></streaming-transcribe>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    // Prevent zooming on mobile devices
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);

    // Load chat history from localStorage
    this.loadChatHistory();

    // Add click listener with proper reference
    document.addEventListener('click', this.documentClickHandler);

    // Check for chatData from home page
    const chatDataString = sessionStorage.getItem('chatData');
    if (chatDataString) {
      try {
        const chatData = JSON.parse(chatDataString);

        // Wait for the chat input to be available
        requestAnimationFrame(() => {
          if (this.chatInput) {
            // Set the user prompt in the input
            this.chatInput.value = chatData.userPrompt;

            // If there's image data, store it in sessionStorage
            if (chatData.imageData && chatData.imageType) {
              sessionStorage.setItem(
                'pendingImageData',
                JSON.stringify({
                  data: chatData.imageData,
                  type: chatData.imageType,
                })
              );
            }

            // If there's document data, store it in sessionStorage
            if (
              chatData.documentName &&
              chatData.documentType &&
              chatData.documentContent
            ) {
              sessionStorage.setItem(
                'pendingDocumentData',
                JSON.stringify({
                  name: chatData.documentName,
                  type: chatData.documentType,
                })
              );
              sessionStorage.setItem(
                'pendingDocumentContent',
                chatData.documentContent
              );
            }

            // Clear the chatData from sessionStorage
            sessionStorage.removeItem('chatData');

            // Automatically send the message
            this.handleSend();
          }
        });
      } catch (error) {
        console.error('Error processing chat data:', error);
      }
    }

    // Restore message if there is one (for backward compatibility)
    const restoreMessage = sessionStorage.getItem('restoreMessage');
    if (restoreMessage) {
      // Wait for the chat input to be available
      requestAnimationFrame(() => {
        if (this.chatInput) {
          this.chatInput.value = restoreMessage;
          this.chatInput.focus();
          // Remove the message from storage
          sessionStorage.removeItem('restoreMessage');
          // Automatically send the message
          this.handleSend();
        }
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // Remove the click listener
    document.removeEventListener('click', this.documentClickHandler);
  }

  meta() {
    return {
      title: 'Chat',
      description: 'Chat with AI',
    };
  }

  static styles = css`
    ${chatInputStyles}

    :host {
      display: block;
      min-height: 100vh;
      padding-bottom: calc(140px + env(safe-area-inset-bottom));
      background: #f8fafc;
      user-select: none;
      touch-action: pan-x pan-y;
      -webkit-touch-callout: none;
      overscroll-behavior: none;
    }

    * {
      touch-action: pan-x pan-y;
      -webkit-touch-callout: none;
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: min(90vw, 800px);
      margin: 0 auto;
      padding: clamp(1rem, 5vw, 2rem);
      padding-bottom: calc(80px + env(safe-area-inset-bottom));
      overscroll-behavior: contain;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: min(90vw, 800px);
      margin: 0 auto;
      padding: 1rem;
      background: rgb(245 245 247 / 90%);
      backdrop-filter: blur(10px);
    }

    .clear-history-button {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      background: #ef4444;
      color: white;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .clear-history-button:hover {
      background: #dc2626;
    }

    .clear-history-button svg {
      width: 16px;
      height: 16px;
    }

    .message {
      position: relative;
      max-width: 80%;
      margin-bottom: 0;
      padding: 1rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
      user-select: text;
      transition: background-color 0.2s;
    }

    .message.selected {
      background-color: rgb(0 123 255 / 10%);
    }

    .user-message {
      align-self: flex-end;
      background: #007bff;
      color: white;
    }

    .ai-message {
      align-self: flex-start;
      background: white;
      color: #333;
    }

    .message-header {
      margin-bottom: 0.5rem;
      font-weight: 500;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .message-content {
      line-height: 1.5;
      user-select: text;
      touch-action: pan-x pan-y;
    }

    .message-content.markdown {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
        Ubuntu, Cantarell, sans-serif;
    }

    .message-content.markdown p {
      margin: 0.5em 0;
    }

    .message-content.markdown code {
      padding: 0.2em 0.4em;
      border-radius: 6px;
      background-color: rgb(175 184 193 / 20%);
      font-size: 0.9em;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
        'Liberation Mono', monospace;
    }

    .message-content.markdown pre {
      overflow-x: auto;
      padding: 1em;
      border-radius: 6px;
      background-color: #f6f8fa;
    }

    .message-content.markdown pre code {
      display: block;
      overflow-x: auto;
      padding: 0;
      background-color: transparent;
      white-space: pre;
    }

    .message-content.markdown h1,
    .message-content.markdown h2,
    .message-content.markdown h3,
    .message-content.markdown h4,
    .message-content.markdown h5,
    .message-content.markdown h6 {
      margin: 0.5em 0;
      font-weight: 600;
      line-height: 1.25;
    }

    .message-content.markdown ul,
    .message-content.markdown ol {
      margin: 0.5em 0;
      padding-left: 2em;
    }

    .message-content.markdown blockquote {
      margin: 0.5em 0;
      padding-left: 1em;
      border-left: 3px solid #ddd;
      color: #666;
    }

    .message-content.markdown a {
      color: #0366d6;
      text-decoration: none;
    }

    .message-content.markdown a:hover {
      text-decoration: underline;
    }

    .message-content.markdown table {
      width: 100%;
      margin: 0.5em 0;
      border-collapse: collapse;
    }

    .message-content.markdown th,
    .message-content.markdown td {
      padding: 6px 13px;
      border: 1px solid #ddd;
    }

    .message-content.markdown tr:nth-child(2n) {
      background-color: rgb(0 0 0 / 2%);
    }

    .message-image {
      overflow: hidden;
      max-width: 100%;
      margin-top: 0.5rem;
      border-radius: 8px;
    }

    .message-image img {
      display: block;
      object-fit: contain;
      width: 100%;
      height: auto;
      max-height: 300px;
      background: #f0f0f0;
    }

    .success-popup,
    .error-popup {
      position: fixed;
      top: 20px;
      left: 50%;
      z-index: 2000;
      max-width: 90vw;
      padding: 16px 24px;
      border-radius: 8px;
      color: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      font-weight: 500;
      text-align: center;
      word-break: break-word;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      transform: translateX(-50%);
    }

    .success-popup {
      background: #4caf50;
    }

    .error-popup {
      background: #f44336;
    }

    .success-popup.show,
    .error-popup.show {
      opacity: 1;
    }

    .hidden-file-input {
      display: none;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      align-self: flex-start;
      max-width: 80px;
      padding: 12px 16px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      opacity: 0.3;
      animation: typingAnimation 1.4s infinite;
    }

    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing-animation {
      0%,
      100% {
        opacity: 0.3;
        transform: scale(1);
      }
      50% {
        opacity: 1;
        transform: scale(1.2);
      }
    }

    .scroll-button {
      position: fixed;
      right: clamp(16px, 5vw, 24px);
      bottom: calc(180px + env(safe-area-inset-bottom));
      z-index: 1001;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      margin-right: calc((100vw - min(95vw, 800px)) / 2);
      padding: 0;
      border: none;
      border-radius: 50%;
      background: #007bff;
      color: white;
      box-shadow: 0 2px 10px rgb(0 0 0 / 20%);
      opacity: 0;
      cursor: pointer;
      pointer-events: none;
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(20px);
    }

    .scroll-button.show {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .scroll-button:hover {
      background: #0056b3;
    }

    .scroll-button svg {
      width: 24px;
      height: 24px;
    }

    .context-menu {
      position: fixed;
      z-index: 1002;
      min-width: 160px;
      padding: 8px 0;
      border-radius: 8px;
      background: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      transform: scale(0.95);
      transform-origin: top left;
    }

    .context-menu.show {
      opacity: 1;
      pointer-events: auto;
      transform: scale(1);
    }

    .context-menu-item {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: none;
      color: #333;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .context-menu-item:hover {
      background-color: #f5f5f7;
    }

    .context-menu-item svg {
      width: 18px;
      height: 18px;
      opacity: 0.7;
    }

    .message.editing {
      align-self: center;
      width: 100% !important;
      max-width: 100% !important;
      margin: 1rem 0;
      transition: all 0.3s ease;
    }

    .editing-input-container {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      max-width: min(95vw, 800px);
      margin: 0 auto;
      padding: 8px 16px;
    }

    .editing-input {
      box-sizing: border-box;
      width: 100%;
      min-height: 80px;
      max-height: 400px;
      margin: 0;
      padding: 12px;
      border: 2px solid #007bff;
      border-radius: 8px;
      background: white;
      box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
      font-size: inherit;
      font-family: inherit;
      line-height: 1.5;
      resize: vertical;
      transition: all 0.2s ease;
    }

    .editing-input:focus {
      border-color: #0056b3;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      outline: none;
    }

    .editing-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
      padding: 0 4px;
    }

    .editing-button {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .save-button {
      background: #007bff;
      color: white;
    }

    .save-button:hover {
      background: #0056b3;
    }

    .cancel-button {
      background: #f0f0f0;
      color: #333;
    }

    .cancel-button:hover {
      background: #e0e0e0;
    }

    @media (max-width: 480px) {
      .message.editing {
        margin: 0.5rem 0;
      }

      .editing-input-container {
        max-width: 92vw;
        padding: 8px;
      }

      .editing-input {
        padding: 10px;
        font-size: 16px; /* Prevent zoom on mobile */
      }

      .editing-actions {
        padding: 0;
      }
    }

    main:empty ~ footer {
      display: none;
    }

    .file-preview {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      left: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #64748b;
      font-size: 14px;
    }

    .preview-close {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 4px;
      border: none;
      border-radius: 4px;
      background: none;
      color: #94a3b8;
      cursor: pointer;
    }

    .preview-close:hover {
      background: #f1f5f9;
      color: #64748b;
    }

    .preview-image {
      object-fit: contain;
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
    }

    .preview-document {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border-radius: 8px;
      background: #f8fafc;
      color: #1e293b;
    }

    .preview-document svg {
      width: 24px;
      height: 24px;
      color: #64748b;
    }

    .upload-menu {
      position: absolute;
      right: 0;
      bottom: 100%;
      margin-bottom: 8px;
      padding: 8px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s ease;
      transform: translateY(10px);
    }

    .upload-menu.show {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .upload-option {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      background: none;
      color: #1e293b;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .upload-option:hover {
      background: #f1f5f9;
    }

    .upload-option svg {
      width: 20px;
      height: 20px;
      color: #64748b;
    }

    .chat-input-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 600px;
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 16px;
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }

    .chat-input-wrapper {
      display: flex;
      flex: 1;
      gap: 12px;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      background: white;
      color: #1e293b;
      font-size: 16px;
      transition: all 0.2s;
      min-height: unset;
      max-height: unset;
      resize: none;
    }

    .chat-input:focus {
      outline: none;
      border-color: #2563eb;
      background: white;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .chat-input::placeholder {
      color: #94a3b8;
    }

    .audio {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 10px;
      background: #f0f0f0;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .audio:hover {
      background: #e2e8f0;
    }

    .audio.recording {
      background: #ef4444;
      color: white;
      animation: pulse 1.5s infinite;
    }

    .button-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .image-upload-button,
    .send-button {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .image-upload-button {
      background: #f0f0f0;
      color: #64748b;
    }

    .image-upload-button:hover {
      background: #e2e8f0;
    }

    .send-button {
      background: #2563eb;
      color: white;
    }

    .send-button:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }

    .image-upload-button svg,
    .send-button svg,
    .audio svg {
      width: 24px;
      height: 24px;
    }

    @media (max-width: 640px) {
      .chat-input-container {
        bottom: 16px;
        padding: 8px;
      }

      .chat-input {
        padding: 10px 14px;
      }

      .audio,
      .image-upload-button,
      .send-button {
        width: 36px;
        height: 36px;
      }
    }
  `;
}
