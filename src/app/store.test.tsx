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

/**
 * Проба стора пунктов ухода: кнопки зовут публичные экшены. Все работают
 * с care-1 (пункт subject-1, в журнале две записи log-1/log-2), чтобы
 * каскады были видны на насыщенной фикстуре.
 */
function CareItemProbe() {
  const { state, addCareItem, updateCareItem, removeCareItem, logCompletion } = useStore()
  const care1 = state.careItems[0]
  return (
    <div>
      <button onClick={() => addCareItem('subject-2', { title: 'Ушные капли', interval: { value: 30, unit: 'days' } })}>
        добавить пункт
      </button>
      <button onClick={() => updateCareItem(care1.id, { interval: { value: 6, unit: 'months' } })}>
        сменить интервал первого
      </button>
      <button onClick={() => updateCareItem(care1.id, { title: 'Вакцинация' })}>
        переименовать первый
      </button>
      <button onClick={() => removeCareItem(care1.id)}>удалить первый пункт</button>
      <button onClick={() => logCompletion(care1.id, '2026-10-24')}>отметить сделанным</button>
      <button onClick={() => logCompletion(care1.id, '2026-10-25', '  Нобивак, «Айболит»  ')}>
        отметить сделанным с заметкой
      </button>
      <button onClick={() => logCompletion('care-нет', '2026-10-24')}>
        отметить несуществующий пункт
      </button>
    </div>
  )
}

describe('Стор пунктов ухода и журнала', () => {
  function renderProbe() {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <CareItemProbe />
      </StoreProvider>,
    )
    return repo
  }

  it('addCareItem создаёт пункт у подопечного', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить пункт' }))

    const loaded = repo.load()
    const created = loaded.careItems.find((item) => item.title === 'Ушные капли')
    expect(created).toStrictEqual({
      id: expect.any(String) as string,
      subjectId: 'subject-2',
      title: 'Ушные капли',
      interval: { value: 30, unit: 'days' },
    })
    // Прежние пункты не тронуты.
    expect(loaded.careItems).toHaveLength(4)
  })

  it('updateCareItem меняет интервал, не трогая заголовок — «следующий раз» выводный, пересчитается сам', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'сменить интервал первого' }))

    const updated = repo.load().careItems[0]
    expect(updated.title).toBe('Прививка')
    expect(updated.interval).toStrictEqual({ value: 6, unit: 'months' })
  })

  it('updateCareItem патчит только заголовок', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'переименовать первый' }))

    const updated = repo.load().careItems[0]
    expect(updated.title).toBe('Вакцинация')
    expect(updated.interval).toStrictEqual({ value: 12, unit: 'months' })
  })

  it('removeCareItem уносит журнал пункта, чужие записи остаются', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'удалить первый пункт' })) // care-1

    const loaded = repo.load()
    expect(loaded.careItems.map((item) => item.id)).toStrictEqual(['care-2', 'care-3'])
    // log-1 и log-2 принадлежали care-1 — ушли; log-3 (care-3) остался.
    expect(loaded.completionLog.map((entry) => entry.id)).toStrictEqual(['log-3'])
  })

  it('logCompletion добавляет запись без заметки — поля note нет совсем', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'отметить сделанным' }))

    const entry = repo.load().completionLog.find((e) => e.careItemId === 'care-1' && e.date === '2026-10-24')
    expect(entry).toBeDefined()
    expect(entry!.id).not.toBe('log-1')
    expect('note' in entry!).toBe(false)
  })

  it('logCompletion с заметкой обрезает пробелы по краям', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'отметить сделанным с заметкой' }))

    const entry = repo.load().completionLog.find((e) => e.careItemId === 'care-1' && e.date === '2026-10-25')
    expect(entry!.note).toBe('Нобивак, «Айболит»')
  })

  it('logCompletion несуществующего пункта — no-op, состояние не меняется', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'отметить несуществующий пункт' }))

    expect(repo.load()).toBe(before)
  })
})

/**
 * Проба стора журнала корма (тикет 09): кнопки зовут публичные экшены.
 * Первая запись фикстуры — feed-1 (subject-1, 2026-09-15, с заметкой);
 * feed-2 принадлежит subject-2 — на нём видна точечность удаления.
 */
