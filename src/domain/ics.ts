/**
 * Генератор .ics-календарей (ADR-0004, глоссарий: «Экспорт .ics»).
 *
 * Чистый строковый модуль без библиотек, Date и DOM: функция возвращает текст
 * VCALENDAR целиком, а Blob и скачивание — забота app-слоя (ui-craft). Всё
 * меняющееся (UID, DTSTAMP, дата старта) приходит параметрами, поэтому вывод
 * детерминирован и в тестах сверяется с эталонными строками.
 *
 * RFC 5545: all-day VEVENT (DTSTART;VALUE=DATE), RRULE из интервала пункта,
 * VALARM за сутки; TEXT экранируется (§3.3.11), строки длиннее 75 октетов
 * сворачиваются с подсчётом октетов UTF-8, а не символов (§3.1); разрывы
 * строк — CRLF. Разовые события тикета 07 строятся из тех же внутренностей:
 * veventLines без rrule — уже одиночный VEVENT.
 */

import type { CareItem, DateString, Interval, IntervalUnit, OneOffEvent } from './model'
import { parseDate } from './dates'

/** Вход генератора календаря пункта ухода (тикет 06). */
export interface CareItemCalendarInput {
  /** Пункт ухода: заголовок идёт в SUMMARY, интервал — в RRULE. */
  item: CareItem
  /** Имя подопечного (CareSubject.name) — вторая половина SUMMARY. */
  subjectName: string
  /** DTSTART: вычисленный nextDue; при пустом журнале вызывающий передаёт «сегодня». */
  start: DateString
  /** UID события; app-слой выдаёт crypto.randomUUID() (как в model.ts). */
  uid: string
  /** Метка создания 'YYYYMMDDTHHMMSSZ' (UTC); строку формирует вызывающий. */
  dtStamp: string
}

/** FREQ для каждой единицы интервала (глоссарий: Интервал → RRULE). */
const UNIT_TO_FREQ: Record<IntervalUnit, string> = {
  days: 'DAILY',
  weeks: 'WEEKLY',
  months: 'MONTHLY',
  years: 'YEARLY',
}

/** DTSTAMP строго 'YYYYMMDDTHHMMSSZ' — UTC-строка из app-слоя. */
const DTSTAMP_RE = /^\d{8}T\d{6}Z$/

/** Лимит физической строки в октетах без свёртки (RFC 5545 §3.1). */
const MAX_LINE_OCTETS = 75

/** Число октетов UTF-8 в символе: 1 — ASCII, 2 — кириллица, 3 — тире и т.п., 4 — эмодзи. */
function utf8Octets(char: string): number {
  const code = char.codePointAt(0) ?? 0
  if (code < 0x80) return 1
  if (code < 0x800) return 2
  if (code < 0x10000) return 3
  return 4
}

/**
 * Экранирование TEXT по RFC 5545 §3.3.11: обратный слэш, точка с запятой,
 * запятая и переводы строк (CRLF/CR/LF → литеральный «\n»). Порядок важен:
 * слэш удваивается первым, иначе были бы экранированы вставленные символы.
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Свёртка длинной строки (RFC 5545 §3.1): физическая строка не длиннее
 * 75 октетов, продолжение начинается с одиночного пробела, входящего в лимит.
 * Кириллица занимает 2 октета на символ, поэтому порог считается по октетам,
 * а не по символам; символ не рвётся посередине.
 */
function foldLine(line: string): string {
  const physical: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const charOctets = utf8Octets(char)
    if (octets + charOctets > MAX_LINE_OCTETS) {
      physical.push(current)
      current = ` ${char}`
      octets = 1 + charOctets
    } else {
      current += char
      octets += charOctets
    }
  }
  physical.push(current)
  return physical.join('\r\n')
}

