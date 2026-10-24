/**
 * Bottom-sheet: модальная панель снизу — единственный канал добавления и
 * редактирования в приложении (ADR-0006, глоссарий «Bottom-sheet»).
 *
 * Компонент чисто презентационный: что положат в children, то и покажет.
 * Закрытие — тап по оверлею, крестик или Escape; прокрутка body блокируется,
 * пока лист открыт, а длинный контент скроллится внутри панели.
 */

import { useEffect, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import styles from './BottomSheet.module.css'

export interface BottomSheetProps {
  /** Заголовок листа: виден в шапке и звучит для скринридера (aria-label). */
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet(props: BottomSheetProps): ReactElement {
  const { title, onClose, children } = props
  const panelRef = useRef<HTMLDivElement>(null)

  // Фокус на панель при открытии: скринридер озвучит лист, а Escape работает
  // и без клика внутрь. cleanup возвращает фокус не нужен — лист закрывается
  // только действием пользователя, после которого фокус и так осмысленный.
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  // Escape закрывает лист — ожидаемое поведение модалки на любой платформе.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Блокируем прокрутку фона, пока лист открыт: под оверлеем не должен
  // «уезжать» дашборд. Прежнее значение возвращаем, а не слепо ставим '' —
  // вдруг кто-то другой тоже управлял overflow.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