function FeedEntryProbe() {
  const { state, addFeedEntry, updateFeedEntry, removeFeedEntry } = useStore()
  const first = state.feed[0]
  return (
    <div>
      <button
        onClick={() =>
          addFeedEntry('subject-1', { date: '2026-10-20', foodName: 'Purina One', price: 750, verdict: 'ok' })
        }
      >
        добавить запись
      </button>
      <button
        onClick={() =>
          addFeedEntry('subject-1', {
            date: '2026-10-21',
            foodName: '  Grandorf  ',
            price: 1200,
            verdict: 'bad',
            note: '  от него расстройство  ',
          })
        }
      >
        добавить запись с заметкой
      </button>
      <button
        onClick={() =>
          addFeedEntry('subject-1', { date: '2026-10-22', foodName: 'Acari', price: 300, verdict: 'ok', note: '   ' })
        }
      >
        добавить запись с пустой заметкой
      </button>
      <button
        onClick={() => addFeedEntry('subject-нет', { date: '2026-10-22', foodName: 'Сирота', price: 100, verdict: 'ok' })}
      >
        добавить запись чужому подопечному
      </button>
      <button onClick={() => updateFeedEntry(first.id, { foodName: 'Royal Canin Fit 32' })}>
        переименовать первую запись
      </button>
      <button onClick={() => updateFeedEntry(first.id, { price: 950, verdict: 'bad' })}>
        сменить цену и вердикт первой
      </button>
      <button onClick={() => updateFeedEntry(first.id, { note: null })}>убрать заметку первой</button>
      <button onClick={() => updateFeedEntry(first.id, { note: '   ' })}>
        заменить заметку первой на пустую
      </button>
      <button onClick={() => updateFeedEntry('feed-нет', { foodName: 'Никого' })}>
        изменить несуществующую запись
      </button>
      <button onClick={() => removeFeedEntry(first.id)}>удалить первую запись</button>
      <button onClick={() => removeFeedEntry('feed-нет')}>удалить несуществующую запись</button>
    </div>
  )
}

describe('Стор журнала корма (тикет 09)', () => {
  function renderProbe() {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <FeedEntryProbe />
      </StoreProvider>,
    )
    return repo
  }

  it('addFeedEntry создаёт запись у подопечного', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить запись' }))

    const created = repo.load().feed.find((entry) => entry.foodName === 'Purina One')
    expect(created).toStrictEqual({
      id: expect.any(String) as string,
      subjectId: 'subject-1',
      date: '2026-10-20',
      foodName: 'Purina One',
      price: 750,
      verdict: 'ok',
    })
    // Прежние записи не тронуты.
    expect(repo.load().feed).toHaveLength(3)
  })

  it('addFeedEntry обрезает пробелы названия и заметки по краям', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить запись с заметкой' }))

    const created = repo.load().feed.find((entry) => entry.foodName === 'Grandorf')
    expect(created!.foodName).toBe('Grandorf')
    expect(created!.note).toBe('от него расстройство')
    expect(created!.verdict).toBe('bad')
  })

  it('addFeedEntry с пустой после trim заметкой — поля note нет совсем', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить запись с пустой заметкой' }))

    const created = repo.load().feed.find((entry) => entry.foodName === 'Acari')
    expect('note' in created!).toBe(false)
  })

  it('addFeedEntry чужому подопечному — no-op, состояние не меняется', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'добавить запись чужому подопечному' }))

    expect(repo.load()).toBe(before)
  })

  it('updateFeedEntry патчит название, не трогая цену, вердикт и заметку', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'переименовать первую запись' }))

    const updated = repo.load().feed[0]
    expect(updated.foodName).toBe('Royal Canin Fit 32')
    expect(updated.price).toBe(890.5)
    expect(updated.verdict).toBe('ok')
    expect(updated.note).toBe('ест охотно')
  })

  it('updateFeedEntry меняет цену и вердикт', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'сменить цену и вердикт первой' }))

    const updated = repo.load().feed[0]
    expect(updated.price).toBe(950)
    expect(updated.verdict).toBe('bad')
  })

  it('updateFeedEntry: note null и пустая строка снимают поле заметки', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'убрать заметку первой' }))
    expect('note' in repo.load().feed[0]!).toBe(false)

    // Заметка возвращается патчем со строкой и снова снимается пустой.
    fireEvent.click(screen.getByRole('button', { name: 'заменить заметку первой на пустую' }))
    expect('note' in repo.load().feed[0]!).toBe(false)
  })

  it('updateFeedEntry несуществующей — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'изменить несуществующую запись' }))

    expect(repo.load()).toBe(before)
  })

  it('removeFeedEntry удаляет только свою запись', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'удалить первую запись' }))

    expect(repo.load().feed.map((entry) => entry.id)).toStrictEqual(['feed-2'])
  })

  it('removeFeedEntry несуществующей — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'удалить несуществующую запись' }))

    expect(repo.load()).toBe(before)
  })
})

