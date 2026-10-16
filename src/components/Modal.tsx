import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
interface Props { title: string; eyebrow: string; onClose: () => void; children: ReactNode }
export function Modal({ title, eyebrow, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, a, select')?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button, a[href], select, input, [tabindex="0"]')
        if (!items?.length) return
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => { document.removeEventListener('keydown', handler, true); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={e => e.stopPropagation()}>
      <button className="icon-button modal-close" aria-label="Закрыть окно" onClick={onClose}><X size={20} /></button>
      <span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{children}
    </div>
  </div>
}
