import { describe, expect, it } from 'vitest'
import type { AppState, DateString } from './model'
import { demoData } from './demoData'
import { presetCareItemDrafts } from './presets'
import { diffInDays, isValidDateString, nextDue } from './dates'
import { dashboardTodoList, eventUrgency, upcomingEvents, withUrgency } from './urgency'
import type { Urgency } from './urgency'
import { monthlySpend } from './spend'

/** Точка отсчёта (как в urgency.test.ts); сдвиги ниже проверяют независимость от «сегодня». */
const TODAY: DateString = '2026-10-25'

/**
 * Инварианты набора обязаны держаться в любой день загрузки: базовый день,
 * сдвиг на несколько дней в обе стороны и високосный край февраля
 * (демо-кнопка живёт в настройках, а не в дате сборки).
 */
const TODAYS: readonly DateString[] = ['2026-10-20', '2026-10-25', '2026-10-30', '2024-02-29']

/** Единицы интервала из model.ts — для проверки careItems. */
const UNITS = ['days', 'weeks', 'months', 'years'] as const

/** Подопечный по имени (имена — часть демо-контракта: Персик и Бублик). */
function subjectByName(state: AppState, name: string) {
  const subject = state.subjects.find((candidate) => candidate.name === name)
  if (!subject) throw new Error(`В демо-наборе нет подопечного «${name}»`)
  return subject
}

/** Пункты ухода одного подопечного. */
function itemsOf(state: AppState, subjectId: string) {
  return state.careItems.filter((item) => item.subjectId === subjectId)
}

/** Срочности пунктов подопечного — через публичную функцию urgency.ts. */
function urgenciesOf(state: AppState, subjectId: string, today: DateString): Urgency[] {
  return withUrgency(itemsOf(state, subjectId), state.completionLog, today).map((due) => due.urgency)
}

/** Записи корма одного подопечного. */
function feedOf(state: AppState, subjectId: string) {
  return state.feed.filter((entry) => entry.subjectId === subjectId)
}

/** Замеры веса одного подопечного. */
function weightsOf(state: AppState, subjectId: string) {
  return state.weights.filter((entry) => entry.subjectId === subjectId)
}

/** Идентификаторы коллекции уникальны. */
function expectUniqueIds(list: readonly { id: string }[], what: string): void {
  expect(new Set(list.map((entity) => entity.id)).size, what).toBe(list.length)
}

describe('demoData: структура и чистота', () => {
  it('все шесть коллекций непусты; подопечных двое, оба — питомцы без фото', () => {
    const state = demoData(TODAY)
    for (const key of ['subjects', 'careItems', 'completionLog', 'oneOffEvents', 'weights', 'feed'] as const) {
      expect(state[key].length, key).toBeGreaterThan(0)
    }
    expect(state.subjects).toHaveLength(2)
    for (const subject of state.subjects) {
      expect(subject.type).toBe('pet')
      expect(subject.photo).toBeUndefined() // демо-скриншотам фото не нужно
      expect(subject.name.length).toBeGreaterThan(0)
      expect(subject.species.length).toBeGreaterThan(0)
    }
  })

  it('даты рождения — в прошлом, 1–7 лет (ADR-0008: разность дат без Date)', () => {
    const state = demoData(TODAY)
    for (const subject of state.subjects) {
      const ageDays = diffInDays(subject.birthDate, TODAY)
      expect(ageDays).toBeGreaterThanOrEqual(365)
      expect(ageDays).toBeLessThanOrEqual(7 * 366)
    }
  })

  it('чистая функция: один и тот же today — одинаковое состояние; вызовы не делят объекты', () => {
    const first = demoData(TODAY)
    const second = demoData(TODAY)
    expect(first).toEqual(second)

    // Порча первого результата не протекает в следующие вызовы.
    first.subjects[0]!.name = 'испорчено'
    first.weights[0]!.grams = -1
    first.completionLog.pop()
    expect(demoData(TODAY)).toEqual(second)
  })
})

