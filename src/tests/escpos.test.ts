import { describe, it, expect } from 'vitest'
import { EscPosEncoder } from '../hardware/escpos'

describe('ESC/POS Command Encoder', () => {
  it('generates initialization and text bytes correctly', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.reset().line('TEST').encode()

    // ESC @ is [0x1b, 0x40], 'TEST' + LF is [84, 69, 83, 84, 10]
    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 84, 69, 83, 84, 10])
  })

  it('encodes alignment and bold commands', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.align('center').bold(true).line('TITLE').encode()
    // ESC a 1 (center), ESC E 1 (bold)
    expect(Array.from(bytes.slice(0, 6))).toEqual([0x1b, 0x61, 1, 0x1b, 0x45, 1])
  })

  it('encodes paper cut and cash drawer commands', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.pulseCashDrawer().cut().encode()
    // ESC p 0 25 250 (cash drawer), GS V 1 (cut)
    expect(bytes.length).toBeGreaterThan(5)
  })
})
