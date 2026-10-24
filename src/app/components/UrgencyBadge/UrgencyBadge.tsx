/**
 * Бейдж карточки подопечного (глоссарий: «Бейдж карточки», User Story 13):
 * самый срочный пункт одной строкой — заголовок и короткий таймер цветом
 * срочности. null — пунктов ухода нет, приглушённая строка вместо пустоты.
 *
 * Самого срочного пункта находит домен (mostUrgent) — компонент только
 * рендерит готовый CareItemDue.
 */

import type { ReactElement } from 'react'
import type { DateString } from '../../../domain/model'
import type { CareItemDue } from '../../../domain/urgency'
import { daysUntil } from '../../../domain/dates'
import { timerTextShort } from '../format'
import styles from './UrgencyBadge.module.css'

export interface UrgencyBadgeProps {
  /** «Сегодня» — локальная 'YYYY-MM-DD'; дашборд вычисляет её один раз на рендер. */
  today: DateString
  /** Самый срочный пункт подопечного (mostUrgent); null — пунктов нет. */
  due: CareItemDue | null
}

export function UrgencyBadge(props: UrgencyBadgeProps): ReactElement {
  const { today, due } = props
  if (due === null) {
    return <span className={`${styles.badge} ${styles.none}`}>Нет пунктов ухода</span>
  }
  // daysUntil здесь только ради текста таймера; цвет уже решён urgency.
  const days = due.nextDue === null ? null : daysUntil(today, due.nextDue)
  return (
    <span className={`${styles.badge} ${styles[due.urgency]}`}>
      {due.item.title} · {timerTextShort(days)}
    </span>
  )
}
