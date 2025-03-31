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

import { handleFileUpload } from '../components/network.js';
import { PageElement } from '../helpers/page-element.js';
import { chatInputStyles } from '../styles/chat-input.js';
import { StreamingTranscribe } from '../components/streaming-transcribe.js';

@customElement('page-home')
export class PageHome extends SignalWatcher(PageElement) {
  @query('#text-input') textInput?: HTMLTextAreaElement;
  @query('#image-input') imageInput?: HTMLInputElement;
  @query('#document-input') documentInput?: HTMLInputElement;
  @state() private showUploadMenu = false;
  @state() private uploadStatus = '';
  @state() private statusType: 'success' | 'error' | 'loading' | '' = '';
  @state() private previewImage: string | null = null;
  @state() private previewDocumentName: string | null = null;
  @state() private isRecording = false;
  @state() private isSpeechSupported = true;
  @state() private isTranscribing = false;
  @state() private currentTranscription = '';
  @state() private isTyping = false;
  @state() private currentPartial = '';
  @state() private partialTranscriptions: string[] = [];

  private _typingTimeout: NodeJS.Timeout | null = null;
  private documentInputRef = createRef<HTMLInputElement>();
  private transcribeElementRef = createRef<StreamingTranscribe>();

  constructor() {
    super();
  }

  firstUpdated() {
    super.firstUpdated();

    // Check if speech recognition is supported
    this.checkSpeechSupport();

    // Log component status for debugging
    setTimeout(() => {
      const element = this.renderRoot.querySelector('streaming-transcribe');
      console.log('[PageHome] First updated, element found:', !!element);
      if (element) {
        console.log(
          '[PageHome] Element methods:',
          Object.getOwnPropertyNames(Object.getPrototypeOf(element))
        );
      }
    }, 100);
  }

  private checkSpeechSupport() {
    // Check if browser supports MediaRecorder API
    if (window.MediaRecorder) {
      console.log('[PageHome] MediaRecorder API is supported');
      this.isSpeechSupported = true;
    } else {
      console.warn(
        '[PageHome] MediaRecorder API is not supported in this browser'
      );
      this.isSpeechSupported = false;
    }
  }

