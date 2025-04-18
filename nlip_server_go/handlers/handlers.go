package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"nlip/config"
	"nlip/llms"
	"nlip/models"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/labstack/echo/v4"
)

var saveImage bool = false

var basePath string

func StartConversationHandler(c echo.Context) error {
	var msg models.Message
	if err := c.Bind(&msg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
	}

	if err := validate.Struct(&msg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed", "details": err.Error()})
	}

	// Hardcoded response:
	response := &models.Message{
		Format:    models.Text,
		Subformat: models.English,
		Content: "Use Authentication token 0x0567564.\n" +
			"Authentication-token must be specified.\n" +
			"Only last 5 exchanges will be remembered by the server.\n" +
			"You need to remember and provide all exchanges older than the last 5.",
	}
	return c.JSON(http.StatusOK, response)
}

func HandleIncomingMessage(c echo.Context) error {
	var msg models.Message
	if err := c.Bind(&msg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
	}

	if err := validate.Struct(&msg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed", "details": err.Error()})
	}

	fmt.Printf(">>> Reque	st incoming with Format: '%s', Subformat: '%s', Content '%s'\n", msg.Format, msg.Subformat, msg.Content)
	if msg.Control != nil && *msg.Control && msg.Label == "LLMs" {
		return updateLLMs(c, &msg)
	}

	if msg.Label == "image" {
		return respondToTextURI(c)
	}
	if msg.Format == "redirect" {
		return responseToRedirectFinal(c, &msg)
	}
	switch msg.Format {
	case "text":
		if !config.LLMs.ChatGPT && !config.LLMs.ClaudeAI && !config.LLMs.DeepSeek && !config.LLMs.Gemini && config.LLMs.Ollama { //default response
			return respondToText(c, &msg)
		}
		return respondToTextRedirect(c, &msg)
	case "authentication":
		return c.NoContent(http.StatusInternalServerError)
	case "structured":
		return c.NoContent(http.StatusInternalServerError)
	case "binary":
		return respondToImage(c, &msg, nil)
	case "location":
		return c.NoContent(http.StatusInternalServerError)
	case "generic":
		return c.NoContent(http.StatusInternalServerError)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
	}
}

func respondToText(c echo.Context, msg *models.Message) error {
	if msg.Submessages != nil {
		// If here, that means there was a submessage.
		// Assuming there can only be one submessage for now
		// Later implementation will allow for more submessages
		// Also assuming this is of type binary
		if len(*msg.Submessages) > 1 || (*msg.Submessages)[0].Format != "binary" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
		}

		// Respond to "submessage" image with the main message's prompt
		return respondToImage(c, &(*msg.Submessages)[0], &msg.Content)
	}

	// If here, then it's a regular text type message.
	payload := llms.OllamaRequest{
		Model:  "llama3.2",
		Prompt: msg.Content,
		Stream: false,
	}

	resp, err := llms.GetTextResponse(&payload)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Bad request: " + err.Error()})
	}

	response := models.Message{
		Format:    "text",
		Subformat: "english",
		Content:   resp,
	}

	fmt.Printf("<<< Response outgoing with Format: '%s', Subformat: '%s', Content '%s'\n", response.Format, response.Subformat, response.Content)
	return c.JSON(http.StatusOK, response)
}

