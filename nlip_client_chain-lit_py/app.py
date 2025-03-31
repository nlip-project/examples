import chainlit as cl
import requests
import base64
from dataclasses import dataclass, asdict
from typing import Optional
from fastapi.encoders import jsonable_encoder
from dotenv import load_dotenv
import os


@dataclass
class BaseMessage:
    control: bool
    format: str
    subformat: str
    content: str

    def to_dict(self):
        return asdict(self)

def create_nlip_message(content: str, file_path: Optional[str] = None) -> dict:
    main_message = BaseMessage(
        control=False,
        format='text',
        subformat='english',
        content=content
    )

    if file_path:
        file_type = file_path.split('.')[-1]
        with open(file_path, 'rb') as image_file:
            binary_data = image_file.read()
            base64_data = base64.b64encode(binary_data).decode('utf-8')
        
        image_message = BaseMessage(
            control=False,
            format='binary',
            subformat=file_type,
            content=base64_data
        )

        data_structure = {
            "main_message": main_message,
            "submessages": [image_message]
        }
    else:
        data_structure = {"main_message": main_message}

    return data_structure



def serialize_message(data_structure: dict) -> dict:
    main_message = jsonable_encoder(data_structure["main_message"].to_dict())
    
    if "submessages" in data_structure and data_structure["submessages"]:
        submessages = [jsonable_encoder(msg.to_dict()) for msg in data_structure["submessages"]]
        return {**main_message,"submessages": submessages}
    return main_message


@cl.on_message
async def main(message: cl.Message):
    url = "https://druid.eecs.umich.edu/nlip/"
    load_dotenv()
    pem_file_path = os.getenv("PEM_FILE_PATH")

    content = message.content
    file_path = None
    
    if message.elements:
        for element in message.elements:
            if hasattr(element, 'path'):
                file_path = element.path
                break

    data = create_nlip_message(content, file_path)
    json_data = serialize_message(data)
    # print(json_data)

    response = requests.post(url, json=json_data, verify=pem_file_path)

    response_data = response.json()
    await cl.Message(
        content=response_data.get('content', "No 'content' field in response.")
    ).send()
    
    #{'control': False, 'format': 'text', 'subformat': 'english', 'content': 'hi'}
    