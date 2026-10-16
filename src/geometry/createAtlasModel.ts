import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { cylinderX, extrude, loft, profile, tube, woodUV } from './primitives'
import type { AtlasMaterials } from '../materials/createMaterials'
import type { PartId } from '../data/types'

export interface ModelPart { id: PartId; group: T.Group; anchor: T.Vector3; spread: T.Vector3; meshes: T.Mesh[]; materials: T.MeshStandardMaterial[]; internal: boolean }
export interface AtlasModel { root: T.Group; parts: Map<PartId, ModelPart>; meshes: T.Mesh[]; dispose: () => void }

export function createAtlasModel(m: AtlasMaterials): AtlasModel {
  const root = new T.Group(), parts = new Map<PartId, ModelPart>(), meshes: T.Mesh[] = []
  let part: ModelPart
  const makePart = (id: PartId, anchor: number[], spread: number[], internal = false) => {
    const group = new T.Group(); group.name = id; root.add(group)
    part = { id, group, anchor: new T.Vector3(...anchor), spread: new T.Vector3(...spread), meshes: [], materials: [], internal }; parts.set(id, part)
  }
  const cloned = new Map<string, T.MeshStandardMaterial>()
  const add = (g: T.BufferGeometry, material: T.MeshStandardMaterial = m.metal, at: [number, number, number] = [0, 0, 0]) => {
    const key = part.id + material.uuid
    if (!cloned.has(key)) { const c = material.clone(); c.userData.baseOpacity = c.opacity; cloned.set(key, c); part.materials.push(c) }
    const mesh = new T.Mesh(g, cloned.get(key)); mesh.position.set(...at); mesh.userData.partId = part.id
    part.group.add(mesh); part.meshes.push(mesh); meshes.push(mesh); return mesh
  }
  const cyl = (x: number, y: number, r: number, length: number, mat = m.metal, z = 0, end = r) => add(cylinderX(r, length, end), mat, [x, y, z])
  const screw = (x: number, y: number, z: number, r = 0.044) => {
    const disk = new T.CylinderGeometry(r, r, 0.016, 20); disk.rotateX(Math.PI / 2)
    add(disk, m.edge, [x, y, z])
    const slot = new T.BoxGeometry(r * 1.2, 0.012, 0.006); slot.rotateZ(0.5)
    add(slot, m.dark, [x, y, z + Math.sign(z) * 0.011])
  }

  makePart('stock', [-4, -.38, 0], [-1.4, .3, .2])
  add(woodUV(loft([
    { x: -5.25, y: -.48, h: .52, w: .24 }, { x: -5.12, y: -.46, h: .58, w: .29 },
    { x: -4.8, y: -.42, h: .57, w: .29 }, { x: -3.8, y: -.3, h: .42, w: .245 },
    { x: -3.25, y: -.2, h: .27, w: .195 }, { x: -2.91, y: -.13, h: .20, w: .17 },
    { x: -2.57, y: -.11, h: .22, w: .19 },
  ])), m.wood)
  add(loft([{ x: -5.29, y: -.48, h: .535, w: .25 }, { x: -5.22, y: -.47, h: .56, w: .265 }]), m.dark)
  add(profile([[-2.79, .12], [-2.46, .12], [-2.46, -.32], [-2.76, -.34]], .42, .018))
  for (const z of [-.28, .28]) {
    screw(-4.91, -.68, z, .035)
    const loop = add(new T.TorusGeometry(.115, .027, 8, 24), m.edge, [-4.75, -.6, z]); loop.scale.y = .6
  }

  makePart('receiver', [-1.38, -.05, 0], [0, .1, 0])
  const receiverShape = new T.Shape()
  const outline: [number, number][] = [[-2.6, .22], [-.1, .22], [.15, .12], [.15, -.52], [-.36, -.58], [-1.58, -.52], [-2.6, -.5]]
  outline.forEach(([x, y], i) => i ? receiverShape.lineTo(x, y) : receiverShape.moveTo(x, y)); receiverShape.closePath()
  add(profile(outline, .55, .025))
  const recess = new T.Path()
  recess.moveTo(-2.32, .035); recess.lineTo(-.72, .035); recess.lineTo(-.56, -.19); recess.lineTo(-.73, -.32); recess.lineTo(-2.32, -.32); recess.closePath()
  receiverShape.holes.push(recess)
  for (const side of [-1, 1]) {
    // Bevelled side shell with an actual recessed outer panel, backed by a solid decorative core.
    add(extrude(receiverShape, .045, .012), m.metal, [0, 0, side * .315])
    add(profile([[-2.32, .035], [-.72, .035], [-.56, -.19], [-.73, -.32], [-2.32, -.32]], .003, 0), m.dark, [0, 0, side * .303])
    for (const [x, y] of [[-2.48, -.3], [-1.5, -.4], [-.25, -.23]]) screw(x, y, side * .365, .033)
  }
  // Outer selector silhouette; decorative, with no mechanism or motion.
  add(profile([[-1.91, -.16], [-.48, -.055], [-.26, -.15], [-.47, -.25], [-1.9, -.23]], .025, .015), m.metal, [0, 0, .397])
  screw(-1.94, -.18, .425, .07)
  add(profile([[-.5, -.06], [-.23, -.05], [-.17, -.12], [-.47, -.17]], .035, .015), m.edge, [0, 0, .44])
  add(tube([[-1.73, -.52, 0], [-1.64, -.89, 0], [-1.31, -1.0, 0], [-.76, -.95, 0], [-.57, -.56, 0]], .045), m.metal)
  add(tube([[-1.2, -.52, 0], [-1.13, -.72, 0], [-1.28, -.84, 0]], .045), m.dark)
  add(profile([[-.6, -.53], [-.35, -.53], [-.39, -.74], [-.55, -.78]], .24, .02))

  makePart('cover', [-1.4, .52, 0], [-.1, 1.65, -.1])
  add(loft([
    { x: -2.57, y: .29, h: .1, w: .27 }, { x: -2.4, y: .31, h: .27, w: .33 },
    { x: -2.18, y: .32, h: .29, w: .35 }, { x: -.35, y: .32, h: .29, w: .35 },
    { x: -.13, y: .32, h: .23, w: .31 },
  ], 40, 6, .85), m.metal)
  for (const z of [-.342, .342]) add(tube([[-2.48, .22, z], [-1.4, .22, z], [-.2, .22, z]], .018), m.edge)
  add(profile([[-2.62, .34], [-2.47, .34], [-2.47, .46], [-2.62, .46]], .16, .015), m.edge)
  // Dark external opening and a short visible handle, no internal geometry.
  add(profile([[-.98, .24], [-.15, .24], [-.15, .39], [-.98, .39]], .015, .018), m.dark, [0, 0, .326])
  const handle = add(cylinderX(.057, .32), m.metal, [-.24, .28, .46]); handle.rotation.y = Math.PI / 2
  add(new T.SphereGeometry(.082, 20, 12), m.edge, [-.24, .28, .64]).scale.set(1.3, .8, 1)

  makePart('handguard', [.95, -.14, 0], [1.05, -.95, .2])
  add(woodUV(loft([
    { x: .04, y: -.14, h: .27, w: .29 }, { x: .18, y: -.14, h: .31, w: .33 },
    { x: .52, y: -.13, h: .32, w: .34 }, { x: 1.38, y: -.07, h: .25, w: .3 },
    { x: 1.72, y: -.04, h: .20, w: .26 },
  ], 32, 8)), m.redWood)
  for (const side of [-1, 1]) {
    add(tube([[.24, -.08, side * .325], [.55, -.07, side * .349], [.98, -.03, side * .337], [1.45, .015, side * .292]], .023, 36), m.gripWood)
  }
  add(loft([{ x: .015, y: -.12, h: .285, w: .305 }, { x: .09, y: -.12, h: .285, w: .305 }]), m.metal)
  add(loft([{ x: 1.68, y: -.03, h: .225, w: .277 }, { x: 1.77, y: -.03, h: .225, w: .277 }]), m.metal)
  add(new T.TorusGeometry(.12, .027, 8, 24), m.edge, [1.73, -.12, -.31]).scale.y = .65

  makePart('gas', [.95, .48, 0], [1.1, 1.15, -.15])
  cyl(.86, .4, .14, 1.95)
  add(woodUV(loft([
    { x: .3, y: .45, h: .16, w: .22 }, { x: .44, y: .46, h: .19, w: .25 },
    { x: 1.28, y: .46, h: .17, w: .23 }, { x: 1.43, y: .44, h: .13, w: .19 },
  ], 32, 6, .8)), m.wood)
  cyl(.26, .42, .195, .13); cyl(1.46, .42, .17, .13)
  cyl(1.78, .4, .135, .52)
  add(profile([[1.92, .55], [2.07, .49], [2.32, .03], [1.99, -.08], [1.9, .2]], .29, .025))
  for (const z of [-.15, .15]) screw(2.07, .27, z, .034)

  makePart('barrel', [3.16, .04, 0], [1.7, .0, -.2])
  cyl(2.3, .025, .125, 4.34, m.metal, 0, .095)
  cyl(.12, .025, .185, .28)
  cyl(2.19, .025, .19, .31)
  cyl(3.74, .025, .145, .23)
  cyl(4.4, .025, .13, .28)
  cyl(4.58, .025, .145, .12, m.edge)
  const muzzle = new T.RingGeometry(.065, .14, 40); muzzle.rotateY(Math.PI / 2)
  add(muzzle, m.metal, [4.648, .025, 0])
  const darkCap = new T.CircleGeometry(.063, 32); darkCap.rotateY(Math.PI / 2)
  add(darkCap, m.dark, [4.649, .025, 0])
  cyl(2.45, -.255, .028, 3.25, m.edge)
  cyl(4.02, -.255, .047, .18, m.metal)
  add(profile([[3.65, -.04], [3.87, -.04], [3.87, -.28], [3.69, -.28]], .14, .015))

  makePart('magazine', [.48, -1.75, 0], [.2, -1.7, .3])
  const mag = new T.Shape(); mag.moveTo(-.57, -.49); mag.lineTo(.43, -.49)
  mag.bezierCurveTo(.48, -1.13, .73, -1.96, 1.42, -2.61)
  mag.lineTo(.64, -3.01); mag.bezierCurveTo(-.1, -2.32, -.48, -1.43, -.57, -.49); mag.closePath()
  add(extrude(mag, .45, .045), m.magazine)
  const rim = new T.Shape(); rim.moveTo(.58, -2.98); rim.lineTo(1.43, -2.55); rim.lineTo(1.51, -2.65); rim.lineTo(.65, -3.09); rim.closePath()
  add(extrude(rim, .51, .025), m.edge)
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const offset = j * .24
      add(tube([[-.37 + offset, -.77, side * .259], [-.28 + offset, -1.32, side * .259], [-.02 + offset, -1.96, side * .259], [.47 + offset, -2.64 + offset * .36, side * .259]], .036, 42), m.magazine)
    }
    add(tube([[-.49, -.61, side * .253], [-.36, -1.53, side * .253], [.02, -2.29, side * .253], [.65, -2.95, side * .253]], .018, 42), m.edge)
    add(tube([[.36, -.61, side * .253], [.54, -1.45, side * .253], [.87, -2.14, side * .253], [1.33, -2.59, side * .253]], .018, 42), m.edge)
    add(profile([[-.47, -.62], [.35, -.62], [.37, -.74], [-.45, -.74]], .015, .012), m.metal, [0, 0, side * .255])
  }

  makePart('grip', [-1.98, -1.25, 0], [-.95, -1.3, .2])
  const grip = new T.Shape(); grip.moveTo(-2.05, -.48); grip.lineTo(-1.52, -.52)
  grip.bezierCurveTo(-1.58, -.9, -1.66, -1.23, -1.53, -1.79)
  grip.quadraticCurveTo(-1.83, -1.93, -2.27, -1.78)
  grip.bezierCurveTo(-2.17, -1.38, -2.05, -.87, -2.05, -.48)
  add(woodUV(extrude(grip, .42, .09), 1, true), m.gripWood)
  for (const z of [-.308, .308]) screw(-1.91, -1.06, z, .065)

  makePart('sights', [2.14, .64, 0], [.15, 1.7, .65])
  add(profile([[-.15, .34], [.33, .34], [.29, .61], [-.13, .66]], .4, .03))
  add(profile([[-.41, .63], [.2, .57], [.19, .67], [-.41, .74]], .24, .015), m.edge)
  add(profile([[-.43, .65], [-.35, .65], [-.35, .8], [-.43, .8]], .31, .012), m.metal)
  add(profile([[3.6, .02], [3.91, .02], [3.87, .49], [3.73, .59], [3.63, .49]], .2, .025))
  const front = add(new T.TorusGeometry(.17, .042, 10, 36, Math.PI * 1.65), m.metal, [3.77, .57, 0]); front.rotation.y = Math.PI / 2; front.rotation.z = -Math.PI * .325
  add(new T.CylinderGeometry(.022, .03, .24, 12), m.edge, [3.77, .53, 0])
  for (const z of [-.12, .12]) screw(3.77, .29, z, .045)

  makePart('core', [-.9, .12, 0], [0, 0, 0], true)
  add(loft([{ x: -1.75, y: .1, h: .13, w: .12 }, { x: -.6, y: .1, h: .18, w: .2 }, { x: -.18, y: .1, h: .1, w: .1 }], 24, 4, 1), m.diagram)
  makePart('return', [-2.03, .36, 0], [0, 0, 0], true)
  add(loft([{ x: -2.45, y: .34, h: .07, w: .08 }, { x: -1.45, y: .34, h: .07, w: .08 }], 20, 2, 1), m.diagram)
  makePart('feed', [-.55, -.29, 0], [0, 0, 0], true)
  add(new T.SphereGeometry(.27, 24, 16), m.diagram, [-.5, -.28, 0]).scale.set(1.3, .65, .65)
  // Batch by part and material: selection remains group-based, draw calls stay small.
  meshes.length = 0
  for (const p of parts.values()) {
    const byMaterial = new Map<T.Material, T.BufferGeometry[]>()
    for (const mesh of p.meshes) {
      mesh.updateMatrix()
      const transformed = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      transformed.applyMatrix4(mesh.matrix)
      const material = mesh.material as T.Material
      if (!byMaterial.has(material)) byMaterial.set(material, [])
      byMaterial.get(material)!.push(transformed)
      mesh.geometry.dispose(); p.group.remove(mesh)
    }
    p.meshes.length = 0
    for (const [material, geometries] of byMaterial) {
      const merged = mergeGeometries(geometries)
      geometries.forEach(g => g.dispose())
      if (!merged) throw new Error('Не удалось объединить геометрию музейной группы')
      const mesh = new T.Mesh(merged, material)
      mesh.userData.partId = p.id; mesh.castShadow = !p.internal; mesh.receiveShadow = !p.internal
      p.meshes.push(mesh); meshes.push(mesh); p.group.add(mesh)
    }
    if (p.internal) p.group.visible = false
  }
  return { root, parts, meshes, dispose: () => { for (const mesh of meshes) mesh.geometry.dispose(); for (const mat of cloned.values()) mat.dispose() } }
}
