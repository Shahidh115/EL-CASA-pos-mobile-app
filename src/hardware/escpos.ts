/**
 * ESC/POS Command Encoder for 58mm and 80mm Thermal Receipt Printers.
 */
export class EscPosEncoder {
  private buffer: number[] = []

  public reset(): this {
    this.buffer = [0x1b, 0x40] // ESC @
    return this
  }

  public raw(bytes: number[]): this {
    this.buffer.push(...bytes)
    return this
  }

  public text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      this.buffer.push(code > 255 ? 0x3f : code)
    }
    return this
  }

  public line(str = ''): this {
    this.text(str)
    this.buffer.push(0x0a) // LF
    return this
  }

  public lineFeed(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a)
    }
    return this
  }

  public align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0
    this.buffer.push(0x1b, 0x61, val) // ESC a n
    return this
  }

  public bold(enable = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0) // ESC E n
    return this
  }

  public doubleSize(enable = true): this {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00) // GS ! n
    return this
  }

  public doubleHeight(enable = true): this {
    this.buffer.push(0x1d, 0x21, enable ? 0x01 : 0x00)
    return this
  }

  public hr(char = '-', width = 32): this {
    this.line(char.repeat(width))
    return this
  }

  public table2Cols(left: string, right: string, width = 32): this {
    const l = left.trim()
    const r = right.trim()
    const space = Math.max(1, width - (l.length + r.length))
    this.line(l + ' '.repeat(space) + r)
    return this
  }

  public table3Cols(col1: string, col2: string, col3: string, width = 32): this {
    const c3Len = col3.length
    const c2Len = Math.max(10, col2.length)
    const c1Width = Math.max(1, width - c2Len - c3Len - 2)

    const c1 = col1.length > c1Width ? col1.substring(0, c1Width) : col1.padEnd(c1Width, ' ')
    const c2 = col2.padStart(c2Len, ' ')
    const c3 = col3.padStart(c3Len, ' ')

    this.line(`${c1} ${c2} ${c3}`)
    return this
  }

  public cut(full = false): this {
    this.lineFeed(3)
    this.buffer.push(0x1d, 0x56, full ? 0x00 : 0x01) // GS V m
    return this
  }

  public pulseCashDrawer(pin: 2 | 5 = 2): this {
    // ESC p m t1 t2
    this.buffer.push(0x1b, 0x70, pin === 2 ? 0 : 1, 25, 250)
    return this
  }

  public qrCode(content: string): this {
    const len = content.length + 3
    const pL = len % 256
    const pH = Math.floor(len / 256)

    // Select model 2
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
    // Set size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06)
    // Error correction Level M
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31)
    // Store data
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30)
    this.text(content)
    // Print QR
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
    return this
  }

  public rasterImage(width: number, height: number, data: number[] | Uint8Array): this {
    const widthBytes = Math.ceil(width / 8)
    const xL = widthBytes % 256
    const xH = Math.floor(widthBytes / 256)
    const yL = height % 256
    const yH = Math.floor(height / 256)

    // GS v 0 0 xL xH yL yH
    this.buffer.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH)
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data[i])
    }
    return this
  }

  public encode(): Uint8Array {
    return new Uint8Array(this.buffer)
  }
}
