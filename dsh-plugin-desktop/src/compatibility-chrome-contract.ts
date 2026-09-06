import type { DesktopLocale, DesktopPlatform } from './runtime.ts'

export const COMPATIBILITY_CHROME_CHANNEL = 'dsh-desktop:compatibility-chrome'
export const COMPATIBILITY_CHROME_STATE = 'dsh-desktop:compatibility-chrome-state'

export type CompatibilityChromeCommand = 'state' | 'version' | 'mode' | 'terminal' | 'restart' | 'developer'

export interface CompatibilityChromeState {
  readonly locale: DesktopLocale
  readonly platform: DesktopPlatform
  readonly version: string
  readonly material: string
}

export interface CompatibilityChromeBridge {
  invoke(command: CompatibilityChromeCommand): Promise<CompatibilityChromeState | undefined>
  subscribe(listener: (state: CompatibilityChromeState) => void): () => void
}
