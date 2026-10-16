import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowRight, Box, Check, ChevronDown, CircleHelp, Eye, EyeOff, Focus, Layers3, List, Maximize, Minus, Move3D, Pause, Plus, RotateCcw, RotateCw, Settings2, X } from 'lucide-react'
import { Viewport, type ViewportHandle } from '../components/Viewport'
import { Modal } from '../components/Modal'
import { PartCard } from '../components/PartCard'
import { modes, partById, parts } from '../data/parts'
import type { Mode, PartId, Quality, View } from '../data/types'

type Panel = 'parts' | 'help' | 'settings' | 'about' | null
const modeIcons = { normal: Box, internal: Layers3, exhibit: Move3D, focus: Focus }
const qualityNames: Record<Quality, string> = { auto: 'Авто', low: 'Низкое', medium: 'Среднее', high: 'Высокое' }
const viewNames: { id: View; name: string }[] = [{ id: 'perspective', name: 'Перспектива' }, { id: 'left', name: 'Левый ракурс' }, { id: 'right', name: 'Правый ракурс' }, { id: 'top', name: 'Сверху' }]

export default function App() {
  const [mode, setMode] = useState<Mode>('normal'), [selected, setSelected] = useState<PartId | null>(null)
  const [hovered, setHovered] = useState<PartId | null>(null), [autoRotate, setAutoRotate] = useState(false)
  const [quality, setQuality] = useState<Quality>('auto'), [panel, setPanel] = useState<Panel>(null)
  const [hidden, setHidden] = useState(false), [view, setView] = useState<View>('perspective')
  const [notice, setNotice] = useState(''), [fullScreen, setFullScreen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const viewport = useRef<ViewportHandle>(null)
  const closePanel = useCallback(() => setPanel(null), [])
  const state = useMemo(() => ({ mode, selected, autoRotate, quality, reducedMotion }), [mode, selected, autoRotate, quality, reducedMotion])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const listener = () => setReducedMotion(query.matches); query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  useEffect(() => {
    const listener = () => setFullScreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (panel || (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))) return
      if (event.key === 'Escape') { setSelected(null); setHidden(false) }
      if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'к') viewport.current?.reset()
      if (event.key === '+' || event.key === '=') viewport.current?.zoom(1)
      if (event.key === '-') viewport.current?.zoom(-1)
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [panel])
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timeout) }, [notice])
  const select = (id: PartId | null) => { setSelected(id); setPanel(null) }
  const changeMode = (next: Mode) => {
    setMode(next); setView('perspective')
    if (next === 'internal') setSelected('core')
    else if (selected && partById[selected].internal) setSelected(null)
    if (next === 'focus' && (!selected || partById[selected].internal)) setSelected('stock')
  }
  const reset = () => { setMode('normal'); setSelected(null); setView('perspective'); viewport.current?.reset() }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setNotice('В этом браузере полноэкранный режим недоступен. Используйте «Скрыть интерфейс».')
    } catch { setNotice('Браузер не разрешил полноэкранный режим. Используйте «Скрыть интерфейс».') }
  }
  const visibleParts = parts.filter(p => mode === 'internal' ? p.internal : !p.internal)
  return <main className={`atlas-app ${hidden ? 'ui-hidden' : ''} ${selected && !hidden ? 'has-selection' : ''}`}>
    <header className="site-header interface">
      <a className="brand" href="#" aria-label="АК — интерактивный атлас" onClick={e => { e.preventDefault(); reset() }}><span className="brand-mark">а.</span><span>АТЛАС<span className="brand-sub">ЦИФРОВАЯ КОЛЛЕКЦИЯ</span></span></a>
      <div className="header-center"><span className="status-dot" />ИНТЕРАКТИВНАЯ ЭКСПОЗИЦИЯ</div>
      <button className="about-button" onClick={() => setPanel('about')}>О проекте <ArrowDownRight size={16} /></button>
    </header>

    <section className="intro interface" aria-label="Об экспонате">
      <div className="eyebrow"><span className="short-rule" />ЭКСПОНАТ 001 / СССР</div>
      <h1>АК<span className="title-dash">—</span>47<span className="title-dot">.</span></h1>
      <p className="intro-subtitle">ИНТЕРАКТИВНЫЙ АТЛАС</p>
      <p className="intro-description">Знакомый силуэт.<br />Новый взгляд на каждую деталь.</p>
      <div className="specimen-tag"><span>ТИП 3</span><i />1950-е годы</div>
    </section>

    <div className="collection-note interface"><span className="tiny-label">ФОРМА. МАТЕРИАЛ. ИСТОРИЯ.</span><p>Предмет, ставший<br />частью истории.</p><span className="edition-label">Цифровая реконструкция / 01</span></div>

    <section className="stage" aria-label="Трёхмерная экспозиция">
      <Viewport ref={viewport} state={state} onSelect={select} onHover={setHovered} />
      {hovered && !selected && !hidden && <div className="hover-caption"><span>{partById[hovered].number}</span>{partById[hovered].name}<ArrowRight size={14} /></div>}
    </section>

    {!selected && <aside className="explore-card interface"><div className="explore-icon"><Focus size={24} strokeWidth={1.15} /></div><span className="tiny-label">ИССЛЕДУЙТЕ ЭКСПОНАТ</span><p>Прикоснитесь к детали,<br />чтобы узнать её историю.</p><button onClick={() => setPanel('parts')}>Все элементы <span>09</span><ArrowRight size={16} /></button></aside>}
    {selected && !hidden && <PartCard id={selected} mode={mode} onClose={() => { setSelected(null); if (mode === 'focus') setMode('normal') }} onSelect={setSelected} onFocus={() => changeMode(mode === 'focus' ? 'normal' : 'focus')} />}

    <div className="scene-tools interface" role="toolbar" aria-label="Управление просмотром">
      <button className="icon-button" aria-label="Приблизить" title="Приблизить" onClick={() => viewport.current?.zoom(1)}><Plus size={18} /></button>
      <button className="icon-button" aria-label="Отдалить" title="Отдалить" onClick={() => viewport.current?.zoom(-1)}><Minus size={18} /></button>
      <span className="tool-divider" />
      <button className="icon-button" aria-label="Сбросить камеру" title="Сбросить камеру" onClick={() => { setView('perspective'); viewport.current?.reset() }}><RotateCcw size={17} /></button>
      <button className={`icon-button ${autoRotate ? 'active' : ''}`} aria-label={autoRotate ? 'Остановить вращение' : 'Включить вращение'} aria-pressed={autoRotate} disabled={reducedMotion} title={reducedMotion ? 'Движение сокращено в настройках устройства' : 'Автовращение'} onClick={() => setAutoRotate(v => !v)}>{autoRotate ? <Pause size={17} /> : <RotateCw size={17} />}</button>
      <span className="tool-divider" />
      <button className="icon-button" aria-label="Скрыть интерфейс" title="Скрыть интерфейс" onClick={() => setHidden(true)}><EyeOff size={17} /></button>
      <button className="icon-button fullscreen-button" aria-label={fullScreen ? 'Выйти из полного экрана' : 'Полный экран'} title="Полный экран" onClick={fullscreen}><Maximize size={17} /></button>
    </div>
    {hidden && <button className="show-interface" onClick={() => setHidden(false)}><Eye size={17} /> Показать интерфейс</button>}

    <div className="lower-controls interface">
      <div className="view-control"><span className="tiny-label">РАКУРС</span><div className="select-wrap"><select aria-label="Ракурс камеры" value={view} onChange={e => { const next = e.target.value as View; setView(next); viewport.current?.view(next) }}>{viewNames.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><ChevronDown size={14} /></div></div>
      <div className="gesture-hint"><Move3D size={17} strokeWidth={1.4} /><span>Вращайте, чтобы рассмотреть<span className="desktop-hint"> · Прокрутите для приближения</span></span></div>
      <button className="parts-button" onClick={() => setPanel('parts')}><List size={17} /><span>Элементы</span><span className="count-badge">{visibleParts.length.toString().padStart(2, '0')}</span></button>
    </div>

    <footer className="bottom-bar interface">
      <div className="mode-label"><span className="tiny-label">РЕЖИМ ПРОСМОТРА</span><span>Исследуйте по-своему</span></div>
      <nav className="mode-nav" aria-label="Режим просмотра">{modes.map((item, index) => {
        const Icon = modeIcons[item.id]
        return <button key={item.id} aria-label={item.title} aria-pressed={mode === item.id} className={`mode-button ${mode === item.id ? 'selected' : ''}`} onClick={() => changeMode(item.id)} title={item.description}><span className="mode-index">0{index + 1}</span><Icon size={17} strokeWidth={1.6} /><span className="mode-title">{item.short}</span></button>
      })}</nav>
      <div className="footer-tools"><button className="icon-button" aria-label="Настройки качества" title="Настройки качества" onClick={() => setPanel('settings')}><Settings2 size={18} /></button><button className="icon-button" aria-label="Помощь по управлению" title="Помощь по управлению" onClick={() => setPanel('help')}><CircleHelp size={19} /></button></div>
    </footer>
    {mode === 'exhibit' && !hidden && <button className="return-model" onClick={reset}><RotateCcw size={15} />Вернуть модель</button>}
    {mode === 'internal' && !hidden && <div className="diagram-note">Условная схема расположения · без механической детализации</div>}
    {notice && <div className="toast" role="status">{notice}<button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={16} /></button></div>}
    <div className="sr-only" aria-live="polite">{modes.find(m => m.id === mode)?.title}. {selected ? `Выбран элемент: ${partById[selected].name}` : 'Полный вид экспоната'}</div>

    {panel === 'parts' && <Modal title={mode === 'internal' ? 'Внутренние области' : 'Девять деталей. Один силуэт.'} eyebrow="НАВИГАЦИЯ ПО ЭКСПОНАТУ" onClose={closePanel}>
      <p className="modal-intro">Выберите элемент, чтобы открыть музейную карточку. Любую внешнюю деталь можно рассмотреть крупным планом.</p>
      <div className="parts-list">{visibleParts.map(p => <button key={p.id} onClick={() => select(p.id)}><span className="part-list-number">{p.number}</span><span><strong>{p.name}</strong><small>{p.subtitle}</small></span>{selected === p.id ? <Check size={17} /> : <ArrowRight size={17} />}</button>)}</div>
    </Modal>}
    {panel === 'settings' && <Modal title="Комфортный просмотр" eyebrow="НАСТРОЙКИ ЭКСПОЗИЦИИ" onClose={closePanel}>
      <p className="modal-intro">Качество меняет разрешение изображения. В режиме «Авто» оно адаптируется к экрану и скорости отрисовки.</p><span className="field-label">Качество графики</span>
      <div className="quality-options">{(['auto', 'low', 'medium', 'high'] as const).map(q => <button key={q} aria-pressed={quality === q} onClick={() => setQuality(q)} className={quality === q ? 'chosen' : ''}>{qualityNames[q]}{quality === q && <Check size={14} />}</button>)}</div>
      <div className="setting-note"><span className="status-dot" /><p>{reducedMotion ? 'Системная настройка «Уменьшить движение» включена. Покачивание и автоматическое вращение отключены.' : 'Системная настройка «Уменьшить движение» поддерживается. При её включении анимации будут сокращены.'}</p></div>
      <p className="fine-print">Ресурсы модели создаются на устройстве. Внешние изображения и готовые 3D-модели не загружаются.</p>
    </Modal>}
    {panel === 'help' && <Modal title="Всё начинается с движения" eyebrow="КАК ИССЛЕДОВАТЬ" onClose={closePanel}>
      <div className="help-list"><div><Move3D size={23} /><span><strong>Вращайте</strong><p>Перетаскивайте мышью или одним пальцем. Доступен полный круг вокруг экспоната.</p></span></div><div><Plus size={23} /><span><strong>Приближайте</strong><p>Используйте колесо мыши, жест двумя пальцами или кнопки «+» и «−».</p></span></div><div><Focus size={23} /><span><strong>Выбирайте</strong><p>Нажмите на деталь модели или откройте список «Элементы». Кнопка «Рассмотреть» включит крупный план.</p></span></div><div><Layers3 size={23} /><span><strong>Меняйте представление</strong><p>Четыре режима внизу экрана: полный вид, условные внутренние области, разнесённая композиция и фокус.</p></span></div></div>
      <div className="keyboard-help"><span><kbd>R</kbd> Сброс камеры</span><span><kbd>+</kbd><kbd>−</kbd> Масштаб</span><span><kbd>Esc</kbd> Закрыть</span></div>
      <p className="fine-print">Автовращение приостанавливается во время взаимодействия и плавно возобновляется через несколько секунд.</p>
    </Modal>}
    {panel === 'about' && <Modal title="История через форму" eyebrow="АК-47 / ИНТЕРАКТИВНЫЙ АТЛАС" onClose={closePanel}>
      <p className="about-lead">Цифровая экспозиция, в которой можно рассмотреть знакомый предмет заново.</p>
      <p>За основу выбран внешний образ АК Type 3 с постоянным деревянным прикладом, характерный для 1950-х годов. Оригинальная модель, материалы дерева и металла созданы программно.</p>
      <div className="about-facts"><div><span>Визуальный вариант</span><strong>АК Type 3</strong></div><div><span>Происхождение</span><strong>СССР</strong></div><div><span>Тип представления</span><strong>Художественная реконструкция</strong></div></div>
      <p>Это образовательная художественная интерпретация, а не цифровая копия конкретного музейного предмета. Пропорции, мелкие наружные детали и отделка содержат допущения. Внутренний обзор условный; разнесённая композиция не отражает порядок разборки.</p>
      <p className="fine-print">Во время разработки музейные сайты и Wikimedia оказались недоступны из облачной среды (HTTP 403). Проверенные по изображениям музейные атрибуции не заявляются. Попытки доступа и границы достоверности зафиксированы в документации проекта.</p>
      <a className="text-button" href="https://github.com/DiRiK25/ak47-interactive-atlas" target="_blank" rel="noreferrer">Репозиторий и документация <ArrowRight size={16} /></a>
    </Modal>}
  </main>
}
