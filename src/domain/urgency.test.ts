import { describe, expect, it } from 'vitest'
import type { CareItem, CompletionLogEntry, DateString } from './model'
import {
  mostUrgent,
  SOON_WINDOW_DAYS,
  sortTodoList,
  urgencyOf,
  withUrgency,
} from './urgency'

/** Точка отсчёта для всех тестов срочности. */
const TODAY: DateString = '2026-10-24'

/** Пункт ухода подопечного subject-1 (если не сказано иное). */
function item(id: string, interval: CareItem['interval'], subjectId = 'subject-1'): CareItem {
  return { id, subjectId, title: id, interval }
}

/** Запись выполнения пункта careItemId. */
function log(careItemId: string, date: DateString): CompletionLogEntry {
  return { id: `log-${careItemId}-${date}`, careItemId, date }
}

/**
 * Пункт с интервалом 7 дней и журналом на `logDate`:
 * nextDue = logDate + 7 дней, то есть за N дней до TODAY журнал был N-7 дней назад.
 */
function dueIn(id: string, daysFromToday: number, subjectId = 'subject-1'): CareItem {
  return item(id, { value: 7, unit: 'days' }, subjectId)
}

describe('классификация срочности (глоссарий: Urgency)', () => {
  it('пустой журнал = «пора сейчас» → overdue (поведение по умолчанию из тикета 02)', () => {
    expect(urgencyOf(item('care-1', { value: 12, unit: 'months' }), [], TODAY)).toBe('overdue')
  })

  it('просрочено: дата следующего раза до сегодня', () => {
    // журнал 2026-10-16 + 7 дней = 2026-10-23 — вчера
    expect(urgencyOf(dueIn('care-1', -1), [log('care-1', '2026-10-16')], TODAY)).toBe('overdue')
    // просрочка на 10 дней: 2026-10-14
    expect(urgencyOf(dueIn('care-2', -10), [log('care-2', '2026-10-04')], TODAY)).toBe('overdue')
  })

  it('границы окна «скоро»: сегодня (0), через 6 и через 7 дней — soon', () => {
    expect(SOON_WINDOW_DAYS).toBe(7) // константа домена (глоссарий: Окно «скоро»)
    // 0 дней: журнал 2026-10-17 + 7 = 2026-10-24 — сегодня
    expect(urgencyOf(dueIn('care-1', 0), [log('care-1', '2026-10-17')], TODAY)).toBe('soon')
    // 6 дней: 2026-10-30
    expect(urgencyOf(dueIn('care-2', 6), [log('care-2', '2026-10-23')], TODAY)).toBe('soon')
    // 7 дней: 2026-10-31
    expect(urgencyOf(dueIn('care-3', 7), [log('care-3', '2026-10-24')], TODAY)).toBe('soon')
  })

  it('8 и больше дней — calm', () => {
    // 8 дней: журнал 2026-10-25 + 7 = 2026-11-01
    expect(urgencyOf(dueIn('care-1', 8), [log('care-1', '2026-10-25')], TODAY)).toBe('calm')
    // 15 дней: 2026-11-08
    expect(urgencyOf(dueIn('care-2', 15), [log('care-2', '2026-11-01')], TODAY)).toBe('calm')
  })

  it('смена интервала пересчитывает срочность от последнего выполнения (ADR-0003)', () => {
    const entries = [log('care-1', '2026-10-23')]
    // 7 дней → 2026-10-30, через 6 дней — soon
    expect(urgencyOf(item('care-1', { value: 7, unit: 'days' }), entries, TODAY)).toBe('soon')
    // 30 дней → 2026-11-22 — calm
    expect(urgencyOf(item('care-1', { value: 30, unit: 'days' }), entries, TODAY)).toBe('calm')
    // 1 день → 2026-10-24, сегодня — soon
    expect(urgencyOf(item('care-1', { value: 1, unit: 'days' }), entries, TODAY)).toBe('soon')
  })
})

