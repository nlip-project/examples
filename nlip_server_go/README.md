# NLIP Go Server

Welcome to the NLIP Go Server! This project is a Go implementation of the NLIP server. It is built using the Echo web and Goth authentication frameworks. It demonstrates handling of various message types using the NLIP protocol along with LLAMA and LLava models.

## Quickstart

1. Clone the project:
```
git clone git@github.com:nlip-project/nlip_server_go.git
```

2. Configure the environment:
   - Rename the included `.env_example` file to `.env`

   - Edit the `.env` file and set the required variables:
     - Required Variables:
       - `PORT`: The port number servers will listen on
       - `CERT_FILE`: Path to the SSL certificate (for HTTPS)
       - `KEY_FILE`: Path to the SSL key (for HTTPS)
       - `EXECUTABLE_LOCATION`: The location where the built executable will be placed
       - `UPLOAD_PATH`: The directory where uploaded files will be saved
     - Authentication Configuration:
       - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_URL_CALLBACK` for Google OAuth
       - `CUSTOM_CLIENT_ID`, `CUSTOM_CLIENT_SECRET`, `CUSTOM_URL_CALLBACK`, `CUSTOM_DISCOVERY_URL` for custom OpenID Connect (OIDC) provider

3. Deploy the server:
   - Use the script located at `scripts/deploy.sh` to automate the deployment process.
   - **IMPORTANT**: If you are not using the optional MacOS-specific variables, remove the section between `#### TODO` and `#### END_TODO` in `scripts/deploy.sh`.
   - Run the deployment script:
     ```
     ./scripts/deploy.sh
     ```

## Creating a Launch Service

#### MacOS:
  1. Create a plist file in `/Library/LaunchDaemons/` for your executable configuration
  2. Use `launchctl` to load and manage the service

#### Linux:
  1. Create a systemd service file in `/etc/systemd/system/`
  2. Use `systemctl` to load and manage the service

## Logging (if using a Launch Service)

If using a launch service, and writing `nlip` process output to files in `/var/log/`, the one line code in `scripts/monitor_log.sh` can be used to display the logs in the terminal.

## Documentation

This server provides a RESTful API for the NLIP protocol and supports handling various formats.

#### Core Features:
- OAuth authentication with Google and a custom OpenID Connect provider
- File uploads and request handling for various data formats
- Integration with LLAMA and LLava models for text and image processing

Dependencies:
- `Echo`: Web framework for Go
- `Goth`: OAuth2 authentication package for Go
- `Ollama`: Backend for LLAMA and LLava models

Endpoints

1. `/auth/`
   - **GET /auth/**: Provides login links for Google and Custom OpenID Connect (Client should directly use this)
   - **GET /auth/:provider/**: Initiates login for the specified provider (Client indirectly uses this)
   - **GET /auth/:provider/callback/**: Handles the provider's callback and returns user data (Client indirectly uses this)

2. `/nlip/`
   - Handles messages in various formats. This is the main endpoint where all requests should be sent.
   - Text format:
     ```
     {
         "format": "text",
         "subformat": "english",
         "content": "Tell me a fun fact"
     }
     ```
   - Binary (Image) format:
     ```
     {
         "format": "text",
         "subformat": "english",
         "content": "Describe this picture",
         "submessages": [
             {
                 "format": "binary",
                 "subformat": "jpeg",
                 "content": "<base-64-encoded-image>"
             }
         ]
     }
     ```

3. `/upload/`
   - **POST /upload/**: Accepts file uploads using form upload. Saves files to the specified `UPLOAD_PATH` in the `.env` file.

### Packages Overview

1. `auth` package:
   - Handles OAuth provider setup using Goth
   - Defines the routes for authentication using OAuth providers

2. `handlers` package:
   - Main NLIP logic. Implements functions to process different message formats:
     - Text messages are passed to the LLAMA model
     - Binary messages (images) are processed using the LLava model
   - File uploads are supported with validation and optional storage

3. `llms` package:
   - Communicates with Ollama using its API for model inference
   - Supports various formats (currently text and image-based requests)

4. `models` package:
   - Defines data structures for message formats and their validation

## Pitfalls

1. Scripts:
   - Scripts inside the `scripts/` directory should be run from the project root
3. Model availability error:
   - Make sure Ollama has the required models (`llama3.2` for text and `llava` for images). Missing models cause silent failures, which could be hard to debug
4. Number of submessages:
   - Currently allows only one submessage per message
5. Authentication:
   - Tokens are returned to the client as a JSON response, and they must be managed by the client
6. Deployment script:
   - Verify the `.env` file. All required variables must be present

## TODO

1. Extend the `/nlip/` endpoint to handle additional formats and more than one submessage
2. Add a voting mechanism that gets responses from multiple LLMs and decides on a combined answer
2. Add support for LLM response streaming
3. Add better error handling
4. Add unit and integration tests
5. Add more OAuth methods and use the authentication method as described by the spec
