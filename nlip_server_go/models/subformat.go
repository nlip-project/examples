package models

type Subformat string

const (
	English   Subformat = "english"
	Spanish   Subformat = "spanish"
	German    Subformat = "german"
	JSON      Subformat = "json"
	URI       Subformat = "uri"
	XML       Subformat = "xml"
	HTML      Subformat = "html"
	ImageBMP  Subformat = "image/bmp"
	ImageGIF  Subformat = "image/gif"
	ImageJPEG Subformat = "image/jpeg"
	ImageJPG  Subformat = "image/jpg"
	ImagePNG  Subformat = "image/png"
	ImageTIFF Subformat = "image/tiff"
	AudioMP3  Subformat = "audio/mp3"
	TextSF    Subformat = "text" // not to be confused with Text format
	GPS       Subformat = "gps"

	// TODO: Add the new subformats as they come up
)
