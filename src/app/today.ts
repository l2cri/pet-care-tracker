/**
 * «Сегодня» для app-слоя: локальная строка 'YYYY-MM-DD'.
 *
 * Домен принимает «сегодня» параметром и не знает Date (ADR-0008) — эта
 * крошечная адаптация живёт в app и остаётся единственным местом, где
 * текущее время читается из системы. Часовой пояс локальный: даты всего
 * приложения локальные, без таймзон.
 */

import type { DateString } from '../domain/model'

/** Текущая локальная дата как 'YYYY-MM-DD'. */
export function todayDateString(): DateString {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
