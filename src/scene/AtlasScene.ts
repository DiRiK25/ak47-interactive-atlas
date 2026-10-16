import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createAtlasModel } from '../geometry/createAtlasModel'
import { createMaterials } from '../materials/createMaterials'
import { damping, fitDistance, pixelRatio } from '../utils/motion'
import type { PartId, SceneState, View } from '../data/types'
import { partById } from '../data/parts'

interface Callbacks {
  onSelect: (id: PartId | null) => void
  onHover: (id: PartId | null) => void
  onReady: () => void
  onError: (message: string) => void
}
interface Marker { element: HTMLButtonElement; id: PartId }

/** Imperative rendering keeps the animation loop independent of React renders. */
export class AtlasScene {
  readonly renderer: T.WebGLRenderer
  readonly camera = new T.PerspectiveCamera(33, 1, .08, 160)
  readonly scene = new T.Scene()
  readonly controls: OrbitControls
  readonly materialSet = createMaterials()
  readonly model = createAtlasModel(this.materialSet.materials)
  private environment: T.WebGLRenderTarget
  private state: SceneState
  private callbacks: Callbacks
  private resizeObserver: ResizeObserver
  private frame = 0
  private stopped = false
  private clock = new T.Clock()
  private elapsed = 0
  private lastInteraction = -100
  private dragging = false
  private pointerStart = new T.Vector2()
  private activePointers = new Set<number>()
  private gestureMoved = false
  private raycaster = new T.Raycaster()
  private pointer = new T.Vector2()
  private hovered: PartId | null = null
  private targetPosition: T.Vector3 | null = null
  private targetLook = new T.Vector3(-.2, -.65, 0)
  private markers: Marker[] = []
  private lines: T.LineSegments
  private linePositions = new Float32Array(9 * 6)
  private scratch = new T.Vector3()
  private qualityWindow = { seconds: 0, frames: 0, warmup: 2 }
  private hasRendered = false
  private baseDistance = 18
  private lastMarkerUpdate = 0
  private width = 1
  private height = 1

