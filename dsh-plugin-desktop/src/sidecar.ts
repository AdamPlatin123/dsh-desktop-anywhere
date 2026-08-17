/** Private Node entry used by the Tauri compatibility spike. */

import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { assertDesktopProfileName } from './profile-manager.ts'
import { parseSidecarCommand } from './sidecar-protocol.ts'
import { startCompatibilityHost } from './sidecar-host.ts'
import type { DesktopPlatform } from './runtime.ts'

export interface SidecarArgs {
  profileName: string
}

/** Parse the intentionally narrow sidecar argument set. */
export function parseSidecarArgs(argv: readonly string[]): SidecarArgs {
  const profileName = argv.length === 0
    ? 'desktop'
    : argv.length === 2 && argv[0] === '--profile'
      ? argv[1]
      : undefined
  if (profileName === undefined) {
    throw new Error('dsh-tauri-sidecar: usage: sidecar [--profile <name>]')
  }
  assertDesktopProfileName(profileName)
  return { profileName }
}

function isDirectExecution(): boolean {
  const entry = process.argv[1]
  return entry !== undefined && fileURLToPath(import.meta.url) === entry
}

function desktopPlatform(platform: NodeJS.Platform): DesktopPlatform {
  if (platform === 'win32' || platform === 'darwin' || platform === 'linux') return platform
  throw new Error(`dsh-tauri-sidecar: unsupported platform ${platform}`)
}

/** Run the line-delimited sidecar process until the native shell closes it. */
export async function runSidecar(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const { profileName } = parseSidecarArgs(argv)
  const host = await startCompatibilityHost({
    homeDir: resolveDshHome(),
    profileName,
    platform: desktopPlatform(process.platform),
    emit: event => { process.stdout.write(`${JSON.stringify(event)}\n`) },
  })
  const commands = createInterface({ input: process.stdin, crlfDelay: Infinity })
  try {
    for await (const line of commands) {
      parseSidecarCommand(line)
      break
    }
  } finally {
    commands.close()
    await host.close()
  }
}

if (isDirectExecution()) {
  void runSidecar().catch((cause: unknown) => {
    process.stderr.write(
      `dsh-tauri-sidecar: ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`,
    )
    process.exitCode = 1
  })
}
