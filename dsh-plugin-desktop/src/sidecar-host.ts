/** Compatibility-only DSH Host generation for a system-WebView native shell. */

import type { Context } from '@deepseek-ai/cordis'
import { boot, loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { installProfilePackageResolver } from './module-resolution.ts'
import { prepareDesktopProfile } from './profile.ts'
import {
  CompatibilitySidecarRuntime,
  type SidecarEvent,
} from './sidecar-runtime.ts'
import type { DesktopPlatform } from './runtime.ts'

const BIN_NAME = 'dsh-tauri-sidecar'
const SIDECAR_DISABLED_ROWS = [
  'desktop-terminal',
  'desktop-pnpm',
  'desktop-profiles',
  'desktop-updates',
] as const

export interface StartCompatibilityHostOptions {
  homeDir: string
  profileName: string
  platform: DesktopPlatform
  emit(event: SidecarEvent): void
}

export interface CompatibilityHost {
  readonly url: string
  close(): Promise<void>
}

/** Boot one compatibility generation and expose its loopback renderer to the native shell. */
export async function startCompatibilityHost(
  options: StartCompatibilityHostOptions,
): Promise<CompatibilityHost> {
  const prepared = prepareDesktopProfile(
    process.env.DSH_TELEMETRY_DISABLED,
    options.homeDir,
    options.platform,
    options.profileName,
  )
  if (prepared.mode !== 'compatibility') {
    throw new Error(`${BIN_NAME}: profile must select compatibility mode`)
  }

  let readyUrl: string | undefined
  const runtime = new CompatibilitySidecarRuntime(options.platform, (event) => {
    if (event.type === 'ready') readyUrl = event.url
    options.emit(event)
  })
  const releasePackageResolver = installProfilePackageResolver(prepared.bareModuleBaseUrl)
  let context: Context | undefined
  let closePromise: Promise<void> | undefined
  let exitRequested = false

  const close = (): Promise<void> => {
    closePromise ??= (async () => {
      try {
        await context?.fiber.dispose()
      } finally {
        releasePackageResolver()
      }
    })()
    return closePromise
  }

  try {
    context = await boot(
      BIN_NAME,
      prepared.rootConfig,
      [
        ...prepared.patches,
        ...SIDECAR_DISABLED_ROWS.map(id => ({ id, disabled: true })),
      ],
      (host) => {
        host.provide(DSH_LAUNCH_ENVIRONMENT_KEY, loadLayeredEnv(BIN_NAME, process.cwd()))
        host.provide('desktopRuntime', runtime)
        provideCmdline(host, {
          args: ['--host', '127.0.0.1', '--port', '0'],
          exit: () => {
            exitRequested = true
            if (context !== undefined) void close()
          },
        })
      },
      prepared.bareModuleBaseUrl,
    )
    await runtime.mountScheduled()
    if (readyUrl === undefined) throw new Error(`${BIN_NAME}: Host mounted without a renderer URL`)
    if (exitRequested) await close()
    return { url: readyUrl, close }
  } catch (cause) {
    await close()
    throw cause
  }
}
