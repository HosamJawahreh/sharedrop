/**
 * Privacy-safe operational logging for the signaling server.
 * Never log SDP, ICE credentials, filenames, or file payloads.
 */

export type OpsEventType =
  'listening' | 'connection_accepted' | 'connection_rejected' | 'connection_closed'

export function logOpsEvent(
  event: OpsEventType,
  fields: Record<string, string | number | boolean | undefined> = {},
): void {
  const entry: Record<string, string | number | boolean> = {
    ts: new Date().toISOString(),
    service: 'sharedrop-signaling',
    event,
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) entry[key] = value
  }
  console.log(JSON.stringify(entry))
}
