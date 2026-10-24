import { describe, expect, it } from 'vitest'
import type { AppState } from '../domain/model'
import { FORMAT_VERSION, exportJson, parseImport } from './backup'

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
  return JSON.stringify({ formatVersion: FORMAT_VERSION, data: { ...fullState(), ...overrides } })
}

/** Конверт текущей версии с испорченной записью внутри состояния. */
function brokenEntry(mutate: (state: AppState) => void): string {
  const state = fullState()
  mutate(state)
  return JSON.stringify({ formatVersion: FORMAT_VERSION, data: state })
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

  it('экспорт несёт formatVersion текущего формата', () => {
    const envelope = JSON.parse(exportJson(fullState())) as { formatVersion: number }
    expect(envelope.formatVersion).toBe(FORMAT_VERSION)
  })
})

describe('импорт отвергает битый и чужой JSON', () => {
  it('не-JSON — понятная ошибка', () => {
    expect(() => parseImport('это не json')).toThrow('Битый JSON')
  })

  it('чужой JSON без formatVersion — понятная ошибка', () => {
    expect(() => parseImport('{"foo": 1}')).toThrow('не бэкап')
  })

  it('массив вместо объекта конверта — понятная ошибка', () => {
    expect(() => parseImport('[1, 2, 3]')).toThrow('не бэкап')
  })

  it('нечелая версия формата — понятная ошибка', () => {
    const text = JSON.stringify({ formatVersion: '1', data: fullState() })
    expect(() => parseImport(text)).toThrow('целым числом')
  })

  it('более новая версия формата — понятная ошибка', () => {
    const text = JSON.stringify({ formatVersion: FORMAT_VERSION + 1, data: fullState() })
    expect(() => parseImport(text)).toThrow('новой версией')
  })

  it('коллекция не является списком', () => {
    expect(() => parseImport(brokenBackup({ subjects: 'нет' }))).toThrow('subjects — ожидается список')
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
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.careItems[0].interval, { unit: 'fortnights' })))).toThrow('unit')
  })

  it('флаг «сделано» разового события — не boolean', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.oneOffEvents[0], { done: 'нет' })))).toThrow('done')
  })

  it('опциональная заметка неверного типа', () => {
    expect(() => parseImport(brokenEntry((s) => Object.assign(s.completionLog[0], { note: 42 })))).toThrow('note')
  })
})

describe('импорт атомарен', () => {
  it('либо полное состояние, либо ошибка — частичного применения не бывает', () => {
    const state = fullState()
    const text = exportJson(state)
    expect(() => parseImport(brokenEntry((s) => { s.subjects[0].birthDate = '2020-02-30' }))).toThrow()
    // Текущее состояние не пострадало: исходный бэкап по-прежнему читается целиком.
    expect(parseImport(text)).toEqual(state)
  })
})
