/**
 * localStorage-реализация репозитория (ADR-0001) — тонкая обёртка.
 *
 * Под ключом лежит тот же конверт { formatVersion, state }, что и в файле
 * бэкапа (backup.ts): формат один, владелец его один, миграции по
 * formatVersion (docs/ARCHITECTURE.md) достаются обоим потребителям
 * автоматически — через parseImport.
 *
 * Первый запуск (ключа нет) — пустое состояние. Битое или чужое содержимое
 * под ключом — громкая ошибка вместо тихой потери истории: если вернуть
 * пустое состояние, первый же автосейв перезапишет данные пользователя.
 */

import type { AppState } from '../domain/model'
import { exportJson, parseImport } from './backup'
import { emptyAppState } from './repository'
import type { Repository } from './repository'

/** Ключ localStorage под конверт состояния. */
export const STORAGE_KEY = 'pet-care-tracker/state'

/** Репозиторий поверх localStorage браузера. */
export function createLocalStorageRepo(): Repository {
  return {
    load(): AppState {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return emptyAppState()
      return parseImport(raw)
    },

    save(state: AppState): void {
      localStorage.setItem(STORAGE_KEY, exportJson(state))
    },

    wipe(): void {
      localStorage.removeItem(STORAGE_KEY)
    },
  }
}
