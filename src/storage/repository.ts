/**
 * Слой хранилища: localStorage спрятан за интерфейсом Repository (ADR-0001).
 *
 * Две реализации: in-memory (тесты, демо-прогоны) и localStorage-обёртка
 * (localStorageRepo.ts). Точка замены на IndexedDB без касания domain и app
 * (docs/ARCHITECTURE.md, «Швы тестирования»). Репозитории синхронные:
 * асинхронных версий сознательно нет (ADR-0001).
 */

import type { AppState } from '../domain/model'

/** Состояние первого запуска: ни одного подопечного и записи (ADR-0001). */
export function emptyAppState(): AppState {
  return {
    subjects: [],
    careItems: [],
    completionLog: [],
    oneOffEvents: [],
    weights: [],
    feed: [],
  }
}

/** Хранилище состояния: загрузить / сохранить / стереть, целиком и синхронно. */
export interface Repository {
  /** Прочитать состояние. Первый запуск — пустое состояние. */
  load(): AppState
  /** Сохранить состояние целиком, замещая прежнее. */
  save(state: AppState): void
  /** Стереть всё. Следующий load — снова пустое состояние. */
  wipe(): void
}

/**
 * In-memory реализация для тестов: второй шов тестирования проекта
 * (docs/ARCHITECTURE.md). Хранит ссылку как есть — состояние приложения
 * иммутабельно по контракту стора (каждое изменение — новый объект),
 * поэтому отдельное копирование не нужно.
 */
export class InMemoryRepository implements Repository {
  private state: AppState | undefined

  load(): AppState {
    return this.state ?? emptyAppState()
  }

  save(state: AppState): void {
    this.state = state
  }

  wipe(): void {
    this.state = undefined
  }
}