/**
 * Проба стора разовых событий (тикет 07): кнопки зовут публичные экшены.
 * Первое событие фикстуры — event-1 (subject-1, 2026-11-05, предстоящее,
 * с заметкой); event-2 уже выполнен — на нём виден no-op повтора.
 */
function OneOffEventProbe() {
  const { state, addOneOffEvent, updateOneOffEvent, removeOneOffEvent, completeOneOffEvent } =
    useStore()
  const first = state.oneOffEvents[0]
  return (
    <div>
      <button onClick={() => addOneOffEvent('subject-1', { title: 'Стрижка', date: '2026-12-01' })}>
        добавить событие
      </button>
      <button
        onClick={() =>
          addOneOffEvent('subject-1', { title: 'Укол', date: '2026-11-10', note: '  Анадин  ' })
        }
      >
        добавить событие с заметкой
      </button>
      <button
        onClick={() => addOneOffEvent('subject-1', { title: 'Чипирование', date: '2026-12-05', note: '   ' })}
      >
        добавить событие с пустой заметкой
      </button>
      <button
        onClick={() => addOneOffEvent('subject-нет', { title: 'Сирота', date: '2026-12-05' })}
      >
        добавить событие чужому подопечному
      </button>
      <button onClick={() => updateOneOffEvent(first.id, { title: 'Осмотр' })}>
        переименовать первое событие
      </button>
      <button onClick={() => updateOneOffEvent(first.id, { date: '2026-11-20' })}>
        перенести первое событие
      </button>
      <button onClick={() => updateOneOffEvent(first.id, { note: null })}>
        убрать заметку первого
      </button>
      <button onClick={() => updateOneOffEvent(first.id, { note: '   ' })}>
        заменить заметку первого на пустую
      </button>
      <button onClick={() => updateOneOffEvent('event-нет', { title: 'Никого' })}>
        изменить несуществующее событие
      </button>
      <button onClick={() => completeOneOffEvent(first.id)}>отметить первое выполненным</button>
      <button onClick={() => completeOneOffEvent('event-2')}>отметить выполненным event-2</button>
      <button onClick={() => completeOneOffEvent('event-нет')}>
        отметить выполненным несуществующее
      </button>
      <button onClick={() => removeOneOffEvent(first.id)}>удалить первое событие</button>
      <button onClick={() => removeOneOffEvent('event-нет')}>удалить несуществующее событие</button>
    </div>
  )
}

