import { describe, expect, it } from 'vitest'
import { emptyAppState, InMemoryRepository } from './repository'
import { sampleAppState } from './testState'

describe('emptyAppState: состояние первого запуска', () => {
  it('шесть пустых коллекций и больше ничего', () => {
    expect(emptyAppState()).toStrictEqual({
      subjects: [],
      careItems: [],
      completionLog: [],
      oneOffEvents: [],
      weights: [],
      feed: [],
    })
  })

  it('каждый вызов даёт независимый экземпляр', () => {
    const first = emptyAppState()
    const second = emptyAppState()
    expect(first).not.toBe(second)
    expect(first.subjects).not.toBe(second.subjects)
  })
})

describe('InMemoryRepository: двойник для тестов', () => {
  it('load до первого save — пустое состояние первого запуска', () => {
    expect(new InMemoryRepository().load()).toStrictEqual(emptyAppState())
  })

  it('save → load: то же состояние без потерь', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    expect(repo.load()).toStrictEqual(sampleAppState())
  })

  it('второй save полностью замещает первый', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    repo.save(emptyAppState())
    expect(repo.load()).toStrictEqual(emptyAppState())
  })

  it('wipe стирает: следующий load — снова пустое состояние', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    repo.wipe()
    expect(repo.load()).toStrictEqual(emptyAppState())
  })
})
