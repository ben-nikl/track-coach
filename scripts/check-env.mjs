#!/usr/bin/env node
// Simple environment check for Android adb presence.
// Non-fatal: only warns if not found.

import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const candidates = [];

const envHomes = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
for (const base of envHomes) {
  candidates.push(path.join(base, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'));
}

// Common macOS/Linux locations
candidates.push('/usr/local/share/android-sdk/platform-tools/' + (process.platform === 'win32' ? 'adb.exe' : 'adb'));
candidates.push(path.join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'));

const found = candidates.find(p => existsSync(p));

if (!found) {
  console.warn('[env-check] Android adb not found. Expo Android commands may fail.');
  console.warn('Install platform-tools and ensure ANDROID_HOME or ANDROID_SDK_ROOT is set. Examples:');
  console.warn('  brew install --cask android-platform-tools');
  console.warn('  export ANDROID_HOME="$HOME/Library/Android/sdk"');
  console.warn('  export PATH="$PATH:$ANDROID_HOME/platform-tools"');
} else {
  console.log('[env-check] adb found at: ' + found);
}
