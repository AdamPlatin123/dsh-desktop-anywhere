import type { RendererBootReport } from './renderer-boot-contract.ts'
import type {
  DesktopPlatform,
  DesktopRuntime,
  DesktopShellSpec,
  DesktopThemeSource,
  DesktopTrayItem,
  DesktopTrayItemRegistration,
  DesktopUpdateAdapter,
} from './runtime.ts'

/** Versioned event emitted from the Node Host sidecar to its native shell. */
export type SidecarEvent = {
  protocol: 1
  type: 'ready'
  url: string
} | {
  protocol: 1
  type: 'renderer-health'
  report: RendererBootReport
}

/** Compatibility-only native adapter used while validating a system-WebView shell. */
export class CompatibilitySidecarRuntime implements DesktopRuntime {
  private scheduled: DesktopShellSpec | undefined
  readonly updates: DesktopUpdateAdapter = {
    isPackaged: false,
    canDownload: false,
    currentVersion: '0.0.0-tauri-spike',
    statePath: '',
    request: async () => { throw new Error('dsh-tauri-sidecar: updates are not available in the compatibility spike') },
    confirmDownload: async () => false,
    showManualCheckResult: async () => {},
    downloadAndOpen: async () => {
      throw new Error('dsh-tauri-sidecar: updates are not available in the compatibility spike')
    },
    notify: () => {},
  }

  constructor(
    readonly platform: DesktopPlatform,
    private readonly emit: (event: SidecarEvent) => void,
  ) {}

  schedule(spec: DesktopShellSpec): () => Promise<void> {
    if (spec.mode !== 'compatibility') {
      throw new Error('dsh-tauri-sidecar: supports compatibility mode only')
    }
    const renderer = new URL(spec.url)
    if (renderer.protocol !== 'http:' || renderer.hostname !== '127.0.0.1' || renderer.port === '') {
      throw new Error('dsh-tauri-sidecar: requires an HTTP loopback renderer with an explicit port')
    }
    this.scheduled = spec
    return async () => {
      if (this.scheduled === spec) this.scheduled = undefined
    }
  }

  async mountScheduled(beforeInteractive?: () => void): Promise<void> {
    if (this.scheduled === undefined) {
      throw new Error('dsh-tauri-sidecar: no renderer generation was scheduled')
    }
    beforeInteractive?.()
    this.emit({
      protocol: 1,
      type: 'ready',
      url: this.scheduled.url,
    })
  }

  show(): void {}

  registerTrayItem(_item: DesktopTrayItem): DesktopTrayItemRegistration {
    return { refresh() {}, dispose() {} }
  }

  openTerminal(): void {
    throw new Error('dsh-tauri-sidecar: terminal integration is not available in the compatibility spike')
  }

  reportRendererBoot(report: RendererBootReport): void {
    this.emit({ protocol: 1, type: 'renderer-health', report })
  }

  setThemeSource(_source: DesktopThemeSource): void {}

  async requestRestart(): Promise<void> {
    throw new Error('dsh-tauri-sidecar: restart is not available in the compatibility spike')
  }

  prepareToQuit(): void {}
}
