/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNALING_URL?: string
  readonly VITE_ICE_SERVERS?: string
  /** Validation-only: set to `relay` to force TURN. Production should leave unset (`all`). */
  readonly VITE_ICE_TRANSPORT_POLICY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
