import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { AppState, CareSubject } from '../domain/model'
import type { CareItemDraft } from '../domain/presets'
import { emptyAppState, InMemoryRepository } from '../storage/repository'
import type { Repository } from '../storage/repository'
import { sampleAppState } from '../storage/testState'
import { StoreProvider, useAutoSave, useStore } from './store'
import type { NewSubjectInput } from './store'

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
function Probe({ repo, initial }: { repo: Repository; initial: AppState }) {
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

/** Черновики пунктов ухода для проб создания подопечного. */
const probeDrafts: CareItemDraft[] = [
  { title: 'Прививка', interval: { value: 12, unit: 'months' } },
  { title: 'Груминг', interval: { value: 8, unit: 'weeks' } },
]

/**
 * Проба стора подопечных: кнопки зовут публичные экшены, созданный
 * подопечный выводится в data-testid="created". Кнопки патча и удаления
 * работают с первым подопечным состояния (в фикстуре это subject-1).
 */
function SubjectProbe() {
  const { state, addSubject, updateSubject, removeSubject } = useStore()
  const [created, setCreated] = useState<CareSubject | null>(null)
  const firstId = state.subjects[0]?.id
  const add = (input: NewSubjectInput) => () => setCreated(addSubject(input))

  return (
    <div>
      <button
        onClick={add({
          name: 'Пушок',
          species: 'кот',
          birthDate: '2024-05-01',
          photo: 'data:image/png;base64,cHJvYmU=',
          careItems: probeDrafts,
        })}
      >
        создать с пунктами ухода
      </button>
      <button onClick={add({ name: 'Тишка', species: 'кот', birthDate: '2023-02-11', careItems: [] })}>
        создать без пунктов ухода
      </button>
      <button onClick={() => firstId && updateSubject(firstId, { name: 'Василий', birthDate: '2019-01-01' })}>
        переименовать первого
      </button>
      <button onClick={() => firstId && updateSubject(firstId, { photo: null })}>удалить фото первого</button>
      <button onClick={() => firstId && updateSubject(firstId, { name: 'Пёс', photo: undefined })}>
        патч с явным undefined фото
      </button>
      <button onClick={() => firstId && removeSubject(firstId)}>удалить первого</button>
      {created !== null && <div data-testid="created">{JSON.stringify(created)}</div>}
    </div>
  )
}

describe('Стор подопечных', () => {
  it('addSubject создаёт подопечного и его пункты ухода одним dispatch', () => {
    const repo = new InMemoryRepository()
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'создать с пунктами ухода' }))

    // Возвращённый подопечный содержит переданные поля.
    const created = JSON.parse(screen.getByTestId('created').textContent ?? '') as CareSubject
    expect(created.type).toBe('pet')
    expect(created.name).toBe('Пушок')
    expect(created.species).toBe('кот')
    expect(created.birthDate).toBe('2024-05-01')
    expect(created.photo).toBe('data:image/png;base64,cHJvYmU=')
    expect(created.id).not.toBe('')

    // Мутация → автосейв → load даёт то же состояние: подопечный лёг в стор как есть.
    const loaded = repo.load()
    expect(loaded.subjects).toStrictEqual([created])
    expect(loaded.careItems).toHaveLength(2)
    // У пунктов уникальные id и subjectId нового подопечного.
    const itemIds = loaded.careItems.map((item) => item.id)
    expect(new Set(itemIds).size).toBe(2)
    for (const item of loaded.careItems) {
      expect(item.subjectId).toBe(created.id)
    }
    expect(loaded.careItems.map(({ title, interval }) => ({ title, interval }))).toStrictEqual(probeDrafts)
  })

  it('addSubject с пустым careItems создаёт только подопечного', () => {
    const repo = new InMemoryRepository()
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'создать без пунктов ухода' }))

    const loaded = repo.load()
    expect(loaded.subjects).toHaveLength(1)
    expect(loaded.subjects[0].name).toBe('Тишка')
    expect(loaded.careItems).toStrictEqual([])
  })

  it('updateSubject патчит только переданные поля — имя и дату', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'переименовать первого' }))

    // Вид и фото не переданы — не тронуты.
    expect(repo.load().subjects[0]).toStrictEqual({
      id: 'subject-1',
      type: 'pet',
      name: 'Василий',
      species: 'кот',
      birthDate: '2019-01-01',
      photo: 'data:image/png;base64,iVBORw0KGgo=',
    })
  })

  it('updateSubject с photo: null удаляет фото', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'удалить фото первого' }))

    const updated = repo.load().subjects[0]
    expect(updated.name).toBe('Барсик')
    // Поля photo нет совсем, а не «есть со значением undefined» — сериализация это различает.
    expect('photo' in updated).toBe(false)
  })

  it('updateSubject с photo: undefined не трогает фото', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'патч с явным undefined фото' }))

    const updated = repo.load().subjects[0]
    expect(updated.name).toBe('Пёс')
    expect(updated.photo).toBe('data:image/png;base64,iVBORw0KGgo=')
  })

  it('removeSubject каскадно уносит данные подопечного, журнал — вместе с его пунктами', () => {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'удалить первого' })) // subject-1

    const loaded = repo.load()
    expect(loaded.subjects.map((subject) => subject.id)).toStrictEqual(['subject-2'])
    expect(loaded.careItems.map((item) => item.id)).toStrictEqual(['care-3'])
    // Журнал связан с пунктом (ADR-0003): записи care-1 ушли вместе с пунктом, осталась только log-3.
    expect(loaded.completionLog.map((entry) => entry.id)).toStrictEqual(['log-3'])
    expect(loaded.oneOffEvents.map((event) => event.id)).toStrictEqual(['event-2'])
    // Оба замера веса были у subject-1 — коллекция пустеет.
    expect(loaded.weights).toStrictEqual([])
    expect(loaded.feed.map((entry) => entry.id)).toStrictEqual(['feed-2'])
  })

  it('экшен не мутирует прежнее состояние', () => {
    const repo = new InMemoryRepository()
    const before = sampleAppState()
    // InMemoryRepository хранит ссылку: начальное состояние стора — тот же объект.
    repo.save(before)
    render(
      <StoreProvider repository={repo}>
        <SubjectProbe />
      </StoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'переименовать первого' }))

    // Прежний объект не тронут: редьюсер построил новое состояние, а не дописал старое.
    expect(before).toStrictEqual(sampleAppState())
    expect(repo.load().subjects[0].name).toBe('Василий')
  })

  it('useStore вне StoreProvider бросает понятную ошибку', () => {
    function Outside() {
      useStore()
      return null
    }

    expect(() => render(<Outside />)).toThrow(/StoreProvider/)
  })
})
