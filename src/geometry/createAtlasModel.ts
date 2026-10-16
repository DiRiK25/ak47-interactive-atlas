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
  // Broad side faces and a shaped comb; all coordinates are artistic display units.
  const stock = new T.Shape(); stock.moveTo(-5.3, -.03); stock.lineTo(-4.91, .015)
  stock.bezierCurveTo(-4.32, .06, -3.72, .17, -3.4, .15)
  stock.lineTo(-3.16, .075); stock.quadraticCurveTo(-2.94, .015, -2.61, .015)
  stock.lineTo(-2.57, -.35); stock.quadraticCurveTo(-2.99, -.38, -3.43, -.57)
  stock.lineTo(-5.15, -1.15); stock.quadraticCurveTo(-5.27, -1.18, -5.29, -1.03)
  stock.lineTo(-5.36, -.15); stock.quadraticCurveTo(-5.37, -.06, -5.3, -.03)
  const stockGeometry = extrude(stock, .44, .065)
  const stockPosition = stockGeometry.getAttribute('position'), stockNormal = stockGeometry.getAttribute('normal')
  const n = new T.Vector3()
  for (let i = 0; i < stockPosition.count; i++) {
    const x = stockPosition.getX(i), z = stockPosition.getZ(i), slope = -.25 / 2.9
    const width = 1 + (x + 5.4) * slope
    stockPosition.setZ(i, z * width)
    // Transform normals with the inverse transpose of the thickness taper.
    n.fromBufferAttribute(stockNormal, i)
    n.set(n.x - n.z * z * slope / width, n.y, n.z / width).normalize()
    stockNormal.setXYZ(i, n.x, n.y, n.z)
  }
  add(woodUV(stockGeometry), m.wood)
  add(profile([[-5.405, -.07], [-5.35, -.08], [-5.26, -1.15], [-5.32, -1.14]], .5, .026), m.dark)
  add(profile([[-2.79, .07], [-2.46, .07], [-2.46, -.35], [-2.76, -.37]], .45, .018))
  screw(-4.83, -.87, -.294, .032)
  const sling = add(new T.TorusGeometry(.108, .021, 8, 28), m.metal, [-4.65, -.8, -.31]); sling.scale.y = .63

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
  const arch = new T.Shape(); arch.moveTo(-.315, .22); arch.lineTo(-.325, .34)
  arch.quadraticCurveTo(-.32, .51, -.16, .55)
  arch.quadraticCurveTo(0, .59, .16, .55)
  arch.quadraticCurveTo(.32, .51, .325, .34); arch.lineTo(.315, .22); arch.closePath()
  const cover = extrude(arch, 2.37, .025); cover.rotateY(Math.PI / 2); cover.translate(-1.35, 0, 0)
  add(cover, m.metal)
  for (const z of [-.339, .339]) add(tube([[-2.53, .22, z], [-1.4, .22, z], [-.17, .22, z]], .012), m.edge)
  add(profile([[-2.62, .34], [-2.47, .34], [-2.47, .46], [-2.62, .46]], .16, .015), m.edge)
  // Dark external opening and a short visible handle, no internal geometry.
  add(profile([[-.98, .24], [-.15, .24], [-.15, .37], [-.98, .37]], .008, .012), m.dark, [0, 0, .353])
  const handle = add(cylinderX(.057, .32), m.metal, [-.24, .28, .46]); handle.rotation.y = Math.PI / 2
  add(new T.SphereGeometry(.082, 20, 12), m.edge, [-.24, .28, .64]).scale.set(1.3, .8, 1)

  makePart('handguard', [.95, -.14, 0], [1.05, -.95, .2])
  const fore = new T.Shape(); fore.moveTo(.055, .085); fore.lineTo(.34, .11); fore.lineTo(1.7, .1)
  fore.lineTo(1.72, -.19); fore.quadraticCurveTo(1.69, -.28, 1.52, -.29)
  fore.lineTo(.47, -.4); fore.quadraticCurveTo(.23, -.51, .11, -.36); fore.closePath()
  add(woodUV(extrude(fore, .43, .045)), m.redWood)
  // Shallow sculpted side recess, backed by wood. It is an exterior visual detail.
  const groove = new T.Path(); groove.moveTo(.37, -.095)
  groove.bezierCurveTo(.65, -.06, 1.08, -.035, 1.43, -.028)
  groove.quadraticCurveTo(1.5, -.03, 1.43, -.09)
  groove.bezierCurveTo(1.06, -.115, .66, -.16, .37, -.165)
  groove.quadraticCurveTo(.29, -.13, .37, -.095); groove.closePath()
  fore.holes.push(groove)
  for (const side of [-1, 1]) {
    const shell = extrude(fore, .025, .01); shell.translate(0, 0, side * .266)
    add(woodUV(shell), m.redWood)
    const inset = extrude(new T.Shape(groove.getPoints(32)), .001, 0); inset.translate(0, 0, side * .261)
    add(woodUV(inset), m.gripWood)
  }
  add(loft([{ x: .015, y: -.12, h: .255, w: .29 }, { x: .09, y: -.12, h: .255, w: .29 }]), m.metal)
  add(loft([{ x: 1.68, y: -.08, h: .215, w: .285 }, { x: 1.77, y: -.08, h: .215, w: .285 }]), m.metal)
  add(new T.TorusGeometry(.11, .022, 8, 24), m.metal, [1.73, -.12, -.32]).scale.y = .65

  makePart('gas', [.95, .48, 0], [1.1, 1.15, -.15])
  cyl(.86, .4, .14, 1.95)
  const upper = new T.Shape(); upper.moveTo(-.2, .29); upper.lineTo(-.215, .44)
  upper.quadraticCurveTo(-.205, .57, 0, .585)
  upper.quadraticCurveTo(.205, .57, .215, .44); upper.lineTo(.2, .29); upper.closePath()
  const upperGeometry = extrude(upper, 1.04, .04)
  upperGeometry.rotateY(Math.PI / 2); upperGeometry.translate(.87, 0, 0)
  add(woodUV(upperGeometry, .9), m.wood)
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
  add(extrude(rim, .48, .018), m.magazine)
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const offset = j * .24
      add(tube([[-.37 + offset, -.77, side * .25], [-.28 + offset, -1.32, side * .25], [-.02 + offset, -1.96, side * .25], [.47 + offset, -2.64 + offset * .36, side * .25]], .029, 42), m.magazine)
    }
    add(tube([[-.49, -.61, side * .253], [-.36, -1.53, side * .253], [.02, -2.29, side * .253], [.65, -2.95, side * .253]], .018, 42), m.edge)
    add(tube([[.36, -.61, side * .253], [.54, -1.45, side * .253], [.87, -2.14, side * .253], [1.33, -2.59, side * .253]], .018, 42), m.edge)
    add(profile([[-.47, -.62], [.35, -.62], [.37, -.74], [-.45, -.74]], .015, .012), m.metal, [0, 0, side * .255])
  }

  makePart('grip', [-2.12, -1.18, 0], [-.95, -1.3, .2])
  const grip = new T.Shape(); grip.moveTo(-2.04, -.48); grip.lineTo(-1.51, -.53)
  grip.bezierCurveTo(-1.56, -.75, -1.92, -1.18, -2.03, -1.67)
  grip.quadraticCurveTo(-2.03, -1.83, -2.19, -1.84); grip.lineTo(-2.52, -1.77)
  grip.quadraticCurveTo(-2.68, -1.72, -2.59, -1.53)
  grip.bezierCurveTo(-2.32, -1.08, -2.15, -.68, -2.04, -.48); grip.closePath()
  add(woodUV(extrude(grip, .38, .06), 1, true), m.gripWood)
  for (const z of [-.257, .257]) screw(-2.04, -1.08, z, .05)

  makePart('sights', [2.14, .64, 0], [.15, 1.7, .65])
  add(profile([[-.15, .34], [.33, .34], [.29, .61], [-.13, .66]], .4, .03))
  add(profile([[-.41, .63], [.2, .57], [.19, .67], [-.41, .74]], .24, .015), m.edge)
  add(profile([[-.43, .65], [-.35, .65], [-.35, .8], [-.43, .8]], .31, .012), m.metal)
  const sightBase = new T.Shape(); sightBase.moveTo(3.59, .02); sightBase.lineTo(3.94, .02)
  sightBase.lineTo(3.84, .58); sightBase.lineTo(3.7, .58); sightBase.closePath()
  const sightWindow = new T.Path(); sightWindow.moveTo(3.695, .17); sightWindow.lineTo(3.84, .17)
  sightWindow.lineTo(3.8, .39); sightWindow.quadraticCurveTo(3.77, .45, 3.74, .39); sightWindow.closePath()
  sightBase.holes.push(sightWindow); add(extrude(sightBase, .2, .017))
  const front = add(new T.TorusGeometry(.17, .042, 10, 36, Math.PI * 1.65), m.metal, [3.77, .57, 0]); front.rotation.y = Math.PI / 2; front.rotation.z = -Math.PI * .325
  add(new T.CylinderGeometry(.022, .03, .24, 12), m.edge, [3.77, .53, 0])
  for (const z of [-.12, .12]) screw(3.77, .1, z, .032)

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
