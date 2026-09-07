import { EventEmitter } from 'node:events'
import { pathToFileURL } from 'node:url'
import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPATIBILITY_CHROME_CHANNEL } from '../src/compatibility-chrome-contract.ts'
import { CompatibilityShell, type CompatibilityShellActions } from '../src/compatibility-shell.ts'
import type { DesktopShellSpec } from '../src/runtime.ts'

const electron = vi.hoisted(() => ({
  content: {
    close: vi.fn(), focus: vi.fn(), isDestroyed: vi.fn(() => false),
  },
  popup: vi.fn(), closePopup: vi.fn(), buildFromTemplate: vi.fn(),
}))
vi.mock('electron', () => ({
  WebContentsView: class {
    readonly webContents = electron.content
    readonly setBounds = vi.fn()
    constructor(readonly options: unknown) {}
  },
  Menu: { buildFromTemplate: electron.buildFromTemplate },
}))

function fixture() {
  const ipc = { handle: vi.fn(), removeHandler: vi.fn() }
  const webContents = Object.assign(new EventEmitter(), {
    ipc,
    mainFrame: { url: '' },
    isDestroyed: vi.fn(() => false),
    setWindowOpenHandler: vi.fn(),
    send: vi.fn(),
  })
  const window = Object.assign(new EventEmitter(), {
    webContents,
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    getContentSize: vi.fn(() => [1280, 840]),
    isDestroyed: vi.fn(() => false),
    loadFile: vi.fn(async (path: string) => { webContents.mainFrame.url = pathToFileURL(path).href }),
  })
  const actions: CompatibilityShellActions = {
    locale: () => 'en', version: '2.0.3',
    openTerminal: vi.fn(), restart: vi.fn(async () => {}), restartToRecovery: vi.fn(async () => {}),
    reload: vi.fn(), developerTools: vi.fn(),
    statusMenu: vi.fn(() => [{ label: 'Check for updates', click: vi.fn() }]), reportError: vi.fn(),
  }
  const spec = { material: 'off', requestModeChange: vi.fn(async () => {}) } as unknown as DesktopShellSpec
  const shell = new CompatibilityShell(window as unknown as BrowserWindow, spec, 'darwin', '/desktop/preload.cjs', actions)
  const handler = ipc.handle.mock.calls[0]?.[1] as (event: unknown, command: unknown) => unknown
  const event = () => ({ sender: webContents, senderFrame: webContents.mainFrame })
  return { shell, window, webContents, ipc, handler, event, actions, spec }
}

