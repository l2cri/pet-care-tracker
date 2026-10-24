/**
 * Стор «Питомцы и дом»: единственное мутируемое состояние приложения —
 * context + useReducer, автосохранение через репозиторий (ADR-0001, ADR-0006).
 *
 * Экраны зовут useStore() и получают состояние и стабильные экшены; о
 * localStorage они не знают — каждое изменение состояния автоматически
 * уходит в репозиторий через useAutoSave. Идентификаторы сущностей выдаёт
 * app-слой через crypto.randomUUID (model.ts), поэтому редьюсер чистый:
 * только раскладывает готовые сущности по коллекциям и ничего не считает
 * сам — производные величины (lastDone, nextDue, срочность) остаются
 * делом домена.
 */

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type {
  AppState,
  CareItem,
  CareSubject,
  CompletionLogEntry,
  DateString,
  Id,
  Interval,
  OneOffEvent,
  WeightEntry,
} from '../domain/model'
import type { CareItemDraft } from '../domain/presets'
import type { Repository } from '../storage/repository'

/**
 * Сохраняет состояние в репозиторий при каждом изменении — включая первый
 * рендер. Изменением считается новая ссылка: стор обязан создавать новое
 * состояние на каждый dispatch, а репозиторий — быть стабильным между
 * рендерами (создан один раз на всё приложение).
 */
export function useAutoSave(state: AppState, repo: Repository): void {
  useEffect(() => {
    repo.save(state)
  }, [state, repo])
}

/** Данные для создания подопечного. */
export interface NewSubjectInput {
  name: string
  species: string
  birthDate: DateString
  photo?: string
  /** Пункты ухода, создаваемые вместе с подопечным (пресеты или пустой список). */
  careItems: CareItemDraft[]
}

/** Частичный апдейт подопечного: применяются только переданные поля. */
export type SubjectPatch = {
  name?: string
  species?: string
  birthDate?: DateString
  /** null — удалить фото; undefined — не трогать. */
  photo?: string | null
}

/** Частичный апдейт пункта ухода: применяются только переданные поля. */
export type CareItemPatch = {
  title?: string
  interval?: Interval
}

/** Данные для создания разового события (тикет 07). */
export interface NewOneOffEventInput {
  title: string
  date: DateString
  note?: string
}

/**
 * Частичный апдейт разового события: применяются только переданные поля.
 * note: null — убрать заметку (полем, как фото подопечного), undefined — не трогать.
 */
export type OneOffEventPatch = {
  title?: string
  date?: DateString
  note?: string | null
}

/** Данные замера веса (тикет 08): дата и целые граммы (ADR-0008). */
export interface NewWeightEntryInput {
  date: DateString
  /** Целое число граммов; килограммы — только поле ввода формы, конвертация до стора. */
  grams: number
}

/** Экшены стора: стабильные между рендерами функции. */
export interface StoreActions {
  /** Создаёт подопечного и его пункты ухода одним dispatch; возвращает созданного подопечного. */
  addSubject(input: NewSubjectInput): CareSubject
  updateSubject(id: Id, patch: SubjectPatch): void
  /** Удаляет подопечного каскадом: его пункты ухода, журнал выполнений, события, вес, корм. */
  removeSubject(id: Id): void
  /** Создаёт пункт ухода у подопечного; возвращает созданный пункт. */
  addCareItem(subjectId: Id, draft: CareItemDraft): CareItem
  updateCareItem(id: Id, patch: CareItemPatch): void
  /** Удаляет пункт ухода вместе с его журналом выполнений (ADR-0003). */
  removeCareItem(id: Id): void
  /**
   * «Сделано»: добавляет запись журнала. Дата приходит из формы (обычно
   * сегодня); смена прошлого — только новой записью, редактирования нет
   * (ADR-0003). «Следующий раз» пересчитается сам — он выводный.
   */
  logCompletion(careItemId: Id, date: DateString, note?: string): void
  /** Создаёт разовое событие у подопечного; возвращает созданное событие (тикет 07). */
  addOneOffEvent(subjectId: Id, input: NewOneOffEventInput): OneOffEvent
  updateOneOffEvent(id: Id, patch: OneOffEventPatch): void
  /** Удаляет разовое событие; выполненные и предстоящие удаляются одинаково. */
  removeOneOffEvent(id: Id): void
  /**
   * «Сделано» разового события: ставит флаг done — событие уходит из
   * предстоящих в историю. Отмены нет: выполненное — факт, как запись журнала.
   */
  completeOneOffEvent(id: Id): void
  /** Добавляет замер веса подопечному; возвращает созданный замер (тикет 08). */
  addWeight(subjectId: Id, input: NewWeightEntryInput): WeightEntry
  /** Удаляет замер веса; правки замера нет — ошибочный удаляется и вводится заново. */
  removeWeight(id: Id): void
}

