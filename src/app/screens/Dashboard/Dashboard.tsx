/**
 * Дашборд (User Stories 1, 12, 13, 26, 27, 33, 37): первый экран с карточками
 * всех подопечных и общим списком дел. Карточка — точка входа в «Карточку
 * питомца» (тикет 05); бейдж на карточке — самый срочный пункт подопечного
 * (mostUrgent), общий список — просроченное и «скоро» по всем подопечным,
 * отсортированные доменной сортировкой.
 *
 * Данные — только из стора; какое окно (создание, правка, подтверждение
 * удаления) открыто — локальное UI-состояние экрана, стор про него не знает.
 * Компонент не считает ни возрастов, ни сроков — только функции домена.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { CareSubject, Id } from '../../../domain/model'
import { mostUrgent, sortTodoList, withUrgency } from '../../../domain/urgency'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { CareTimer } from '../../components/CareTimer/CareTimer'
import { SubjectSheet } from '../../components/SubjectSheet/SubjectSheet'
import { UrgencyBadge } from '../../components/UrgencyBadge/UrgencyBadge'
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
}

export function Dashboard(props: DashboardProps): ReactElement {
  const { onOpenSubject } = props
  const { state, removeSubject } = useStore()
  const subjects = state.subjects
  // «Сегодня» — один раз на рендер экрана: бейджи и список одного кадра согласованы.
  const today = todayDateString()

  // Общий список дел (User Story 12): просроченное и «скоро» по всем
  // подопечным; порядок даёт доменная сортировка (срочность, внутри — дата).
  const todoList = sortTodoList(
    withUrgency(state.careItems, state.completionLog, today),
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
              {todoList.map((due) => (
                <li key={due.item.id}>
                  <button
                    type="button"
                    className={styles.todoRow}
                    onClick={() => onOpenSubject(due.item.subjectId)}
                  >
                    <span className={styles.todoMeta}>
                      <span className={styles.todoItem}>{due.item.title}</span>
                      <span className={styles.todoSubject}>
                        {subjectName.get(due.item.subjectId) ?? ''}
                      </span>
                    </span>
                    <CareTimer today={today} due={due} short />
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
