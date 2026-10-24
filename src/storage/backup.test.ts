import { describe, expect, it } from 'vitest'
import type { AppState } from '../domain/model'
import { CURRENT_FORMAT_VERSION, BackupImportError, exportJson, parseImport } from './backup'

/** Полное состояние: все шесть коллекций, опциональные поля note и photo. */
function fullState(): AppState {
  return {
    subjects: [
      {
        id: 'subject-1',
        type: 'pet',
        name: 'Барсик',
        species: 'кот',
        birthDate: '2020-05-10',
        photo: 'data:image/png;base64,abc',
      },
    ],
    careItems: [
      { id: 'care-1', subjectId: 'subject-1', title: 'Прививка', interval: { value: 12, unit: 'months' } },
    ],
    completionLog: [
      { id: 'log-1', careItemId: 'care-1', date: '2026-01-15', note: 'Нобивак, клиника «Айболит»' },
    ],
    oneOffEvents: [
      { id: 'event-1', subjectId: 'subject-1', title: 'Визит к ветеринару', date: '2026-11-02', done: false },
    ],
    weights: [{ id: 'weight-1', subjectId: 'subject-1', date: '2026-10-01', grams: 4250 }],
    feed: [
      {
        id: 'feed-1',
        subjectId: 'subject-1',
        date: '2026-09-20',
        foodName: 'Royal Canin',
        price: 899.9,
        verdict: 'ok',
        note: 'ест охотно',
      },
    ],
  }
}

/** Конверт текущей версии с испорченным полем верхнего уровня состояния. */
function brokenBackup(overrides: Record<string, unknown>): string {
  return JSON.stringify({ formatVersion: CURRENT_FORMAT_VERSION, state: { ...fullState(), ...overrides } })
}

/** Конверт текущей версии с испорченной записью внутри состояния. */
function brokenEntry(mutate: (state: AppState) => void): string {
  const state = fullState()
  mutate(state)
  return JSON.stringify({ formatVersion: CURRENT_FORMAT_VERSION, state })
}

describe('round-trip бэкапа', () => {
  it('экспорт → импорт восстанавливает состояние без потерь', () => {
    expect(parseImport(exportJson(fullState()))).toEqual(fullState())
  })

  it('пустое состояние проходит round-trip', () => {
    const empty = {
      subjects: [],
      careItems: [],
      completionLog: [],
      oneOffEvents: [],
      weights: [],
      feed: [],
    }
    expect(parseImport(exportJson(empty))).toEqual(empty)
  })

  it('экспорт — конверт { formatVersion, state } текущей версии', () => {
    expect(JSON.parse(exportJson(fullState()))).toEqual({
      formatVersion: CURRENT_FORMAT_VERSION,
      state: fullState(),
    })
  })
})

describe('импорт отвергает битый и чужой JSON', () => {
  it('не-JSON — понятная ошибка', () => {
    expect(() => parseImport('это не json')).toThrow('Не удалось разобрать JSON')
  })

  it('чужой JSON без formatVersion — понятная ошибка', () => {
    expect(() => parseImport('{"foo": 1}')).toThrow('не похож на бэкап')
  })

  it('массив вместо конверта — понятная ошибка', () => {
    expect(() => parseImport('[1, 2, 3]')).toThrow('ожидается объект')
  })

  it('отсутствует поле state — понятная ошибка', () => {
    expect(() => parseImport('{"formatVersion": 1}')).toThrow('state — ожидается объект')
  })

  it('версия формата 0 или нечисловая — не бэкап', () => {
    expect(() => parseImport('{"formatVersion": 0, "state": {}}')).toThrow('не похож на бэкап')
    expect(() => parseImport('{"formatVersion": "1", "state": {}}')).toThrow('не похож на бэкап')
  })

  it('более новая версия формата — понятная ошибка', () => {
    const text = JSON.stringify({ formatVersion: CURRENT_FORMAT_VERSION + 1, state: fullState() })
    expect(() => parseImport(text)).toThrow('более новой версией')
  })

  it('все ошибки импорта — BackupImportError (настройки покажут текст, тикет 10)', () => {
    expect(() => parseImport('это не json')).toThrow(BackupImportError)
  })

  it('коллекция не является массивом', () => {
    expect(() => parseImport(brokenBackup({ subjects: 'нет' }))).toThrow('state.subjects — ожидается массив')
  })

  it('дата рождения не в формате YYYY-MM-DD', () => {
    expect(() => parseImport(brokenEntry((s) => { s.subjects[0].birthDate = '10.05.2020' }))).toThrow('birthDate')
  })

  it('несуществующая календарная дата (30 февраля)', () => {
    expect(() => parseImport(brokenEntry((s) => { s.subjects[0].birthDate = '2020-02-30' }))).toThrow('birthDate')
  })

  it('вес — не целое число граммов', () => {
    expect(() => parseImport(brokenEntry((s) => { s.weights[0].grams = 4250.5 }))).toThrow('grams')
  })

  it('неизвестный вердикт корма', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.feed[0], { verdict: 'so-so' })))).toThrow('verdict')
  })

  it('неизвестная единица интервала', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.careItems[0].interval, { unit: 'fortnights' })))).toThrow('interval.unit')
  })

  it('флаг «сделано» разового события — не boolean', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.oneOffEvents[0], { done: 'нет' })))).toThrow('done')
  })

  it('опциональная заметка неверного типа', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.completionLog[0], { note: 42 })))).toThrow('note')
  })
})

describe('импорт атомарен', () => {
  it('либо полное состояние, либо ошибка — текущее состояние не портится', () => {
    const state = fullState()
    const text = exportJson(state)
    expect(() => parseImport(brokenEntry((s) => { s.subjects[0].birthDate = '2020-02-30' }))).toThrow(BackupImportError)
    // Исходный бэкап по-прежнему читается целиком: неудачный разбор ничего не изменил.
    expect(parseImport(text)).toEqual(state)
  })
})