describe('demoData: консистентность — то, что валидирует parseImport (тикет 10)', () => {
  // storage/backup.ts домен не импортирует (запрещённое направление),
  // поэтому его инварианты проверены прямыми утверждениями.
  const state = demoData(TODAY)

  it('все даты всех сущностей — корректные локальные YYYY-MM-DD', () => {
    const dates = [
      ...state.subjects.map((subject) => subject.birthDate),
      ...state.completionLog.map((entry) => entry.date),
      ...state.oneOffEvents.map((event) => event.date),
      ...state.weights.map((entry) => entry.date),
      ...state.feed.map((entry) => entry.date),
    ]
    for (const date of dates) expect(isValidDateString(date), date).toBe(true)
  })

  it('grams — целые положительные; интервалы — положительные целые с допустимой единицей', () => {
    for (const entry of state.weights) {
      expect(Number.isInteger(entry.grams), entry.id).toBe(true)
      expect(entry.grams, entry.id).toBeGreaterThan(0)
    }
    for (const item of state.careItems) {
      expect(Number.isInteger(item.interval.value) && item.interval.value > 0, item.id).toBe(true)
      expect(UNITS).toContain(item.interval.unit)
      expect(item.title.length).toBeGreaterThan(0)
    }
  })

  it('вердикты корма — ok/bad, цены — конечные положительные, заметки — строки или отсутствуют', () => {
    for (const entry of state.feed) {
      expect(['ok', 'bad']).toContain(entry.verdict)
      expect(Number.isFinite(entry.price) && entry.price > 0, entry.id).toBe(true)
      expect(entry.foodName.length).toBeGreaterThan(0)
      expect(entry.note === undefined || typeof entry.note === 'string', entry.id).toBe(true)
    }
    for (const entry of state.completionLog) {
      expect(entry.note === undefined || typeof entry.note === 'string', entry.id).toBe(true)
    }
    for (const event of state.oneOffEvents) {
      expect(typeof event.done).toBe('boolean')
      expect(event.note === undefined || typeof event.note === 'string', event.id).toBe(true)
    }
  })

  it('референциальная целостность: subjectId и careItemId указывают на существующие сущности', () => {
    const subjectIds = new Set(state.subjects.map((subject) => subject.id))
    const itemIds = new Set(state.careItems.map((item) => item.id))
    for (const item of state.careItems) expect(subjectIds.has(item.subjectId), item.id).toBe(true)
    for (const entry of state.completionLog) expect(itemIds.has(entry.careItemId), entry.id).toBe(true)
    for (const collection of [state.oneOffEvents, state.weights, state.feed]) {
      for (const entry of collection) expect(subjectIds.has(entry.subjectId), entry.id).toBe(true)
    }
  })

  it('идентификаторы уникальны в каждой коллекции и читаемы: demo-…', () => {
    expectUniqueIds(state.subjects, 'subjects')
    expectUniqueIds(state.careItems, 'careItems')
    expectUniqueIds(state.completionLog, 'completionLog')
    expectUniqueIds(state.oneOffEvents, 'oneOffEvents')
    expectUniqueIds(state.weights, 'weights')
    expectUniqueIds(state.feed, 'feed')
    const everyone = [
      ...state.subjects,
      ...state.careItems,
      ...state.completionLog,
      ...state.oneOffEvents,
      ...state.weights,
      ...state.feed,
    ]
    expect(everyone.every((entity) => entity.id.startsWith('demo-'))).toBe(true)
  })
})

describe('demoData: пункты ухода — пресеты и полный спектр срочности', () => {
  it('у каждого питомца — весь пресетный набор из presets.ts плюс нестандартный пункт в неделях', () => {
    const state = demoData(TODAY)
    const presets = presetCareItemDrafts()
    for (const subject of state.subjects) {
      const own = itemsOf(state, subject.id)
      for (const preset of presets) {
        const match = own.find(
          (item) =>
            item.title === preset.title &&
            item.interval.value === preset.interval.value &&
            item.interval.unit === preset.interval.unit,
        )
        expect(match, `пресет «${preset.title}» у ${subject.name}`).toBeDefined()
      }
      const nonPreset = own.filter((item) => !presets.some((preset) => preset.title === item.title))
      expect(nonPreset.length, subject.name).toBeGreaterThan(0)
      expect(own.some((item) => item.interval.unit === 'weeks'), subject.name).toBe(true)
    }
  })

  for (const today of TODAYS) {
    it(`срочность покрывает overdue / soon / calm у обоих питомцев (today=${today})`, () => {
      const state = demoData(today)
      for (const subject of state.subjects) {
        const present = new Set(urgenciesOf(state, subject.id, today))
        expect(present.has('overdue'), subject.name).toBe(true)
        expect(present.has('soon'), subject.name).toBe(true)
        expect(present.has('calm'), subject.name).toBe(true)
      }
    })

    it(`есть пункт с пустым журналом: nextDue null — «пора сейчас» (today=${today})`, () => {
      const state = demoData(today)
      const neverDone = state.careItems.filter((item) => nextDue(item, state.completionLog) === null)
      expect(neverDone.length).toBeGreaterThan(0)
    })
  }
})

