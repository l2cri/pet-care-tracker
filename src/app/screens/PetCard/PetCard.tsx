/**
 * Карточка питомца (глоссарий: PetCard) — второй экран приложения с вкладками
 * Уход / Вес / Корм (User Stories 4–15, 28). Вкладка «Уход» — полный цикл
 * пункта (таймер срочности, «Сделано» с заметкой, история, экспорт .ics
 * тикета 06, правка и удаление) и раздел разовых событий (тикет 07):
 * создание, предстоящие по дате, «Сделано», экспорт одиночным .ics,
 * выполненные — в истории. Корм — вкладка тикета 09 (журнал покупок с
 * вердиктами и столбики расходов); Вес — заглушка до тикета 08.
 *
 * Компонент не считает ни дат, ни срочности: порядок и цвета дают функции
 * домена (withUrgency, sortTodoList, upcomingEvents), «сегодня» —
 * todayDateString(), мутации — экшены стора. Открытые bottom-sheet'ы
 * взаимно исключающие — локальное UI-состояние экрана.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { CareItem, Id, OneOffEvent } from '../../../domain/model'
import { daysUntil } from '../../../domain/dates'
import { sortTodoList, upcomingEvents, withUrgency } from '../../../domain/urgency'
import { formatDate, intervalLabel, timerText } from '../../components/format'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { CareItemSheet } from '../../components/CareItemSheet/CareItemSheet'
import { CareTimer } from '../../components/CareTimer/CareTimer'
import { DoneEventsSheet } from '../../components/DoneEventsSheet/DoneEventsSheet'
import { DoneSheet } from '../../components/DoneSheet/DoneSheet'
import { HistorySheet } from '../../components/HistorySheet/HistorySheet'
import { OneOffEventSheet } from '../../components/OneOffEventSheet/OneOffEventSheet'
import { FeedTab } from './FeedTab'
import { todayDateString } from '../../today'
import { downloadCareItemCalendar, downloadOneOffEventCalendar } from '../../icsDownload'
import { useStore } from '../../store'
import form from '../../components/form.module.css'
import styles from './PetCard.module.css'

/** Вкладки карточки; «Вес» пока заглушка (тикет 08). */
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
  const { state, removeCareItem, completeOneOffEvent, removeOneOffEvent } = useStore()
  const subject = state.subjects.find((candidate) => candidate.id === subjectId)

  const [tab, setTab] = useState<Tab>('care')
  // «Сегодня» — один раз на рендер экрана: таймеры одного кадра согласованы.
  const today = todayDateString()

  const items = state.careItems.filter((item) => item.subjectId === subjectId)
  const dueList = sortTodoList(withUrgency(items, state.completionLog, today), today)

  // Разовые события этого подопечного (тикет 07): предстоящие — по дате,
  // выполненные ушли в историю и открываются отдельным листом.
  const events = state.oneOffEvents.filter((event) => event.subjectId === subjectId)
  const upcoming = upcomingEvents(events, today)
  const doneCount = events.length - upcoming.length

  // Взаимоисключающие листы: один на экране, как на дашборде.
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CareItem | null>(null)
  const [markingDone, setMarkingDone] = useState<CareItem | null>(null)
  const [showingHistory, setShowingHistory] = useState<CareItem | null>(null)
  const [removing, setRemoving] = useState<CareItem | null>(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<OneOffEvent | null>(null)
  const [removingEvent, setRemovingEvent] = useState<OneOffEvent | null>(null)
  const [showingDoneEvents, setShowingDoneEvents] = useState(false)

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
        {tab === 'care' && (
          <>
            {dueList.length === 0 ? (
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
                      {/* Экспорт .ics в один клик (тикет 06, ADR-0004): иконка
                          проговаривает, что напоминание живёт в календаре. */}
                      <button
                        type="button"
                        className={styles.calendarButton}
                        onClick={() =>
                          downloadCareItemCalendar({
                            item: due.item,
                            subjectName: subject.name,
                            nextDue: due.nextDue,
                            today,
                          })
                        }
                        aria-label="Экспортировать в календарь"
                        title="Экспортировать в календарь"
                      >
                        <svg
                          className={styles.calendarIcon}
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="3" y="5" width="18" height="16" rx="2" />
                          <path d="M8 3v4M16 3v4M3 10h18" />
                        </svg>
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
            )}

            {/* Разовые события (тикет 07): без повтора, к конкретной дате.
                Раздел виден всегда — событие заведут и без пунктов ухода. */}
            <section className={styles.events}>
              <div className={styles.eventsHead}>
                <h2 className={styles.eventsTitle}>Разовые события</h2>
                <div className={styles.eventsHeadActions}>
                  {doneCount > 0 && (
                    <button
                      type="button"
                      className={styles.minorButton}
                      onClick={() => setShowingDoneEvents(true)}
                    >
                      Выполненные ({doneCount})
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.minorButton}
                    onClick={() => setAddingEvent(true)}
                  >
                    + Событие
                  </button>
                </div>
              </div>
              {upcoming.length === 0 ? (
                <p className={styles.eventsEmpty}>
                  Визит к ветеринару или стрижка к определённой дате — добавьте событие, и оно
                  появится здесь и в списке дел на дашборде.
                </p>
              ) : (
                <ul className={styles.eventList}>
                  {upcoming.map((due) => (
                    <li key={due.event.id} className={styles.eventCard}>
                      <div className={styles.eventHead}>
                        <h3 className={styles.eventTitle}>{due.event.title}</h3>
                        <p className={styles.eventDate}>{formatDate(due.event.date)}</p>
                      </div>
                      {/* Текст и цвет таймера — как у пунктов ухода: дни до
                          даты считает домен, срочность пришла в due. */}
                      <span className={`${styles.eventTimer} ${styles[due.urgency]}`}>
                        {timerText(daysUntil(today, due.event.date))}
                      </span>
                      {due.event.note !== undefined && (
                        <p className={styles.eventNote}>{due.event.note}</p>
                      )}
                      <div className={styles.careActions}>
                        <button
                          type="button"
                          className={styles.doneButton}
                          onClick={() => completeOneOffEvent(due.event.id)}
                        >
                          Сделано
                        </button>
                        <button
                          type="button"
                          className={styles.calendarButton}
                          onClick={() =>
                            downloadOneOffEventCalendar({
                              event: due.event,
                              subjectName: subject.name,
                            })
                          }
                          aria-label="Экспортировать в календарь"
                          title="Экспортировать в календарь"
                        >
                          <svg
                            className={styles.calendarIcon}
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M8 3v4M16 3v4M3 10h18" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={styles.minorButton}
                          onClick={() => setEditingEvent(due.event)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => setRemovingEvent(due.event)}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === 'weight' && (
          <div className={styles.stub}>
            <h2 className={styles.stubTitle}>График веса появится здесь</h2>
            <p className={styles.stubText}>
              Замеры и динамика за всю историю — в следующем обновлении.
            </p>
          </div>
        )}

        {tab === 'feed' && <FeedTab subjectId={subjectId} />}
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
      {addingEvent && (
        <OneOffEventSheet subjectId={subjectId} onClose={() => setAddingEvent(false)} />
      )}
      {editingEvent !== null && (
        <OneOffEventSheet event={editingEvent} onClose={() => setEditingEvent(null)} />
      )}
      {showingDoneEvents && (
        <DoneEventsSheet subjectId={subjectId} onClose={() => setShowingDoneEvents(false)} />
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

      {/* Удаление события уносит только его самого — но подтверждение всё
          равно явное, как у остальных необратимых действий. */}
      {removingEvent !== null && (
        <BottomSheet title="Удалить событие?" onClose={() => setRemovingEvent(null)}>
          <p className={form.note}>
            Удалить «{removingEvent.title}» {formatDate(removingEvent.date)}? Действие необратимо.
          </p>
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              onClick={() => setRemovingEvent(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className={form.danger}
              onClick={() => {
                removeOneOffEvent(removingEvent.id)
                setRemovingEvent(null)
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
