package config

import (
	"github.com/google/uuid"
)

type UsableLLMs struct {
	Ollama   bool
	ChatGPT  bool
	ClaudeAI bool
	DeepSeek bool
	Gemini   bool
}

var ConversationID string
var LLMs UsableLLMs

var StoredQuery string
var OllamaResponse string
var ChatGPTResponse string
var GeminiResponse string
var DeepSeekResponse string
var ClaudeAIResponse string

func InitConversationID() {
	ConversationID = uuid.New().String()
	LLMs = UsableLLMs{
		Ollama:   true,
		ChatGPT:  false,
		ClaudeAI: false,
		DeepSeek: false,
		Gemini:   false,
	}

	// Reset responses
	StoredQuery = ""
	OllamaResponse = ""
	ChatGPTResponse = ""
	DeepSeekResponse = ""
	GeminiResponse = ""
	ClaudeAIResponse = ""

}
