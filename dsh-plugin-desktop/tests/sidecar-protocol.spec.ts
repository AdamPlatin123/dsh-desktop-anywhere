import { describe, expect, it } from 'vitest'
import { parseSidecarCommand } from '../src/sidecar-protocol.ts'

describe('sidecar control protocol', () => {
  it('accepts the versioned shutdown command', () => {
    expect(parseSidecarCommand('{"protocol":1,"type":"shutdown"}')).toEqual({
      protocol: 1,
      type: 'shutdown',
    })
  })
})
