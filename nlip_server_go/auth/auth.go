package auth

import (
	"fmt"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/google"
	"github.com/markbates/goth/providers/openidConnect"
)

func setupProviders() {
	goth.UseProviders(
		google.New(os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("GOOGLE_CLIENT_SECRET"), os.Getenv("GOOGLE_URL_CALLBACK")),
	)

	openidConnect, err := openidConnect.New(
		os.Getenv("CUSTOM_CL IENT_ID"),
		os.Getenv("CUSTOM_CLIENT_SECRET"),
		os.Getenv("CUSTOM_URL_CALLBACK"),
		os.Getenv("CUSTOM_DISCOVERY_URL"),
	)

	if openidConnect != nil {
		goth.UseProviders(openidConnect)
	} else {
		fmt.Println(err)
		panic("openidconnect failed!")
	}
}

func SetupAuth(e *echo.Echo) {
	setupProviders()

	// Base auth URL
	e.GET("/auth/", func(c echo.Context) error {
		return c.HTML(http.StatusOK, "<h1>Login Page</h1><p><a href='/auth/google'>Login with Google</a></p><p><a href='/auth/openid-connect'>Login with Custom OIDC</a></p>")
	})

	// Specific provider URL
	e.GET("/auth/:provider/", func(c echo.Context) error {
		q := c.Request().URL.Query()
		q.Add("provider", c.Param("provider"))
		c.Request().URL.RawQuery = q.Encode()

		req := c.Request()
		res := c.Response().Writer
		if gothUser, err := gothic.CompleteUserAuth(res, req); err == nil {
			return c.JSON(http.StatusOK, gothUser)
		}
		gothic.BeginAuthHandler(res, req)
		return nil
	})

	// Callback, specific to provider
	e.GET("/auth/:provider/callback/", func(c echo.Context) error {
		req := c.Request()
		res := c.Response().Writer
		// user object here stores the access token too
		user, err := gothic.CompleteUserAuth(res, req)
		if err != nil {
			return c.String(http.StatusBadRequest, err.Error())
		}
		return c.JSON(http.StatusOK, user)
	})

}
