import * as T from 'three'

/** Display-space coordinates only: no manufacturing dimensions or mating surfaces. */
export function profile(points: [number, number][], depth: number, bevel = 0.025) {
  const shape = new T.Shape()
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  return extrude(shape, depth, bevel)
}
export function extrude(shape: T.Shape, depth: number, bevel = 0.025) {
  const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 32, steps: 1 })
  g.translate(0, 0, -depth / 2)
  return g
}
export interface Section { x: number; y: number; h: number; w: number }
/** Smooth, softly squared cross sections with genuinely rounded transitions. */
export function loft(sections: Section[], radial = 32, subdivisions = 6, exponent = 0.55) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const rings: Section[] = []
  for (let k = 0; k < sections.length - 1; k++) {
    const a = sections[k], b = sections[k + 1]
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions, smooth = t * t * (3 - 2 * t)
      rings.push({ x: T.MathUtils.lerp(a.x, b.x, t), y: T.MathUtils.lerp(a.y, b.y, smooth), h: T.MathUtils.lerp(a.h, b.h, smooth), w: T.MathUtils.lerp(a.w, b.w, smooth) })
    }
  }
  rings.push(sections.at(-1)!)
  rings.forEach((r, i) => {
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2
      const sy = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** exponent
      const sz = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** exponent
      positions.push(r.x, r.y + sy * r.h, sz * r.w)
      uvs.push((r.x + 5.3) / 3, j / radial)
      if (i < rings.length - 1 && j < radial) {
        const n = i * (radial + 1) + j
        indices.push(n, n + 1, n + radial + 1, n + 1, n + radial + 2, n + radial + 1)
      }
    }
  })
  for (const [i, reverse] of [[0, true], [rings.length - 1, false]] as const) {
    const c = positions.length / 3, r = rings[i]
    positions.push(r.x, r.y, 0); uvs.push(0.5, 0.5)
    for (let j = 0; j < radial; j++) {
      const n = i * (radial + 1) + j
      indices.push(c, reverse ? n + 1 : n, reverse ? n : n + 1)
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals()
  return g
}
export function tube(points: [number, number, number][], radius = 0.025, segments = 32, closed = false) {
  return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), closed, 'centripetal'), segments, radius, 8, closed)
}
export function cylinderX(radius: number, length: number, end = radius, segments = 40) {
  const g = new T.CylinderGeometry(end, radius, length, segments)
  g.rotateZ(-Math.PI / 2)
  return g
}
export function woodUV(geometry: T.BufferGeometry, scale = 1, vertical = false) {
  const position = geometry.getAttribute('position'), uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = ((vertical ? position.getY(i) : position.getX(i)) + 5.2) * 0.35 * scale
    uv[i * 2 + 1] = ((vertical ? position.getX(i) : position.getY(i)) + position.getZ(i) * 0.6) * 0.65 * scale + 0.5
  }
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); return geometry
}
