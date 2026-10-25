/**
 * Вкладка «Корм» карточки питомца (тикет 09, User Stories 23–25): сверху
 * столбики расходов по месяцам за полгода (SpendBars с корзинами monthlySpend
 * из домена), ниже — журнал покупок. Плохой корм (verdict 'bad') визуально
 * кричит: красный бейдж плюс красная полоса карточки — «больше не купить
 * плохой» (User Story 24).
 *
 * Компонент не считает ни месяцев, ни сумм: корзины даёт домен, «сегодня» —
 * todayDateString(), мутации — экшены стора. Сортировка журнала по строке
 * даты — презентационная: 'YYYY-MM-DD' сравнивается лексикографически так
 * же, как хронологически (замечание домена в dates.ts). Листы добавления,
 * правки и удаления — взаимоисключающее локальное состояние вкладки.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { FeedEntry, Id } from '../../../domain/model'
import { monthlySpend } from '../../../domain/spend'
import { formatDate, formatPrice } from '../../components/format'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { FeedEntrySheet } from '../../components/FeedEntrySheet/FeedEntrySheet'
import { SpendBars } from '../../components/SpendBars/SpendBars'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import form from '../../components/form.module.css'
import styles from './FeedTab.module.css'

export interface FeedTabProps {
  /** Подопечный, чей журнал корма показываем. */
  subjectId: Id
}

export function FeedTab(props: FeedTabProps): ReactElement {
  const { subjectId } = props
  const { state, removeFeedEntry } = useStore()

  // «Сегодня» — один раз на рендер вкладки: окно месяцев и таймеры согласованы.
  const today = todayDateString()

  const entries = state.feed
    .filter((entry) => entry.subjectId === subjectId)
    // Новые покупки сверху; сравнение строк дат — как в DoneEventsSheet.
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const months = monthlySpend(entries, today)

  // Взаимоисключающие листы вкладки: добавление, правка, удаление.
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FeedEntry | null>(null)
  const [removing, setRemoving] = useState<FeedEntry | null>(null)

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Расходы по месяцам</h2>
        <div className={styles.chartCard}>
          <SpendBars months={months} />
        </div>
      </section>

      <section className={styles.journal}>
        <h2 className={styles.sectionTitle}>Журнал покупок</h2>
        {entries.length === 0 ? (
          // Пустое состояние журнала: что копить и зачем (правило чартера).
          <div className={styles.empty}>
            <h3 className={styles.emptyTitle}>Покупок пока нет</h3>
            <p className={styles.emptyText}>
              Добавляйте покупки — дату, цену и вердикт «подошёл / не подошёл», чтобы плохой
              корм больше не купить, а расходы на корм были видны по месяцам.
            </p>
            <button type="button" className={styles.emptyButton} onClick={() => setCreating(true)}>
              Добавить покупку
            </button>
          </div>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={
                  entry.verdict === 'bad' ? `${styles.card} ${styles.cardBad}` : styles.card
                }
              >
                <div className={styles.cardHead}>
                  <h3 className={styles.foodName}>{entry.foodName}</h3>
                  <span
                    className={
                      entry.verdict === 'bad'
                        ? `${styles.badge} ${styles.badgeBad}`
                        : `${styles.badge} ${styles.badgeOk}`
                    }
                  >
                    {entry.verdict === 'bad' ? 'Не подошёл' : 'Подошёл'}
                  </span>
                </div>
                <p className={styles.meta}>
                  <span className={styles.date}>{formatDate(entry.date)}</span>
                  <span className={styles.price}>{formatPrice(entry.price)}</span>
                </p>
                {entry.note !== undefined && <p className={styles.note}>{entry.note}</p>}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.minorButton}
                    onClick={() => setEditing(entry)}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => setRemoving(entry)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FAB добавления покупки — та же фиксированная точка, что в PetCard. */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setCreating(true)}
        aria-label="Добавить покупку корма"
      >
        +
      </button>

      {creating && <FeedEntrySheet subjectId={subjectId} onClose={() => setCreating(false)} />}
      {editing !== null && <FeedEntrySheet entry={editing} onClose={() => setEditing(null)} />}

      {/* Удаление записи — только через явное подтверждение, как удаление
          пункта ухода и события в PetCard. */}
      {removing !== null && (
        <BottomSheet title="Удалить покупку?" onClose={() => setRemoving(null)}>
          <p className={form.note}>
            Удалить «{removing.foodName}» от {formatDate(removing.date)}? Действие необратимо.
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
                removeFeedEntry(removing.id)
                setRemoving(null)
              }}
            >
              Удалить
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
