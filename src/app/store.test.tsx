import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { CareSubject } from '../domain/model'
import { emptyAppState, InMemoryRepository } from '../storage/repository'
import type { Repository } from '../storage/repository'
import { sampleAppState } from '../storage/testState'
import { useAutoSave } from './store'

/** Подопечный, которого кнопка пробы добавляет в состояние. */
const newSubject: CareSubject = {
  id: 'subject-new',
  type: 'pet',
  name: 'Барсик',
  species: 'кот',
  birthDate: '2020-03-08',
}

/**
 * Проба: локальное состояние + автосохранение — так стор тикета 04
 * соединит useReducer с useAutoSave.
 */
function Probe({ repo, initial }: { repo: Repository; initial: ReturnType<typeof sampleAppState> }) {
  const [state, setState] = useState(initial)
  useAutoSave(state, repo)
  return (
    <button onClick={() => setState((s) => ({ ...s, subjects: [...s.subjects, newSubject] }))}>
      добавить подопечного
    </button>
  )
}

describe('useAutoSave: автосохранение hook-интеграцией', () => {
  it('первый рендер сохраняет начальное состояние в репозиторий', () => {
    const repo = new InMemoryRepository()
    render(<Probe repo={repo} initial={sampleAppState()} />)
    expect(repo.load()).toStrictEqual(sampleAppState())
  })

  it('мутация → автосейв → загрузка из репозитория даёт то же состояние', () => {
    const repo = new InMemoryRepository()
    render(<Probe repo={repo} initial={emptyAppState()} />)

    fireEvent.click(screen.getByRole('button', { name: 'добавить подопечного' }))

    const loaded = repo.load()
    expect(loaded.subjects).toHaveLength(1)
    expect(loaded.subjects[0]).toStrictEqual(newSubject)
    // Остальные коллекции не тронуты.
    expect(loaded.careItems).toStrictEqual([])
  })

  it('повторная мутация перезаписывает сохранённое состояние', () => {
    const repo = new InMemoryRepository()
    render(<Probe repo={repo} initial={emptyAppState()} />)

    fireEvent.click(screen.getByRole('button', { name: 'добавить подопечного' }))
    fireEvent.click(screen.getByRole('button', { name: 'добавить подопечного' }))

    expect(repo.load().subjects).toHaveLength(2)
  })
})
