export enum Format {
    Text = "text",
	Structured = "structured",
	Binary = "binary",
	Location = "location",
	Generic = "generic",
};

export enum SubFormat {
	English = "english",
	Spanish = "spanish",
	German = "german",
	JSON = "json",
	URI = "uri",
	XML = "xml",
	HTML = "html",
	ImageBMP = "image/bmp",
	ImageGIF = "image/gif",
	ImageJPEG = "image/jpeg",
	ImageJPG = "image/jpg",
	ImagePNG = "image/png",
	ImageTIFF = "image/tiff",
	AudioMP3 = "audio/mp3",
	TextSF = "text",
	GPS = "gps",
};

export interface Message {
	control?: boolean;          
	format: Format;
	subformat: SubFormat | string; 
	content: string;
	submessages?: Message[];
  }