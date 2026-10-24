import { describe, expect, it } from 'vitest'
import type { CareItem, CompletionLogEntry } from './model'
import {
  addInterval,
  daysUntil,
  diffInDays,
  isValidDateString,
  lastDone,
  nextDue,
  parseDate,
  toDateString,
} from './dates'

/** Минимальный пункт ухода для проверки nextDue. */
function item(interval: CareItem['interval']): CareItem {
  return { id: 'care-1', subjectId: 'subject-1', title: 'Прививка', interval }
}

/** Запись выполнения для care-1 (или другого пункта). */
function entry(date: string, careItemId = 'care-1'): CompletionLogEntry {
  return { id: `log-${date}-${careItemId}`, careItemId, date }
}

describe('валидация и парсинг ' + "'YYYY-MM-DD'", () => {
  it('принимает корректные даты', () => {
    expect(isValidDateString('2026-10-24')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true) // високосный год
    expect(isValidDateString('2000-02-29')).toBe(true) // 400-кратный — високосный
  })

  it('отвергает неверный формат и несуществующие даты', () => {
    expect(isValidDateString('')).toBe(false)
    expect(isValidDateString('2026-1-5')).toBe(false) // без ведущих нулей
    expect(isValidDateString('2026/10/24')).toBe(false)
    expect(isValidDateString('26-10-24')).toBe(false)
    expect(isValidDateString('2026-10-24T00:00')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false) // месяц 13
    expect(isValidDateString('2026-00-10')).toBe(false) // месяц 0
    expect(isValidDateString('2026-10-00')).toBe(false) // день 0
    expect(isValidDateString('2026-10-32')).toBe(false) // день 32
    expect(isValidDateString('2026-04-31')).toBe(false) // в апреле 30 дней
    expect(isValidDateString('2023-02-29')).toBe(false) // 2023 не високосный
    expect(isValidDateString('1900-02-29')).toBe(false) // 100-кратный — не високосный
  })

  it('парсит дату на компоненты и форматирует обратно', () => {
    expect(parseDate('2026-10-24')).toEqual({ year: 2026, month: 10, day: 24 })
    expect(toDateString({ year: 2024, month: 2, day: 29 })).toBe('2024-02-29')
    expect(toDateString({ year: 2026, month: 3, day: 7 })).toBe('2026-03-07')
  })

  it('бросает ошибку при парсинге мусора', () => {
    expect(() => parseDate('2026-02-30')).toThrow(RangeError)
  })
})

describe('сложение интервалов', () => {
  it('дни: переходят через конец месяца и года', () => {
    expect(addInterval('2026-01-31', { value: 2, unit: 'days' })).toBe('2026-02-02')
    expect(addInterval('2026-12-31', { value: 1, unit: 'days' })).toBe('2027-01-01')
    expect(addInterval('2026-10-24', { value: 10, unit: 'days' })).toBe('2026-11-03')
  })

  it('недели: семь дней каждая', () => {
    expect(addInterval('2026-10-24', { value: 2, unit: 'weeks' })).toBe('2026-11-07')
    expect(addInterval('2024-02-23', { value: 1, unit: 'weeks' })).toBe('2024-03-01') // через 29 февраля
  })

  it('месяцы: клампинг 31-го числа (31 января + 1 месяц = 28/29 февраля)', () => {
    expect(addInterval('2024-01-31', { value: 1, unit: 'months' })).toBe('2024-02-29') // високосный
    expect(addInterval('2023-01-31', { value: 1, unit: 'months' })).toBe('2023-02-28') // обычный
    expect(addInterval('2026-01-31', { value: 1, unit: 'months' })).toBe('2026-02-28')
  })

  it('месяцы: без клампинга дата сохраняется, перенос через год работает', () => {
    expect(addInterval('2026-01-15', { value: 1, unit: 'months' })).toBe('2026-02-15')
    expect(addInterval('2025-11-30', { value: 3, unit: 'months' })).toBe('2026-02-28')
    expect(addInterval('2024-12-31', { value: 2, unit: 'months' })).toBe('2025-02-28')
  })

  it('месяцы от 29 февраля не требует клампинга', () => {
    expect(addInterval('2024-02-29', { value: 1, unit: 'months' })).toBe('2024-03-29')
  })

  it('годы: високосный февраль клампится до 28-го', () => {
    expect(addInterval('2024-02-29', { value: 1, unit: 'years' })).toBe('2025-02-28')
    expect(addInterval('2024-02-29', { value: 4, unit: 'years' })).toBe('2028-02-29') // снова високосный
    expect(addInterval('2024-02-29', { value: 100, unit: 'years' })).toBe('2124-02-29') // 400-кратный
    expect(addInterval('2026-03-31', { value: 1, unit: 'years' })).toBe('2027-03-31')
  })

  it('бросает ошибку на некорректных входах', () => {
    expect(() => addInterval('2026-02-30', { value: 1, unit: 'days' })).toThrow(RangeError)
    expect(() => addInterval('2026-10-24', { value: 0, unit: 'days' })).toThrow(RangeError)
    expect(() => addInterval('2026-10-24', { value: -1, unit: 'months' })).toThrow(RangeError)
    expect(() => addInterval('2026-10-24', { value: 1.5, unit: 'days' })).toThrow(RangeError)
  })
})

