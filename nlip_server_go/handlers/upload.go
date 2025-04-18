package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func UploadHandler(c echo.Context) error {
	tag := c.Param("tag")

	file, err := c.FormFile("file")
	if err != nil {
		return c.String(http.StatusBadRequest, "get file error: "+err.Error())
	}

	src, err := file.Open()
	if err != nil {
		return c.String(http.StatusInternalServerError, "open file error: "+err.Error())
	}
	defer src.Close()

	// Create directory if it doesn't exist
	uploadDir := fmt.Sprintf("%s/%s/", os.Getenv("UPLOAD_PATH"), tag)
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return c.String(http.StatusInternalServerError, "failed to create directory: "+err.Error())
	}

	uuidFilename := uuid.New().String()

	// extension
	fileExt := filepath.Ext(file.Filename)
	uuidFilename += fileExt

	//dst, err := os.Create(os.Getenv("UPLOAD_PATH") + uuidFilename)
	dst, err := os.Create(uploadDir + uuidFilename)
	if err != nil {
		return c.String(http.StatusInternalServerError, "create file error: "+err.Error())
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.String(http.StatusInternalServerError, "save file error: "+err.Error())
	}

	return c.String(http.StatusOK, "file uploaded successfully!")
}
