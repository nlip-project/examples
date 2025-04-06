[![Built with pwa-lit-template](https://img.shields.io/badge/built%20with-pwa--lit--template-blue)](https://github.com/IBM/pwa-lit-template 'Built with pwa-lit-template')

# NLIP-PWA

This is a Progressive Web App for demonstrating the Natural Language Interaction Protocol in application.

## Getting started

### Quick Start

Start the development environment using docker compose:

```
version: '3.8'
services:
  app:
  	container_name: nlip_pwa
    build: .
    ports:
      - "8000:8000" # Modify this line according to your local port
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
```

Then run:

```
docker compose up -d
```

### Prerequisites

- [node.js](https://nodejs.org)

Furthermore, this project is built on [TypeScript](https://www.typescriptlang.org) with the intention of improving the developer experience.

### Install the dependencies

```bash
npm install
```

### Running the Application

The application consists of two parts: the client and the server. Both need to be running for full functionality, especially for the speech-to-text feature.

#### 1. Start the server

The server handles speech-to-text transcription and other API requests. To start the server:

```bash
cd server
npm install  # Only needed the first time
npm start
```

This will start the server on `http://localhost:3000`.

#### 2. Start the client

In a new terminal window, navigate to the project root and run:

```bash
npm start
```

This command serves the app at `http://localhost:8000`.

### Building for production

```bash
npm run build
```

This will create a `dist` folder with the compiled application.

## Features

### Speech-to-Text Functionality

The application includes speech-to-text functionality that allows users to input text by speaking. This feature is available on both the home page and the chat page.

#### How to use Speech-to-Text:

1. Look for the microphone button to the left of the text input field.
2. Click the microphone button to start recording.
3. Speak clearly into your microphone.
4. Click the button again to stop recording.
5. The application will process your speech and convert it to text in the input field.

#### Requirements for Speech-to-Text:

- A modern browser that supports the MediaRecorder API (Chrome, Firefox, Edge, Safari)
- Microphone access (you'll be prompted to allow microphone access)
- The server must be running to process the audio transcription

#### Troubleshooting Speech-to-Text:

- If the microphone button doesn't appear, your browser may not support the required APIs.
- If you see an error about microphone access, make sure you've granted permission to use your microphone.
- If transcription fails, ensure the server is running at `http://localhost:3000`.

## Development

### Project Structure

- `src/` - Client-side source code
  - `components/` - Web components
  - `pages/` - Application pages
  - `services/` - Service classes including speech-to-text
- `server/` - Server-side code
  - `src/` - Server source code
  - `api/` - API endpoints
  - `services/` - Server services including speech-to-text processing

### Speech-to-Text Implementation

The speech-to-text functionality is implemented using:

1. **Client-side**: The `StreamingTranscribe` component in `src/components/streaming-transcribe.ts` handles recording audio using the MediaRecorder API and streaming it to the server using Server-Sent Events (SSE).
2. **Server-side**: The transcription API endpoint in `server/src/api/transcribe.ts` processes the audio using Google Cloud Speech-to-Text API.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
