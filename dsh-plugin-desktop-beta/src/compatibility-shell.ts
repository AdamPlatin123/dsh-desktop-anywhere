import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { COMPATIBILITY_CHROME_CHANNEL, COMPATIBILITY_CHROME_STATE, type CompatibilityChromeState } from './compatibility-chrome-contract.ts'
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
  checkForUpdates(): Promise<void>
}

export class CompatibilityShell {
  readonly content: WebContentsView
  private readonly documentPath = fileURLToPath(new URL('./native-ui/compatibility-chrome.html', import.meta.url))
  private disposed = false
  readonly chromeView: WebContentsView
  private expanded = false
  private readonly chrome: WebContents

  constructor(
    private readonly window: BrowserWindow,
    private readonly spec: DesktopShellSpec,
    private readonly platform: DesktopPlatform,
    preload: string,
    private readonly actions: CompatibilityShellActions,
  ) {
    this.chromeView = new WebContentsView({ webPreferences: {
      preload: fileURLToPath(new URL('./compatibility-preload.cjs', import.meta.url)),
      partition: 'dsh-desktop-compatibility-chrome',
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
    } })
    this.chromeView.setBackgroundColor('#00000000')
    this.chrome = this.chromeView.webContents
    this.content = new WebContentsView({ webPreferences: {
      preload,
      partition: DESKTOP_RENDERER_SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    } })
    window.contentView.addChildView(this.content)
    window.contentView.addChildView(this.chromeView)
    window.on('resize', this.resize)
    window.on('enter-full-screen', this.resize)
    window.on('leave-full-screen', this.resize)
    window.on('closed', this.dispose)
    this.chrome.on('will-navigate', this.preventNavigation)
    this.chrome.on('will-redirect', this.preventNavigation)
    this.chrome.on('will-attach-webview', this.preventNavigation)
    this.chrome.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.chrome.ipc.handle(COMPATIBILITY_CHROME_CHANNEL, (event, command: unknown) => {
      if (this.disposed || event.sender !== this.chrome
        || event.senderFrame !== this.chrome.mainFrame
        || event.senderFrame.url !== pathToFileURL(this.documentPath).href) {
        throw new Error('dsh-plugin-desktop: untrusted chrome sender')
      }
      return this.command(command)
    })
    this.chrome.on('render-process-gone', this.collapse)
    this.chrome.on('did-start-loading', this.collapse)
    window.on('blur', this.dismiss)
    window.on('hide', this.dismiss)
    this.resize()
  }

  get webContents(): WebContents { return this.content.webContents }
  get chromeWebContents(): WebContents { return this.chrome }

  async load(): Promise<void> {
    await this.chrome.loadFile(this.documentPath)
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
    this.chromeView.setBounds({ x: 0, y: 0, width, height: this.expanded ? height : Math.min(height, DESKTOP_FRAME_HEIGHT) })
  }

  private readonly preventNavigation = (event: Electron.Event): void => { event.preventDefault() }

  private readonly collapse = (): void => {
    this.expanded = false
    this.resize()
  }

  private readonly dismiss = (): void => {
    if (!this.disposed && !this.chrome.isDestroyed()) this.chrome.send('dsh-desktop:chrome-dismiss')
    this.collapse()
  }

  private command(command: unknown): CompatibilityChromeState | undefined | Promise<void> {
    switch (command) {
      case 'state': return this.state()
      case 'expand': this.expanded = true; this.resize(); return
      case 'collapse': this.collapse(); return
      case 'terminal': this.actions.openTerminal(); return
      case 'check-for-updates': return this.actions.checkForUpdates()
      case 'mode-extended': return this.spec.requestModeChange('extended')
      case 'mode-advanced': return this.spec.requestModeChange('advanced')
      case 'restart': return this.actions.restart()
      case 'restart-recovery': return this.actions.restartToRecovery()
      case 'reload': this.actions.reload(); return
      case 'developer': this.actions.developerTools(); return
      default: throw new Error('dsh-plugin-desktop: unsupported chrome command')
    }
  }

  readonly dispose = (): void => {
    if (this.disposed) return
    this.disposed = true
    this.window.off('blur', this.dismiss)
    this.window.off('hide', this.dismiss)
    this.window.off('resize', this.resize)
    this.window.off('enter-full-screen', this.resize)
    this.window.off('leave-full-screen', this.resize)
    this.window.off('closed', this.dispose)
    if (!this.chrome.isDestroyed()) {
      this.chrome.off('render-process-gone', this.collapse)
      this.chrome.off('did-start-loading', this.collapse)
      this.chrome.ipc.removeHandler(COMPATIBILITY_CHROME_CHANNEL)
      this.chrome.off('will-navigate', this.preventNavigation)
      this.chrome.off('will-redirect', this.preventNavigation)
      this.chrome.off('will-attach-webview', this.preventNavigation)
    }
    if (!this.window.isDestroyed()) {
      this.window.contentView.removeChildView(this.content)
      this.window.contentView.removeChildView(this.chromeView)
    }
    if (!this.chrome.isDestroyed()) this.chrome.close({ waitForBeforeUnload: false })
    if (!this.webContents.isDestroyed()) this.webContents.close({ waitForBeforeUnload: false })
  }
}