describe('isolated compatibility shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electron.buildFromTemplate.mockReturnValue({ popup: electron.popup, closePopup: electron.closePopup })
  })

  it('loads only the packaged chrome and reserves native bounds outside the content document', async () => {
    const { shell, window } = fixture()
    await shell.load()
    expect(window.loadFile).toHaveBeenCalledWith(expect.stringMatching(/native-ui\/compatibility-chrome\.html$/))
    expect(window.contentView.addChildView).toHaveBeenCalledWith(shell.content)
    expect(shell.content).toMatchObject({ options: { webPreferences: {
      partition: 'persist:dsh-desktop-renderer', preload: '/desktop/preload.cjs',
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
    } } })
    expect(shell.content.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 36, width: 1280, height: 804 })
    window.getContentSize.mockReturnValue([900, 640])
    window.emit('resize')
    expect(shell.content.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 36, width: 900, height: 604 })
    window.getContentSize.mockReturnValue([900, 20])
    window.emit('enter-full-screen')
    expect(shell.content.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 36, width: 900, height: 0 })
    shell.dispose()
  })

  it('rejects other renderers, child frames, navigated chrome, and arbitrary commands', async () => {
    const { shell, handler, event, webContents, actions } = fixture()
    await shell.load()
    expect(handler(event(), 'state')).toEqual({ locale: 'en', platform: 'darwin', version: '2.0.3', material: 'off' })
    expect(() => handler({ ...event(), sender: electron.content }, 'terminal')).toThrow('untrusted')
    expect(() => handler({ ...event(), senderFrame: { url: webContents.mainFrame.url } }, 'terminal')).toThrow('untrusted')
    expect(() => handler(event(), { command: 'terminal' })).toThrow('unsupported')
    expect(() => handler(event(), 'executeJavaScript')).toThrow('unsupported')
    webContents.mainFrame.url = 'http://127.0.0.1:43120/'
    expect(() => handler(event(), 'terminal')).toThrow('untrusted')
    expect(actions.openTerminal).not.toHaveBeenCalled()
    shell.dispose()
  })

  it('keeps popup menus native and routes actions through the Host rather than plugin JavaScript', async () => {
    const { shell, handler, event, actions, spec } = fixture()
    await shell.load()
    handler(event(), 'terminal')
    expect(actions.openTerminal).toHaveBeenCalledOnce()
    handler(event(), 'version')
    expect(electron.buildFromTemplate).toHaveBeenLastCalledWith([
      { label: 'Current version: 2.0.3', enabled: false },
      { label: 'Check for updates', click: expect.any(Function) },
    ])
    handler(event(), 'mode')
    const modeMenu = electron.buildFromTemplate.mock.lastCall?.[0] as Array<{ click?: () => void }>
    modeMenu[1]?.click?.()
    await vi.waitFor(() => { expect(actions.restart).toHaveBeenCalledOnce() })
    expect(spec.requestModeChange).toHaveBeenCalledWith('extended')
    handler(event(), 'restart')
    const restartMenu = electron.buildFromTemplate.mock.lastCall?.[0] as Array<{ click: () => void }>
    restartMenu[0]?.click()
    await vi.waitFor(() => { expect(actions.reload).toHaveBeenCalledOnce() })
    handler(event(), 'developer')
    const developerMenu = electron.buildFromTemplate.mock.lastCall?.[0] as Array<{ click: () => void }>
    developerMenu[0]?.click()
    await vi.waitFor(() => { expect(actions.developerTools).toHaveBeenCalledOnce() })
    expect(electron.popup).toHaveBeenCalled()
    shell.dispose()
  })

  it('does not restart if persisting the selected mode fails', async () => {
    const { shell, handler, event, spec, actions } = fixture()
    vi.mocked(spec.requestModeChange).mockRejectedValueOnce(new Error('write failed'))
    await shell.load()
    handler(event(), 'mode')
    const menu = electron.buildFromTemplate.mock.lastCall?.[0] as Array<{ click?: () => void }>
    menu[2]?.click?.()
    await vi.waitFor(() => { expect(actions.reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'write failed' })) })
    expect(actions.restart).not.toHaveBeenCalled()
    shell.dispose()
  })

  it('blocks chrome navigation and disposes the child renderer and IPC exactly once', async () => {
    const { shell, window, webContents, ipc, handler, event } = fixture()
    await shell.load()
    for (const name of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
      const preventDefault = vi.fn()
      webContents.emit(name, { preventDefault })
      expect(preventDefault).toHaveBeenCalledOnce()
    }
    shell.refresh()
    expect(webContents.send).toHaveBeenCalledOnce()
    window.emit('closed')
    shell.dispose()
    shell.refresh()
    expect(webContents.send).toHaveBeenCalledOnce()
    expect(ipc.removeHandler).toHaveBeenCalledOnce()
    expect(ipc.removeHandler).toHaveBeenCalledWith(COMPATIBILITY_CHROME_CHANNEL)
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(shell.content)
    expect(electron.content.close).toHaveBeenCalledExactlyOnceWith({ waitForBeforeUnload: false })
    expect(window.listenerCount('resize')).toBe(0)
    expect(() => handler(event(), 'terminal')).toThrow('untrusted')
  })
})
