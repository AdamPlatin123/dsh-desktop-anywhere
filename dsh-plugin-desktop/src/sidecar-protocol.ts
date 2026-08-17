/** The only command accepted from the native shell during the first spike. */
export interface SidecarShutdownCommand {
  protocol: 1
  type: 'shutdown'
}

/** Parse one newline-delimited native-shell command. */
export function parseSidecarCommand(line: string): SidecarShutdownCommand {
  const value: unknown = JSON.parse(line)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('dsh-tauri-sidecar: command must be a JSON object')
  }
  const command = value as Record<string, unknown>
  if (command.protocol !== 1 || command.type !== 'shutdown') {
    throw new Error('dsh-tauri-sidecar: unsupported control command')
  }
  return { protocol: 1, type: 'shutdown' }
}
