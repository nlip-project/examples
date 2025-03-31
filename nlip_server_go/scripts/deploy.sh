#!/bin/bash

# .env file expected to be in project root, where this script is ran
ENV_FILE=".env"

REQUIRED_VARS=("PORT" "CERT_FILE" "KEY_FILE" "EXECUTABLE_LOCATION")
OPTIONAL_VARS=("KEYCHAIN_PASSWORD" "CERT_NAME" "PLIST_PATH" "KEYCHAIN_DATABASE")

if [ -f "$ENV_FILE" ]; then
  echo ".env file found. Exporting environment variables."
  set -a
  source "$ENV_FILE"
  set +a
else
  echo ".env file not found. Exiting."
  exit 1
fi

# Making sure all required variables exist
echo "Validating required variables..."
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo "Error: $VAR is not set. This is a required variable. Exiting."
        exit 1
    fi
done
echo "All required variables are set."


# Remove existing executable
# if [ -f "$EXECUTABLE_LOCATION" ]; then
#   echo "Removing existing executable at $EXECUTABLE_LOCATION..."
#   rm -f "$EXECUTABLE_LOCATION"
# fi

# Build the new executable
echo "Building the Go project..."
sudo go build -o $EXECUTABLE_LOCATION
if [ $? -ne 0 ]; then
  echo "Build failed. Exiting."
  exit 1
fi
echo "Build succeeded."


############################# START_TODO: If NOT using Keychain or NOT on MacOS, remove this section until END_TODO #############################
# Making sure all optional variables exist, IF using this section
  echo "Validating optional variables..."
  for VAR in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo "Error: $VAR is not set. This is a optional variable, but you must remove this section from the script. Exiting."
        exit 1
    fi
  done

echo "Unlocking the keychain..."
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_DATABASE"
if [ $? -ne 0 ]; then
  echo "Failed to unlock keychain. Exiting."
  exit 1
fi

echo "Checking if the executable is already signed..."
codesign -v "$EXECUTABLE_LOCATION" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "The executable is already signed. Skipping code signing."
else
  echo "The executable is not signed. Proceeding with code signing..."
  codesign -s "$CERT_NAME" "$EXECUTABLE_LOCATION"
  if [ $? -ne 0 ]; then
    echo "Code signing failed. Exiting."
    exit 1
  fi
  echo "Code signing succeeded."
fi
############################# END_TODO: If NOT using Keychain or NOT on MacOS, remove this section starting from TODO #############################


# set permissions for the executable
echo "Setting permissions for the executable..."
sudo chmod +x $EXECUTABLE_LOCATION
# root privileges
sudo chown root:wheel $EXECUTABLE_LOCATION

############################# START_TODO: If NOT using a launch configuration (e.g., .plist on MacOS), remove this section until END_TODO #############################
# Important: This seems necessary to process changes correctly due to a race condition
sleep 0.5

# Reload the launchd service
echo "Reloading the launchd service..."
sudo launchctl unload $PLIST_PATH 2>/dev/null
sudo launchctl load $PLIST_PATH

echo "Deployment complete. The service has been reloaded."
############################# END_TODO: If NOT using a launch configuration (e.g., .plist on MacOS), remove this section until END_TODO #############################
