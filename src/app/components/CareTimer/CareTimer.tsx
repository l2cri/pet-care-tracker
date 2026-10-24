/**
 * Таймер срочности пункта ухода (глоссарий: «Таймер», «Срочность»).
 *
 * Компонент только рендерит: сколько дней осталось, считает ядро
 * (daysUntil), срочность приходит готовой в CareItemDue, тексты —
 * чистые функции из format.ts. Цвета — только токены срочности
 * (--color-urgency-overdue / -soon) и приглушённый текст для calm.
 */

import type { ReactElement } from 'react'
import type { DateString } from '../../domain/model'
import type { CareItemDue } from '../../domain/urgency'
import { daysUntil } from '../../domain/dates'
import { formatDate, timerText, timerTextShort } from '../format'
import styles from './CareTimer.module.css'

export interface CareTimerProps {
  /** «Сегодня» — локальная 'YYYY-MM-DD'; экран вычисляет её один раз на рендер. */
  today: DateString
  /** Пункт с вычисленными nextDue и срочностью (withUrgency / mostUrgent). */
  due: CareItemDue
  /** Короткая строчная форма для плотных списков и бейджа дашборда. */
  short?: boolean
  /** Показывать строку «Следующий раз: …» — для карточки пункта на вкладке «Уход». */
  detailed?: boolean
}

export function CareTimer(props: CareTimerProps): ReactElement {
  const { today, due, short = false, detailed = false } = props
  // null — пустой журнал («пора сейчас»): daysUntil не звать, nextDue нет.
  const days = due.nextDue === null ? null : daysUntil(today, due.nextDue)

  return (
    <div className={styles.timer}>
      <p className={`${styles.line} ${styles[due.urgency]}`}>
        {short ? timerTextShort(days) : timerText(days)}
      </p>
      {detailed && (
        <p className={styles.next}>
          {due.nextDue === null ? 'Ещё не отмечали' : `Следующий раз: ${formatDate(due.nextDue)}`}
        </p>
      )}
    </div>
  )
}
