import type { Quality } from '../data/types'
export const damping = (rate: number, delta: number) => 1 - Math.exp(-rate * Math.max(0, Math.min(delta, 0.1)))
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function pixelRatio(quality: Quality, deviceRatio: number, compact: boolean) {
  const cap = { low: 1, medium: 1.5, high: 2, auto: compact ? 1.35 : 2 }[quality]
  return Math.min(deviceRatio || 1, cap)
}
export function fitDistance(width: number, height: number, aspect: number, fov: number) {
  const tangent = Math.tan(fov * Math.PI / 360)
  return Math.max(height / (2 * tangent), width / (2 * tangent * aspect))
}
