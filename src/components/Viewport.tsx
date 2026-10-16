import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { AtlasScene } from '../scene/AtlasScene'
import type { PartId, SceneState, View } from '../data/types'
import { RotateCcw } from 'lucide-react'

export interface ViewportHandle { reset: () => void; view: (view: View) => void; zoom: (direction: number) => void }
interface Props { state: SceneState; onSelect: (id: PartId | null) => void; onHover: (id: PartId | null) => void }
export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport({ state, onSelect, onHover }, ref) {
  const container = useRef<HTMLDivElement>(null), markers = useRef<HTMLDivElement>(null), scene = useRef<AtlasScene | null>(null)
  const latest = useRef({ state, onSelect, onHover }); latest.current = { state, onSelect, onHover }
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useImperativeHandle(ref, () => ({ reset: () => scene.current?.resetCamera(), view: v => scene.current?.view(v), zoom: d => scene.current?.zoom(d) }), [])
  useEffect(() => {
    let cancelled = false
    import('../scene/AtlasScene').then(({ AtlasScene }) => {
      if (cancelled || !container.current || !markers.current) return
      try {
        scene.current = new AtlasScene(container.current, markers.current, latest.current.state, {
          onSelect: id => latest.current.onSelect(id), onHover: id => latest.current.onHover(id),
          onReady: () => setReady(true), onError: setError,
        })
      } catch (e) { console.error('Не удалось создать 3D-сцену:', e); setError('Браузер не смог запустить WebGL. Попробуйте обновить Chrome или включить аппаратное ускорение.') }
    }).catch(() => setError('Не удалось загрузить модуль экспозиции. Проверьте соединение и повторите попытку.'))
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null }
  }, [attempt])
  useEffect(() => { scene.current?.update(state) }, [state])
  return <>
    <div className="canvas-container" ref={container} data-testid="viewport" data-ready={ready} />
    <div className="marker-layer" ref={markers} aria-label="Подписи к экспозиции" />
    {!ready && !error && <div className="scene-loading" role="status"><span className="loading-orbit" /><strong>Создаём экспозицию</strong><span>Геометрия, дерево, свет</span></div>}
    {error && <div className="scene-error" role="alert"><strong>Экспозиция временно недоступна</strong><p>{error}</p><button className="text-button" onClick={() => { setError(''); setReady(false); setAttempt(a => a + 1) }}><RotateCcw size={16} /> Повторить</button></div>}
  </>
})
