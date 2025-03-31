# nlip_client_chain-lit_py

The Chainlit application serves as a frontend interface that uses NLIP to interact with the backend. It supports either just textual or both textual and binary input (e.g., images, audio files) and converts user inputs into a structured message format before forwarding them to the backend.

## Installation
Prerequisites
- Python 3.8+: Ensure you have Python installed.
- Dependencies: Install required packages using the provided requirements.txt.

Steps to Set Up
- Clone the Repository
- Install Dependencies
```python
pip install -r requirements.txt
```
## Run the frontend
Launch the Chainlit interface
```python
python -m chainlit run app.py
```
Access the Interface
- Open your browser and navigate to the URL displayed in the terminal (e.g., http://localhost:8000).

## Application Workflow
Input Parsing
- Users interact with the Chainlit frontend to provide inputs.
- The application retrieves textual content and, if present, file paths for any uploaded files.

Message Creation
- Textual and inputs are processed into a structured format using the create_nlip_message function.
- Text inputs populate the main_message field, while binary inputs are encoded in base64 and added to the submessages field.

Serialization
- The structured message is serialized into a JSON-compatible format using the serialize_message function.
- The serialized message is structured based on whether binary inputs are present.

Communication with NLIP Backend
- The serialized message is sent to the backend using a secure HTTPS POST request.
- A CA certificate is used to verify the backend's identity, ensuring secure communication.

Response Handling
- The backend processes the message and returns a response.
- The application parses the response and displays the result in the Chainlit interface.

## Features
Dynamic Input Handling:
- Accepts both text and optional file inputs (binary).
- Processes inputs into a structured format for seamless communication with the NLIP backend.

Data Serialization:
- Serializes messages into JSON format compatible with the backend API.

Secure Communication:
- Utilizes HTTPS with a specified CA certificate for secure communication.

Response Handling:
- Displays backend responses directly in the Chainlit interface.
