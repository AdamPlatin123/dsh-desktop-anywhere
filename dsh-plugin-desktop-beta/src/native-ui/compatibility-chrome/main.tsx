import '../shared/theme.css'
import './style.css'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { LayoutTemplate, RotateCw, SquareTerminal, Wrench } from 'lucide-react'
import type { CompatibilityChromeBridge, CompatibilityChromeCommand, CompatibilityChromeState } from '../../compatibility-chrome-contract.ts'
import { en, zh } from '../../client/desktop-settings-locales.ts'

declare global {
  interface Window { desktopChrome: CompatibilityChromeBridge }
}

function Chrome() {
  const [state, setState] = useState<CompatibilityChromeState>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const off = window.desktopChrome.subscribe(setState)
    void window.desktopChrome.invoke('state').then(value => { if (value) setState(value) }).catch(() => { setFailed(true) })
    return off
  }, [])
  useEffect(() => {
    document.documentElement.lang = state?.locale === 'zh' ? 'zh-CN' : 'en'
  }, [state?.locale])
  const copy = state?.locale === 'zh' ? zh : en
  const invoke = (command: CompatibilityChromeCommand): void => {
    setFailed(false)
    void window.desktopChrome.invoke(command).catch(() => { setFailed(true) })
  }
  return <header data-platform={state?.platform} data-material={state?.material}>
    <div className="identity">
      <strong>DSH Desktop</strong>
      <button disabled={!state} onClick={() => { invoke('version') }} aria-label={copy.currentVersion}>{state?.version ?? '…'}</button>
      <button disabled={!state} onClick={() => { invoke('mode') }} title={copy.compatibilityMode} aria-label={copy.compatibilityMode}><LayoutTemplate /></button>
    </div>
    <nav>
      {failed && <span role="alert" title={copy.operationFailed}>!</span>}
      <button disabled={!state} onClick={() => { invoke('terminal') }} title={copy.openTerminal} aria-label={copy.openTerminal}><SquareTerminal /></button>
      <button disabled={!state} onClick={() => { invoke('restart') }} title={copy.restartOptions} aria-label={copy.restartOptions}><RotateCw /></button>
      <button disabled={!state} onClick={() => { invoke('developer') }} title={copy.developerOptions} aria-label={copy.developerOptions}><Wrench /></button>
    </nav>
  </header>
}

const root = document.getElementById('root')
if (root === null) throw new Error('dsh-desktop: missing chrome root')
createRoot(root).render(<Chrome />)
