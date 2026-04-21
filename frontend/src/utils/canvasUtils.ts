import { getStroke } from 'perfect-freehand'

export const CANVAS_BG = '#0f172a'

export function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce((acc: (string | number)[], [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length]
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    return acc
  }, ['M', ...stroke[0], 'Q'])
  return d.join(' ')
}

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function colorsMatch(
  data: Uint8ClampedArray,
  idx: number,
  r: number, g: number, b: number,
  tolerance = 30
): boolean {
  return (
    Math.abs(data[idx] - r) <= tolerance &&
    Math.abs(data[idx + 1] - g) <= tolerance &&
    Math.abs(data[idx + 2] - b) <= tolerance
  )
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) {
  const canvas = ctx.canvas
  const width = canvas.width
  const height = canvas.height
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const startIdx = (startY * width + startX) * 4
  const startR = data[startIdx]
  const startG = data[startIdx + 1]
  const startB = data[startIdx + 2]

  const [fillR, fillG, fillB] = hexToRgb(fillColor)

  if (
    Math.abs(startR - fillR) < 5 &&
    Math.abs(startG - fillG) < 5 &&
    Math.abs(startB - fillB) < 5
  ) return

  const stack: number[] = [startX + startY * width]
  const visited = new Uint8Array(width * height)

  while (stack.length > 0) {
    const pos = stack.pop()!
    const x = pos % width
    const y = Math.floor(pos / width)
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (visited[pos]) continue
    const idx = pos * 4
    if (!colorsMatch(data, idx, startR, startG, startB)) continue
    visited[pos] = 1
    data[idx] = fillR
    data[idx + 1] = fillG
    data[idx + 2] = fillB
    data[idx + 3] = 255
    stack.push(pos + 1)
    stack.push(pos - 1)
    stack.push(pos + width)
    stack.push(pos - width)
  }

  ctx.putImageData(imageData, 0, 0)
}

export function renderStrokes(canvas: HTMLCanvasElement, actions: any[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = CANVAS_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const action of actions) {
    if (!action) continue

    if (action.type === 'fill') {
      const x = Math.floor(Number(action.x))
      const y = Math.floor(Number(action.y))
      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        floodFill(ctx, x, y, action.color)
      }
      continue
    }

    const rawPoints = action.points
    if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length === 0) continue

    const points: [number, number, number][] = rawPoints.map((p: any) => {
      if (Array.isArray(p)) {
        return [Number(p[0]), Number(p[1]), Number(p[2] ?? 0.5)]
      }
      // Object form {x, y, pressure} or {0: x, 1: y, 2: pressure}
      if (typeof p === 'object') {
        const x = Number(p.x ?? p[0] ?? 0)
        const y = Number(p.y ?? p[1] ?? 0)
        const pressure = Number(p.pressure ?? p[2] ?? 0.5)
        return [x, y, pressure]
      }
      return [0, 0, 0.5]
    })

    if (points.length === 0) continue

    const outline = getStroke(points, {
      size: Number(action.size) || 8,
      thinning: 0.5,
      smoothing: 0.5,
      simulatePressure: false, 
    })

    if (!outline.length) continue

    const path = new Path2D(getSvgPath(outline))
    ctx.fillStyle = action.tool === 'eraser' ? CANVAS_BG : (action.color ?? '#ffffff')
    ctx.fill(path)
  }
}

export function renderToDataUrl(actions: any[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 480
  renderStrokes(canvas, actions)
  return canvas.toDataURL('image/png')
}