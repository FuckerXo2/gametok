// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// NOTE: We no longer mock react-native-google-mobile-ads at the Metro level.
// The app handles Expo Go detection at runtime using Constants.appOwnership.
// This ensures dev builds with native modules work correctly.

module.exports = config;