/** Значение контекста: состояние и экшены одним объектом. */
type Store = { state: AppState } & StoreActions

/**
 * Экшены редьюсера несут готовые сущности: их строит креатор в провайдере
 * (id выдаёт app-слой), поэтому редьюсер остаётся чистой раскладкой по
 * коллекциям.
 */
type StoreAction =
  | { type: 'subject/add'; subject: CareSubject; careItems: CareItem[] }
  | { type: 'subject/update'; id: Id; patch: SubjectPatch }
  | { type: 'subject/remove'; id: Id }
  | { type: 'careItem/add'; item: CareItem }
  | { type: 'careItem/update'; id: Id; patch: CareItemPatch }
  | { type: 'careItem/remove'; id: Id }
  | { type: 'completion/log'; entry: CompletionLogEntry }
  | { type: 'oneOffEvent/add'; event: OneOffEvent }
  | { type: 'oneOffEvent/update'; id: Id; patch: OneOffEventPatch }
  | { type: 'oneOffEvent/remove'; id: Id }
  | { type: 'oneOffEvent/complete'; id: Id }
  | { type: 'weight/add'; entry: WeightEntry }
  | { type: 'weight/remove'; id: Id }

/** Чистый редьюсер: новые массивы и объекты, прежнее состояние не трогается. */
function reducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    // Подопечный и его пункты появляются атомарно: экран никогда не видит
    // питомца без стартового набора ухода.
    case 'subject/add':
      return {
        ...state,
        subjects: [...state.subjects, action.subject],
        careItems: [...state.careItems, ...action.careItems],
      }
    case 'subject/update': {
      const index = state.subjects.findIndex((subject) => subject.id === action.id)
      // Несуществующий id — no-op: та же ссылка состояния, автосейв не дёргается.
      if (index === -1) return state
      const { name, species, birthDate, photo } = action.patch
      const next: CareSubject = { ...state.subjects[index] }
      if (name !== undefined) next.name = name
      if (species !== undefined) next.species = species
      if (birthDate !== undefined) next.birthDate = birthDate
      // Фото снимается именно удалением поля, а не записью undefined:
      // сериализация и проверки toStrictEqual различают «поля нет» и «undefined».
      if (photo === null) delete next.photo
      else if (photo !== undefined) next.photo = photo
      const subjects = [...state.subjects]
      subjects[index] = next
      return { ...state, subjects }
    }
    case 'subject/remove': {
      if (!state.subjects.some((subject) => subject.id === action.id)) return state
      // Журнал выполнений связан с пунктом, а не с подопечным (ADR-0003):
      // записи уходят вместе с пунктами удаляемого подопечного.
      const removedItemIds = new Set(
        state.careItems.filter((item) => item.subjectId === action.id).map((item) => item.id),
      )
      return {
        subjects: state.subjects.filter((subject) => subject.id !== action.id),
        careItems: state.careItems.filter((item) => item.subjectId !== action.id),
        completionLog: state.completionLog.filter((entry) => !removedItemIds.has(entry.careItemId)),
        oneOffEvents: state.oneOffEvents.filter((event) => event.subjectId !== action.id),
        weights: state.weights.filter((entry) => entry.subjectId !== action.id),
        feed: state.feed.filter((entry) => entry.subjectId !== action.id),
      }
    }
    case 'careItem/add':
      return { ...state, careItems: [...state.careItems, action.item] }
    case 'careItem/update': {
      const index = state.careItems.findIndex((item) => item.id === action.id)
      if (index === -1) return state
      const next: CareItem = { ...state.careItems[index] }
      if (action.patch.title !== undefined) next.title = action.patch.title
      // Интервал просто заменяется: «следующий раз» нигде не хранится и
      // пересчитается от последнего выполнения сам (ADR-0003).
      if (action.patch.interval !== undefined) next.interval = action.patch.interval
      const careItems = [...state.careItems]
      careItems[index] = next
      return { ...state, careItems }
    }
    case 'careItem/remove':
      if (!state.careItems.some((item) => item.id === action.id)) return state
      return {
        ...state,
        careItems: state.careItems.filter((item) => item.id !== action.id),
        // Прошлое пункта без самого пункта не нужно: журнал уходит вместе с ним.
        completionLog: state.completionLog.filter((entry) => entry.careItemId !== action.id),
      }
    case 'completion/log': {
      // Запись без пункта — сирота: экраны не должны иметь возможности её создать,
      // но стор не молчит, а просто не меняет состояние (no-op, как у несуществующего id).
      if (!state.careItems.some((item) => item.id === action.entry.careItemId)) return state
      return { ...state, completionLog: [...state.completionLog, action.entry] }
    }
    case 'oneOffEvent/add':
      // Событие без подопечного — сирота, как запись журнала без пункта: no-op.
      if (!state.subjects.some((subject) => subject.id === action.event.subjectId)) return state
      return { ...state, oneOffEvents: [...state.oneOffEvents, action.event] }
    case 'oneOffEvent/update': {
      const index = state.oneOffEvents.findIndex((event) => event.id === action.id)
      if (index === -1) return state
      const next: OneOffEvent = { ...state.oneOffEvents[index] }
      const { title, date, note } = action.patch
      if (title !== undefined) next.title = title
      if (date !== undefined) next.date = date
      // Заметка снимается именно удалением поля (как фото); пустая после
      // trim строка трактуется как «заметки нет».
      if (note === null) delete next.note
      else if (note !== undefined) {
        const trimmed = note.trim()
        if (trimmed === '') delete next.note
        else next.note = trimmed
      }
      const oneOffEvents = [...state.oneOffEvents]
      oneOffEvents[index] = next
      return { ...state, oneOffEvents }
    }
    case 'oneOffEvent/remove':
      if (!state.oneOffEvents.some((event) => event.id === action.id)) return state
      return {
        ...state,
        oneOffEvents: state.oneOffEvents.filter((event) => event.id !== action.id),
      }
    case 'oneOffEvent/complete': {
      const index = state.oneOffEvents.findIndex((event) => event.id === action.id)
      // Повторное «Сделано» выполненного и несуществующий id — no-op:
      // та же ссылка состояния, автосейв не дёргается.
      if (index === -1 || state.oneOffEvents[index].done) return state
      const oneOffEvents = [...state.oneOffEvents]
      oneOffEvents[index] = { ...oneOffEvents[index], done: true }
      return { ...state, oneOffEvents }
    }
    case 'weight/add':
      // Замер без подопечного — сирота, как событие и запись журнала: no-op.
      if (!state.subjects.some((subject) => subject.id === action.entry.subjectId)) return state
      return { ...state, weights: [...state.weights, action.entry] }
    case 'weight/remove':
      if (!state.weights.some((entry) => entry.id === action.id)) return state
      return { ...state, weights: state.weights.filter((entry) => entry.id !== action.id) }
  }
}

