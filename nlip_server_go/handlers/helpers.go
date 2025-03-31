package handlers

import (
	"fmt"
	"nlip/models"

	"github.com/go-playground/validator/v10"
)

func init() {
	validate = validator.New()
}

// TODO: Use these for validation
// Documentation recommends single instance as it does caching
var validate *validator.Validate

func validateStruct(object interface{}) error {
	return validate.Struct(object)
}

var getFormat = map[models.Subformat]models.Format{
	models.English:   models.Text,
	models.Spanish:   models.Text,
	models.German:    models.Text,
	models.JSON:      models.Structured,
	models.URI:       models.Structured,
	models.XML:       models.Structured,
	models.HTML:      models.Structured,
	models.ImageBMP:  models.Binary,
	models.ImageGIF:  models.Binary,
	models.ImageJPEG: models.Binary,
	models.ImageJPG:  models.Binary,
	models.ImagePNG:  models.Binary,
	models.ImageTIFF: models.Binary,
	models.AudioMP3:  models.Binary,
	models.TextSF:    models.Location,
	models.GPS:       models.Location,
}

func validateMessage(msg *models.Message) error {
	// Using a map here to map from subformat to format.
	if msg.Format != getFormat[msg.Subformat] {
		return fmt.Errorf("subformat incompatible with Format type")
	}

	// Need to make sure Format and Subformat are valid!

	// TODO: Add if control != nil && control == true check here
	// so that logistical requests (server policy, parameter negotiating)
	// can be handled here.
	return nil
}
