# Product scope

## Frozen core workflow

```text
Open
  → Your devices + Available now on the homepage
  → Select an Online device
  → Connect
  → Select files
  → Send
  → Direct peer-to-peer transfer
  → Complete
```

### Saved devices

- **Your devices** are remembered locally by persistent `deviceId` (not IP / Wi‑Fi).
- An **Online** saved device can enter the normal connection flow from any network the signaling + ICE path supports.
- An **Offline** saved device cannot receive files — there is no cloud storage or queued delivery.
- Saved ≠ trusted; connection still requires accept/reject.

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

## Phase 12C core checklist

Core product readiness is gated by [phase-12-final-validation-report.md](./phase-12-final-validation-report.md). Physical cross-network and multi-OS pairs remain **NOT TESTED** until measured — never mark them PASS without evidence.
