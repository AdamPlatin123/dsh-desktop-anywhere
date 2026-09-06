import { Menu, WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { COMPATIBILITY_CHROME_CHANNEL, COMPATIBILITY_CHROME_STATE, type CompatibilityChromeState } from './compatibility-chrome-contract.ts'
import { en, zh } from './client/desktop-settings-locales.ts'
import type { DesktopLocale, DesktopPlatform, DesktopShellSpec } from './runtime.ts'
import { DESKTOP_FRAME_HEIGHT } from './window-chrome.ts'
import { DESKTOP_RENDERER_SESSION_PARTITION } from './window-options.ts'

export interface CompatibilityShellActions {
  locale(): DesktopLocale
  version: string
  openTerminal(): void
  restart(): Promise<void>
  restartToRecovery(): Promise<void>
  reload(): void
  developerTools(): void
  statusMenu(): Electron.MenuItemConstructorOptions[]
  reportError(cause: unknown): void
}

export class CompatibilityShell {
  readonly content: WebContentsView
  private readonly documentPath = fileURLToPath(new URL('./native-ui/compatibility-chrome.html', import.meta.url))
  private disposed = false
  private menu: Menu | undefined
  private readonly chrome: WebContents

  constructor(
    private readonly window: BrowserWindow,
    private readonly spec: DesktopShellSpec,
    private readonly platform: DesktopPlatform,
    preload: string,
    private readonly actions: CompatibilityShellActions,
  ) {
    this.chrome = window.webContents
    this.content = new WebContentsView({ webPreferences: {
      preload,
      partition: DESKTOP_RENDERER_SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    } })
    window.contentView.addChildView(this.content)
    window.on('resize', this.resize)
    window.on('enter-full-screen', this.resize)
    window.on('leave-full-screen', this.resize)
    window.on('closed', this.dispose)
    window.webContents.on('will-navigate', this.preventNavigation)
    window.webContents.on('will-redirect', this.preventNavigation)
    window.webContents.on('will-attach-webview', this.preventNavigation)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.ipc.handle(COMPATIBILITY_CHROME_CHANNEL, (event, command: unknown) => {
      if (this.disposed || event.sender !== window.webContents
        || event.senderFrame !== window.webContents.mainFrame
        || event.senderFrame.url !== pathToFileURL(this.documentPath).href) {
        throw new Error('dsh-plugin-desktop: untrusted chrome sender')
      }
      return this.command(command)
    })
    this.resize()
  }

  get webContents(): WebContents { return this.content.webContents }

  async load(): Promise<void> {
    await this.window.loadFile(this.documentPath)
  }

  refresh(): void {
    if (!this.disposed && !this.chrome.isDestroyed()) {
      this.chrome.send(COMPATIBILITY_CHROME_STATE, this.state())
    }
  }

  private state(): CompatibilityChromeState {
    return { locale: this.actions.locale(), version: this.actions.version, platform: this.platform, material: this.spec.material }
  }

  private readonly resize = (): void => {
    if (this.disposed || this.window.isDestroyed()) return
    const [width = 0, height = 0] = this.window.getContentSize()
    this.content.setBounds({ x: 0, y: DESKTOP_FRAME_HEIGHT, width, height: Math.max(0, height - DESKTOP_FRAME_HEIGHT) })
  }

  private readonly preventNavigation = (event: Electron.Event): void => { event.preventDefault() }

  private command(command: unknown): CompatibilityChromeState | undefined {
    if (command === 'state') return this.state()
    const copy = this.actions.locale() === 'zh' ? zh : en
    const invoke = (action: () => void | Promise<void>) => (): void => {
      if (this.disposed) return
      void Promise.resolve().then(action).catch(cause => { this.actions.reportError(cause) })
    }
    const changeMode = async (mode: 'extended' | 'advanced'): Promise<void> => {
      await this.spec.requestModeChange(mode)
      if (!this.disposed) await this.actions.restart()
    }
    let template: Electron.MenuItemConstructorOptions[]
    switch (command) {
      case 'terminal':
        this.actions.openTerminal()
        return
      case 'version':
        template = [
          { label: `${copy.currentVersion}: ${this.actions.version}`, enabled: false },
          ...this.actions.statusMenu(),
        ]
        break
      case 'mode':
        template = [
          { label: copy.compatibilityMode, type: 'radio', checked: true },
          { label: copy.extendedMode, type: 'radio', checked: false, click: invoke(() => changeMode('extended')) },
          { label: copy.advancedMode, type: 'radio', checked: false, click: invoke(() => changeMode('advanced')) },
        ]
        break
      case 'restart':
        template = [
          { label: copy.reloadRenderer, click: invoke(() => { this.actions.reload() }) },
          { label: copy.restartDesktop, click: invoke(() => this.actions.restart()) },
          { label: copy.restartToRecovery, click: invoke(() => this.actions.restartToRecovery()) },
        ]
        break
      case 'developer':
        template = [{ label: copy.toggleDeveloperTools, click: invoke(() => { this.actions.developerTools() }) }]
        break
      default:
        throw new Error('dsh-plugin-desktop: unsupported chrome command')
    }
    this.menu?.closePopup(this.window)
    this.menu = Menu.buildFromTemplate(template)
    this.menu.popup({ window: this.window, callback: () => {
      if (!this.disposed && !this.webContents.isDestroyed()) this.webContents.focus()
    } })
  }

  readonly dispose = (): void => {
    if (this.disposed) return
    this.disposed = true
    this.menu?.closePopup(this.window)
    this.window.off('resize', this.resize)
    this.window.off('enter-full-screen', this.resize)
    this.window.off('leave-full-screen', this.resize)
    this.window.off('closed', this.dispose)
    if (!this.chrome.isDestroyed()) {
      this.chrome.ipc.removeHandler(COMPATIBILITY_CHROME_CHANNEL)
      this.chrome.off('will-navigate', this.preventNavigation)
      this.chrome.off('will-redirect', this.preventNavigation)
      this.chrome.off('will-attach-webview', this.preventNavigation)
    }
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(this.content)
    if (!this.webContents.isDestroyed()) this.webContents.close({ waitForBeforeUnload: false })
  }
}
