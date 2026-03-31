#!/bin/bash

# Android App Bundle Build Script
# Make sure to fill in the keystore password in android/keystore.properties first!

cd android

echo "🔨 Building Android App Bundle (AAB) for Play Store..."
echo "Version: 1.3.9 (Build 49)"
echo ""

./gradlew bundleRelease

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📦 AAB location: android/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "You can now upload this to Google Play Console"
else
    echo ""
    echo "❌ Build failed. Check the error messages above."
    echo "Make sure you've filled in the keystore password in android/keystore.properties"
fi
