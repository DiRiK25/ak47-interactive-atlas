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
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), T.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v)
  }
  const grain = (x: number, y: number) => {
    const warp = y + (noise(x * 3, y * 4) - .5) * .12 + Math.sin(x * 4) * .018
    const long = noise(x * 5, warp * 100)
    const fine = noise(x * 16, warp * 420)
    const pores = Math.pow(noise(x * 13, warp * 260), 5)
    return (long - .5) * .13 + (fine - .5) * .075 - pores * .12
  }
  const wood = texture(1024, 512, (x, y) => {
    const tone = .9 + grain(x, y) + (noise(x * 2, y * 7) - .5) * .24
    return [119 * tone, 65 * tone, 33 * tone]
  }); wood.colorSpace = T.SRGBColorSpace
  const woodBump = texture(1024, 512, (x, y) => { const v = 130 + grain(x, y) * 120; return [v, v, v] })
  const metalNoise = texture(512, 512, (x, y) => { const v = 200 + (random() - 0.5) * 22 + Math.sin(y * 600) * 2 + Math.sin(x * 120) * 2; return [v, v, v] })
  const roughness = texture(256, 256, () => { const v = 170 + random() * 45; return [v, v, v] })
  const metal = new T.MeshStandardMaterial({ color: '#434a4b', metalness: 0.86, roughness: 0.44, map: metalNoise, roughnessMap: roughness, bumpMap: metalNoise, bumpScale: 0.002, envMapIntensity: 1.05 })
  const edge = new T.MeshStandardMaterial({ color: '#596163', metalness: 0.87, roughness: 0.4, envMapIntensity: 1.1 })
  const dark = new T.MeshStandardMaterial({ color: '#171d1d', metalness: 0.65, roughness: 0.56 })
  const magazine = metal.clone(); magazine.color.set('#343c3d'); magazine.roughness = 0.39
  const woodMat = new T.MeshPhysicalMaterial({ color: '#ffffff', map: wood, roughness: 0.39, metalness: 0, bumpMap: woodBump, bumpScale: 0.006, clearcoat: 0.18, clearcoatRoughness: 0.45 })
  const redWood = woodMat.clone(); redWood.color.set('#e9c8ae')
  const gripWood = woodMat.clone(); gripWood.color.set('#d1aa85'); gripWood.roughness = 0.46
  const diagram = new T.MeshStandardMaterial({ color: '#91b9aa', metalness: 0.24, roughness: 0.45, emissive: '#255c47', emissiveIntensity: 0.1 })
  const materials = { metal, edge, dark, magazine, wood: woodMat, redWood, gripWood, diagram }
  return { materials, textures: [wood, woodBump, metalNoise, roughness] }
}
export type AtlasMaterials = ReturnType<typeof createMaterials>['materials']
