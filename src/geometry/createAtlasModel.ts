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

  // These are display-space silhouettes interpreted from the supplied side views.
  // They have no real-world scale, functional internals or manufacturing surfaces.
  const rivet = (x: number, y: number, z: number, radius = .032) => {
    const head = add(new T.SphereGeometry(radius, 16, 10), m.edge, [x, y, z])
    head.scale.z = .3
  }

  makePart('stock', [-4.15, -.55, 0], [-1.4, .3, .2])
  const stock = new T.Shape(); stock.moveTo(-5.45, -.17)
  stock.bezierCurveTo(-4.63, -.08, -3.61, .025, -2.79, .12)
  stock.lineTo(-2.77, -.37); stock.bezierCurveTo(-3.51, -.65, -4.57, -1.07, -5.35, -1.34)
  stock.quadraticCurveTo(-5.43, -1.37, -5.45, -1.28)
  stock.lineTo(-5.49, -.25); stock.quadraticCurveTo(-5.49, -.18, -5.45, -.17)
  const stockGeometry = extrude(stock, .44, .045)
  const stockPosition = stockGeometry.getAttribute('position'), stockNormal = stockGeometry.getAttribute('normal')
  const n = new T.Vector3()
  for (let i = 0; i < stockPosition.count; i++) {
    const x = stockPosition.getX(i), z = stockPosition.getZ(i), slope = -.25 / 2.75
    const width = 1 + (x + 5.5) * slope
    stockPosition.setZ(i, z * width)
    n.fromBufferAttribute(stockNormal, i)
    n.set(n.x - n.z * z * slope / width, n.y, n.z / width).normalize()
    stockNormal.setXYZ(i, n.x, n.y, n.z)
  }
  add(woodUV(stockGeometry), m.wood)
  add(profile([[-5.52, -.19], [-5.48, -.19], [-5.43, -1.33], [-5.48, -1.32]], .48, .015), m.dark)
  add(profile([[-2.805, .13], [-2.755, .13], [-2.755, -.39], [-2.805, -.39]], .41, .008))
  const sling = add(new T.TorusGeometry(.075, .016, 8, 24), m.metal, [-4.45, -1.025, 0])
  sling.rotation.x = Math.PI / 2; sling.scale.y = .65

  makePart('receiver', [-1.26, -.06, 0], [0, .1, 0])
  add(profile([[-2.79, .15], [-2.55, .25], [.28, .25], [.3, -.26], [-.35, -.32], [-2.76, -.39]], .49, .018))
  for (const side of [-1, 1]) {
    add(tube([[-2.65, .1, side * .266], [-1.85, .1, side * .266], [-.75, .12, side * .266], [.22, .14, side * .266]], .008, 36), m.edge)
    for (const [x, y] of [[-2.3, -.26], [-1.83, -.28], [-1.37, -.18], [-1.12, -.24], [-.95, -.03], [-.76, -.14]]) rivet(x, y, side * .269)
    add(tube([[-2.71, -.31, side * .266], [-1.6, -.31, side * .266], [-.35, -.29, side * .266]], .006, 28), m.edge)
  }
  // Static external silhouettes only; no control is operable.
  add(profile([[-2.1, -.055], [-1.88, -.02], [-.12, .235], [-.035, .18], [-.15, .07], [-1.98, -.16]], .018, .009), m.metal, [0, 0, .288])
  rivet(-2.08, -.055, .313, .067)
  add(profile([[-.16, .205], [-.025, .23], [.015, .14], [-.15, .11]], .026, .008), m.edge, [0, 0, .305])
  const guard = new T.Shape(); guard.moveTo(-2.0, -.36); guard.lineTo(-1.18, -.33)
  guard.lineTo(-1.2, -.63); guard.quadraticCurveTo(-1.22, -.74, -1.4, -.75)
  guard.lineTo(-1.82, -.75); guard.quadraticCurveTo(-2.0, -.72, -2.02, -.58); guard.closePath()
  const guardOpening = new T.Path(); guardOpening.moveTo(-1.955, -.4); guardOpening.lineTo(-1.225, -.375)
  guardOpening.lineTo(-1.245, -.61); guardOpening.quadraticCurveTo(-1.25, -.7, -1.4, -.705)
  guardOpening.lineTo(-1.8, -.705); guardOpening.quadraticCurveTo(-1.96, -.685, -1.97, -.565); guardOpening.closePath()
  guard.holes.push(guardOpening); add(extrude(guard, .13, .008), m.metal)
  add(tube([[-1.72, -.36, 0], [-1.76, -.52, 0], [-1.65, -.625, 0]], .026, 24), m.dark)
  add(profile([[-1.19, -.34], [-1.07, -.34], [-1.09, -.55], [-1.17, -.56]], .18, .012))

  makePart('cover', [-1.4, .41, 0], [-.1, 1.65, -.1])
  add(loft([
    { x: -2.78, y: .155, h: .025, w: .225 }, { x: -2.57, y: .29, h: .13, w: .265 },
    { x: -2.43, y: .315, h: .165, w: .28 }, { x: -.18, y: .315, h: .165, w: .28 },
    { x: .04, y: .3, h: .14, w: .25 },
  ], 48, 6, .55), m.metal)
  for (const z of [-.278, .278]) add(tube([[-2.72, .165, z], [-2.4, .19, z], [-.15, .19, z]], .009, 36), m.edge)
  add(profile([[-.69, .19], [.025, .19], [.025, .305], [-.69, .305]], .005, .01), m.dark, [0, 0, .287])
  const handle = add(cylinderX(.038, .19), m.metal, [.015, .24, .355]); handle.rotation.y = Math.PI / 2
  add(new T.SphereGeometry(.051, 18, 10), m.edge, [.015, .24, .455]).scale.set(1.45, .7, 1)

  makePart('handguard', [1.2, -.08, 0], [1.05, -.95, .2])
  const fore = new T.Shape(); fore.moveTo(.315, .185); fore.lineTo(.85, .19); fore.lineTo(2.13, .17)
  fore.quadraticCurveTo(2.18, .055, 2.145, -.14)
  fore.bezierCurveTo(1.83, -.17, 1.22, -.155, .91, -.225)
  fore.quadraticCurveTo(.73, -.27, .58, -.375)
  fore.quadraticCurveTo(.45, -.4, .315, -.285); fore.closePath()
  add(woodUV(extrude(fore, .45, .035), 1.1), m.redWood)
  add(profile([[.29, .2], [.34, .2], [.34, -.3], [.29, -.28]], .5, .01))
  add(loft([{ x: 2.13, y: .015, h: .2, w: .265 }, { x: 2.21, y: .015, h: .2, w: .265 }], 32, 2, .4), m.metal)
  add(new T.TorusGeometry(.075, .018, 8, 24), m.metal, [2.17, -.09, -.28]).scale.y = .6

  makePart('gas', [1.58, .4, 0], [1.1, 1.15, -.15])
  cyl(1.51, .35, .115, 2.57)
  const upper = new T.Shape(); upper.moveTo(.88, .205); upper.lineTo(.88, .515)
  upper.quadraticCurveTo(1.3, .545, 2.125, .515); upper.lineTo(2.135, .205)
  upper.lineTo(1.97, .205); upper.lineTo(1.97, .255); upper.quadraticCurveTo(1.85, .285, 1.72, .255)
  upper.lineTo(1.72, .205); upper.lineTo(1.31, .205); upper.lineTo(1.31, .255)
  upper.quadraticCurveTo(1.18, .285, 1.05, .255); upper.lineTo(1.05, .205); upper.closePath()
  add(woodUV(extrude(upper, .365, .022), .95), m.wood)
  cyl(.855, .35, .19, .07); cyl(2.16, .35, .18, .07)
  cyl(2.65, .35, .108, 1.02)
  for (const x of [2.29, 2.43, 2.57]) cyl(x, .35, .116, .045, m.edge)
  add(profile([[3.11, .455], [3.19, .425], [3.43, .12], [3.5, .075], [3.48, -.025], [3.14, -.025], [3.12, .13]], .24, .014))
  for (const z of [-.14, .14]) rivet(3.16, .09, z, .025)

  makePart('barrel', [3.46, .045, 0], [1.7, .0, -.2])
  cyl(2.53, .045, .09, 4.27, m.metal, 0, .075)
  cyl(.4, .045, .14, .15); cyl(3.19, .045, .12, .16); cyl(4.4, .045, .105, .2)
  cyl(4.64, .045, .09, .17); cyl(4.76, .045, .104, .12)
  const muzzle = new T.RingGeometry(.045, .101, 36); muzzle.rotateY(Math.PI / 2)
  add(muzzle, m.edge, [4.823, .045, 0])
  const darkCap = new T.CircleGeometry(.044, 28); darkCap.rotateY(Math.PI / 2)
  add(darkCap, m.dark, [4.824, .045, 0])
  cyl(3.33, -.13, .019, 2.82, m.edge); cyl(4.61, -.13, .029, .12)
  add(profile([[4.27, .015], [4.49, .015], [4.49, -.15], [4.31, -.15]], .11, .01))

  makePart('magazine', [-.35, -1.35, 0], [.2, -1.7, .3])
  const mag = new T.Shape(); mag.moveTo(-1.085, -.315); mag.lineTo(-.385, -.31)
  mag.bezierCurveTo(-.32, -.93, .06, -1.39, .7, -1.73)
  mag.lineTo(.3, -2.32); mag.bezierCurveTo(-.53, -1.89, -1.005, -1.14, -1.085, -.315); mag.closePath()
  add(extrude(mag, .345, .028), m.magazine)
  const panel = new T.Shape(); panel.moveTo(-.975, -.46); panel.lineTo(-.48, -.45)
  panel.bezierCurveTo(-.39, -1.02, -.035, -1.45, .57, -1.78)
  panel.lineTo(.275, -2.16); panel.bezierCurveTo(-.44, -1.75, -.9, -1.09, -.975, -.46); panel.closePath()
  for (const side of [-1, 1]) {
    add(extrude(panel, .008, .012), m.magazine, [0, 0, side * .196])
    add(tube([[-1.025, -.42, side * .204], [-.87, -1.12, side * .204], [-.42, -1.79, side * .204], [.3, -2.265, side * .204]], .011, 42), m.edge)
    add(tube([[-.425, -.41, side * .204], [-.235, -1.04, side * .204], [.19, -1.51, side * .204], [.655, -1.765, side * .204]], .011, 42), m.edge)
    add(profile([[-1.03, -.35], [-.43, -.35], [-.417, -.43], [-1.02, -.43]], .008, .006), m.metal, [0, 0, side * .205])
  }
  add(profile([[.265, -2.30], [.695, -1.71], [.75, -1.75], [.31, -2.365]], .39, .012), m.metal)

  makePart('grip', [-2.46, -.93, 0], [-.95, -1.3, .2])
  const grip = new T.Shape(); grip.moveTo(-2.52, -.365); grip.lineTo(-1.985, -.375)
  grip.bezierCurveTo(-2.08, -.65, -2.34, -.97, -2.39, -1.255)
  grip.quadraticCurveTo(-2.41, -1.395, -2.49, -1.42); grip.lineTo(-2.73, -1.405)
  grip.quadraticCurveTo(-2.91, -1.4, -2.96, -1.22)
  grip.bezierCurveTo(-2.86, -.95, -2.66, -.65, -2.52, -.365); grip.closePath()
  add(woodUV(extrude(grip, .32, .045), 1, true), m.gripWood)
  for (const side of [-1, 1]) {
    const inset = extrude(grip, .004, .008); inset.scale(.81, .82, 1); inset.translate(-2.47 * .19, -.9 * .18, side * .207)
    add(woodUV(inset, 1, true), m.gripWood)
    screw(-2.48, -.87, side * .222, .035)
  }

  makePart('sights', [2.48, .59, 0], [.15, 1.7, .65])
  add(profile([[.3, .2], [.855, .2], [.855, .51], [.76, .58], [.33, .58]], .34, .018))
  add(profile([[.34, .54], [.81, .54], [.79, .615], [.35, .63]], .2, .008), m.edge)
  add(profile([[.31, .57], [.37, .57], [.37, .66], [.31, .66]], .29, .008))
  for (const z of [-.184, .184]) rivet(.48, .48, z, .024)
  const sightBase = new T.Shape(); sightBase.moveTo(4.17, .06); sightBase.lineTo(4.6, .06)
  sightBase.lineTo(4.51, .2); sightBase.lineTo(4.49, .62)
  sightBase.quadraticCurveTo(4.44, .685, 4.345, .635); sightBase.lineTo(4.235, .2); sightBase.closePath()
  const lowerWindow = new T.Path(); lowerWindow.moveTo(4.28, .23); lowerWindow.lineTo(4.45, .23)
  lowerWindow.lineTo(4.44, .375); lowerWindow.quadraticCurveTo(4.38, .42, 4.325, .375); lowerWindow.closePath()
  const upperWindow = new T.Path(); upperWindow.absellipse(4.405, .53, .044, .052, 0, Math.PI * 2, true)
  sightBase.holes.push(lowerWindow, upperWindow); add(extrude(sightBase, .145, .012))
  const front = add(new T.TorusGeometry(.105, .017, 8, 32, Math.PI * 1.65), m.metal, [4.4, .56, 0])
  front.rotation.y = Math.PI / 2; front.rotation.z = -Math.PI * .325
  add(new T.CylinderGeometry(.013, .018, .13, 10), m.edge, [4.4, .58, 0])

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
