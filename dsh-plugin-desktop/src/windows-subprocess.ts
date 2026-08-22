/** Electron adapter for terminal processes confined by the upstream Windows ACL sandbox. */

import { fileURLToPath } from 'node:url'
import type {
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local'
import {
  adaptWindowsAclExecution,
  type WindowsAclAdaptation,
} from './windows-pwsh-sandbox.ts'

const UPSTREAM_RUNNER = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-sandbox-windows-acl/runner'))
const DESKTOP_TRAMPOLINE = fileURLToPath(new URL('./windows-acl-runner.js', import.meta.url))

/** Adapt one persistent-terminal spawn while preserving every non-runner spec unchanged. */
export function adaptWindowsAclTerminalSpawn(
  spec: SubprocessTerminalSpawnSpec,
  adaptation: WindowsAclAdaptation,
): SubprocessTerminalSpawnSpec {
  const adapted = adaptWindowsAclExecution(spec, spec.argv, adaptation)
  if (adapted.spec === spec && adapted.argv === spec.argv) return spec
  return { ...adapted.spec, argv: adapted.argv }
}

/** Official local subprocess provider with the Electron ACL-runner launch repaired for PTYs. */
export class DesktopWindowsSubprocess extends LocalSubprocessRuntime {
  override spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    return super.spawnTerminal(adaptWindowsAclTerminalSpawn(spec, {
      platform: process.platform,
      electron: process.versions.electron !== undefined,
      execPath: process.execPath,
      upstreamRunner: UPSTREAM_RUNNER,
      trampoline: DESKTOP_TRAMPOLINE,
    }))
  }
}

export default DesktopWindowsSubprocess
