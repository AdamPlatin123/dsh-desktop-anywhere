import { describe, expect, it } from 'vitest'
import { parseSidecarArgs } from '../src/sidecar.ts'

describe('compatibility sidecar CLI', () => {
  it('selects a Web-capable profile without adding other launch options', () => {
    expect(parseSidecarArgs([])).toEqual({ profileName: 'desktop' })
    expect(parseSidecarArgs(['--profile', 'web'])).toEqual({ profileName: 'web' })
  })
})
