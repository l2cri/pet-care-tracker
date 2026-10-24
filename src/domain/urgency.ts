/**
 * Срочность и сортировки дашборда (глоссарий: Urgency, «Окно "скоро"», бейдж карточки).
 *
 * Всё выводится из журнала выполнений (ADR-0003): nextDue нигде не хранится,
 * «сегодня» приходит параметром — функции чистые, без Date и DOM.
 */

import type { CareItem, CompletionLogEntry, DateString } from './model'
import { daysUntil, nextDue } from './dates'

/** Классификация пункта по nextDue: overdue — красный, soon — жёлтый, calm — серый. */
export type Urgency = 'overdue' | 'soon' | 'calm'

/** Окно «скоро» в днях: константа домена, границы 6/7/8 покрыты тестами. */
export const SOON_WINDOW_DAYS = 7

/** Пункт ухода с вычисленными «следующим разом» и срочностью — то, что рисуют таймеры. */
export interface CareItemDue {
  item: CareItem
  /** null — пустой журнал, «пора сейчас» (тикет 02: поведение по умолчанию). */
  nextDue: DateString | null
  urgency: Urgency
}

/**
 * Срочность пункта ухода. Пустой журнал — overdue «пора сейчас»;
 * дата до сегодня — overdue; 0..SOON_WINDOW_DAYS дней — soon; дальше — calm.
 */
export function urgencyOf(
  item: CareItem,
  log: readonly CompletionLogEntry[],
  today: DateString,
): Urgency {
  const due = nextDue(item, log)
  if (due === null) return 'overdue'
  const days = daysUntil(today, due)
  if (days < 0) return 'overdue'
  if (days <= SOON_WINDOW_DAYS) return 'soon'
  return 'calm'
}

/** Пункты ухода с вычисленными nextDue и срочностью. */
export function withUrgency(
  items: readonly CareItem[],
  log: readonly CompletionLogEntry[],
  today: DateString,
): CareItemDue[] {
  return items.map((item) => ({
    item,
    nextDue: nextDue(item, log),
    urgency: urgencyOf(item, log, today),
  }))
}

/** Ранг для сортировки: просроченное — 0, «скоро» — 1, спокойное — 2. */
function rank(urgency: Urgency): number {
  if (urgency === 'overdue') return 0
  if (urgency === 'soon') return 1
  return 2
}

/**
 * Общий список дел: сначала по срочности, внутри группы — по дате
 * (лексикографический порядок 'YYYY-MM-DD' совпадает с хронологическим).
 * «Пора сейчас» (пустой журнал) стоит после строгих просрочек и перед «скоро»:
 * его ключ сортировки — сегодня. Чистая функция: вход не изменяется.
 */
export function sortTodoList(
  entries: readonly CareItemDue[],
  today: DateString,
): CareItemDue[] {
  const key = (entry: CareItemDue): DateString => entry.nextDue ?? today
  return [...entries].sort(
    (a, b) =>
      rank(a.urgency) - rank(b.urgency) ||
      (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0),
  )
}

/**
 * Бейдж карточки: самый срочный пункт подопечного — первый элемент общего
 * порядка. null, если пунктов нет. Порядок тот же, что в sortTodoList.
 */
export function mostUrgent(
  items: readonly CareItem[],
  log: readonly CompletionLogEntry[],
  today: DateString,
): CareItemDue | null {
  const sorted = sortTodoList(withUrgency(items, log, today), today)
  return sorted.length > 0 ? sorted[0] : null
}