/** 'YYYY-MM-DD' → 'YYYYMMDD' для DTSTART; попутно валидация из dates.ts (ADR-0008). */
function toIcsDate(date: DateString): string {
  const { year, month, day } = parseDate(date)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(year).padStart(4, '0')}${pad(month)}${pad(day)}`
}

/**
 * RRULE из интервала пункта: единица → FREQ (days→DAILY и т.д.), значение →
 * INTERVAL. При значении 1 INTERVAL опускается — это значение по умолчанию
 * по RFC 5545 (решение зафиксировано тестами).
 */
function rruleFromInterval(interval: Interval): string {
  if (!Number.isInteger(interval.value) || interval.value <= 0) {
    throw new RangeError(
      `Значение интервала должно быть целым положительным числом: ${interval.value}`,
    )
  }
  const freq = `FREQ=${UNIT_TO_FREQ[interval.unit]}`
  return interval.value === 1 ? freq : `${freq};INTERVAL=${interval.value}`
}

/** Части одного VEVENT; без rrule получится одиночное событие (тикет 07). */
interface VeventParts {
  uid: string
  dtStamp: string
  start: DateString
  summary: string
  /** Повтор: содержимое RRULE без префикса; undefined — событие без повтора. */
  rrule?: string
}

/**
 * Логические (ещё не свёрнутые) строки VEVENT с VALARM за сутки (ADR-0004).
 * DESCRIPTION будильника фиксирован: календарь и так показывает SUMMARY.
 * Точка переиспользования для разовых событий тикета 07 — без rrule.
 */
function veventLines({ uid, dtStamp, start, summary, rrule }: VeventParts): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
    ...(rrule === undefined ? [] : [`RRULE:${rrule}`]),
    `SUMMARY:${escapeText(summary)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание',
    'END:VALARM',
    'END:VEVENT',
  ]
}

/** Обёртка VCALENDAR вокруг строк события: свёртка каждой строки + CRLF между ними. */
function vcalendar(eventLines: readonly string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pet-care-tracker//Питомцы и дом//RU',
    'CALSCALE:GREGORIAN',
    ...eventLines,
    'END:VCALENDAR',
    // Финальный CRLF после END:VCALENDAR обязателен (RFC 5545 §3.4):
    // строгие валидаторы помечают файл без него ошибкой.
  ]
    .map(foldLine)
    .join('\r\n')
    .concat('\r\n')
}

/**
 * VCALENDAR повторяющегося all-day события пункта ухода (тикет 06, ADR-0004).
 * SUMMARY — «{заголовок пункта} — {имя подопечного}», RRULE выводится из
 * интервала пункта, VALARM звонит за сутки. Бросает RangeError на несуществующей
 * дате старта, нецелом/неположительном интервале и DTSTAMP не по формату.
 */
export function careItemCalendar(input: CareItemCalendarInput): string {
  if (!DTSTAMP_RE.test(input.dtStamp)) {
    throw new RangeError(`Некорректный DTSTAMP (ожидался 'YYYYMMDDTHHMMSSZ'): ${input.dtStamp}`)
  }
  return vcalendar(
    veventLines({
      uid: input.uid,
      dtStamp: input.dtStamp,
      start: input.start,
      summary: `${input.item.title} — ${input.subjectName}`,
      rrule: rruleFromInterval(input.item.interval),
    }),
  )
}

/** Вход генератора календаря разового события (тикет 07). */
export interface OneOffEventCalendarInput {
  /** Разовое событие: заголовок идёт в SUMMARY, дата — в DTSTART. */
  event: OneOffEvent
  /** Имя подопечного (CareSubject.name) — вторая половина SUMMARY. */
  subjectName: string
  /** UID события; app-слой выдаёт crypto.randomUUID() (как в model.ts). */
  uid: string
  /** Метка создания 'YYYYMMDDTHHMMSSZ' (UTC); строку формирует вызывающий. */
  dtStamp: string
}

/**
 * VCALENDAR одиночного all-day события разового дела (тикет 07, ADR-0004):
 * DTSTART — дата события, RRULE нет, VALARM за сутки. SUMMARY — «{заголовок}
 * — {питомец}». Флаг done не влияет на выгрузку: экспортировать можно и
 * предстоящее, и выполненное (перенос в календарь задним числом). Бросает
 * RangeError на несуществующей дате события и DTSTAMP не по формату.
 */
export function oneOffEventCalendar(input: OneOffEventCalendarInput): string {
  if (!DTSTAMP_RE.test(input.dtStamp)) {
    throw new RangeError(`Некорректный DTSTAMP (ожидался 'YYYYMMDDTHHMMSSZ'): ${input.dtStamp}`)
  }
  return vcalendar(
    veventLines({
      uid: input.uid,
      dtStamp: input.dtStamp,
      start: input.event.date,
      summary: `${input.event.title} — ${input.subjectName}`,
      // rrule не передаётся — veventLines без него даёт одиночный VEVENT
    }),
  )
}
