import { useState } from 'react'
import type { Id } from '../domain/model'
import { createLocalStorageRepo } from '../storage/localStorageRepo'
import { Dashboard } from './screens/Dashboard/Dashboard'
import { PetCard } from './screens/PetCard/PetCard'
import { Settings } from './screens/Settings/Settings'
import { StoreProvider } from './store'

/**
 * Композиционный корень приложения: единственное место, где стор получает
 * свою реализацию репозитория. Репозиторий создаётся один раз на всё
 * приложение — контракт useAutoSave требует стабильную ссылку между
 * рендерами. Экраны берут данные только через useStore и не знают о
 * localStorage (docs/ARCHITECTURE.md).
 *
 * Три экрана без роутера (ADR-0006): какой питомец открыт и не открыт ли
 * экран настроек — навигационное состояние корня, id достаточно — сам питомец
 * живёт в сторе.
 */

/** Навигационное состояние: дашборд / карточка питомца / настройки (тикет 10). */
type Screen =
  | { name: 'dashboard' }
  | { name: 'petCard'; subjectId: Id }
  | { name: 'settings' }

export function App() {
  const [repository] = useState(createLocalStorageRepo)
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' })

  return (
    <StoreProvider repository={repository}>
      {screen.name === 'dashboard' ? (
        <Dashboard
          onOpenSubject={(id) => setScreen({ name: 'petCard', subjectId: id })}
          onOpenSettings={() => setScreen({ name: 'settings' })}
        />
      ) : screen.name === 'petCard' ? (
        <PetCard subjectId={screen.subjectId} onBack={() => setScreen({ name: 'dashboard' })} />
      ) : (
        <Settings onBack={() => setScreen({ name: 'dashboard' })} />
      )}
    </StoreProvider>
  )
}
