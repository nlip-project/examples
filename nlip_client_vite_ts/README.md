# nlip_client_vite_ts
The React/Typescript application serves as a frontend that uses NLIP to interact with the NLIP backend. It supports both textual and binary input (e.g., images) and converts user inputs into a structured NLIP message format before forwarding them to the backend and subsequently receiving a response.

## Set Up
### Prerequisites
- Node/npm: Ensure you have Node/npm installed.

### Steps
- Clone the Repository

```git clone https://github.com/nlip-project/nlip_client_vite_ts.git```
- Install Dependencies

```npm i```

## Using the App
- Run the Application

```npm run dev```

This will build the application and start a development server using Vite on port 5173.

- Access the Interface

Open your browser and navigate to the URL displayed in the terminal (e.g., http://localhost:5173).

## Application Workflow
### Input Parsing

- Users interact with the frontend to provide inputs.
- The application retrieves textual content and, if present, base64 encodings for any uploaded binary files (e.g., images).

### Message Creation
- User inputs are processed into a NLIP structured format.
- Text inputs populate the format,subformat,content fields
- Binary inputs are encoded in base64 and added to the submessages field of a text NLIP message.

### Serialization
- The structured message is serialized into a JSON-compatible format.
- Text Request
  
```
{
    "format": “text”,
    "subformat": “english”,
    "content": "Tell me a fun fact",
}
```

- Binary Request

```
{
    "format": “text”,
    "subformat": “english”,
    "content": "Describe this picture",
    "submessages": [
        {
            "format": "binary",
            "subformat": "jpeg",
            "content": <base-64-encoding>
        }
    ]
}
```

### Communication with NLIP Backend
- The serialized message is sent to the NLIP backend as a secure HTTPS POST request.
- A rootCA certificate is used for SSL certification.

### Response Handling
- The backend processes the message and returns a response.
- The application parses the response and displays it on the frontend.

