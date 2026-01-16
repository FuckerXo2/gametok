// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for socket.io-client ESM resolution issues
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Ensure proper resolution of engine.io-client modules
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
