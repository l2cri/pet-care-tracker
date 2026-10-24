import { describe, expect, it } from 'vitest'
import type { CareItem, DateString, IntervalUnit } from './model'
import { careItemCalendar } from './ics'

/**
 * UID и DTSTAMP в проде выдаёт app-слой (crypto.randomUUID и UTC-время);
 * в тестах они фиксированы — генератор обязан быть детерминированным.
 */
const UID = 'f0f1f2f3-1111-2222-3333-444455556666'
const DTSTAMP = '20261024T183000Z'

/** Дата старта — вычисленный nextDue (в эталонах: 2026-11-05). */
const START: DateString = '2026-11-05'

/** Пункт ухода «Прививка» подопечного Барсика; интервал задаёт тест. */
function vaccine(value: number, unit: IntervalUnit): CareItem {
  return { id: 'care-1', subjectId: 'subject-1', title: 'Прививка', interval: { value, unit } }
}

/** Вызов генератора с фиксированными uid/dtStamp (меняется только item и опции). */
function calendarOf(item: CareItem, subjectName = 'Барсик', start: DateString = START): string {
  return careItemCalendar({ item, subjectName, start, uid: UID, dtStamp: DTSTAMP })
}

/**
 * Эталонный VCALENDAR целиком: пункт «Прививка», подопечный Барсик, старт
 * 2026-11-05. rrule — единственная строка, отличающая единицы интервала;
 * эталон собирается здесь же, снапшоты не используются.
 */
function referenceVcalendar(rrule: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pet-care-tracker//Питомцы и дом//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${UID}`,
    `DTSTAMP:${DTSTAMP}`,
    'DTSTART;VALUE=DATE:20261105',
    `RRULE:${rrule}`,
    'SUMMARY:Прививка — Барсик',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .join('\r\n')
    // финальный CRLF обязателен по RFC 5545 §3.4 — эталон закрепляет и его
    .concat('\r\n')
}

describe('эталонные VCALENDAR по единицам интервала (ADR-0004)', () => {
  it('days → FREQ=DAILY;INTERVAL=7', () => {
    expect(calendarOf(vaccine(7, 'days'))).toBe(referenceVcalendar('FREQ=DAILY;INTERVAL=7'))
  })

  it('weeks → FREQ=WEEKLY;INTERVAL=2', () => {
    expect(calendarOf(vaccine(2, 'weeks'))).toBe(referenceVcalendar('FREQ=WEEKLY;INTERVAL=2'))
  })

  it('months → FREQ=MONTHLY;INTERVAL=12', () => {
    expect(calendarOf(vaccine(12, 'months'))).toBe(referenceVcalendar('FREQ=MONTHLY;INTERVAL=12'))
  })

  it('years → FREQ=YEARLY;INTERVAL=3', () => {
    expect(calendarOf(vaccine(3, 'years'))).toBe(referenceVcalendar('FREQ=YEARLY;INTERVAL=3'))
  })
})

describe('RRULE: INTERVAL=1 опускается — значение по умолчанию RFC 5545', () => {
  it('интервал 1 день → RRULE:FREQ=DAILY без INTERVAL', () => {
    const out = calendarOf(vaccine(1, 'days'))
    expect(out).toContain('\r\nRRULE:FREQ=DAILY\r\n')
    expect(out).not.toContain('INTERVAL')
  })
})

describe('экранирование текста SUMMARY (RFC 5545 §3.3.11)', () => {
  it('запятые и точки с запятой → «\\,» и «\\;»', () => {
    const item = { ...vaccine(2, 'months'), title: 'Груминг, ванны; когти' }
    expect(calendarOf(item)).toContain('SUMMARY:Груминг\\, ванны\\; когти — Барсик\r\n')
  })

  it('обратный слэш удваивается, перевод строки → литеральный «\\n»', () => {
    const item = { ...vaccine(2, 'months'), title: 'Витамин D\\омега-3\nвесна' }
    // в эталонной строке «\\\\» — два символа-слэша, «\\n» — слэш и буква n, не перевод
    expect(calendarOf(item)).toContain('SUMMARY:Витамин D\\\\омега-3\\nвесна — Барсик\r\n')
  })
})

describe('folding длинных строк по октетам UTF-8 (RFC 5545 §3.1)', () => {
  it('кириллический SUMMARY рвётся ровно на 75 октетах: первая строка кончается на «клеще»', () => {
    const item = { ...vaccine(3, 'months'), title: 'Профилактическая обработка от клещей и блох' }
    const out = calendarOf(item)
    // «SUMMARY:» (8 октетов) + 32 кириллических символа и 3 пробела = ровно 75:
    // «й» из слова «клещей» уже не влезает; кириллица — 2 октета на символ
    expect(out).toContain('SUMMARY:Профилактическая обработка от клеще\r\n й и блох — Барсик\r\n')
    // несвёрнутая строка не встречается нигде
    expect(out).not.toContain('от клещей и')
  })
})

describe('валидация входа (контракт для app-слоя)', () => {
  it('несуществующая дата старта → RangeError', () => {
    expect(() => calendarOf(vaccine(7, 'days'), 'Барсик', '2026-02-30')).toThrow(RangeError)
  })

  it('недопустимый интервал → RangeError', () => {
    expect(() => calendarOf(vaccine(0, 'days'))).toThrow(RangeError)
  })

  it('DTSTAMP не в формате YYYYMMDDTHHMMSSZ → RangeError', () => {
    expect(() =>
      careItemCalendar({
        item: vaccine(7, 'days'),
        subjectName: 'Барсик',
        start: START,
        uid: UID,
        dtStamp: '2026-10-24T18:30:00Z',
      }),
    ).toThrow(RangeError)
  })
})
