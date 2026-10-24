/**
 * Срочность и сортировки дашборда (глоссарий: Urgency, «Окно "скоро"», бейдж карточки).
 *
 * Всё выводится из журнала выполнений (ADR-0003): nextDue нигде не хранится,
 * «сегодня» приходит параметром — функции чистые, без Date и DOM.
 */

import type { CareItem, CompletionLogEntry, DateString, OneOffEvent } from './model'
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

/** Разовое событие с вычисленной срочностью — то, что рисуют строки событий. */
export interface OneOffEventDue {
  event: OneOffEvent
  urgency: Urgency
}

/**
 * Срочность разового события по его дате. Выполненные — calm: в списках
 * дел их больше нет, они ушли в историю. Дата прошла — overdue;
 * 0..SOON_WINDOW_DAYS — soon; дальше — calm.
 */
export function eventUrgency(event: OneOffEvent, today: DateString): Urgency {
  if (event.done) return 'calm'
  const days = daysUntil(today, event.date)
  if (days < 0) return 'overdue'
  if (days <= SOON_WINDOW_DAYS) return 'soon'
  return 'calm'
}

/**
 * Предстоящие разовые события по возрастанию даты: первым — самое близкое
 * (тикет 07). Выполненные не возвращаются — их место в истории. Порядок
 * даты-строки лексикографический = хронологический ('YYYY-MM-DD').
 */
export function upcomingEvents(
  events: readonly OneOffEvent[],
  today: DateString,
): OneOffEventDue[] {
  return events
    .filter((event) => !event.done)
    .map((event) => ({ event, urgency: eventUrgency(event, today) }))
    .sort((a, b) => (a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : 0))
}

/**
 * Строка общего списка дел дашборда: пункт ухода или разовое событие
 * (тикет 07). Дискриминант kind — единственное, что различает строки;
 * срочность есть у обеих разновидностей.
 */
export type TodoEntry =
  | ({ kind: 'careItem' } & CareItemDue)
  | { kind: 'oneOffEvent'; event: OneOffEvent; urgency: Urgency }

/** Ключ даты строки: «следующий раз» пункта (пустой журнал — сегодня) или дата события. */
function entryDate(entry: TodoEntry, today: DateString): DateString {
  return entry.kind === 'careItem' ? entry.nextDue ?? today : entry.event.date
}

/**
 * Общий список дел дашборда: пункты ухода и предстоящие разовые события
 * (тикет 07) в одном порядке — сначала срочность, внутри группы — дата,
 * «пора сейчас» стоит после строгих просрочек (ключ — сегодня). Выполненные
 * события не входят; calm-строки возвращаются — показывать их или нет,
 * решает экран. Чистая функция: вход не изменяется.
 */
export function dashboardTodoList(
  items: readonly CareItem[],
  log: readonly CompletionLogEntry[],
  events: readonly OneOffEvent[],
  today: DateString,
): TodoEntry[] {
  const entries: TodoEntry[] = [
    ...withUrgency(items, log, today).map<TodoEntry>((due) => ({ kind: 'careItem', ...due })),
    ...upcomingEvents(events, today).map<TodoEntry>((due) => ({ kind: 'oneOffEvent', ...due })),
  ]
  return entries.sort(
    (a, b) =>
      rank(a.urgency) - rank(b.urgency) ||
      (entryDate(a, today) < entryDate(b, today)
        ? -1
        : entryDate(a, today) > entryDate(b, today)
          ? 1
          : 0),
  )
}