describe('Стор разовых событий (тикет 07)', () => {
  function renderProbe() {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <OneOffEventProbe />
      </StoreProvider>,
    )
    return repo
  }

  it('addOneOffEvent создаёт предстоящее событие (done: false)', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить событие' }))

    const created = repo.load().oneOffEvents.find((event) => event.title === 'Стрижка')
    expect(created).toStrictEqual({
      id: expect.any(String) as string,
      subjectId: 'subject-1',
      title: 'Стрижка',
      date: '2026-12-01',
      done: false,
    })
    // Прежние события не тронуты.
    expect(repo.load().oneOffEvents).toHaveLength(3)
  })

  it('addOneOffEvent обрезает пробелы заметки по краям', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить событие с заметкой' }))

    const created = repo.load().oneOffEvents.find((event) => event.title === 'Укол')
    expect(created!.note).toBe('Анадин')
  })

  it('addOneOffEvent с пустой после trim заметкой — поля note нет совсем', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить событие с пустой заметкой' }))

    const created = repo.load().oneOffEvents.find((event) => event.title === 'Чипирование')
    expect('note' in created!).toBe(false)
  })

  it('addOneOffEvent чужому подопечному — no-op, состояние не меняется', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'добавить событие чужому подопечному' }))

    expect(repo.load()).toBe(before)
  })

  it('updateOneOffEvent патчит заголовок, не трогая дату и заметку', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'переименовать первое событие' }))

    const updated = repo.load().oneOffEvents[0]
    expect(updated.title).toBe('Осмотр')
    expect(updated.date).toBe('2026-11-05')
    expect(updated.note).toBe('Осмотр перед вакцинацией')
  })

  it('updateOneOffEvent переносит дату', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'перенести первое событие' }))

    expect(repo.load().oneOffEvents[0].date).toBe('2026-11-20')
  })

  it('updateOneOffEvent: note null и пустая строка снимают поле заметки', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'убрать заметку первого' }))
    expect('note' in repo.load().oneOffEvents[0]!).toBe(false)

    // Заметка возвращается патчем со строкой и снова снимается пустой.
    fireEvent.click(screen.getByRole('button', { name: 'заменить заметку первого на пустую' }))
    expect('note' in repo.load().oneOffEvents[0]!).toBe(false)
  })

  it('updateOneOffEvent несуществующего — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'изменить несуществующее событие' }))

    expect(repo.load()).toBe(before)
  })

  it('completeOneOffEvent ставит done: true — событие уходит из предстоящих', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'отметить первое выполненным' }))

    expect(repo.load().oneOffEvents[0].done).toBe(true)
  })

  it('completeOneOffEvent уже выполненного — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'отметить выполненным event-2' }))

    expect(repo.load()).toBe(before)
  })

  it('completeOneOffEvent несуществующего — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'отметить выполненным несуществующее' }))

    expect(repo.load()).toBe(before)
  })

  it('removeOneOffEvent удаляет только своё событие', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'удалить первое событие' }))

    expect(repo.load().oneOffEvents.map((event) => event.id)).toStrictEqual(['event-2'])
  })

  it('removeOneOffEvent несуществующего — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'удалить несуществующее событие' }))

    expect(repo.load()).toBe(before)
  })
})

/**
 * Проба стора замеров веса (тикет 08): кнопки зовут публичные экшены.
 * Фикстура хранит два замера subject-1; первый — weight-1 (2026-06-01, 4100 г).
 */
function WeightProbe() {
  const { state, addWeight, removeWeight } = useStore()
  const first = state.weights[0]
  return (
    <div>
      <button onClick={() => addWeight('subject-1', { date: '2026-10-25', grams: 4300 })}>
        добавить замер
      </button>
      <button onClick={() => addWeight('subject-нет', { date: '2026-10-25', grams: 4300 })}>
        добавить замер чужому подопечному
      </button>
      <button onClick={() => removeWeight(first.id)}>удалить первый замер</button>
      <button onClick={() => removeWeight('weight-нет')}>удалить несуществующий замер</button>
    </div>
  )
}

describe('Стор замеров веса (тикет 08)', () => {
  function renderProbe() {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <WeightProbe />
      </StoreProvider>,
    )
    return repo
  }

  it('addWeight создаёт замер: дата и целые граммы ложатся как есть', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'добавить замер' }))

    const created = repo.load().weights.find((entry) => entry.date === '2026-10-25')
    expect(created).toStrictEqual({
      id: expect.any(String) as string,
      subjectId: 'subject-1',
      date: '2026-10-25',
      grams: 4300,
    })
    // Прежние замеры не тронуты.
    expect(repo.load().weights).toHaveLength(3)
  })

  it('addWeight чужому подопечному — no-op, состояние не меняется', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'добавить замер чужому подопечному' }))

    expect(repo.load()).toBe(before)
  })

  it('removeWeight удаляет только свой замер', () => {
    const repo = renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'удалить первый замер' }))

    expect(repo.load().weights.map((entry) => entry.id)).toStrictEqual(['weight-2'])
  })

  it('removeWeight несуществующего — no-op', () => {
    const repo = renderProbe()
    const before = repo.load()

    fireEvent.click(screen.getByRole('button', { name: 'удалить несуществующий замер' }))

    expect(repo.load()).toBe(before)
  })
})

