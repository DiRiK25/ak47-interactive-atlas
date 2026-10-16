import { ArrowLeft, ArrowRight, Focus, X } from 'lucide-react'
import { partById, parts } from '../data/parts'
import type { Mode, PartId } from '../data/types'
interface Props { id: PartId; mode: Mode; onClose: () => void; onSelect: (id: PartId) => void; onFocus: () => void }
export function PartCard({ id, mode, onClose, onSelect, onFocus }: Props) {
  const part = partById[id], collection = parts.filter(p => mode === 'internal' ? p.internal : !p.internal)
  const index = collection.findIndex(p => p.id === id)
  const next = (direction: number) => onSelect(collection[(Math.max(0, index) + direction + collection.length) % collection.length].id)
  return <aside className="part-card" aria-label="Информация об элементе" data-testid="part-card">
    <div className="card-topline"><span className="eyebrow">{part.internal ? 'Условная схема' : 'Деталь экспоната'} / {part.number}</span><button className="icon-button" aria-label="Закрыть карточку" onClick={onClose}><X size={18} /></button></div>
    <div className="part-card-scroll" key={id}>
      <div className={`material-sample ${id === 'stock' || id === 'handguard' || id === 'gas' || id === 'grip' ? 'sample-wood' : part.internal ? 'sample-diagram' : 'sample-metal'}`}><span>{part.number}</span><span>{part.subtitle}</span></div>
      <h2>{part.name}</h2><p className="part-description">{part.description}</p>
      <div className="material-label"><span className="tiny-label">МАТЕРИАЛ</span><p>{part.material}</p></div>
      <details open><summary>Исторический контекст</summary><p>{part.history}</p></details>
      <details><summary>О реконструкции</summary><p>{part.note}</p></details>
    </div>
    <div className="card-footer"><button className="icon-button" aria-label="Предыдущий элемент" onClick={() => next(-1)}><ArrowLeft size={17} /></button>
      {!part.internal && <button className="focus-button" onClick={onFocus}><Focus size={15} />{mode === 'focus' ? 'Полный вид' : 'Рассмотреть'}</button>}
      {part.internal && <span className="tiny-label">{part.number} / 3 ОБЛАСТИ</span>}
      <button className="icon-button" aria-label="Следующий элемент" onClick={() => next(1)}><ArrowRight size={17} /></button>
    </div>
  </aside>
}
