# React Native Recovery Key Storage

This guide explains how the MatrixChat React Native clone implements the recovery key flow and how to integrate it into new screens or features. It mirrors the native Android behaviour described in `SeedPhraseActivity.kt` and targets the custom VPS endpoints (`/api/api/storeRecoveryKey`, `/verifyRecoveryKey`, `/resetPasswordAdmin`).

## Prerequisites

- React Native 0.81 project configured with the dependencies listed below (already present in `package.json`):
  - `@scure/bip39` for deterministic mnemonic generation.
  - `@noble/hashes` (and utilities) for SHA-256 hashing.
  - `axios` for HTTP requests.
  - Navigation stack (`@react-navigation/native` + native-stack), gesture handler, and safe area context.
- `homeserverUrl` defined in `src/services/matrixApi.ts` that points to the Matrix homeserver / VPS (e.g. `http://195.15.212.132`).
- The React context providers registered in `App.tsx`: `MatrixProvider`, `FlowProvider`, and `PinProvider`.

## High-level flow

1. **Seed generation** – After a successful registration, the app generates a BIP-39 seed phrase and computes its SHA-256 hash.
2. **Transient storage** – The words and hash are stored in `FlowContext` so any screen in the gated flow can access them without persisting to disk.
3. **User confirmation** – `SeedPreviewScreen` displays the words and hash, requiring the user to confirm they have written them down.
4. **Backend persistence** – On confirmation, the app calls `storeRecoveryKey` from `src/services/recoveryApi.ts`, sending `{ user_id, recovery_key_hash }` to the VPS.
5. **PIN gating** – Once the backend acknowledges the hash, the flow proceeds to the PIN setup screen controlled by `PinContext`.

The diagram below summarises the modules:

```
SignupScreen → generateMnemonic + sha256Hex
             → FlowContext.setSeedPayload({ words, hash })
             ↓
Pin stack navigator
  SeedPreviewScreen (shows words/hash)
    onContinue → storeRecoveryKey({ user_id: session.userId, recovery_key_hash: hash })
              → PinScreen (setup or verify)
```

## Implementation steps

### 1. Generate a seed and hash it

Use `@scure/bip39` to produce 12 words and `@noble/hashes` to derive the SHA-256 hex digest. A helper already exists in `src/utils/hash.ts`:

```ts
import { english } from '@scure/bip39/wordlists/english';
import { generateMnemonic } from '@scure/bip39';
import { sha256Hex } from '@utils/hash';

const words = generateMnemonic(english, 128).split(' '); // 12-word phrase
const hash = sha256Hex(words.join(' '));
```

Set the payload in `FlowContext` so you can retrieve it later:

```ts
const { setSeedPayload } = useFlow();
setSeedPayload({ words, hash });
```

### 2. Present the seed preview screen

`SeedPreviewScreen` (located at `src/screens/pin/SeedPreviewScreen.tsx`) expects the words and hash via props:

```tsx
<SeedPreviewScreen
  {...props}
  seedWords={seedPayload.words}
  seedHash={seedPayload.hash}
  onContinue={handleStoreRecoveryKey}
/>
```

The pin stack in `RootNavigator` already wires these props from `FlowContext`.

### 3. Persist the hash on the backend

`src/services/recoveryApi.ts` wraps the VPS endpoints:

```ts
import { storeRecoveryKey as storeKey } from '@services/recoveryApi';
import { useMatrix } from '@contexts/MatrixContext';

const { session } = useMatrix();
const { seedPayload } = useFlow();

const handleStoreRecoveryKey = async () => {
  if (!session || !seedPayload) {
    throw new Error('Missing session or seed payload');
  }

  await storeKey({
    user_id: session.userId,
    recovery_key_hash: seedPayload.hash,
  });

  // success → continue to PIN setup
};
```

`recoveryApi.ts` uses the shared `homeserverUrl` to build the base URL (`${homeserverUrl}/api/api`). No additional configuration is required as long as `matrixApi.ts` is pointing to the correct homeserver.

### 4. Handle success, errors, and cleanup

- On success, clear the seed payload (`setSeedPayload(null)`) to avoid leaving sensitive data in memory once the flow continues.
- Show the `PinScreen` by calling `navigation.replace('PinGate')` (already handled in `RootNavigator`).
- Wrap the request in `try/catch` to surface server or connectivity issues via toasts, modals, or inline errors.

Example handler used by the preview screen:

```ts
const handleStoreRecoveryKey = async () => {
  try {
    await storeKey({ user_id: session.userId, recovery_key_hash: seedPayload.hash });
    setSeedPayload(null);
    navigation.replace('PinGate');
  } catch (error) {
    Alert.alert('Recovery key save failed', getFriendlyMessage(error));
  }
};
```

## Testing the integration

1. Run the app on Android or iOS: `npx react-native run-android` (or `run-ios`).
2. Register a new account to trigger seed generation.
3. On the seed preview screen, open an HTTP inspector (e.g., Charles Proxy, ngrok log, or server logs) and confirm the POST request to `/api/api/storeRecoveryKey` contains:
   ```json
   { "user_id": "@username:matrixchat", "recovery_key_hash": "<64-char hex>" }
   ```
4. Verify the backend responds with HTTP 200/204. The app should automatically advance to the PIN flow.

## Troubleshooting

- **Request failures** – Ensure `homeserverUrl` is reachable from the device/emulator and that the VPS allows plain HTTP if using `http://`. Update Android network security config if HTTPS is required.
- **Missing payload** – If `seedPayload` is `null`, confirm the signup flow calls `setSeedPayload` after generating the mnemonic.
- **Long path issues on Windows** – When building Android locally, keep the project path short (e.g., `C:\rn\matrixchat`) or enable Windows long-path support to avoid CMake limits.
- **Server validation** – The backend only stores hashes. If you need to regenerate the hash manually, ensure you use the exact same word order and lowercase formatting before hashing.

With these steps, the React Native client mirrors the Android app’s recovery key behaviour while keeping sensitive data transient and secure.
