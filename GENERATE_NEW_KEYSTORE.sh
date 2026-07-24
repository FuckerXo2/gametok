#!/bin/bash

# WARNING: Only use this if you've lost your keystore password!
# You'll need to contact Google Play support to update your app signing key.

echo "⚠️  WARNING: This will create a NEW keystore!"
echo "You'll need to contact Google Play support to update your signing key."
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Creating new keystore..."

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/app/upload-keystore-new.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass vogeza2024 \
  -keypass vogeza2024 \
  -dname "CN=GameTOK, OU=Mobile, O=Vogeza, L=Unknown, ST=Unknown, C=US"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ New keystore created: android/app/upload-keystore-new.jks"
    echo "Password: vogeza2024"
    echo ""
    echo "⚠️  IMPORTANT: You must contact Google Play support to update your signing key!"
    echo "See: https://support.google.com/googleplay/android-developer/answer/7384423"
fi
