from enum import Enum
from dataclasses import dataclass, field
from typing import List

class Format(Enum):
    TEXT = "text"
    STRUCTURED = "structured"
    BINARY = "binary"
    LOCATION = "location"
    GENERIC = "generic"

class SubFormat(Enum):
    ENGLISH = "english"
    SPANISH = "spanish"
    GERMAN = "german"
    JSON = "json"
    URI = "uri"
    XML = "xml"
    HTML = "html"
    IMAGE_BMP = "bmp"
    IMAGE_GIF = "gif"
    IMAGE_JPEG = "jpeg"
    IMAGE_JPG = "jpg"
    IMAGE_PNG = "png"
    IMAGE_TIFF = "tiff"
    AUDIO_MP3 = "audio/mp3"
    TEXT_SF = "text"
    GPS = "gps"

@dataclass
class Message:
    control: bool
    format: Format
    subformat: SubFormat
    content: str
    submessages: List['Message'] = field(default_factory=list)
