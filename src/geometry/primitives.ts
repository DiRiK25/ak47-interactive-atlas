import * as T from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

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
  const smoothed = toCreasedNormals(g, Math.PI / 3)
  // Keep the broad cap planes truly flat. Averaging their normals with narrow
  // bevel triangles otherwise creates large diagonal reflection artifacts.
  const position = smoothed.getAttribute('position'), normal = smoothed.getAttribute('normal')
  const cap = depth / 2 + bevel
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(Math.abs(position.getZ(i)) - cap) < 1e-5) normal.setXYZ(i, 0, 0, Math.sign(position.getZ(i)))
  }
  if (smoothed !== g) g.dispose()
  return smoothed
}
export interface Section { x: number; y: number; h: number; w: number }
/** Smooth, softly squared cross sections with genuinely rounded transitions. */
export function loft(sections: Section[], radial = 32, subdivisions = 6, exponent = 0.55, linear = false) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const rings: Section[] = []
  for (let k = 0; k < sections.length - 1; k++) {
    const a = sections[k], b = sections[k + 1]
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions, smooth = linear ? t : t * t * (3 - 2 * t)
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
    // Separate end-cap vertices prevent the cap normals pinching the side wall.
    const capStart = positions.length / 3
    for (let j = 0; j <= radial; j++) {
      const offset = (i * (radial + 1) + j) * 3
      positions.push(positions[offset], positions[offset + 1], positions[offset + 2])
      uvs.push((positions[offset + 2] / r.w + 1) / 2, ((positions[offset + 1] - r.y) / r.h + 1) / 2)
    }
    for (let j = 0; j < radial; j++) {
      const n = capStart + j
      indices.push(c, reverse ? n + 1 : n, reverse ? n : n + 1)
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals()
  // The UV seam has duplicate positions; average its two normals explicitly.
  const normal = g.getAttribute('normal'), seam = new T.Vector3(), opposite = new T.Vector3()
  for (let i = 0; i < rings.length; i++) {
    const first = i * (radial + 1), last = first + radial
    seam.fromBufferAttribute(normal, first).add(opposite.fromBufferAttribute(normal, last)).normalize()
    normal.setXYZ(first, seam.x, seam.y, seam.z); normal.setXYZ(last, seam.x, seam.y, seam.z)
  }
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
    uv[i * 2 + 1] = ((vertical ? position.getX(i) - position.getY(i) * .43 : position.getY(i)) + position.getZ(i) * 0.6) * 0.65 * scale + 0.5
  }
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); return geometry
}