describe('demoData: история веса', () => {
  it('кот: 8–10 замеров за год, даты строго возрастают, рост котёнка замедляется', () => {
    const state = demoData(TODAY)
    const cat = weightsOf(state, subjectByName(state, 'Персик').id)
    expect(cat.length).toBeGreaterThanOrEqual(8)
    expect(cat.length).toBeLessThanOrEqual(10)
    for (let i = 1; i < cat.length; i++) {
      expect(cat[i]!.date > cat[i - 1]!.date, `замер ${i}`).toBe(true)
    }
    // Все замеры неотрицательно растут, первый прирост больше последнего:
    // крутой подъём котёнка выходит на плато — красивый тренд для SVG-линии.
    for (let i = 1; i < cat.length; i++) {
      expect(cat[i]!.grams, `замер ${i}`).toBeGreaterThanOrEqual(cat[i - 1]!.grams)
    }
    const firstGain = cat[1]!.grams - cat[0]!.grams
    const lastGain = cat[cat.length - 1]!.grams - cat[cat.length - 2]!.grams
    expect(firstGain).toBeGreaterThan(lastGain)
  })

  it('собака: ~6 замеров, вес взрослой собаки стабилен (размах ≤ 500 г)', () => {
    const state = demoData(TODAY)
    const dog = weightsOf(state, subjectByName(state, 'Бублик').id)
    expect(dog.length).toBeGreaterThanOrEqual(5)
    expect(dog.length).toBeLessThanOrEqual(7)
    for (let i = 1; i < dog.length; i++) {
      expect(dog[i]!.date > dog[i - 1]!.date, `замер ${i}`).toBe(true)
    }
    const grams = dog.map((entry) => entry.grams)
    expect(Math.max(...grams) - Math.min(...grams)).toBeLessThanOrEqual(500)
  })

  for (const today of TODAYS) {
    it(`даты замеров обоих питомцев возрастают от старых к новым (today=${today})`, () => {
      const state = demoData(today)
      for (const subject of state.subjects) {
        const entries = weightsOf(state, subject.id)
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i]!.date > entries[i - 1]!.date, `${subject.name}, замер ${i}`).toBe(true)
        }
      }
    })
  }
})

describe('demoData: журнал корма', () => {
  it('у каждого питомца оба вердикта ok и bad; заметки есть, цены положительные', () => {
    const state = demoData(TODAY)
    for (const subject of state.subjects) {
      const verdicts = new Set(feedOf(state, subject.id).map((entry) => entry.verdict))
      expect(verdicts, subject.name).toEqual(new Set(['ok', 'bad']))
    }
    expect(state.feed.filter((entry) => entry.note !== undefined).length).toBeGreaterThanOrEqual(3)
    for (const entry of state.feed) expect(entry.price, entry.id).toBeGreaterThan(0)
  })

  it('кот покупает корм каждый месяц: все 6 корзин окна ненулевые (today=база)', () => {
    const state = demoData(TODAY)
    const bins = monthlySpend(feedOf(state, subjectByName(state, 'Персик').id), TODAY)
    expect(bins).toHaveLength(6)
    expect(bins.filter((bin) => bin.total > 0)).toHaveLength(6)
  })

  for (const today of TODAYS) {
    it(`расходы живые: ≥ 5 из 6 месяцев с покупками у каждого (today=${today})`, () => {
      const state = demoData(today)
      for (const subject of state.subjects) {
        const bins = monthlySpend(feedOf(state, subject.id), today)
        expect(bins).toHaveLength(6)
        expect(bins.filter((bin) => bin.total > 0).length, subject.name).toBeGreaterThanOrEqual(5)
      }
    })
  }
})

describe('demoData: разовые события и общий список дел', () => {
  for (const today of TODAYS) {
    it(`есть выполненное и предстоящее soon-событие; выполненное уходит из предстоящих (today=${today})`, () => {
      const state = demoData(today)
      const done = state.oneOffEvents.filter((event) => event.done)
      const upcoming = state.oneOffEvents.filter((event) => !event.done)
      expect(done.length).toBeGreaterThan(0)
      expect(upcoming.length).toBeGreaterThan(0)

      const listed = upcomingEvents(state.oneOffEvents, today).map((due) => due.event)
      expect(listed.map((event) => event.id).sort()).toEqual(upcoming.map((event) => event.id).sort())
      expect(done.every((event) => !listed.some((listed_) => listed_.id === event.id))).toBe(true)
      // Дата предстоящего выводится из того же today — всегда внутри окна «скоро».
      for (const event of listed) expect(eventUrgency(event, today)).toBe('soon')
    })

    it(`список дел дашборда непуст: пункты ухода и события, первая строка — просрочка (today=${today})`, () => {
      const state = demoData(today)
      const rows = dashboardTodoList(state.careItems, state.completionLog, state.oneOffEvents, today)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.some((row) => row.kind === 'careItem')).toBe(true)
      expect(rows.some((row) => row.kind === 'oneOffEvent')).toBe(true)
      expect(rows[0]!.urgency).toBe('overdue')
    })
  }
})