  static styles = css`
    ${chatInputStyles}

    :host {
      display: block;
      box-sizing: border-box;
      min-height: 100vh;
      padding: 16px;
      background: #f8fafc;
      color: #1e293b;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: env(safe-area-inset-top) env(safe-area-inset-right)
        env(safe-area-inset-bottom) env(safe-area-inset-left);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
    }

    .logo {
      color: #2563eb;
      font-size: 24px;
    }

    .user-avatar {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      font-weight: 500;
    }

    .main-content {
      display: flex;
      flex-direction: column;
      gap: 32px;
      margin-top: 32px;
    }

    .quick-actions {
      display: flex;
      gap: 12px;
      margin: 24px 0;
    }

    .action-button {
      display: flex;
      flex: 1;
      gap: 8px;
      align-items: center;
      padding: 16px;
      border: none;
      border-radius: 12px;
      background: white;
      color: #1e293b;
      box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-button:hover {
      background: #f8fafc;
      box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
      transform: translateY(-1px);
    }

    .action-button svg {
      width: 24px;
      height: 24px;
      color: #2563eb;
    }

    .title-section {
      margin: 0 0 16px;
    }

    .title {
      margin: 0;
      color: #0f172a;
      font-weight: 600;
      font-size: clamp(32px, 6vw, 48px);
      line-height: 1.2;
    }

    .title span {
      color: #2563eb;
    }

    .search-section {
      display: none; /* Hide the inline search */
    }

    .quick-prompts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }

    .prompt-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 24px;
      border: none;
      border-radius: 16px;
      background: white;
      color: #1e293b;
      box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }

    .prompt-card:hover,
    .prompt-card:focus {
      background: white;
      box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
      transform: translateY(-2px);
    }

    .prompt-card:focus {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }

    .prompt-icon {
      width: 32px;
      height: 32px;
      margin-bottom: 16px;
      color: #2563eb;
    }

    .prompt-title {
      margin: 0;
      color: #1e293b;
      font-weight: 500;
      font-size: 18px;
    }

    @media (max-width: 640px) {
      .quick-actions {
        flex-direction: column;
      }

      .prompt-card {
        padding: 20px;
      }
    }

    @media (min-width: 1024px) {
      .main-content {
        gap: 48px;
      }

      .quick-prompts {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
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

    .status-message {
      position: fixed;
      top: 20px;
      left: 50%;
      z-index: 2000;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      font-weight: 500;
      text-align: center;
      word-break: break-word;
      pointer-events: none;
      transition: opacity 0.3s ease;
      transform: translateX(-50%);
    }

    .status-success {
      background: #4caf50;
      color: white;
    }

    .status-error {
      background: #f44336;
      color: white;
    }

    .status-loading {
      background: #2196f3;
      color: white;
    }

    .hidden-file-input {
      position: absolute;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      border: 0;
      white-space: nowrap;
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

    .chat-input-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      z-index: 1000;
      display: flex;
      gap: 12px;
      width: calc(100% - 32px);
      max-width: 600px;
      padding: 12px;
      border-radius: 16px;
      background: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
      transform: translateX(-50%);
    }

    .chat-input-wrapper {
      display: flex;
      flex: 1;
      gap: 12px;
      align-items: center;
    }

    .voice-input-button,
    .image-upload-button,
    .send-button {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .voice-input-button {
      background: #f0f0f0;
      color: #666;
    }

    .voice-input-button:hover {
      background: #e0e0e0;
    }

    .voice-input-button.recording {
      background: #ef4444;
      color: white;
      animation: pulse 1.5s infinite;
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

    .chat-input {
      flex: 1;
      min-height: unset;
      max-height: unset;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      background: #f8fafc;
      color: #1e293b;
      font-size: 16px;
      resize: none;
      transition: all 0.2s;
    }

    .chat-input:focus {
      border-color: #2563eb;
      background: white;
      box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
      outline: none;
    }

    .chat-input::placeholder {
      color: #94a3b8;
    }

    .button-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .image-upload-button {
      background: #f0f0f0;
      color: #666;
    }

    .image-upload-button:hover {
      background: #e0e0e0;
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
    .voice-input-button svg {
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

      .voice-input-button,
      .image-upload-button,
      .send-button {
        width: 36px;
        height: 36px;
      }
    }

    .transcription-preview {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      left: 0;
      overflow-y: auto;
      max-height: 100px;
      padding: 12px;
      border-radius: 12px;
      background: white;
      color: #64748b;
      box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
      font-size: 14px;
      opacity: 0;
      transition: all 0.3s ease-in-out;
      transform: translateY(10px);
    }

    .transcription-preview.show {
      opacity: 1;
      transform: translateY(0);
    }

    .transcription-preview.typing {
      border-left: 3px solid #2563eb;
      background-color: #f8f9fa;
      font-style: italic;
    }

    .transcription-preview.typing::after {
      content: '';
      position: absolute;
      right: 1rem;
      bottom: 1rem;
      width: 2px;
      height: 1.2em;
      background-color: #2563eb;
      animation: blink 1s step-end infinite;
    }

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }

    .input-container {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    textarea {
      flex-grow: 1;
      overflow: hidden;
      min-height: 40px;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: inherit;
      font-family: inherit;
      resize: none;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background-color: #4285f4;
      color: white;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    button:hover {
      background-color: #3367d6;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    button.recording {
      background-color: #ea4335;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
      100% {
        opacity: 1;
      }
    }

    .partials-display {
      position: absolute;
      bottom: 24px;
      left: 50%;
      width: calc(100% - 32px);
      max-width: 600px;
      padding: 16px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      transform: translateX(-50%);
    }

    .partials-display.show {
      opacity: 1;
      pointer-events: auto;
    }

    .partials-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .partials-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .partial-item {
      padding: 8px;
      border-radius: 4px;
      background: #f8fafc;
      color: #1e293b;
    }

    .typing-indicator-small {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #2563eb;
      animation: blink 1s step-end infinite;
    }

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  `;

