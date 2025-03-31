import { css } from 'lit';

export const chatInputStyles = css`
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
    z-index: 100;
  }

  .chat-input-wrapper {
    position: relative;
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
    background: #f8fafc;
    color: #1e293b;
    font-size: 16px;
    transition: all 0.2s;
    min-height: unset;
    max-height: unset;
    resize: none;
    position: relative;
  }

  .chat-input-container.typing .chat-input {
    border-color: #2563eb;
    background: white;
  }

  .chat-input-container.typing .chat-input::after {
    content: '';
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 20px;
    background-color: #2563eb;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
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

  .voice-input-button,
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
`;
