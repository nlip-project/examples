package main

import (
	"nlip/config"
	"nlip/handlers"
	"os"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
)

func init() {
	if err := godotenv.Load(); err != nil {
		panic("Error loading .env file")
	}
}

func main() {
	e := echo.New()
	config.InitConversationID()
	print(config.ConversationID)
	// Allow for routes ending with or without '/'
	e.Pre(middleware.AddTrailingSlash())

	e.Logger.SetLevel(log.DEBUG)
	e.Logger.SetOutput(os.Stdout)
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Allow all origins only for DEVELOPMENT
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
	}))

	e.POST("/nlip/", handlers.HandleIncomingMessage)
	e.POST("/upload/:tag", handlers.UploadHandler)
	// auth.SetupAuth(e)

	// HTTPS
	certFile := os.Getenv("CERT_FILE")
	keyFile := os.Getenv("KEY_FILE")
	e.Logger.Fatal(e.StartTLS(os.Getenv("PORT"), certFile, keyFile))

	// HTTP
	// To run with HTTP, comment out the above three lines and uncomment the below line
	// Optionally, change the "PORT" environment variable to :80 in the .env file
	// e.Logger.Fatal(e.Start(os.Getenv("PORT")))
}
