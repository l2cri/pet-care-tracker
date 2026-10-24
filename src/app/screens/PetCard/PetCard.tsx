/**
 * Карточка питомца (глоссарий: PetCard) — второй экран приложения с вкладками
 * Уход / Вес / Корм (User Stories 4–13, 28). Вкладка «Уход» — полный цикл
 * пункта: таймер срочности, «Сделано» с заметкой, история, правка и удаление;
 * Вес и Корм — заглушки до тикетов 08–09.
 *
 * Компонент не считает ни дат, ни срочности: порядок и цвета дают функции
 * домена (withUrgency, sortTodoList), «сегодня» — todayDateString(), мутации —
 * экшены стора. Открытые bottom-sheet'ы взаимно исключающие — локальное
 * UI-состояние экрана.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { CareItem, Id } from '../../../domain/model'
import { withUrgency, sortTodoList } from '../../../domain/urgency'
import { intervalLabel } from '../../components/format'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { CareItemSheet } from '../../components/CareItemSheet/CareItemSheet'
import { CareTimer } from '../../components/CareTimer/CareTimer'
import { DoneSheet } from '../../components/DoneSheet/DoneSheet'
import { HistorySheet } from '../../components/HistorySheet/HistorySheet'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import form from '../../components/form.module.css'
import styles from './PetCard.module.css'

/** Вкладки карточки; «Вес» и «Корм» пока заглушки (тикет 08–09). */
type Tab = 'care' | 'weight' | 'feed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'care', label: 'Уход' },
  { id: 'weight', label: 'Вес' },
  { id: 'feed', label: 'Корм' },
]

export interface PetCardProps {
  subjectId: Id
  onBack: () => void
}

export function PetCard(props: PetCardProps): ReactElement {
  const { subjectId, onBack } = props
  const { state, removeCareItem } = useStore()
  const subject = state.subjects.find((candidate) => candidate.id === subjectId)

  const [tab, setTab] = useState<Tab>('care')
  // «Сегодня» — один раз на рендер экрана: таймеры одного кадра согласованы.
  const today = todayDateString()

  const items = state.careItems.filter((item) => item.subjectId === subjectId)
  const dueList = sortTodoList(withUrgency(items, state.completionLog, today), today)

  // Взаимоисключающие листы: один на экране, как на дашборде.
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CareItem | null>(null)
  const [markingDone, setMarkingDone] = useState<CareItem | null>(null)
  const [showingHistory, setShowingHistory] = useState<CareItem | null>(null)
  const [removing, setRemoving] = useState<CareItem | null>(null)

  // Подопечный исчез из состояния, пока экран открыт (удалён из другого
  // места) — честная заглушка с выходом назад вместо белого экрана.
  if (subject === undefined) {
    return (
      <div className={styles.screen}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            aria-label="К списку питомцев"
          >
            ‹ Назад
          </button>
        </header>
        <main className={styles.content}>
          <p className={styles.stubText}>Питомец не найден — возможно, он был удалён.</p>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="К списку питомцев"
        >
          ‹ Назад
        </button>
        <div className={styles.heading}>
          <h1 className={styles.title}>{subject.name}</h1>
          <p className={styles.species}>{subject.species}</p>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Разделы карточки">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={tab === entry.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <main className={styles.content}>
        {tab === 'care' &&
          (dueList.length === 0 ? (
            // Пустое состояние вкладки: что делать дальше (правило чартера).
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>Уход ещё не настроен</h2>
              <p className={styles.emptyText}>
                Добавьте пункты ухода — например, прививку раз в год или груминг раз в два месяца.
              </p>
              <button type="button" className={styles.emptyButton} onClick={() => setAdding(true)}>
                Добавить пункт ухода
              </button>
            </div>
          ) : (
            <ul className={styles.list}>
              {dueList.map((due) => (
                <li key={due.item.id} className={styles.careCard}>
                  <div className={styles.careHead}>
                    <h3 className={styles.careTitle}>{due.item.title}</h3>
                    <p className={styles.careInterval}>
                      {intervalLabel(due.item.interval.value, due.item.interval.unit)}
                    </p>
                  </div>
                  <CareTimer due={due} today={today} detailed />
                  <div className={styles.careActions}>
                    <button
                      type="button"
                      className={styles.doneButton}
                      onClick={() => setMarkingDone(due.item)}
                    >
                      Сделано
                    </button>
                    <button
                      type="button"
                      className={styles.minorButton}
                      onClick={() => setShowingHistory(due.item)}
                    >
                      История
                    </button>
                    <button
                      type="button"
                      className={styles.minorButton}
                      onClick={() => setEditing(due.item)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => setRemoving(due.item)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'weight' && (
          <div className={styles.stub}>
            <h2 className={styles.stubTitle}>График веса появится здесь</h2>
            <p className={styles.stubText}>
              Замеры и динамика за всю историю — в следующем обновлении.
            </p>
          </div>
        )}

        {tab === 'feed' && (
          <div className={styles.stub}>
            <h2 className={styles.stubTitle}>Журнал корма появится здесь</h2>
            <p className={styles.stubText}>
              Покупки, цены и вердикт «подошёл / не подошёл» — в следующем обновлении.
            </p>
          </div>
        )}
      </main>

      {/* FAB добавления пункта — только на вкладке ухода. */}
      {tab === 'care' && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setAdding(true)}
          aria-label="Добавить пункт ухода"
        >
          +
        </button>
      )}

      {adding && <CareItemSheet subjectId={subjectId} onClose={() => setAdding(false)} />}
      {editing !== null && <CareItemSheet item={editing} onClose={() => setEditing(null)} />}
      {markingDone !== null && (
        <DoneSheet item={markingDone} onClose={() => setMarkingDone(null)} />
      )}
      {showingHistory !== null && (
        <HistorySheet item={showingHistory} onClose={() => setShowingHistory(null)} />
      )}

      {/* Удаление пункта уносит и историю выполнений — только через явное
          подтверждение, как удаление питомца на дашборде. */}
      {removing !== null && (
        <BottomSheet title="Удалить пункт ухода?" onClose={() => setRemoving(null)}>
          <p className={form.note}>
            Удалить «{removing.title}»? Уйдёт и история выполнений. Действие необратимо.
          </p>
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              onClick={() => setRemoving(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className={form.danger}
              onClick={() => {
                removeCareItem(removing.id)
                setRemoving(null)
              }}
            >
              Удалить
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
