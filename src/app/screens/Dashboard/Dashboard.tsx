/**
 * Дашборд (User Stories 1, 12, 13, 26, 27, 33, 37): первый экран с карточками
 * всех подопечных и общим списком дел. Карточка — точка входа в «Карточку
 * питомца» (тикет 05); бейдж на карточке — самый срочный пункт подопечного
 * (mostUrgent). Общий список — просроченное и «скоро» по всем подопечным:
 * пункты ухода и разовые события в одном порядке (тикет 07), который даёт
 * доменная сортировка dashboardTodoList.
 *
 * Данные — только из стора; какое окно (создание, правка, подтверждение
 * удаления) открыто — локальное UI-состояние экрана, стор про него не знает.
 * Компонент не считает ни возрастов, ни сроков — только функции домена.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { CareSubject, Id } from '../../../domain/model'
import { daysUntil } from '../../../domain/dates'
import { dashboardTodoList, mostUrgent } from '../../../domain/urgency'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { CareTimer } from '../../components/CareTimer/CareTimer'
import { SubjectSheet } from '../../components/SubjectSheet/SubjectSheet'
import { UrgencyBadge } from '../../components/UrgencyBadge/UrgencyBadge'
import { timerTextShort } from '../../components/format'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import styles from './Dashboard.module.css'

/** Заглушка вместо фото: первая буква имени — презентационное форматирование. */
function subjectInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '•'
}

export interface DashboardProps {
  /** Открыть карточку питомца — навигация стейтом в App (без роутера). */
  onOpenSubject: (id: Id) => void
  /** Открыть настройки (тикет 10) — навигация стейтом в App, как у карточки. */
  onOpenSettings: () => void
}

export function Dashboard(props: DashboardProps): ReactElement {
  const { onOpenSubject, onOpenSettings } = props
  const { state, removeSubject } = useStore()
  const subjects = state.subjects
  // «Сегодня» — один раз на рендер экрана: бейджи и список одного кадра согласованы.
  const today = todayDateString()

  // Общий список дел (User Story 12, тикет 07): просроченное и «скоро» по
  // всем подопечным — пункты ухода и разовые события в одном порядке
  // (срочность, внутри — дата), который даёт доменная сортировка.
  const todoList = dashboardTodoList(
    state.careItems,
    state.completionLog,
    state.oneOffEvents,
    today,
  ).filter((entry) => entry.urgency !== 'calm')
  const subjectName = new Map(subjects.map((subject) => [subject.id, subject.name]))

  // Открытые bottom-sheet'ы: создание, правка и подтверждение удаления
  // взаимно исключающие — один лист на экране.
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CareSubject | null>(null)
  const [removing, setRemoving] = useState<CareSubject | null>(null)

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Питомцы и дом</h1>
        {/* Шестерёнка — единственный вход в настройки (тикет 10). Кнопка без
            текста: смысл проговаривает aria-label, как у экспорта в календарь. */}
        <button
          type="button"
          className={styles.settingsButton}
          onClick={onOpenSettings}
          aria-label="Настройки"
          title="Настройки"
        >
          <svg
            className={styles.settingsIcon}
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>
      <main className={styles.content}>
        {subjects.length === 0 ? (
          // Пустое состояние объясняет, что делать дальше, — экран без
          // необъяснённой пустоты.
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Пока никого нет</h2>
            <p className={styles.emptyText}>
              Заведите первого питомца: имя, вид и дата рождения. Мы предложим готовый набор ухода —
              прививки, обработка от паразитов, груминг — его можно править под своего питомца.
            </p>
            <button type="button" className={styles.emptyButton} onClick={() => setCreating(true)}>
              Добавить питомца
            </button>
          </div>
        ) : (
          <ul className={styles.list}>
            {subjects.map((subject) => (
              <li key={subject.id} className={styles.card}>
                {/* Основная область карточки — кнопка в «Карточку питомца»
                    (тикет 05); «Изменить» и «Удалить» — отдельные действия
                    рядом, без вложенных кнопок. */}
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => onOpenSubject(subject.id)}
                  aria-label={`Открыть карточку: ${subject.name}`}
                >
                  {subject.photo !== undefined ? (
                    <img className={styles.avatar} src={subject.photo} alt="" />
                  ) : (
                    <span className={styles.avatarPlaceholder} aria-hidden="true">
                      {subjectInitial(subject.name)}
                    </span>
                  )}
                  <span className={styles.cardText}>
                    <span className={styles.name}>{subject.name}</span>
                    <span className={styles.species}>{subject.species}</span>
                    <UrgencyBadge
                      today={today}
                      due={mostUrgent(
                        state.careItems.filter((item) => item.subjectId === subject.id),
                        state.completionLog,
                        today,
                      )}
                    />
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </button>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.cardButton}
                    onClick={() => setEditing(subject)}
                    aria-label={`Изменить: ${subject.name}`}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className={`${styles.cardButton} ${styles.cardButtonDanger}`}
                    onClick={() => setRemoving(subject)}
                    aria-label={`Удалить: ${subject.name}`}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Общий список дел: показывается только когда есть что не забыть. */}
        {todoList.length > 0 && (
          <section className={styles.todo}>
            <h2 className={styles.todoTitle}>Просрочено и скоро</h2>
            <ul className={styles.todoList}>
              {todoList.map((entry) => (
                <li key={entry.kind === 'careItem' ? entry.item.id : entry.event.id}>
                  <button
                    type="button"
                    className={styles.todoRow}
                    onClick={() =>
                      onOpenSubject(
                        entry.kind === 'careItem' ? entry.item.subjectId : entry.event.subjectId,
                      )
                    }
                  >
                    <span className={styles.todoMeta}>
                      <span className={styles.todoItem}>
                        {entry.kind === 'careItem' ? entry.item.title : entry.event.title}
                      </span>
                      <span className={styles.todoSubject}>
                        {subjectName.get(
                          entry.kind === 'careItem' ? entry.item.subjectId : entry.event.subjectId,
                        ) ?? ''}
                      </span>
                    </span>
                    {entry.kind === 'careItem' ? (
                      <CareTimer
                        today={today}
                        due={{ item: entry.item, nextDue: entry.nextDue, urgency: entry.urgency }}
                        short
                      />
                    ) : (
                      /* Короткий таймер события — тот же текст и цвет, что у
                          пунктов; дни до даты считает домен. */
                      <span className={`${styles.todoTimer} ${styles[entry.urgency]}`}>
                        {timerTextShort(daysUntil(today, entry.event.date))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* FAB — постоянная точка входа к добавлению, виден и в пустом состоянии. */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setCreating(true)}
        aria-label="Добавить питомца"
      >
        +
      </button>

      {creating && <SubjectSheet onClose={() => setCreating(false)} />}
      {editing !== null && <SubjectSheet subject={editing} onClose={() => setEditing(null)} />}

      {/* Подтверждение удаления: каскад уносит все данные питомца (тикет 04),
          поэтому действие — только через явное «Удалить», кнопка красная. */}
      {removing !== null && (
        <BottomSheet title="Удалить питомца?" onClose={() => setRemoving(null)}>
          <p className={styles.removingText}>
            Удалить «{removing.name}»? Уйдут все его данные: пункты ухода, история выполнений,
            события, вес и журнал корма. Действие необратимо.
          </p>
          <div className={styles.removingActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setRemoving(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                removeSubject(removing.id)
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