describe('withUrgency: пункты с вычисленным «следующим разом»', () => {
  it('проставляет nextDue и срочность каждому пункту', () => {
    const items = [
      item('care-1', { value: 7, unit: 'days' }),
      item('care-2', { value: 12, unit: 'months' }),
    ]
    const logEntries = [log('care-1', '2026-10-16'), log('care-2', '2026-01-31')]
    expect(withUrgency(items, logEntries, TODAY)).toEqual([
      // 2026-10-16 + 7 дней = 2026-10-23 — вчера
      { item: items[0], nextDue: '2026-10-23', urgency: 'overdue' },
      // 31 января + 12 месяцев с клампингом = 2027-01-31 — далеко
      { item: items[1], nextDue: '2027-01-31', urgency: 'calm' },
    ])
  })

  it('записи чужих пунктов не мешают: пустой журнал пункта = overdue', () => {
    const items = [item('care-1', { value: 7, unit: 'days' }), item('care-2', { value: 7, unit: 'days' })]
    const logEntries = [log('care-2', '2026-10-23')]
    const result = withUrgency(items, logEntries, TODAY)
    expect(result[0]).toMatchObject({ item: items[0], nextDue: null, urgency: 'overdue' })
    expect(result[1]).toMatchObject({ item: items[1], nextDue: '2026-10-30', urgency: 'soon' })
  })
})

describe('sortTodoList: общий список дел дашборда', () => {
  /** Смесь пунктов всех срочностей трёх подопечных, порядок входа нарочно перепутан. */
  function mixed(): CareItem[] {
    return [
      dueIn('calm-15', 15, 'subject-3'), // 2026-11-08, calm
      dueIn('soon-6', 6, 'subject-2'), // 2026-10-30, soon
      dueIn('over-1', -1, 'subject-1'), // 2026-10-23, overdue
      dueIn('calm-8', 8, 'subject-1'), // 2026-11-01, calm
      item('never-done', { value: 12, unit: 'months' }, 'subject-2'), // пустой журнал
      dueIn('soon-0', 0, 'subject-3'), // 2026-10-24, soon
      dueIn('over-10', -10, 'subject-2'), // 2026-10-14, overdue
    ]
  }

  function mixedLog(): CompletionLogEntry[] {
    return [
      log('calm-15', '2026-11-01'),
      log('soon-6', '2026-10-23'),
      log('over-1', '2026-10-16'),
      log('calm-8', '2026-10-25'),
      log('soon-0', '2026-10-17'),
      log('over-10', '2026-10-04'),
    ]
  }

  it('сортирует по срочности, внутри группы — по дате; «пора сейчас» после строгих просрочек', () => {
    const sorted = sortTodoList(withUrgency(mixed(), mixedLog(), TODAY), TODAY)
    expect(sorted.map((e) => e.item.id)).toEqual([
      'over-10', // просрочено на 10 дней — самая ранняя дата
      'over-1', // просрочено на 1 день
      'never-done', // пустой журнал — «пора сейчас»
      'soon-0', // сегодня
      'soon-6', // через 6 дней
      'calm-8', // через 8 дней
      'calm-15', // через 15 дней
    ])
  })

  it('чистая функция: вход не мутируется', () => {
    const entries = withUrgency(mixed(), mixedLog(), TODAY)
    const snapshot = [...entries]
    sortTodoList(entries, TODAY)
    expect(entries).toEqual(snapshot)
  })
})

describe('mostUrgent: бейдж карточки подопечного', () => {
  it('самый срочный пункт из переданных (пункты одного подопечного)', () => {
    const items = [
      dueIn('calm', 15, 'subject-1'), // 2026-11-08
      dueIn('over', -1, 'subject-1'), // 2026-10-23
      dueIn('soon', 6, 'subject-1'), // 2026-10-30
    ]
    const logEntries = [
      log('calm', '2026-11-01'),
      log('over', '2026-10-16'),
      log('soon', '2026-10-23'),
    ]
    expect(mostUrgent(items, logEntries, TODAY)?.item.id).toBe('over')
  })

  it('при равной срочности выигрывает более ранняя дата', () => {
    const items = [dueIn('late-over', -1, 'subject-1'), dueIn('early-over', -10, 'subject-1')]
    const logEntries = [log('late-over', '2026-10-16'), log('early-over', '2026-10-04')]
    expect(mostUrgent(items, logEntries, TODAY)?.item.id).toBe('early-over')
  })

  it('null, когда пунктов нет', () => {
    expect(mostUrgent([], [], TODAY)).toBeNull()
  })
})