// Save the base64 encoded version of the image in respective paths
func saveImageAsBase64(imagePath, base64Path string) error {
	imageData, err := os.ReadFile(imagePath)
	if err != nil {
		return fmt.Errorf("failed to read image: %w", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(imageData)
	err = os.WriteFile(base64Path, []byte(base64Data), 0644)
	if err != nil {
		return fmt.Errorf("failed to save base64 data: %w", err)
	}

	return nil
}

// Read the base64 file and use it in LLM request
func readBase64ForLLM(base64Path string) (string, error) {
	data, err := os.ReadFile(base64Path)
	if err != nil {
		return "", fmt.Errorf("failed to read base64 file: %w", err)
	}
	return string(data), nil
}

// Test function for base64 encoding of saved images and cache
func respondToTextURI(c echo.Context) error {

	// Store the base64 image
	err := saveImageAsBase64("/Users/razeenmaroof/Jamin/image.png", "/Users/razeenmaroof/Jamin/imageb64.b64")
	if err != nil {
		fmt.Println("Error saving base64:", err)
		return nil
	}

	// Read the saved base64 file
	base64Data, err := readBase64ForLLM("/Users/razeenmaroof/Jamin/imageb64.b64")
	if err != nil {
		fmt.Println("Error reading base64:", err)
		return nil
	}

	// Use it in LLM request
	payload := llms.OllamaRequest{
		Model:  "llava",
		Prompt: "What do you see in this image",
		Image:  base64Data,
		Stream: false,
	}

	ollamaResponse, err := llms.GetImageResponse(&payload)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to get response from Ollama", "details": err.Error()})
	}

	jsonResp := models.Message{
		Format:    "text",
		Subformat: "english",
		Content:   ollamaResponse,
	}

	prettyJSON, err := json.MarshalIndent(jsonResp, "", "  ")
	if err != nil {
		fmt.Println("Failed to generate JSON:", err)
		return c.NoContent(http.StatusInternalServerError)
	}
	fmt.Printf("@@@ Response is @@@\n%s\n@@@-------------@@@\n", string(prettyJSON))
	return c.JSON(http.StatusOK, jsonResp)
}

// END Large Data Upload

// START Redirecting Backend
func updateLLMs(c echo.Context, msg *models.Message) error {
	if msg.Submessages != nil {
		// Reset all LLMs to false before updating
		config.LLMs.ChatGPT = false
		config.LLMs.Ollama = false
		config.LLMs.ClaudeAI = false
		config.LLMs.DeepSeek = false
		config.LLMs.Gemini = false
		for _, submsg := range *msg.Submessages {
			if submsg.Format == "text" && submsg.Subformat == "english" {
				llmName := strings.TrimSpace(submsg.Content)
				switch llmName {
				case "ChatGPT":
					config.LLMs.ChatGPT = true
				case "Ollama":
					config.LLMs.Ollama = true
				case "ClaudeAI":
					config.LLMs.ClaudeAI = true
				case "DeepSeek":
					config.LLMs.DeepSeek = true
				case "Gemini":
					config.LLMs.Gemini = true
				}
			}
		}

		fmt.Println(">>> Updated LLM configuration:")
		fmt.Printf("    ChatGPT:  %v\n", config.LLMs.ChatGPT)
		fmt.Printf("    Ollama:   %v\n", config.LLMs.Ollama)
		fmt.Printf("    ClaudeAI: %v\n", config.LLMs.ClaudeAI)
		fmt.Printf("    DeepSeek: %v\n", config.LLMs.DeepSeek)
		fmt.Printf("    Gemini:   %v\n", config.LLMs.Gemini)

		return c.NoContent(http.StatusOK)
	}
	return c.NoContent(http.StatusInternalServerError)
}

func respondToTextRedirect(c echo.Context, msg *models.Message) error {
	response := models.Message{
		Format:    "text",
		Subformat: "english",
		Content:   "No free LLMS enabled",
	}
	submessages := []models.Message{
		{
			Format:    "token",
			Subformat: "conversation ID",
			Content:   config.ConversationID,
		},
	}
	config.StoredQuery = msg.Content
	if config.LLMs.Ollama {
		payload := llms.OllamaRequest{
			Model:  "llama3.2",
			Prompt: msg.Content,
			Stream: false,
		}

		resp, err := llms.GetTextResponse(&payload)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Bad request: " + err.Error()})
		}

		if !config.LLMs.ChatGPT && !config.LLMs.DeepSeek && !config.LLMs.Gemini && !config.LLMs.ClaudeAI {
			response = models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   resp,
			}
		} else {
			// Store Ollama response globally
			config.OllamaResponse = resp
		}
	}

	if config.LLMs.ChatGPT {
		submessages = append(submessages,
			models.Message{
				Format:    "structured",
				Subformat: "uri",
				Content:   "https://chatgpt.com/",
				Label:     "ChatGPT",
			},
		)
	}
	if config.LLMs.ClaudeAI {
		submessages = append(submessages,
			models.Message{
				Format:    "structured",
				Subformat: "uri",
				Content:   "https://claude.ai/new",
				Label:     "ClaudeAI",
			},
		)
	}
	if config.LLMs.Gemini {
		submessages = append(submessages,
			models.Message{
				Format:    "structured",
				Subformat: "uri",
				Content:   "https://gemini.google.com/app",
				Label:     "Gemini",
			},
		)
	}
	if config.LLMs.DeepSeek {
		submessages = append(submessages,
			models.Message{
				Format:    "structured",
				Subformat: "uri",
				Content:   "https://chat.deepseek.com/",
				Label:     "DeepSeek",
			},
		)
	}

	control := true
	response = models.Message{
		Control:     &control,
		Format:      "redirect",
		Subformat:   "english",
		Content:     "redirect message",
		Submessages: &submessages,
	}

	fmt.Printf("<<< Response outgoing with Format: '%s', Subformat: '%s', Content '%s'\n", response.Format, response.Subformat, response.Content)
	return c.JSON(http.StatusOK, response)
}

