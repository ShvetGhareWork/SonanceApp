# Sonance

Sonance is an Android audio player application built with React Native and Expo using the **bare workflow**, enabling custom Java native module integration for advanced audio handling.

## Features & Project Structure

- **Bare Expo Workflow**: Prebuilt with Android native project folder (`/android`) ready for custom Java native modules.
- **Dark Theme**: Global dark theme with electric blue (`#00F0FF`) accent color applied across screens and navigation.
- **React Navigation**: Bottom tab navigation featuring `Library` and `Player` placeholder screens.
- **Zustand State Management**: Configured store ready for audio playback and playlist state.

### Folder Structure

```
├── android/             # Bare Android project directory
├── assets/              # App icons and splash screen assets
├── components/          # Reusable UI components (e.g., Header)
├── constants/           # Global theme colors and spacing constants
├── native/              # Bridge interfaces for future custom native Java modules
├── screens/             # Screen components (LibraryScreen, PlayerScreen)
├── services/            # Placeholder services for future data/extraction logic
├── store/               # Zustand state management stores
├── App.tsx              # Root application component and React Navigation config
├── app.json             # Expo configuration (Package: com.sonance.app)
├── index.ts             # Application entry point
└── tsconfig.json        # TypeScript configuration
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Android Studio](https://developer.android.com/studio) with Android SDK configured (`ANDROID_HOME`)
- Java Development Kit (JDK 17+)
- Android Emulator or physical device with USB debugging enabled

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

### Running the Project

#### 1. Start Metro Bundler with Hot Reload
```bash
npm run start
```
or
```bash
npx expo start
```

#### 2. Run on Android Emulator / Connected Device
To compile and launch the native Android app on a connected emulator or device:
```bash
npm run android
```

#### 3. Native Android Build (Gradle)
To manually compile the debug APK:
```bash
cd android
./gradlew assembleDebug
```
The resulting APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Development Commands

- **Type Check**: `npx tsc --noEmit`
- **Re-generate Android Folder**: `npx expo prebuild --platform android`
