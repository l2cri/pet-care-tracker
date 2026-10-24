import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_FORMAT_VERSION, BackupImportError, exportJson } from './backup'
import { createLocalStorageRepo, STORAGE_KEY } from './localStorageRepo'
import { emptyAppState } from './repository'
import { sampleAppState } from './testState'

beforeEach(() => {
  localStorage.clear()
})

describe('localStorage-репозиторий: тонкая обёртка', () => {
  it('первый запуск (ключа нет) — пустое состояние', () => {
    expect(createLocalStorageRepo().load()).toStrictEqual(emptyAppState())
  })

  it('save → load: состояние без потерь, под ключом — конверт бэкапа', () => {
    const repo = createLocalStorageRepo()
    repo.save(sampleAppState())

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toStrictEqual({
      formatVersion: CURRENT_FORMAT_VERSION,
      state: sampleAppState(),
    })
    expect(repo.load()).toStrictEqual(sampleAppState())
  })

  it('save поверх существующего замещает прежнее состояние', () => {
    const repo = createLocalStorageRepo()
    repo.save(sampleAppState())
    repo.save(emptyAppState())
    expect(repo.load()).toStrictEqual(emptyAppState())
  })

  it('wipe стирает ключ — следующий load снова пустое состояние', () => {
    const repo = createLocalStorageRepo()
    repo.save(sampleAppState())
    repo.wipe()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(repo.load()).toStrictEqual(emptyAppState())
  })
})

describe('чужое или битое содержимое под ключом — громкая ошибка', () => {
  it('не-JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'это не json')
    expect(() => createLocalStorageRepo().load()).toThrow(BackupImportError)
  })

  it('чужой JSON без formatVersion', () => {
    localStorage.setItem(STORAGE_KEY, '{"foo": 1}')
    expect(() => createLocalStorageRepo().load()).toThrow('не похож на бэкап')
  })

  it('конверт более новой версии формата (даунгрейд приложения)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ formatVersion: CURRENT_FORMAT_VERSION + 1, state: {} }))
    expect(() => createLocalStorageRepo().load()).toThrow('более новой версией')
  })

  it('ошибка load не портит содержимое: конверт остаётся под ключом', () => {
    const repo = createLocalStorageRepo()
    repo.save(sampleAppState())
    const saved = localStorage.getItem(STORAGE_KEY)

    localStorage.setItem(STORAGE_KEY, 'битое')
    expect(() => createLocalStorageRepo().load()).toThrow()

    // Восстановили конверт — данные по-прежнему читаются целиком.
    localStorage.setItem(STORAGE_KEY, saved ?? exportJson(sampleAppState()))
    expect(createLocalStorageRepo().load()).toStrictEqual(sampleAppState())
  })
})
