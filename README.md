This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Release builds for Google Play

Current release target: version **0.0.2** (Android `versionCode` 2).

Follow these steps before uploading to the Google Play Console:

1. **Create a release keystore** (runs once):
	```powershell
	keytool -genkeypair -v -storetype PKCS12 -keystore android\app\release.keystore -alias release -keyalg RSA -keysize 4096 -validity 9125
	```
	Replace the alias, password, and validity as needed. Keep the resulting keystore secret and back it up securely.

2. **Configure signing credentials:**
		- Copy `android/keystore.properties.example` to `android/keystore.properties` (this file is ignored by git).
		- Fill in the values for `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. The `storeFile` path is resolved relative to `android/app`.
	- In CI, write this file at build time from secured secret variables instead of committing it.

3. **Install dependencies and build the release bundle:**
	```powershell
	cd android
	./gradlew clean bundleRelease
	```
	The build produces an AAB at `android/app/build/outputs/bundle/release/app-release.aab`.

4. **Test the release artifact:**
	- Use `bundletool` or an internal testing track on the Play Console to verify installation.
	- Run through critical user flows on a release build to ensure no regressions.

5. **Upload to Google Play:**
	- Increment `versionName`/`versionCode` in `android/app/build.gradle` for each submission.
	- Attach release notes, screenshots, and complete the Play Console checklists.

Refer to the [React Native publishing guide](https://reactnative.dev/docs/signed-apk-android) for more details on release management.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

## Ship it: Android release builds

1. **Generate a release keystore** (one-time):
	```powershell
	keytool -genkeypair -v -storetype PKCS12 -keystore android\app\my-release-key.jks -alias matrixchatRelease -keyalg RSA -keysize 4096 -validity 3650
	```
2. **Configure signing secrets:**
	- Copy `android/keystore.properties.sample` to `android/keystore.properties`.
	- Replace the placeholder values with the keystore path, alias, and passwords you just used. Keep the populated file out of source control.
	- Alternatively, export the same values as environment variables (`RELEASE_STORE_FILE`, `RELEASE_KEY_ALIAS`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_PASSWORD`).
3. **Build the Play Store bundle:**
	```powershell
	cd android
	.\gradlew.bat bundleRelease
	```
	The signed AAB will be created at `android/app/build/outputs/bundle/release/app-release.aab`.
4. **Smoke-test the release APK (optional but recommended):**
	```powershell
	.\gradlew.bat assembleRelease
	```
	Install the resulting APK on a device/emulator and verify the critical flows before uploading.

> Tip: Each time you bump the `version` in `package.json`, the Android `versionCode` and `versionName` are updated automatically. Remember that Google Play requires the `versionCode` to increase for every upload.

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
