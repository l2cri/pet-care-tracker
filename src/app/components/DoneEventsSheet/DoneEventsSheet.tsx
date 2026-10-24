/**
 * Выполненные разовые события подопечного в bottom-sheet (тикет 07, User
 * Story 15): выполненное уходит из предстоящих и живёт здесь — даты,
 * заголовки и заметки, новые сверху. Read-only, как история выполнений
 * пункта: прошедшее не редактируется.
 *
 * Сортировка по дате-строке — презентационная: 'YYYY-MM-DD' сравнивается
 * лексикографически так же, как хронологически (замечание домена в dates.ts).
 */

import type { ReactElement } from 'react'
import type { Id } from '../../../domain/model'
import { formatDate } from '../format'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import styles from './DoneEventsSheet.module.css'

export interface DoneEventsSheetProps {
  /** Подопечный, чьи выполненные события показываем. */
  subjectId: Id
  onClose: () => void
}

export function DoneEventsSheet(props: DoneEventsSheetProps): ReactElement {
  const { subjectId, onClose } = props
  const { state } = useStore()

  const events = state.oneOffEvents
    .filter((event) => event.subjectId === subjectId && event.done)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <BottomSheet title="Выполненные события" onClose={onClose}>
      {events.length === 0 ? (
        <p className={styles.empty}>Выполненных событий пока нет.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.entry}>
              <span className={styles.date}>{formatDate(event.date)}</span>
              <span className={styles.title}>{event.title}</span>
              {event.note !== undefined && <span className={styles.note}>{event.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}
