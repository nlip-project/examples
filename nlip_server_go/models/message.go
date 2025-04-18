package models

// Using "github.com/go-playground/validator/v10" for validation.
// Currently have "required" validation checks. Need more.

type Message struct {
	Control     *bool      `json:"control,omitempty"`
	Format      Format     `json:"format" validate:"required"`
	Subformat   Subformat  `json:"subformat" validate:"required"`
	Content     string     `json:"content" validate:"required"`
	Submessages *[]Message `json:"submessages,omitempty"`
	Token       *string    `json:"token,omitempty"`     // JSON as string is ok?
	Subtokens   *[]string  `json:"subtokens,omitempty"` // JSON as string is ok?
	Label       string     `json:"label,omitempty"`
}
