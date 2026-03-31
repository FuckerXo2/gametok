# Android Release Build Instructions

## Build Setup Complete ✅
- Version updated to 1.3.9 (build 49)
- Signing configuration added to build.gradle
- keystore.properties file created

## To Build in Android Studio:

1. **Fill in the keystore password** in `android/keystore.properties`:
   ```
   MYAPP_UPLOAD_STORE_FILE=upload-keystore.jks
   MYAPP_UPLOAD_KEY_ALIAS=upload
   MYAPP_UPLOAD_STORE_PASSWORD=YOUR_PASSWORD_HERE
   MYAPP_UPLOAD_KEY_PASSWORD=YOUR_PASSWORD_HERE
   ```

2. **Open in Android Studio:**
   - Open Android Studio
   - File → Open → Select `gametok/android` folder
   - Wait for Gradle sync to complete

3. **Build Release APK:**
   - Build → Select Build Variant → Choose "release"
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Or use: Build → Generate Signed Bundle / APK

4. **Output Location:**
   - APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Or Build via Command Line:

```bash
cd gametok/android
./gradlew assembleRelease
```

The signed APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Keystore Location:
- File: `android/app/upload-keystore.jks`
- You need to provide the password in `keystore.properties`
