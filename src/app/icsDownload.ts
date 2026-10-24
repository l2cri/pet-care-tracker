/**
 * Скачивание .ics-календаря пункта ухода (тикет 06, ADR-0004, глоссарий:
 * «Экспорт .ics»). Вся строка VCALENDAR и её валидация — в domain/ics;
 * здесь только app-обёртка: сборка входа генератора (uid, DTSTAMP, старт)
 * и Blob-механика браузера. Компонент зовёт downloadCareItemCalendar с
 * готовыми данными пункта — в JSX не появляется ни строки логики.
 */

import type { CareItem, DateString } from '../domain/model'
import { careItemCalendar } from '../domain/ics'

/** Символы, запрещённые в именах файлов: заголовок пункта — свободный текст. */
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/g

/**
 * Человекочитаемое имя файла «{пункт} — {питомец}.ics». Запрещённые
 * символы превращаются в пробел, пробелы схлопываются, края обрезаются —
 * «Груминг/когти» не должен ломать скачивание ни на Windows, ни на телефоне.
 */
export function icsFileName(itemTitle: string, subjectName: string): string {
  const safe = (text: string): string =>
    text.replace(UNSAFE_FILENAME_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return `${safe(itemTitle)} — ${safe(subjectName)}.ics`
}

/** DTSTAMP 'YYYYMMDDTHHMMSSZ' из UTC-компонентов Date — app-слою можно (как today.ts). */
export function utcStamp(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${String(now.getUTCFullYear()).padStart(4, '0')}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `${date}T${time}Z`
}

/** DTSTART события: вычисленный nextDue; пустой журнал («пора сейчас») — «сегодня». */
export function calendarStart(nextDue: DateString | null, today: DateString): DateString {
  return nextDue ?? today
}

/** Тонкая DOM-механика: Blob → временная ссылка → клик → revoke. Сервера нет (ADR-0004). */
function downloadTextFile(fileName: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // Firefox кликает только ссылку в документе — она в DOM на один тик.
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Готовые данные пункта, которых хватает на выгрузку; остальное — выводное. */
export interface CareItemCalendarDownload {
  /** Пункт ухода: заголовок и интервал уходят в ядро (SUMMARY, RRULE). */
  item: CareItem
  /** Имя подопечного (CareSubject.name) — в SUMMARY и в имя файла. */
  subjectName: string
  /** nextDue пункта (withUrgency); null — пустой журнал, стартуем «сегодня». */
  nextDue: DateString | null
  /** «Сегодня» — локальная 'YYYY-MM-DD' (todayDateString экрана). */
  today: DateString
}

/**
 * Один клик → скачан «{пункт} — {питомец}.ics». Строку строит ядро
 * (careItemCalendar); uid и DTSTAMP выдаются только здесь, в app-слое.
 */
export function downloadCareItemCalendar(input: CareItemCalendarDownload): void {
  const calendar = careItemCalendar({
    item: input.item,
    subjectName: input.subjectName,
    start: calendarStart(input.nextDue, input.today),
    uid: crypto.randomUUID(),
    dtStamp: utcStamp(new Date()),
  })
  downloadTextFile(
    icsFileName(input.item.title, input.subjectName),
    calendar,
    'text/calendar;charset=utf-8',
  )
}
