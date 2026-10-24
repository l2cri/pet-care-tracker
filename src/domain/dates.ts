/**
 * Арифметика локальных дат 'YYYY-MM-DD' (ADR-0008).
 *
 * Ни одного объекта Date и ни одного UTC-преобразования: даты парсятся на
 * компоненты и считаются целочисленной календарной арифметикой. Единственная
 * точка входа для работы с датами в домене (ADR-0008, «Последствия»).
 * «Сегодня» всегда приходит параметром — функции чистые.
 */

import type { CareItem, CompletionLogEntry, DateString, Interval } from './model'

/** Дата на компоненты: 2026-10-24 → { year: 2026, month: 10, day: 24 }. */
export interface DateParts {
  year: number
  month: number
  day: number
}

/** Строгий формат 'YYYY-MM-DD': четыре цифры года, две месяца, две дня. */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Длины месяцев невисокосного года, индекс 0 — январь. */
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Дней в месяце (month: 1–12) с учётом високосного февраля. */
function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29
  return MONTH_LENGTHS[month - 1]
}

/**
 * Порядковый номер дня — монотонная шкала для сложения дней и разностей дат.
 * Алгоритм дней от гражданской даты (пролептический григорианский календарь),
 * чистая целочисленная математика.
 */
function toDayNumber({ year, month, day }: DateParts): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400 // [0, 399]
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Обратное преобразование порядкового номера дня в компоненты даты. */
function fromDayNumber(n: number): DateParts {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097 // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  )
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp + (mp < 10 ? 3 : -9)
  return { year: y + (month <= 2 ? 1 : 0), month, day }
}

/** Проверка интервала: положительное целое число (глоссарий: Интервал). */
function assertValidInterval(interval: Interval): void {
  if (!Number.isInteger(interval.value) || interval.value <= 0) {
    throw new RangeError(
      `Значение интервала должно быть целым положительным числом: ${interval.value}`,
    )
  }
}

/**
 * Парсинг 'YYYY-MM-DD' на компоненты.
 * Бросает RangeError на неверном формате и несуществующих датах
 * (30/31 февраля, 31 апреля, 29 февраля невисокосного года).
 */
export function parseDate(date: DateString): DateParts {
  const match = DATE_RE.exec(date)
  if (!match) throw new RangeError(`Некорректный формат даты (ожидался 'YYYY-MM-DD'): ${date}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) throw new RangeError(`Месяц вне 1–12: ${date}`)
  if (day < 1 || day > daysInMonth(year, month)) throw new RangeError(`День вне диапазона месяца: ${date}`)
  return { year, month, day }
}

/** Форматирование компонентов обратно в 'YYYY-MM-DD' (с валидацией). */
export function toDateString({ year, month, day }: DateParts): DateString {
  if (![year, month, day].every(Number.isInteger)) {
    throw new RangeError(`Компоненты даты должны быть целыми: ${year}-${month}-${day}`)
  }
  if (month < 1 || month > 12) throw new RangeError(`Месяц вне 1–12: ${month}`)
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`День вне диапазона месяца: ${year}-${month}-${day}`)
  }
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

/** Строка — корректная локальная дата 'YYYY-MM-DD'? */
export function isValidDateString(date: string): boolean {
  try {
    parseDate(date)
    return true
  } catch {
    return false
  }
}

/**
 * Сложение даты с интервалом.
 *
 * days/weeks — по календарной шкале дней; months/years — календарно, с
 * клампингом дня к длине целевого месяца: 31 января + 1 месяц = 28/29 февраля,
 * 29 февраля + 1 год = 28 февраля. Бросает RangeError на некорректной дате
 * и нецелом/неположительном значении интервала.
 */
export function addInterval(date: DateString, interval: Interval): DateString {
  assertValidInterval(interval)
  const from = parseDate(date)
  switch (interval.unit) {
    case 'days':
      return toDateString(fromDayNumber(toDayNumber(from) + interval.value))
    case 'weeks':
      return toDateString(fromDayNumber(toDayNumber(from) + interval.value * 7))
    case 'months': {
      const totalMonths = from.year * 12 + (from.month - 1) + interval.value
      const year = Math.floor(totalMonths / 12)
      const month = (totalMonths % 12) + 1
      const day = Math.min(from.day, daysInMonth(year, month))
      return toDateString({ year, month, day })
    }
    case 'years': {
      const year = from.year + interval.value
      const day = Math.min(from.day, daysInMonth(year, from.month))
      return toDateString({ year, month: from.month, day })
    }
  }
}

/**
 * Разность дат в днях: положительная — «to» в будущем от «from»,
 * отрицательная — в прошлом. Учитывает длины месяцев и високосные годы.
 */
export function diffInDays(from: DateString, to: DateString): number {
  return toDayNumber(parseDate(to)) - toDayNumber(parseDate(from))
}

/** «Через сколько дней»: due относительно today. Отрицательно — просрочено. */
export function daysUntil(today: DateString, due: DateString): number {
  return diffInDays(today, due)
}

/**
 * Последний раз (глоссарий: lastDone): дата последней записи журнала
 * для пункта ухода. Нигде не хранится, всегда выводится из фактов (ADR-0003).
 * Порядок записей в массиве не важен — берётся максимум по дате.
 */
export function lastDone(
  careItemId: string,
  log: readonly CompletionLogEntry[],
): DateString | null {
  let latest: DateString | null = null
  for (const entry of log) {
    if (entry.careItemId !== careItemId) continue
    // 'YYYY-MM-DD' сравнивается лексикографически так же, как хронологически.
    if (latest === null || entry.date > latest) latest = entry.date
  }
  return latest
}

/**
 * Следующий раз (глоссарий: nextDue): lastDone + интервал пункта.
 * Пустой журнал → null — «пора сейчас»; трактовку срочности решает urgency.
 * Смена интервала пункта автоматически пересчитывает результат от последнего
 * выполнения, потому что ничего не хранится (ADR-0003).
 */
export function nextDue(
  careItem: CareItem,
  log: readonly CompletionLogEntry[],
): DateString | null {
  const last = lastDone(careItem.id, log)
  return last === null ? null : addInterval(last, careItem.interval)
}
