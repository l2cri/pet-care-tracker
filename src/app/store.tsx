/**
 * Стор «Питомцы и дом»: автосохранение состояния (ADR-0001, ADR-0006).
 *
 * Тикет 03 доставляет хук автосохранения. Стор тикета 04 (context +
 * useReducer) будет пропускать каждое изменение состояния через него:
 * единственное мутируемое состояние приложения, компоненты не знают о
 * localStorage, репозиторий — единственная точка записи.
 */

import { useEffect } from 'react'
import type { AppState } from '../domain/model'
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
