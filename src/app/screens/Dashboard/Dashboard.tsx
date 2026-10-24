/**
 * Дашборд (User Stories 1, 26, 27, 33, 37): первый экран с карточками всех
 * подопечных. Данные — только из стора; какое окно (создание, правка,
 * подтверждение удаления) открыто — локальное UI-состояние экрана, стор
 * про него не знает.
 *
 * Карточка в этом тикете никуда не ведёт: таймеры, бейджи и вкладки —
 * тикеты 05 и дальше. Компонент не считает ни возрастов, ни сроков.
 */

import { useState } from 'react'
import type { CareSubject } from '../../../domain/model'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { SubjectSheet } from '../../components/SubjectSheet/SubjectSheet'
import { useStore } from '../../store'
import styles from './Dashboard.module.css'

/** Заглушка вместо фото: первая буква имени — презентационное форматирование. */
function subjectInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '•'
}

export function Dashboard() {
  const { state, removeSubject } = useStore()
  const subjects = state.subjects

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
                <div className={styles.cardMain}>
                  {subject.photo !== undefined ? (
                    <img className={styles.avatar} src={subject.photo} alt="" />
                  ) : (
                    <span className={styles.avatarPlaceholder} aria-hidden="true">
                      {subjectInitial(subject.name)}
                    </span>
                  )}
                  <div className={styles.cardText}>
                    <h2 className={styles.name}>{subject.name}</h2>
                    <p className={styles.species}>{subject.species}</p>
                  </div>
                </div>
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
