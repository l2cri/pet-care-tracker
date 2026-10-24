import { useState } from 'react'
import type { Id } from '../domain/model'
import { createLocalStorageRepo } from '../storage/localStorageRepo'
import { Dashboard } from './screens/Dashboard/Dashboard'
import { PetCard } from './screens/PetCard/PetCard'
import { StoreProvider } from './store'

/**
 * Композиционный корень приложения: единственное место, где стор получает
 * свою реализацию репозитория. Репозиторий создаётся один раз на всё
 * приложение — контракт useAutoSave требует стабильную ссылку между
 * рендерами. Экраны берут данные только через useStore и не знают о
 * localStorage (docs/ARCHITECTURE.md).
 *
 * Два экрана без роутера (ADR-0006): какой питомец открыт — навигационное
 * состояние корня, id достаточно — сам питомец живёт в сторе.
 */
export function App() {
  const [repository] = useState(createLocalStorageRepo)
  const [openSubjectId, setOpenSubjectId] = useState<Id | null>(null)

  return (
    <StoreProvider repository={repository}>
      {openSubjectId === null ? (
        <Dashboard onOpenSubject={setOpenSubjectId} />
      ) : (
        <PetCard subjectId={openSubjectId} onBack={() => setOpenSubjectId(null)} />
      )}
    </StoreProvider>
  )
}
