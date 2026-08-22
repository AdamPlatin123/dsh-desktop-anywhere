import type { SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it } from 'vitest'
import { adaptWindowsAclTerminalSpawn } from '../src/windows-subprocess.ts'
import type { WindowsAclAdaptation } from '../src/windows-pwsh-sandbox.ts'

const adaptation: WindowsAclAdaptation = {
  platform: 'win32',
  electron: true,
  execPath: 'C:\\Program Files\\DSH Desktop\\DSH Desktop.exe',
  upstreamRunner: 'C:\\Program Files\\DSH Desktop\\resources\\app.asar\\runner.js',
  trampoline: 'C:\\Program Files\\DSH Desktop\\resources\\app.asar\\windows-acl-runner.js',
}

function terminalSpec(argv: readonly string[]): SubprocessTerminalSpawnSpec {
  return {
    argv,
    cwd: 'C:\\workspace',
    env: { KEEP: 'value', electron_run_as_node: 'stale' },
    rows: 24,
    cols: 80,
    graceMs: 1_000,
  }
}

describe('Windows Electron persistent-terminal adaptation', () => {
  it('routes an ACL-confined PTY through the Desktop Node-mode trampoline', () => {
    const spec = terminalSpec([
      adaptation.execPath,
      adaptation.upstreamRunner,
      '--workspace',
      'C:\\workspace',
      '--',
      'powershell.exe',
      '-NoLogo',
    ])

    const result = adaptWindowsAclTerminalSpawn(spec, adaptation)

    expect(result).not.toBe(spec)
    expect(result.argv).toEqual([
      adaptation.execPath,
      adaptation.trampoline,
      adaptation.upstreamRunner,
      '--workspace',
      'C:\\workspace',
      '--',
      'powershell.exe',
      '-NoLogo',
    ])
    expect(result.env).toEqual({ KEEP: 'value', ELECTRON_RUN_AS_NODE: '1' })
    expect(result.cwd).toBe(spec.cwd)
    expect(result.rows).toBe(spec.rows)
    expect(result.cols).toBe(spec.cols)
    expect(result.graceMs).toBe(spec.graceMs)
    expect(spec.env).toEqual({ KEEP: 'value', electron_run_as_node: 'stale' })
  })

  it.each([
    ['plain Node', { electron: false }, undefined],
    ['non-Windows', { platform: 'darwin' as const }, undefined],
    ['direct PowerShell', {}, ['powershell.exe', '-NoLogo']],
  ])('leaves a %s terminal spec unchanged', (_label, override, argv) => {
    const spec = terminalSpec(argv ?? [adaptation.execPath, adaptation.upstreamRunner, '--'])

    const result = adaptWindowsAclTerminalSpawn(spec, { ...adaptation, ...override })

    expect(result).toBe(spec)
  })
})
