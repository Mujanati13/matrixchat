# MatrixChat Android app reference

## High-level architecture

- **App type:** Native Android app backed by the official [Matrix Android SDK](https://github.com/matrix-org/matrix-android-sdk2). The SDK manages authentication, session state, sync, room access, encryption, and content upload.
- **Application entry point:** `MyApplication` (`app/src/main/java/com/me/matrixchat/MyApplication.kt`) creates a single `Matrix` instance, restores the most recent session, opens it, and starts background sync.
- **Global session holder:** `SessionHolder` exposes a static `currentSession` reference that the rest of the app uses to access Matrix services.
- **UI shell:** `MainActivity` decides whether to show the authenticated experience (`RoomListFragment`) or redirect to the login flow. A `SplashActivity` routes new users to `Login` after a short delay.
- **Navigation style:** Largely activity-driven for top-level flows (login, signup, recovery, profile, password lock) and fragment-driven for in-app messaging screens.

## Authentication and account flows

| Flow | Key classes | Notes |
| --- | --- | --- |
| **Login** | `Login.kt` | Uses Matrix SDK `directAuthentication` against the configured homeserver, stores session via `SessionHolder`, opens sync, then requires the local PIN (`PasswordActivity`). |
| **Signup** | `SignUp.kt` | Uses the SDK `RegistrationWizard`. Requires avatar selection, completes the dummy auth stage if prompted, uploads avatar, stores session and opens sync, then redirects to `SeedPhraseActivity` to show a recovery seed. |
| **PIN lock** | `PasswordActivity.java` | Local AES-encrypted PIN stored in `SharedPreferences`. Wrong attempts decrement a counter; hitting zero wipes app data (`pm clear`). |
| **Recovery seed** | `SeedPhraseActivity.kt` | Generates a BIP39 seed phrase (bitcoinj), hashes it with SHA-256, and stores the hash on the backend via `POST /api/api/storeRecoveryKey`. |
| **Password reset** | `RecoveryActivity.kt` | Verifies seed hash via `POST /api/api/verifyRecoveryKey` and triggers an admin reset with `POST /api/api/resetPasswordAdmin`. |

## Homeserver and external endpoints

- **Matrix homeserver base URL:** `http://195.15.212.132` (configured in `res/values/strings.xml` as `homeserver_url`).
- **Matrix SDK calls:**
  - Authentication: `POST /_matrix/client/r0/login` (via SDK `directAuthentication`).
  - Registration: `POST /_matrix/client/r0/register` using the SDK wizard.
  - Sync / timeline / room APIs: handled by the SDK.
  - Media upload: `POST /_matrix/media/r0/upload?filename=...` (used for avatar and attachments).
  - Avatar update: `PUT /_matrix/client/v3/profile/{userId}/avatar_url`.
  - Media fetch: resolved `mxc://` URLs rewritten to `/_matrix/client/v1/media/…` for Glide/OkHttp.
- **Custom backend (same base host) for recovery features:**
  - `POST /api/api/storeRecoveryKey` – body `{ "user_id": "@user:matrixchat", "recovery_key_hash": "..." }`.
  - `POST /api/api/verifyRecoveryKey` – same payload to validate seed.
  - `POST /api/api/resetPasswordAdmin` – body `{ "user_id": "@user:matrixchat", "new_password": "..." }`.

## Core features & data flow

### Session bootstrap & background work

- `MyApplication` registers a `WorkManager` periodic task (`message_checker`) that runs `MessageCheckWorker` every 15 minutes. The worker reads joined room summaries and raises local notifications for unread messages.
- Notifications channel `message_channel` is created both at startup and inside fragments/workers.

### Room list (`RoomListFragment`)

- Observes joined/invited rooms via `session.roomService().getRoomSummariesLive(...)` with active membership filters.
- Automatically joins any pending invites in the feed.
- Creates DM rooms with `session.roomService().createDirectRoom(roomId)` after validating `@user:server` input.
- Provides UI actions: open profile, open search, open About, log out, create room, leave room.
- Loads avatars using `Session.contentUrlResolver()` (converting `mxc://` to HTTPS) plus Glide with bearer tokens.
- Sends notification badge updates when `summary.hasUnreadMessages` is true.

### Room detail (`RoomDetailFragment`)

- Opens a specific room via `session.getRoom(roomId)` and joins if the membership is not JOIN.
- Displays timeline using `Timeline` API with a `MessagesListAdapter` from ChatKit.
- Sends text via `room.sendService().sendTextMessage`.
- Supports image attachments via `ContentAttachmentData` + `sendMedia`; handles encrypted attachments by fetching the encrypted file (`OkHttp`), decrypting with AES-CTR via metadata in the event, and caching the plaintext file locally.
- Marks messages as read, reports typing notifications, and resolves avatars for room and participants.

### Search (`SearchActivity`)

- Uses `session.userService().searchUsersDirectory(query, limit, excludedIds)`.
- Shows results in `RecyclerView` (`SearchAdapter`), with copy-to-clipboard shortcuts.

### Profile management (`ProfileActivity`)

- Shows current or target user info (when opened from `RoomDetailFragment` with extras).
- Lets current user upload or clear an avatar via the same media + profile APIs used during sign-up.
- Supports logout (signing out via `session.signOutService().signOut(true)`), and quick links to recovery flow.

### Seed recovery utilities

- Seed phrase display uses custom `SeedView` components laid out in `activity_seed_phrase`.
- Copy actions use Android clipboard helpers across seed and profile screens.

### UI libraries & components

- Chat UI: [Stfalcon ChatKit](https://github.com/stfalcon-studio/ChatKit) for dialog lists and message views.
- Image loading: Glide (room lists, messages) + Picasso (some avatar helpers) + TextDrawable fallback for initials.
- Kotlin coroutines for async Matrix calls.

## Security & storage considerations

- Local PIN stored encrypted with AES-CBC; IV and key kept in `SharedPreferences`. `MAX_ATTEMPTS = 3` before data wipe.
- Seed phrase is only stored hashed (SHA-256) on backend; plaintext is shown once and copyable.
- App allows cleartext traffic (`usesCleartextTraffic="true"`) to reach the homeserver IP over HTTP.

## Background service integration (VPS linking)

- All Matrix traffic and custom recovery endpoints talk to the bare IP `195.15.212.132`, implying the homeserver and recovery APIs reside on the same VPS.
- Avatar uploads & media downloads go through the Matrix media endpoints running on that host.
- Recovery flows hit `/api/api/*` paths; exact server implementation is not present, but the Android app expects 200 OK on success (no response body).

## Key takeaways for the React Native port

1. **Reuse Matrix APIs:** The clone must authenticate, sync, and manage rooms using Matrix client APIs compatible with the homeserver at `http://195.15.212.132`.
2. **Implement custom recovery endpoints:** Mirror the POST requests to `/api/api/storeRecoveryKey`, `/api/api/verifyRecoveryKey`, and `/api/api/resetPasswordAdmin`.
3. **Replicate PIN lock logic:** Provide local encrypted storage with attempt throttling and data wipe semantics.
4. **Match messaging UX:** Support room list with unread badges, invitations auto-join, direct-room creation, timeline rendering, text + encrypted image sending, typing indicators, and read receipts.
5. **Profile & media management:** Allow avatar upload/update via Matrix media/profile endpoints, and display avatars by resolving `mxc://` URLs with bearer tokens.
6. **Background notifications:** Schedule periodic background checks (or push notifications) for unread counts if real-time sync is unavailable in the RN environment.
7. **Seed phrase flow:** Generate mnemonic, hash it (SHA-256), send to backend, and use for password recovery through the same endpoints.

Use this document as the baseline checklist when implementing the React Native clone.
