package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
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

	fmt.Printf(">>> Request incoming with Format: '%s', Subformat: '%s', Content '%s'\n", msg.Format, msg.Subformat, msg.Content)

	switch msg.Format {
	case "text":
		return respondToText(c, &msg)
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
