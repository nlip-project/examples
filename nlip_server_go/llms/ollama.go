package llms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Image  string `json:"image"`
	Stream bool   `json:"stream"` // one-go or as a stream? for UI or large requests
}

// Simple request took ~2.5 sec
// If "Stream" is on, will likely work better for client
func GetTextResponse(payload *OllamaRequest) (string, error) {
	// Important TODO: If Ollama does not have desired model, request silently fails and code keeps running.
	// Must have an error check otherwise will cause all sorts of bugs.
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	resp, err := http.Post("http://localhost:11434/api/generate", "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return "", err
	}

	response, ok := result["response"].(string)
	if !ok {
		return "", nil
	}

	return response, nil
}

func GetImageResponse(req *OllamaRequest) (string, error) {
	payload := map[string]interface{}{
		"model":  req.Model,
		"prompt": req.Prompt,
		"images": []string{req.Image},
		"stream": req.Stream,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	resp, err := http.Post("http://localhost:11434/api/generate", "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", fmt.Errorf("failed to send request to Ollama API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama API returned non-200 status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Reads flexibly
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal response JSON: %w", err)
	}

	response, ok := result["response"].(string)
	if !ok {
		return "", fmt.Errorf("ollama API response missing 'response' field or format is invalid")
	}

	return response, nil
}
