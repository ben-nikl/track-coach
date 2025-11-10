# Track Coach

Quick Expo React Native project.

## Environment Setup (Android)

1. Install Java (Temurin JDK 17 recommended):

```bash
brew install --cask temurin17
```

2. Install Android Platform Tools (for `adb`):

```bash
brew install --cask android-platform-tools
```

3. (Optional) Install full Android SDK via Android Studio if you need an emulator.

4. Ensure environment variables (add to shell profile):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

5. Verify:

```bash
which adb
adb version
```

If `adb` is not found, re-open your terminal or source your profile.

## Scripts

- `npm run env:check` – warns if `adb` is missing.
- `npm run android` – runs env check then launches Expo on Android.

## Troubleshooting `spawn ... adb ENOENT`

This means the `adb` binary cannot be found at expected locations. Fix by installing platform-tools and setting PATH as above. On some systems Expo looks at `/usr/local/share/android-sdk/platform-tools/adb`; you can create that path or set `ANDROID_HOME`.

Example manual install (if Homebrew not desired):

1. Download platform-tools zip from https://developer.android.com/tools/releases/platform-tools
2. Extract and move:

```bash
unzip platform-tools*.zip
mkdir -p /usr/local/share/android-sdk
mv platform-tools /usr/local/share/android-sdk/
export PATH="$PATH:/usr/local/share/android-sdk/platform-tools"
```

## iOS

Use Xcode + simulators: `npm run ios`.

## Web

`npm run web`.

## Notes

React 19 / RN 0.81 per package.json. Keep Expo SDK version aligned (`expo upgrade`) when updating.

