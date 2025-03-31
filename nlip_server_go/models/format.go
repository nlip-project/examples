package models

type Format string

const (
	Text       Format = "text"
	Structured Format = "structured"
	Binary     Format = "binary"
	Location   Format = "location"
	Generic    Format = "generic"
)