/**
 * Состояние-замена для тикета 10: в каждой из шести коллекций — другая
 * композиция записей, чем в sampleAppState(). Фабрика — из testState.ts,
 * срезы выбирают по одной записи так, чтобы ни одна коллекция не совпала
 * с исходной (субъект subject-1 исчезает при выжившем care-1 — сливать
 * нечего, видна именно замена).
 */
function replacementAppState(): AppState {
  const base = sampleAppState()
  return {
    subjects: base.subjects.slice(1), // subject-2
    careItems: base.careItems.slice(0, 1), // care-1
    completionLog: base.completionLog.slice(2), // log-3
    oneOffEvents: base.oneOffEvents.slice(1), // event-2
    weights: base.weights.slice(1), // weight-2
    feed: base.feed.slice(1), // feed-2
  }
}

/**
 * Проба стора полной замены состояния (тикет 10): кнопки зовут публичные
 * экшены настроек — замену готовым состоянием (импорт бэкапа / демо-набор)
 * и «Стереть всё». Сводка id шести коллекций выводится в data-testid:
 * UI получает данные только через стор.
 */
function ReplaceStateProbe({ replacement }: { replacement: AppState }) {
  const { state, replaceState } = useStore()
  const summary = [
    state.subjects.map((subject) => subject.id),
    state.careItems.map((item) => item.id),
    state.completionLog.map((entry) => entry.id),
    state.oneOffEvents.map((event) => event.id),
    state.weights.map((entry) => entry.id),
    state.feed.map((entry) => entry.id),
  ]
    .map((ids) => ids.join(','))
    .join('|')
  return (
    <div>
      <button onClick={() => replaceState(replacement)}>заменить состояние</button>
      <button onClick={() => replaceState(emptyAppState())}>стереть всё</button>
      <div data-testid="summary">{summary}</div>
    </div>
  )
}

describe('Стор полной замены состояния (тикет 10)', () => {
  function renderProbe(replacement: AppState) {
    const repo = new InMemoryRepository()
    repo.save(sampleAppState())
    render(
      <StoreProvider repository={repo}>
        <ReplaceStateProbe replacement={replacement} />
      </StoreProvider>,
    )
    return repo
  }

  it('replaceState замещает все шесть коллекций — стор отдаёт состояние-замену', () => {
    renderProbe(replacementAppState())

    fireEvent.click(screen.getByRole('button', { name: 'заменить состояние' }))

    // Каждая коллекция — ровно записи замены: прежних subject-1, care-2,
    // care-3, log-1, event-1, weight-1, feed-1 нет, слияния не произошло.
    expect(screen.getByTestId('summary').textContent).toBe(
      'subject-2|care-1|log-3|event-2|weight-2|feed-2',
    )
  })

  it('автосейв сохранил замену: InMemoryRepository.load() возвращает новое состояние', () => {
    const replacement = replacementAppState()
    const repo = renderProbe(replacement)

    fireEvent.click(screen.getByRole('button', { name: 'заменить состояние' }))

    // Мутация → автосейв → load даёт состояние-замену: репозиторий отдельного
    // вызова не получал, useAutoSave записал замену как любое изменение.
    expect(repo.load()).toStrictEqual(replacement)
  })

  it('replaceState(emptyAppState()) даёт состояние первого запуска', () => {
    const repo = renderProbe(replacementAppState())

    fireEvent.click(screen.getByRole('button', { name: 'стереть всё' }))

    // Все шесть коллекций пусты — сводка из шести пустых сегментов.
    expect(screen.getByTestId('summary').textContent).toBe('|||||')
    expect(repo.load()).toStrictEqual(emptyAppState())
  })
})