  constructor(private container: HTMLDivElement, markerLayer: HTMLDivElement, state: SceneState, callbacks: Callbacks) {
    this.state = state; this.callbacks = callbacks
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.shadowMap.type = T.PCFSoftShadowMap
    this.renderer.setClearColor('#fafaf8', 0)
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.setAttribute('aria-label', 'Интерактивная трёхмерная модель АК Type 3. Вращайте перетаскиванием; для выбора деталей также доступен список.')
    this.renderer.domElement.setAttribute('role', 'img')
    this.renderer.domElement.setAttribute('data-testid', 'atlas-canvas')
    container.append(this.renderer.domElement)
    this.scene.add(this.model.root)
    const pmrem = new T.PMREMGenerator(this.renderer), studio = new RoomEnvironment()
    this.environment = pmrem.fromScene(studio, .04)
    this.scene.environment = this.environment.texture
    studio.dispose(); pmrem.dispose()
    this.scene.add(new T.HemisphereLight('#fffaf3', '#c8d1d4', 1.2))
    const key = new T.DirectionalLight('#fff4df', 2.8); key.position.set(-3, 7, 6); key.castShadow = true
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6
    key.shadow.camera.near = .5; key.shadow.camera.far = 30; key.shadow.normalBias = .015; key.shadow.bias = -.0001
    this.scene.add(key)
    const fill = new T.DirectionalLight('#e1ebff', 2.0); fill.position.set(4, 3, -5); this.scene.add(fill)
    const rim = new T.DirectionalLight('#ffffff', 2.2); rim.position.set(-5, -1, -3); this.scene.add(rim)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = !state.reducedMotion; this.controls.dampingFactor = .075
    this.controls.enablePan = false; this.controls.rotateSpeed = .55; this.controls.zoomSpeed = .7
    this.controls.minPolarAngle = .12; this.controls.maxPolarAngle = Math.PI - .12
    this.controls.autoRotateSpeed = .27
    this.controls.touches.ONE = T.TOUCH.ROTATE; this.controls.touches.TWO = T.TOUCH.DOLLY_ROTATE
    this.controls.addEventListener('start', this.onInteractionStart)
    this.controls.addEventListener('end', this.onInteractionEnd)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerCancel)
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave)
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost)
    document.addEventListener('visibilitychange', this.onVisibility)
    const lineGeometry = new T.BufferGeometry(); lineGeometry.setAttribute('position', new T.BufferAttribute(this.linePositions, 3))
    this.lines = new T.LineSegments(lineGeometry, new T.LineBasicMaterial({ color: '#89998f', transparent: true, opacity: .38, depthTest: false }))
    this.lines.visible = false; this.scene.add(this.lines)
    for (const p of this.model.parts.values()) {
      if (p.internal) continue
      const el = document.createElement('button'); el.className = 'scene-marker'; el.type = 'button'
      el.textContent = `${partById[p.id].number}  ${partById[p.id].name}`
      el.setAttribute('aria-label', `Выбрать: ${partById[p.id].name}`)
      el.addEventListener('click', () => this.callbacks.onSelect(p.id))
      el.hidden = true; markerLayer.append(el); this.markers.push({ element: el, id: p.id })
    }
    this.resizeObserver = new ResizeObserver(this.onResize); this.resizeObserver.observe(container)
    this.onResize(); this.resetCamera(true); this.animate()
  }

  update(state: SceneState) {
    const previous = this.state; this.state = state
    this.controls.enableDamping = !state.reducedMotion
    if (previous.quality !== state.quality) {
      this.renderer.shadowMap.enabled = state.quality === 'high' || (state.quality === 'auto' && this.width >= 700)
      this.renderer.setPixelRatio(pixelRatio(state.quality, window.devicePixelRatio, this.width < 700))
      this.qualityWindow = { seconds: 0, frames: 0, warmup: 2 }
    }
    if (previous.mode !== state.mode) {
      this.resetCamera()
      this.callbacks.onHover(null); this.hovered = null
    }
    if (state.mode === 'focus' && state.selected && (state.selected !== previous.selected || previous.mode !== 'focus')) this.focus(state.selected)
    this.container.dataset.mode = state.mode
    this.container.dataset.selected = state.selected ?? ''
  }
  private onResize = () => {
    this.width = this.container.clientWidth; this.height = this.container.clientHeight
    if (!this.width || !this.height) return
    this.model.root.rotation.z = this.width < 700 ? .26 : 0
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix()
    this.renderer.shadowMap.enabled = this.state.quality === 'high' || (this.state.quality === 'auto' && this.width >= 700)
    this.renderer.setPixelRatio(pixelRatio(this.state.quality, window.devicePixelRatio, this.width < 700))
    this.renderer.setSize(this.width, this.height)
    this.baseDistance = fitDistance(this.state.mode === 'exhibit' ? 15 : 11.5, this.state.mode === 'exhibit' ? 9 : 5.5, this.camera.aspect, this.camera.fov)
    this.controls.minDistance = this.state.mode === 'focus' ? 2.7 : this.baseDistance * .56
    this.controls.maxDistance = this.baseDistance * 1.55
    this.resetCamera()
    if (this.state.mode === 'focus' && this.state.selected) this.focus(this.state.selected)
  }
  resetCamera(immediate = false) {
    const width = this.state.mode === 'exhibit' ? 15 : this.width < 700 ? 10.8 : 11.8
    const height = this.state.mode === 'exhibit' ? 9 : 5.5
    this.baseDistance = fitDistance(width, height, this.camera.aspect, this.camera.fov)
    this.controls.minDistance = this.state.mode === 'focus' ? 2.7 : this.baseDistance * .56
    this.controls.maxDistance = this.baseDistance * 1.55
    this.targetLook.set(-.25, this.state.mode === 'exhibit' ? -.8 : -.75, 0)
    this.targetPosition = new T.Vector3(.29, .17, 1).normalize().multiplyScalar(this.baseDistance).add(this.targetLook)
    if (immediate || this.state.reducedMotion) {
      this.camera.position.copy(this.targetPosition); this.controls.target.copy(this.targetLook); this.targetPosition = null; this.controls.update()
    }
    this.lastInteraction = this.elapsed
  }
  view(view: View) {
    this.resetCamera()
    const direction = { perspective: [.29, .17, 1], left: [0, .02, 1], right: [0, .02, -1], top: [0, 1, .001] }[view]
    this.targetPosition = new T.Vector3(...direction).normalize().multiplyScalar(this.baseDistance).add(this.targetLook)
    if (this.state.reducedMotion) { this.camera.position.copy(this.targetPosition); this.controls.target.copy(this.targetLook); this.targetPosition = null }
  }
  zoom(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const distance = T.MathUtils.clamp(offset.length() * (direction > 0 ? .82 : 1.22), this.controls.minDistance, this.controls.maxDistance)
    this.targetLook.copy(this.controls.target); this.targetPosition = offset.setLength(distance).add(this.controls.target)
    this.lastInteraction = this.elapsed
  }
  private focus(id: PartId) {
    const p = this.model.parts.get(id)!
    const box = new T.Box3()
    for (const mesh of p.meshes) { mesh.geometry.computeBoundingBox(); box.union(mesh.geometry.boundingBox!) }
    this.model.root.updateMatrixWorld(true); box.applyMatrix4(this.model.root.matrixWorld)
    const size = box.getSize(new T.Vector3())
    box.getCenter(this.targetLook)
    const distance = Math.max(3.1, fitDistance(Math.min(size.x + 1.6, 8), size.y + 1.1, this.camera.aspect, this.camera.fov))
    this.targetPosition = new T.Vector3(.25, .12, 1).normalize().multiplyScalar(distance).add(this.targetLook)
    this.controls.minDistance = Math.max(2, distance * .6); this.controls.maxDistance = this.baseDistance * 1.55
    if (this.state.reducedMotion) { this.camera.position.copy(this.targetPosition); this.controls.target.copy(this.targetLook); this.targetPosition = null }
  }
  private onInteractionStart = () => { this.dragging = true; this.targetPosition = null; this.lastInteraction = this.elapsed }
  private onInteractionEnd = () => { this.dragging = false; this.lastInteraction = this.elapsed }
  private onPointerDown = (e: PointerEvent) => {
    if (!this.activePointers.size) { this.pointerStart.set(e.clientX, e.clientY); this.gestureMoved = false }
    this.activePointers.add(e.pointerId)
    if (this.activePointers.size > 1) this.gestureMoved = true
  }
  private onPointerCancel = (e: PointerEvent) => { this.activePointers.delete(e.pointerId); this.gestureMoved = true }
  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId)
    if (!this.gestureMoved && this.pointerStart.distanceTo(new T.Vector2(e.clientX, e.clientY)) < 6 && e.isPrimary) {
      const part = this.pick(e); this.callbacks.onSelect(part)
    }
  }
  private onPointerMove = (e: PointerEvent) => {
    if (this.activePointers.has(e.pointerId) && this.pointerStart.distanceTo(new T.Vector2(e.clientX, e.clientY)) >= 6) this.gestureMoved = true
    if (this.dragging || e.pointerType === 'touch') return
    const part = this.pick(e)
    if (part !== this.hovered) { this.hovered = part; this.callbacks.onHover(part); this.renderer.domElement.style.cursor = part ? 'pointer' : 'grab' }
  }
  private onPointerLeave = () => { this.hovered = null; this.callbacks.onHover(null) }
  private pick(e: PointerEvent): PartId | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.model.meshes, false)
    if (this.state.mode === 'internal') {
      const inner = hits.find(h => this.model.parts.get(h.object.userData.partId)?.internal)
      if (inner) return inner.object.userData.partId
    }
    const hit = hits.find(h => this.model.parts.get(h.object.userData.partId)?.group.visible)
    return hit ? hit.object.userData.partId : null
  }
  private onContextLost = (e: Event) => { e.preventDefault(); this.callbacks.onError('Графический контекст прерван. Перезагрузите экспозицию, чтобы восстановить изображение.'); this.stopped = true; cancelAnimationFrame(this.frame) }
  private onVisibility = () => { if (!document.hidden && !this.stopped) { this.clock.getDelta(); this.animate() } else cancelAnimationFrame(this.frame) }
  private animate = () => {
    if (this.stopped || document.hidden) return
    const measuredDelta = this.clock.getDelta()
    const dt = Math.min(measuredDelta, .05); this.elapsed += dt
    const a = this.state.reducedMotion ? 1 : damping(5, dt)
    const interactive = !this.dragging && this.elapsed - this.lastInteraction > 4
    this.controls.autoRotate = this.state.autoRotate && interactive && !this.state.reducedMotion && this.state.mode === 'normal' && !this.targetPosition
    this.controls.autoRotateSpeed = T.MathUtils.lerp(this.controls.autoRotateSpeed, this.controls.autoRotate ? .27 : 0, a)
    if (this.targetPosition) {
      this.camera.position.lerp(this.targetPosition, a); this.controls.target.lerp(this.targetLook, a)
      if (this.camera.position.distanceToSquared(this.targetPosition) < .0001 && this.controls.target.distanceToSquared(this.targetLook) < .0001) this.targetPosition = null
    }
    this.controls.update(dt)
    const bob = this.state.reducedMotion || this.dragging ? 0 : Math.sin(this.elapsed * .65) * .045
    this.model.root.position.y = T.MathUtils.lerp(this.model.root.position.y, bob, a)
    let lineIndex = 0
    for (const p of this.model.parts.values()) {
      const spread = this.state.mode === 'exhibit' ? 1 : 0
      this.scratch.copy(p.spread).multiplyScalar(spread); p.group.position.lerp(this.scratch, a)
      p.group.visible = !p.internal || this.state.mode === 'internal'
      const selected = p.id === this.state.selected, hovered = p.id === this.hovered
      let opacity = 1
      if (this.state.mode === 'internal' && !p.internal) opacity = .12
      if (this.state.mode === 'focus' && this.state.selected && !selected) opacity = .11
      for (const material of p.materials) {
        material.opacity = T.MathUtils.lerp(material.opacity, opacity, a)
        const transparent = material.opacity < .995
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true }
        material.depthWrite = !transparent
        material.emissive.set(selected ? '#35604e' : hovered ? '#5c6a53' : p.internal ? '#255c47' : '#000000')
        material.emissiveIntensity = selected ? .23 : hovered ? .13 : p.internal ? .12 : 0
      }
      for (const mesh of p.meshes) mesh.castShadow = !p.internal && opacity > .5
      if (!p.internal) {
        const anchor = p.anchor.clone()
        this.model.root.localToWorld(anchor).toArray(this.linePositions, lineIndex * 6)
        anchor.copy(p.anchor).add(p.group.position)
        this.model.root.localToWorld(anchor).toArray(this.linePositions, lineIndex * 6 + 3); lineIndex++
      }
    }
    this.lines.visible = this.state.mode === 'exhibit'
    if (this.lines.visible) this.lines.geometry.getAttribute('position').needsUpdate = true
    if (this.elapsed - this.lastMarkerUpdate > .04) { this.updateMarkers(); this.lastMarkerUpdate = this.elapsed }
    this.renderer.render(this.scene, this.camera)
    if (!this.hasRendered) { this.hasRendered = true; this.callbacks.onReady() }
    this.adjustQuality(measuredDelta)
    this.frame = requestAnimationFrame(this.animate)
  }
  private updateMarkers() {
    for (const marker of this.markers) {
      const p = this.model.parts.get(marker.id)!
      this.scratch.copy(p.anchor).add(p.group.position); this.model.root.localToWorld(this.scratch); this.scratch.project(this.camera)
      const shown = this.state.mode === 'exhibit' && this.scratch.z < 1 && Math.abs(this.scratch.x) < .96 && Math.abs(this.scratch.y) < .96
      marker.element.hidden = !shown
      if (shown) {
        const x = (this.scratch.x + 1) / 2 * this.width, y = (1 - this.scratch.y) / 2 * this.height
        marker.element.style.transform = `translate(${x}px, ${y}px)`
        marker.element.dataset.selected = String(this.state.selected === marker.id)
      }
    }
  }
  private adjustQuality(dt: number) {
    if (this.state.quality !== 'auto' || this.dragging) return
    const q = this.qualityWindow
    if (q.warmup > 0) { q.warmup -= dt; return }
    q.seconds += dt; q.frames++
    if (q.seconds < 3) return
    const fps = q.frames / q.seconds
    if (fps < 32 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() - .25))
    }
    this.container.dataset.fps = fps.toFixed(1)
    this.container.dataset.drawCalls = String(this.renderer.info.render.calls)
    this.container.dataset.triangles = String(this.renderer.info.render.triangles)
    this.container.dataset.dpr = this.renderer.getPixelRatio().toFixed(2)
    q.seconds = 0; q.frames = 0
  }
  dispose() {
    this.stopped = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.renderer.domElement.removeEventListener('pointercancel', this.onPointerCancel)
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
    this.model.dispose(); Object.values(this.materialSet.materials).forEach(m => m.dispose()); this.materialSet.textures.forEach(t => t.dispose())
    this.scene.traverse(object => { if (object instanceof T.DirectionalLight) object.shadow.map?.dispose() })
    this.environment.dispose(); this.lines.geometry.dispose(); (this.lines.material as T.Material).dispose()
    this.renderer.dispose(); this.renderer.domElement.remove(); this.markers.forEach(m => m.element.remove())
  }
}
