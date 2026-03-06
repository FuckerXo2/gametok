// Quick script to reset onboarding flag
// Run: node reset-onboarding.js

const { execSync } = require('child_process');

console.log('🔄 Resetting onboarding flag...');

// For iOS simulator
try {
  execSync(`xcrun simctl spawn booted log stream --predicate 'process == "GameTOK"' --level=debug | grep -m 1 "AsyncStorage" || true`, { stdio: 'inherit' });
} catch (e) {
  // Ignore
}

console.log('\n✅ To see the new onboarding:');
console.log('1. In your app, go to Profile tab');
console.log('2. Scroll down to Settings');
console.log('3. Tap "Clear App Data" (if available)');
console.log('\nOR');
console.log('1. Delete the app from simulator');
console.log('2. Rebuild and run from Xcode');
console.log('\nOR run this in your app console:');
console.log('AsyncStorage.removeItem("hasSeenOnboarding").then(() => console.log("Cleared! Reload app"))');