func responseToRedirectFinal(c echo.Context, msg *models.Message) error {
	submessages := []models.Message{
		{
			Format:    "token",
			Subformat: "conversation ID",
			Content:   config.ConversationID,
		},
		{
			Format:    "text",
			Subformat: "english",
			Content:   config.StoredQuery,
		},
	}

	if msg.Submessages != nil {
		for _, submsg := range *msg.Submessages {
			if submsg.Label == "ChatGPT" {
				config.ChatGPTResponse = submsg.Content
			}
			if submsg.Label == "ClaudeAI" {
				config.ClaudeAIResponse = submsg.Content
			}
			if submsg.Label == "DeepSeek" {
				config.DeepSeekResponse = submsg.Content
			}
			if submsg.Label == "Gemini" {
				config.GeminiResponse = submsg.Content
			}
		}
	}

	if config.LLMs.Ollama {
		submessages = append(submessages,
			models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   config.OllamaResponse,
				Label:     "Ollama",
			},
		)
	}

	if config.LLMs.ChatGPT {
		submessages = append(submessages,
			models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   config.ChatGPTResponse,
				Label:     "ChatGPT",
			},
		)
	}
	if config.LLMs.DeepSeek {
		submessages = append(submessages,
			models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   config.DeepSeekResponse,
				Label:     "DeepSeek",
			},
		)
	}
	if config.LLMs.Gemini {
		submessages = append(submessages,
			models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   config.GeminiResponse,
				Label:     "Gemini",
			},
		)
	}
	if config.LLMs.ClaudeAI {
		submessages = append(submessages,
			models.Message{
				Format:    "text",
				Subformat: "english",
				Content:   config.ClaudeAIResponse,
				Label:     "ClaudeAI",
			},
		)
	}

	response := models.Message{
		Format:      "text",
		Subformat:   "english",
		Content:     "Aggregate response",
		Submessages: &submessages,
	}
	return c.JSON(http.StatusOK, response)
}

// END Redirecting Backend

func respondToImage(c echo.Context, msg *models.Message, requestPrompt *string) error {
	// For now binary only supports images
	if !isValidImageSubformat(msg.Subformat) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid format or subformat"})
	}

	if saveImage {
		imageData, err := base64.StdEncoding.DecodeString(msg.Content)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to decode base64 content"})
		}

		uniqueID := uuid.New().String()
		extension := strings.ToLower(string(msg.Subformat))
		filename := fmt.Sprintf("%s.%s", uniqueID, extension)
		filepath := filepath.Join(basePath, filename)

		if _, err := os.Stat(basePath); os.IsNotExist(err) {
			if err := os.Mkdir(basePath, 0755); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{
					"error": "Unable to create uploads directory",
				})
			}
		}

		if err := os.WriteFile(filepath, imageData, 0644); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Unable to save file"})
		}
	}

	// If there is some prompt passed to the function, use that when
	// talking to the LLava model
	var ollamaPrompt string
	if requestPrompt == nil {
		ollamaPrompt = "What do you see in this image?"
	} else {
		ollamaPrompt = *requestPrompt
	}

	payload := llms.OllamaRequest{
		Model:  "llava",
		Prompt: ollamaPrompt,
		Image:  msg.Content,
		Stream: false,
	}

	ollamaResponse, err := llms.GetImageResponse(&payload)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to get response from Ollama", "details": err.Error()})
	}

	jsonResp := models.Message{
		Format:    "text",
		Subformat: "english",
		Content:   ollamaResponse,
	}

	prettyJSON, err := json.MarshalIndent(jsonResp, "", "  ")
	if err != nil {
		fmt.Println("Failed to generate JSON:", err)
		return c.NoContent(http.StatusInternalServerError)
	}
	fmt.Printf("@@@ Response is @@@\n%s\n@@@-------------@@@\n", string(prettyJSON))
	return c.JSON(http.StatusOK, jsonResp)
}

func isValidImageSubformat(subformat models.Subformat) bool {
	switch strings.ToLower(string(subformat)) {
	case "jpeg", "jpg", "png", "gif", "bmp":
		return true
	default:
		return false
	}
}
