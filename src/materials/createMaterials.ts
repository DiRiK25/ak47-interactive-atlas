import * as T from 'three'

function rng(seed: number) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296 }
}
function texture(width: number, height: number, paint: (x: number, y: number) => number[]) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!, data = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = paint(x / width, y / height), i = (y * width + x) * 4
    data.data[i] = c[0]; data.data[i + 1] = c[1]; data.data[i + 2] = c[2]; data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  const tex = new T.CanvasTexture(canvas); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4
  return tex
}
export function createMaterials() {
  const random = rng(47)
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  // Periodic lattice noise keeps the generated textures continuous across UV seams.
  const noise = (x: number, y: number, periodX = 256, periodY = 256) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    const at = (a: number, b: number) => hash(((a % periodX) + periodX) % periodX, ((b % periodY) + periodY) % periodY)
    return T.MathUtils.lerp(T.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u), T.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v)
  }
  const field = (x: number, y: number, sx: number, sy: number) => noise(x * sx, y * sy, sx, sy)
  const grain = (x: number, y: number) => {
    const warp = y + (field(x, y, 3, 4) - .5) * .07 + Math.sin(x * Math.PI * 2) * .012
    const long = field(x, warp, 4, 95)
    const fine = field(x, warp, 18, 360)
    const pores = Math.pow(field(x, warp, 12, 210), 6)
    return (long - .5) * .15 + (fine - .5) * .065 - pores * .18
  }
  const wood = texture(1024, 512, (x, y) => {
    const cloud = field(x, y, 3, 5), aged = field(x, y, 17, 21) - .5
    const amber = Math.pow(field(x, y, 7, 10), 3)
    const tone = .62 + cloud * .75 + grain(x, y) + aged * .24
    return [(70 + amber * 55) * tone, (24 + amber * 27) * tone, (16 + amber * 10) * tone]
  }); wood.colorSpace = T.SRGBColorSpace
  const woodBump = texture(1024, 512, (x, y) => { const v = 130 + grain(x, y) * 95; return [v, v, v] })
  const woodRoughness = texture(512, 256, (x, y) => {
    const v = 155 + field(x, y, 3, 5) * 62 + (field(x, y, 17, 21) - .5) * 35 + grain(x, y) * 70
    return [v, v, v]
  })
  const patina = (x: number, y: number) => (field(x, y, 7, 9) - .5) * .65 + (field(x, y, 23, 27) - .5) * .35
  const metalNoise = texture(512, 512, (x, y) => {
    const v = 185 + patina(x, y) * 60 + (random() - .5) * 7 + (field(x, y, 10, 230) - .5) * 5
    return [v, v, v]
  })
  const roughness = texture(512, 512, (x, y) => {
    const v = 188 - patina(x, y) * 80 + (random() - .5) * 9
    return [v, v, v]
  })
  const metal = new T.MeshStandardMaterial({ color: '#2e342f', metalness: .91, roughness: .56, map: metalNoise, roughnessMap: roughness, bumpMap: metalNoise, bumpScale: .0012, envMapIntensity: 1.05 })
  const edge = new T.MeshStandardMaterial({ color: '#424a43', metalness: .88, roughness: .5, map: metalNoise, roughnessMap: roughness, envMapIntensity: 1.05 })
  const dark = new T.MeshStandardMaterial({ color: '#141a16', metalness: 0.65, roughness: 0.56 })
  const magazine = metal.clone(); magazine.color.set('#333a32'); magazine.roughness = .58
  const woodMat = new T.MeshPhysicalMaterial({ color: '#ffffff', map: wood, roughness: .57, roughnessMap: woodRoughness, metalness: 0, bumpMap: woodBump, bumpScale: .004, clearcoat: .26, clearcoatRoughness: .36, clearcoatRoughnessMap: woodRoughness })
  const redWood = woodMat.clone(); redWood.color.set('#f5dfd3')
  const gripWood = woodMat.clone(); gripWood.color.set('#d4bbc0'); gripWood.roughness = .65; gripWood.clearcoat = .16
  const diagram = new T.MeshStandardMaterial({ color: '#35775b', metalness: 0.1, roughness: 0.6, emissive: '#255c47', emissiveIntensity: 0.1 })
  const materials = { metal, edge, dark, magazine, wood: woodMat, redWood, gripWood, diagram }
  return { materials, textures: [wood, woodBump, woodRoughness, metalNoise, roughness] }
}
export type AtlasMaterials = ReturnType<typeof createMaterials>['materials']
