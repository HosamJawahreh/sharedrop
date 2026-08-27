# Product scope

## Frozen core workflow

```text
Open
  → Send to nearby
  → Saved devices (if any) + nearby devices appear
  → Select device
  → Select files
  → Send
  → Direct peer-to-peer transfer
  → Complete
```

Optional: install as PWA, set device name, save contacted devices locally.

This remains the **primary** product workflow in the CORE PRODUCT development track.

## Supported device pairs (target)

- iPhone ↔ iPhone
- iPhone ↔ Android
- Android ↔ Android
- iPhone ↔ Linux / Windows / macOS
- Android ↔ Linux / Windows / macOS
- Linux ↔ Windows / macOS
- Windows ↔ macOS

## Required product qualities

- No mandatory account or login
- No room codes
- No upload-to-server step
- No cloud storage
- No manual networking configuration for users
- Users never need to understand WebRTC, ICE, STUN, TURN, sessions, or chunks

## Out of scope

Do **not** implement in this track:

- user accounts / registration / login
- subscriptions / payments / billing
- business or enterprise features
- cloud or permanent file storage
- social features
- public file-sharing links
- cloud-synced contact directories (local saved devices are allowed)
- transfer history products
- analytics or admin dashboards
- unnecessary database models
- unnecessary backend services
- claiming background receiving while the app is fully closed

## Phase honesty rule

Do not fake:

- nearby devices
- transfer progress
- WebRTC connections
- rooms
- file transfers

Unimplemented subsystems must remain explicitly unimplemented.
