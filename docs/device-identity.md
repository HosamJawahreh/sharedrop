# Device identity

ShareDrop uses a **local, persistent device identity** — not an account.

## Model

```text
ShareDropDeviceIdentity
{
  deviceId      // persistent random id (dev_…)
  displayName   // user-defined or generated "My …"
  deviceType
  platform
  browser
  isCustomName
  createdAt
  updatedAt
}
```

### Identity layers

| Layer       | Lifetime                    | Purpose                                                       |
| ----------- | --------------------------- | ------------------------------------------------------------- |
| `deviceId`  | Persisted in `localStorage` | Stable ShareDrop device identity for presence / saved devices |
| `sessionId` | New every page load         | Ephemeral connection/session identity                         |

## Name priority

1. User-defined device name
2. Persisted generated name
3. Safe browser/platform-derived type (`My iPhone`, `My Android Phone`, …)

ShareDrop does **not** read OS account names, contacts, advertising IDs, MAC/IP addresses, or hardware serials.

## Validation

- Max length: 64 characters (`PROTOCOL.MAX_DISPLAY_NAME_LENGTH`)
- Empty / whitespace-only names rejected
- Unicode (including Arabic) and emoji allowed
- Control characters stripped
- Whitespace collapsed

## Privacy

- Identity is stored **locally** (`sharedrop.deviceIdentity.v1`)
- Only the fields needed for presence are sent to the signaling server (`deviceId`, `sessionId`, `displayName`, type/platform/browser/status)
- No account is required

## Saved devices

Saved peers are a **local convenience list** (`sharedrop.savedDevices.v1`).

```text
SavedDevice { deviceId, displayName, deviceType, platform, lastSeenAt, lastConnectedAt }
```

### Security

> Saved device ≠ trusted device.

- Online matching uses **deviceId from current presence**, never display name alone
- Connection authorization still uses the existing secure WebRTC session negotiation (request / accept)
- Knowing a `displayName` or guessing a `deviceId` does not bypass accept/reject
- Cryptographic peer identity is an intentional future extension point (not implemented in Phase 8)

### Behavior

- Saved devices remain visible when offline
- When presence rediscovers the same `deviceId`, status becomes **Online** without reload
- Selecting an offline saved device does **not** start a connection
- Users can rename, remove, or **Forget saved devices**
- Saved-device lists are **not** uploaded to the server
- UI lists them under **Your devices** (online first) above **Nearby**
- Connecting to a saved Online device always opens a fresh WebRTC session

## This device

The home screen shows **This device** with the local display name. The current device never appears as a send target (self-filtered by `deviceId` on server and client).