describe('разность дат', () => {
  it('нулевая разность на одинаковых датах', () => {
    expect(diffInDays('2026-10-24', '2026-10-24')).toBe(0)
  })

  it('положительная в будущее, отрицательная в прошлое', () => {
    expect(diffInDays('2026-10-24', '2026-10-31')).toBe(7)
    expect(diffInDays('2026-10-31', '2026-10-24')).toBe(-7)
  })

  it('учитывает длину месяцев и високосный февраль', () => {
    expect(diffInDays('2026-01-01', '2026-02-01')).toBe(31)
    expect(diffInDays('2023-02-01', '2023-03-01')).toBe(28)
    expect(diffInDays('2024-02-01', '2024-03-01')).toBe(29)
    expect(diffInDays('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('daysUntil(today, due) — «через сколько дней»', () => {
    expect(daysUntil('2026-10-24', '2026-10-31')).toBe(7)
    expect(daysUntil('2026-10-24', '2026-10-24')).toBe(0)
    expect(daysUntil('2026-10-24', '2026-10-20')).toBe(-4)
  })
})

describe('lastDone и nextDue: журнал — источник истины (ADR-0003)', () => {
  it('пустой журнал: lastDone и nextDue отсутствуют («пора сейчас» решает срочность)', () => {
    expect(lastDone('care-1', [])).toBeNull()
    expect(nextDue(item({ value: 12, unit: 'months' }), [])).toBeNull()
  })

  it('одна запись: nextDue = дата + интервал', () => {
    expect(nextDue(item({ value: 12, unit: 'months' }), [entry('2026-03-15')])).toBe('2027-03-15')
    expect(nextDue(item({ value: 7, unit: 'days' }), [entry('2026-03-15')])).toBe('2026-03-22')
  })

  it('берётся последняя по дате запись, а не последняя в массиве', () => {
    const log = [entry('2026-05-01'), entry('2026-01-10'), entry('2026-03-15')]
    expect(lastDone('care-1', log)).toBe('2026-05-01')
    expect(nextDue(item({ value: 1, unit: 'months' }), log)).toBe('2026-06-01')
  })

  it('чужие записи других пунктов ухода игнорируются', () => {
    const log = [entry('2026-01-10', 'care-2'), entry('2026-03-15')]
    expect(lastDone('care-1', log)).toBe('2026-03-15')
    expect(lastDone('care-2', log)).toBe('2026-01-10')
  })

  it('смена интервала пересчитывает nextDue от последнего выполнения', () => {
    const log = [entry('2026-03-15')]
    expect(nextDue(item({ value: 12, unit: 'months' }), log)).toBe('2027-03-15')
    expect(nextDue(item({ value: 1, unit: 'months' }), log)).toBe('2026-04-15')
    expect(nextDue(item({ value: 2, unit: 'weeks' }), log)).toBe('2026-03-29')
    // lastDone при этом не меняется — это факт из журнала
    expect(lastDone('care-1', log)).toBe('2026-03-15')
  })

  it('интервал, выводящий за конец февраля, клампится', () => {
    // 31 января + 1 месяц = 28 февраля 2026 (не високосный)
    expect(nextDue(item({ value: 1, unit: 'months' }), [entry('2026-01-31')])).toBe('2026-02-28')
  })
})
