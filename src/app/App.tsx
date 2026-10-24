import { useState } from 'react'
import { createLocalStorageRepo } from '../storage/localStorageRepo'
import { Dashboard } from './screens/Dashboard/Dashboard'
import { StoreProvider } from './store'

/**
 * Композиционный корень приложения: единственное место, где стор получает
 * свою реализацию репозитория. Репозиторий создаётся один раз на всё
 * приложение — контракт useAutoSave требует стабильную ссылку между
 * рендерами. Экраны берут данные только через useStore и не знают о
 * localStorage (docs/ARCHITECTURE.md).
 */
export function App() {
  const [repository] = useState(createLocalStorageRepo)
  return (
    <StoreProvider repository={repository}>
      <Dashboard />
    </StoreProvider>
  )
}