// null в дефолте — маркер «вне провайдера»: useStore различает его и даёт
// понятную ошибку вместо невнятного undefined.
const StoreContext = createContext<Store | null>(null)

/** Провайдер единственного мутируемого состояния приложения. */
export function StoreProvider(props: { children: ReactNode; repository: Repository }): ReactElement {
  const { children, repository } = props
  // Начальное состояние читается из репозитория один раз: после старта
  // стор — источник правды, повторные load затирали бы уже сохранённое.
  const [state, dispatch] = useReducer(reducer, undefined, () => repository.load())
  useAutoSave(state, repository)

  const actions = useMemo<StoreActions>(
    () => ({
      addSubject(input) {
        // Сущности строятся в креаторе: редьюсер остаётся чистым, а
        // возвращённый подопечный — ровно тот объект, что лёг в состояние.
        const subject: CareSubject = {
          id: crypto.randomUUID(),
          type: 'pet', // в MVP интерфейс показывает только питомцев (ADR-0002)
          name: input.name,
          species: input.species,
          birthDate: input.birthDate,
          ...(input.photo !== undefined ? { photo: input.photo } : {}),
        }
        const careItems = input.careItems.map((draft) => ({
          id: crypto.randomUUID(),
          subjectId: subject.id,
          title: draft.title,
          interval: draft.interval,
        }))
        dispatch({ type: 'subject/add', subject, careItems })
        return subject
      },
      updateSubject(id, patch) {
        dispatch({ type: 'subject/update', id, patch })
      },
      removeSubject(id) {
        dispatch({ type: 'subject/remove', id })
      },
      addCareItem(subjectId, draft) {
        const item: CareItem = {
          id: crypto.randomUUID(),
          subjectId,
          title: draft.title,
          interval: draft.interval,
        }
        dispatch({ type: 'careItem/add', item })
        return item
      },
      updateCareItem(id, patch) {
        dispatch({ type: 'careItem/update', id, patch })
      },
      removeCareItem(id) {
        dispatch({ type: 'careItem/remove', id })
      },
      logCompletion(careItemId, date, note) {
        // Пустую заметку не храним совсем: сериализация и проверки
        // toStrictEqual различают «поля нет» и «пустая строка» (см. photo).
        const trimmed = note?.trim()
        const entry: CompletionLogEntry = {
          id: crypto.randomUUID(),
          careItemId,
          date,
          ...(trimmed ? { note: trimmed } : {}),
        }
        dispatch({ type: 'completion/log', entry })
      },
      addOneOffEvent(subjectId, input) {
        const trimmedNote = input.note?.trim()
        const event: OneOffEvent = {
          id: crypto.randomUUID(),
          subjectId,
          title: input.title.trim(),
          date: input.date,
          done: false,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        }
        dispatch({ type: 'oneOffEvent/add', event })
        return event
      },
      updateOneOffEvent(id, patch) {
        dispatch({ type: 'oneOffEvent/update', id, patch })
      },
      removeOneOffEvent(id) {
        dispatch({ type: 'oneOffEvent/remove', id })
      },
      completeOneOffEvent(id) {
        dispatch({ type: 'oneOffEvent/complete', id })
      },
      addWeight(subjectId, input) {
        // Граммы приходят уже целыми: форма конвертирует килограммы до стора
        // (ADR-0008), стор раскладывает готовую сущность, ничего не считая.
        const entry: WeightEntry = {
          id: crypto.randomUUID(),
          subjectId,
          date: input.date,
          grams: input.grams,
        }
        dispatch({ type: 'weight/add', entry })
        return entry
      },
      removeWeight(id) {
        dispatch({ type: 'weight/remove', id })
      },
    }),
    // dispatch стабилен между рендерами — экшены не пересоздаются и не
    // дёргают deps потребителей стора.
    [dispatch],
  )

  const store = useMemo<Store>(() => ({ state, ...actions }), [state, actions])
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

/** Стор: состояние + стабильные экшены. Бросает понятную ошибку вне провайдера. */
export function useStore(): Store {
  const store = useContext(StoreContext)
  if (store === null) {
    throw new Error('useStore вызван вне StoreProvider — оберни дерево в StoreProvider')
  }
  return store
}
