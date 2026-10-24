/**
 * История выполнений пункта в bottom-sheet (User Story 8): даты и заметки
 * журнала, новые сверху. Отвечает на вопрос «когда была последняя
 * прививка?» без расчётов — просто перечисление фактов из журнала.
 *
 * Сортировка по дате-строке — презентационная: 'YYYY-MM-DD' сравнивается
 * лексикографически так же, как хронологически (замечание домена в dates.ts).
 */

import type { ReactElement } from 'react'
import type { CareItem } from '../../../domain/model'
import { formatDate } from '../format'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import styles from './HistorySheet.module.css'

export interface HistorySheetProps {
  /** Пункт, чью историю показываем. */
  item: CareItem
  onClose: () => void
}

export function HistorySheet(props: HistorySheetProps): ReactElement {
  const { item, onClose } = props
  const { state } = useStore()

  const entries = state.completionLog
    .filter((entry) => entry.careItemId === item.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <BottomSheet title={`История: ${item.title}`} onClose={onClose}>
      {entries.length === 0 ? (
        // Пустое состояние: лист без объяснения — необъяснённая пустота.
        <p className={styles.empty}>Ещё не отмечали ни разу.</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <span className={styles.date}>{formatDate(entry.date)}</span>
              {entry.note !== undefined && <span className={styles.note}>{entry.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}