  private handleTranscriptionUpdate(event: CustomEvent) {
    const { transcript, isFinal } = event.detail;
    console.log(
      '[PageHome] Received transcription update:',
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
        console.log('[PageHome] Applying final transcription to input');
        inputContainer.classList.remove('typing');
        this.isTyping = false;
        this.currentPartial = '';
      }

      this.requestUpdate();
    } else {
      console.error(
        '[PageHome] Input element not found for transcription update'
      );
    }
  }

  private async toggleTranscription() {
    console.log(
      '[PageHome] Toggle transcription called, isRecording:',
      this.isRecording
    );

    // Directly query the element instead of using the ref
    const element = this.renderRoot.querySelector(
      'streaming-transcribe'
    ) as any;

    if (!element) {
      console.error('[PageHome] Transcribe element not found in DOM');
      this.showStatus('Audio recording component not found', 'error');
      return;
    }

    console.log('[PageHome] Found element:', element);
    console.log(
      '[PageHome] Element methods:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(element))
    );

    try {
      if (!this.isRecording) {
        console.log('[PageHome] Starting recording...');
        this.currentPartial = '';
        this.partialTranscriptions = [];

        if (typeof element.startRecording === 'function') {
          await element.startRecording();
          this.isRecording = true;
          console.log('[PageHome] Recording started successfully');
        } else {
          console.error(
            '[PageHome] startRecording is not a function on the element'
          );
          this.showStatus(
            'Audio recording functionality not available',
            'error'
          );
          return;
        }
      } else {
        console.log('[PageHome] Stopping recording...');

        if (typeof element.stopRecording === 'function') {
          await element.stopRecording();
          this.isRecording = false;
          console.log('[PageHome] Recording stopped successfully');
        } else {
          console.error(
            '[PageHome] stopRecording is not a function on the element'
          );
          this.showStatus(
            'Audio recording functionality not available',
            'error'
          );
          return;
        }
      }
    } catch (error) {
      console.error('[PageHome] Error toggling transcription:', error);

      // Show user-friendly error message
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.showStatus(
          'Microphone access denied. Please allow microphone access and try again.',
          'error'
        );
      } else if (
        error instanceof DOMException &&
        error.name === 'NotFoundError'
      ) {
        this.showStatus(
          'No microphone found. Please connect a microphone and try again.',
          'error'
        );
      } else {
        this.showStatus(
          'Could not start recording. Please try again.',
          'error'
        );
      }

      this.isRecording = false;
    }
  }

  private handleMicrophoneClick() {
    console.log(
      'Microphone clicked, isSpeechSupported:',
      this.isSpeechSupported
    );
    if (this.isSpeechSupported) {
      this.toggleTranscription();
    }
  }

  private _handleInput(e: Event) {
    const input = e.target as HTMLTextAreaElement;
    this.currentTranscription = input.value;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="container">
        ${this.isRecording
          ? html`
              <div
                class="partials-display ${this.partialTranscriptions.length > 0
                  ? 'show'
                  : ''}"
              >
                <div class="partials-header">
                  <span>Live Transcription</span>
                  ${this.isTyping
                    ? html`<div class="typing-indicator-small"></div>`
                    : ''}
                </div>
                <div class="partials-list">
                  ${this.partialTranscriptions.map(
                    (text) => html` <div class="partial-item">${text}</div> `
                  )}
                </div>
              </div>
            `
          : ''}

        <div class="header">
          <div class="logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2zm0 2.84L19.5 12h-1.5v8h-4v-6H10v6H6v-8H4.5L12 4.84z"
              />
            </svg>
          </div>
          <div class="user-avatar">M</div>
        </div>

        <div class="main-content">
          <div class="quick-actions">
            <button
              class="action-button"
              @click=${() => (window.location.href = '/scan')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"
                />
              </svg>
              Scan QR
            </button>
            <button
              class="action-button"
              @click=${() => (window.location.href = '/map')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"
                />
              </svg>
              Map
            </button>
          </div>

          <div class="title-section">
            <h1 class="title">Ask <span>anything</span> you need help with.</h1>
          </div>

          <div class="quick-prompts">
            <button
              class="prompt-card"
              @click=${() =>
                this.navigateToChat('I need a secure AI diagnosis.')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.navigateToChat('I need a secure AI diagnosis.');
                }
              }}
            >
              <svg class="prompt-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"
                />
              </svg>
              <h3 class="prompt-title">I need a secure AI diagnosis.</h3>
            </button>

            <button
              class="prompt-card"
              @click=${() =>
                this.navigateToChat('I want a combined market analysis.')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.navigateToChat('I want a combined market analysis.');
                }
              }}
            >
              <svg class="prompt-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
                />
              </svg>
              <h3 class="prompt-title">I want a combined market analysis.</h3>
            </button>

            <button
              class="prompt-card"
              @click=${() => this.navigateToChat('Find me the best shampoo.')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.navigateToChat('Find me the best shampoo.');
                }
              }}
            >
              <svg class="prompt-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M7 20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-3H7v3zM18 7c-.55 0-1 .45-1 1v5H7V8c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V8c0-.55-.45-1-1-1zm-3-5H9C6.79 2 5 3.79 5 6v1h2V6c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v1h2V6c0-2.21-1.79-4-4-4z"
                />
              </svg>
              <h3 class="prompt-title">Find me the best shampoo.</h3>
            </button>

            <button
              class="prompt-card"
              @click=${() =>
                this.navigateToChat('I want insights into this project.')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.navigateToChat('I want insights into this project.');
                }
              }}
            >
              <svg class="prompt-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
                />
              </svg>
              <h3 class="prompt-title">I want insights into this project.</h3>
            </button>
          </div>
        </div>
      </div>

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
                    ? html`
                        <img
                          class="preview-image"
                          src="${this.previewImage}"
                          alt="Preview"
                        />
                      `
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
                  class="voice-input-button ${this.isRecording
                    ? 'recording'
                    : ''}"
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
                  @click=${() => this.handleDocumentSelect()}
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

            <button
              class="send-button"
              @click=${() => {
                const input = this.renderRoot?.querySelector(
                  '.chat-input'
                ) as HTMLTextAreaElement;
                if (input?.value.trim()) {
                  this.navigateToChat(input.value);
                }
              }}
            >
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

      ${this.uploadStatus
        ? html`
            <div class="status-message status-${this.statusType}">
              ${this.uploadStatus}
            </div>
          `
        : ''}

      <streaming-transcribe
        id="transcribe-component"
        ${ref(this.transcribeElementRef)}
        .hideUI=${true}
        @transcription-update=${this.handleTranscriptionUpdate}
      ></streaming-transcribe>
    `;
  }

  private navigateToChat(prompt?: string) {
    if (!prompt) return;

    const pendingImageData = sessionStorage.getItem('pendingImageData');
    const pendingDocumentData = sessionStorage.getItem('pendingDocumentData');
    const pendingDocumentContent = sessionStorage.getItem(
      'pendingDocumentContent'
    );

    let chatData: any = {
      userPrompt: prompt,
    };

    if (pendingImageData) {
      const imageData = JSON.parse(pendingImageData);
      chatData = {
        ...chatData,
        imageData: imageData.data,
        imageType: imageData.type,
      };
      sessionStorage.removeItem('pendingImageData');
    } else if (pendingDocumentData && pendingDocumentContent) {
      const documentData = JSON.parse(pendingDocumentData);
      chatData = {
        ...chatData,
        documentName: documentData.name,
        documentType: documentData.type,
        documentContent: pendingDocumentContent,
      };
      sessionStorage.removeItem('pendingDocumentData');
      sessionStorage.removeItem('pendingDocumentContent');
    }

    sessionStorage.setItem('chatData', JSON.stringify(chatData));
    Router.go('/chat');
  }

  private handleImageSelect() {
    if (this.imageInput) {
      this.imageInput.click();
    }
  }

  private handleDocumentSelect() {
    if (this.documentInputRef.value) {
      this.documentInputRef.value.click();
    }
  }

  private async handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (
      !['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(file.type)
    ) {
      this.showStatus(
        'Please select a valid image file (JPEG, PNG, GIF, or BMP)',
        'error'
      );
      input.value = '';
      return;
    }

    try {
      const result = await handleFileUpload(file);
      this.showStatus(result.message || 'Upload successful', 'success');

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
    } catch (error) {
      console.error('Upload error:', error);
      this.showStatus(
        error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.',
        'error'
      );
    }
    input.value = '';
  }

  private async handleDocumentUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      const result = await handleFileUpload(file);
      this.showStatus(result.message || 'Upload successful', 'success');

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
    } catch (error) {
      console.error('Upload error:', error);
      this.showStatus(
        error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.',
        'error'
      );
      if (this.documentInputRef.value) {
        this.documentInputRef.value.value = '';
      }
    }
  }

  private showStatus(message: string, type: 'success' | 'error' | 'loading') {
    this.uploadStatus = message;
    this.statusType = type;
    setTimeout(
      () => {
        this.uploadStatus = '';
        this.statusType = '';
      },
      type === 'error' ? 5000 : 3000
    );
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
      setTimeout(() => {
        document.addEventListener('click', this.closeUploadMenu);
      });
    }
  }

  private clearPreview() {
    this.previewImage = null;
    this.previewDocumentName = null;
    sessionStorage.removeItem('pendingImageData');
    sessionStorage.removeItem('pendingDocumentData');
    sessionStorage.removeItem('pendingDocumentContent');
  }

  meta() {
    return {
      title: 'Home',
      description: 'Home page',
    };
  }
}
