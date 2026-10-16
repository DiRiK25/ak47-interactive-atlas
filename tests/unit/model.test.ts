import { describe, it, expect, afterEach } from 'vitest'
import * as T from 'three'
import { createAtlasModel } from '../../src/geometry/createAtlasModel'
import { extrude, loft } from '../../src/geometry/primitives'
import { parts } from '../../src/data/parts'
import { damping, pixelRatio, fitDistance } from '../../src/utils/motion'
import type { AtlasMaterials } from '../../src/materials/createMaterials'

const resources: { dispose(): void }[] = []
afterEach(() => { resources.forEach(r => r.dispose()); resources.length = 0 })
function model() {
  const m = new T.MeshStandardMaterial(); resources.push(m)
  const materials = Object.fromEntries(['metal', 'edge', 'dark', 'magazine', 'wood', 'redWood', 'gripWood', 'diagram'].map(k => [k, m])) as AtlasMaterials
  const result = createAtlasModel(materials); resources.push(result); return result
}
describe('Оригинальная геометрия', () => {
  it('сохраняет гладкую поверхность объёма у UV-шва и плоские торцы', () => {
    const geometry = loft([{ x: -1, y: 0, h: .4, w: .25 }, { x: 1, y: 0, h: .4, w: .25 }], 32, 3)
    resources.push(geometry)
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
    const seamNormals = new Map<string, T.Vector3[]>()
    let capVertices = 0
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), nx = normal.getX(i)
      if (Math.abs(nx) > .99) {
        expect(nx).toBeCloseTo(Math.sign(x), 6)
        expect(Math.abs(x)).toBeCloseTo(1, 6); capVertices++
      } else {
        expect(Math.abs(nx)).toBeLessThan(.001)
        const key = [x, position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e6)).join(',')
        if (!seamNormals.has(key)) seamNormals.set(key, [])
        seamNormals.get(key)!.push(new T.Vector3().fromBufferAttribute(normal, i))
      }
    }
    const seams = [...seamNormals.values()].filter(v => v.length > 1)
    expect(seams.length).toBeGreaterThan(0); expect(capVertices).toBeGreaterThan(0)
    for (const [a, b] of seams) expect(a.distanceTo(b)).toBeLessThan(.00001)
  })
  it('сохраняет плоские нормали больших граней рядом со сглаженной фаской', () => {
    const shape = new T.Shape(); shape.moveTo(-2, 0); shape.lineTo(1, 0); shape.lineTo(.8, 1); shape.lineTo(-1.9, .5); shape.closePath()
    const geometry = extrude(shape, .4, .05); resources.push(geometry)
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
    let caps = 0, curved = 0
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i)
      if (Math.abs(Math.abs(z) - .25) < 1e-5) {
        caps++
        expect(normal.getX(i)).toBeCloseTo(0, 6); expect(normal.getY(i)).toBeCloseTo(0, 6)
        expect(normal.getZ(i)).toBeCloseTo(Math.sign(z), 6)
      } else if (Math.abs(normal.getZ(i)) > .05 && Math.abs(normal.getZ(i)) < .95) curved++
    }
    expect(caps).toBeGreaterThan(0); expect(curved).toBeGreaterThan(0)
  })
  it('создаёт все документированные группы с геометрией для выбора', () => {
    const atlas = model()
    expect([...atlas.parts.keys()].sort()).toEqual(parts.map(p => p.id).sort())
    for (const part of atlas.parts.values()) {
      expect(part.meshes.length).toBeGreaterThan(0)
      expect(part.meshes.every(m => m.userData.partId === part.id)).toBe(true)
    }
  })
  it('не содержит NaN, бесконечных координат и вырожденных границ', () => {
    const atlas = model()
    for (const mesh of atlas.meshes) {
      const geometry = mesh.geometry; geometry.computeBoundingSphere()
      expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true)
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0)
      for (const name of ['position', 'normal', 'uv']) {
        const data = geometry.getAttribute(name)
        expect(data).toBeDefined()
        expect(Array.from(data.array).every(Number.isFinite)).toBe(true)
      }
    }
  })
  it('оставляет внутренние области условными и скрытыми в начальном виде', () => {
    const atlas = model()
    const internal = [...atlas.parts.values()].filter(p => p.internal)
    expect(internal).toHaveLength(3)
    expect(internal.every(p => !p.group.visible && p.meshes.length === 1)).toBe(true)
  })
  it('хранит разные пространственные смещения для музейной композиции', () => {
    const atlas = model(), external = [...atlas.parts.values()].filter(p => !p.internal)
    expect(new Set(external.map(p => p.spread.toArray().join(','))).size).toBe(9)
    expect(external.some(p => p.spread.y > 1)).toBe(true)
    expect(external.some(p => p.spread.y < -1)).toBe(true)
  })
  it('удерживает сложность модели в измеримом бюджете', () => {
    const atlas = model()
    const triangles = atlas.meshes.reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, 0)
    expect(triangles).toBeGreaterThan(20000)
    expect(triangles).toBeLessThan(150000)
    expect(atlas.meshes.length).toBeLessThan(200)
  })
})
describe('Камера и качество', () => {
  it('вписывает объект с учётом узкого экрана', () => {
    const portrait = fitDistance(12, 5, .75, 33), landscape = fitDistance(12, 5, 2, 33)
    expect(portrait).toBeGreaterThan(landscape)
    const visibleWidth = 2 * portrait * Math.tan(33 * Math.PI / 360) * .75
    expect(visibleWidth).toBeGreaterThanOrEqual(11.999)
  })
  it('ограничивает разрешение на телефоне и сохраняет высокое качество на десктопе', () => {
    expect(pixelRatio('auto', 3, true)).toBe(1.35)
    expect(pixelRatio('high', 3, false)).toBe(2)
    expect(pixelRatio('low', 3, true)).toBe(1)
    expect(pixelRatio('medium', 1, false)).toBe(1)
  })
  it('делает сглаживание независимым от частоты кадров', () => {
    const step = (fps: number) => { let v = 0; for (let i = 0; i < fps; i++) v += (1 - v) * damping(5, 1 / fps); return v }
    expect(step(30)).toBeCloseTo(step(120), 8)
    expect(damping(5, -1)).toBe(0)
    expect(damping(5, 10)).toBeLessThan(1)
  })
})
