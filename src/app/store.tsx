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
import type { AppState, CareItem, CareSubject, DateString, Id } from '../domain/model'
import type { CareItemDraft } from '../domain/presets'
import type { Repository } from '../storage/repository'

/**
 * Сохраняет состояние в репозиторий при каждом изменении — включая первый
 * рендер. Изменением считается новая ссылка: стор обязан создавать новое
 * состояние на каждый dispatch, а репозиторий — быть стабильным между
 * рендерами (создан один раз на всё приложение).
 *
 * Ошибка сохранения (квота localStorage, заблокированное хранилище) не
 * роняет приложение: экран продолжает работать с несохранённым состоянием,
 * сбой виден в консоли. Потерять персистентность, сохранив работающий
 * интерфейс, лучше, чем потерять и то и другое — пользовательский сигнал
 * об ошибке появится вместе с экраном настроек (тикет 10).
 */
export function useAutoSave(state: AppState, repo: Repository): void {
  useEffect(() => {
    try {
      repo.save(state)
    } catch (error) {
      console.error('Не удалось сохранить состояние:', error)
    }
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

/** Экшены стора: стабильные между рендерами функции. */
export interface StoreActions {
  /** Создаёт подопечного и его пункты ухода одним dispatch; возвращает созданного подопечного. */
  addSubject(input: NewSubjectInput): CareSubject
  updateSubject(id: Id, patch: SubjectPatch): void
  /** Удаляет подопечного каскадом: его пункты ухода, журнал выполнений, события, вес, корм. */
  removeSubject(id: Id): void
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
