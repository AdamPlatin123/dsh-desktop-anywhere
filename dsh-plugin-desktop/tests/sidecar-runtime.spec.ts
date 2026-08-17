import { describe, expect, it } from 'vitest'
import { CompatibilitySidecarRuntime, type SidecarEvent } from '../src/sidecar-runtime.ts'
import type { DesktopShellSpec } from '../src/runtime.ts'

function compatibilityShell(url: string): DesktopShellSpec {
  return {
    mode: 'compatibility',
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    url,
    productName: 'DSH Desktop',
    windowTitle: 'DeepSeek Harness Desktop',
    iconPath: 'app-icon.png',
    trayIcons: {
      templatePath: 'tray-template.png',
      bluePath: 'tray-blue.png',
    },
    readThemeSource: () => 'system',
    requestQuit: () => {},
    requestModeChange: async () => {},
  }
}

describe('compatibility sidecar runtime', () => {
  it('publishes the loopback renderer URL after the Host generation mounts', async () => {
    const events: SidecarEvent[] = []
    const runtime = new CompatibilitySidecarRuntime('win32', event => { events.push(event) })
    const url = 'http://127.0.0.1:43120/?dsh-desktop-mode=compatibility&dsh-desktop-platform=win32'

    runtime.schedule(compatibilityShell(url))
    await runtime.mountScheduled()

    expect(events).toEqual([{
      protocol: 1,
      type: 'ready',
      url,
    }])
  })

  it('rejects an advanced renderer generation', () => {
    const runtime = new CompatibilitySidecarRuntime('win32', () => {})
    const spec = compatibilityShell(
      'http://127.0.0.1:43120/?dsh-desktop-mode=advanced&dsh-desktop-platform=win32',
    )

    expect(() => runtime.schedule({ ...spec, mode: 'advanced' }))
      .toThrow('supports compatibility mode only')
  })

  it('rejects a renderer outside the loopback carrier', () => {
    const runtime = new CompatibilitySidecarRuntime('win32', () => {})

    expect(() => runtime.schedule(compatibilityShell('https://example.com/')))
      .toThrow('requires an HTTP loopback renderer')
  })
})
