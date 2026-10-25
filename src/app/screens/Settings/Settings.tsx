/**
 * Настройки (тикет 10; User Stories 29–32): JSON-бэкап в обе стороны, демо-набор
 * и «Стереть всё». Все три операции меняют состояние целиком — одним экшеном
 * replaceState: строку JSON и валидацию файла даёт storage/backup.ts, демо-набор
 * — домен (demoData), состояние первого запуска — emptyAppState. Компонент
 * только организует ввод-вывод: скачивание — backupDownload, чтение файла —
 * FileReader, «сегодня» для демо — todayDateString в момент клика, не рендера.
 *
 * Разрушительные действия — через bottom-sheet с подтверждением (правило
 * приложения): демо-набор — один шаг с честным «заменит текущие данные»,
 * стирание — два раздельных осознанных шага. После демо и стирания — возврат
 * на дашборд: результат виден сразу (карточки питомцев / пустое состояние
 * первого запуска). Импорт оставляет на экране строку-итог: успех — данные
 * заменены, ошибка — текст BackupImportError, данные не тронуты.
 */

import { useRef, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import { demoData } from '../../../domain/demoData'
import { BackupImportError, parseImport } from '../../../storage/backup'
import { emptyAppState } from '../../../storage/repository'
import { downloadBackupJson } from '../../backupDownload'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import form from '../../components/form.module.css'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import styles from './Settings.module.css'

/** Итог импорта для строки-статуса: успех или ошибка с текстом пользователю. */
type ImportNotice = { kind: 'success' | 'error'; text: string }

export interface SettingsProps {
  /** Вернуться на дашборд — навигация стейтом в App (без роутера). */
  onBack: () => void
}

export function Settings(props: SettingsProps): ReactElement {
  const { onBack } = props
  const { state, replaceState } = useStore()

  // Скрытый input выбора файла: видимая touch-friendly кнопка проксирует клик.
  const fileInput = useRef<HTMLInputElement>(null)
  // Итог импорта висит на экране, пока не сменится следующим действием.
  const [notice, setNotice] = useState<ImportNotice | null>(null)
  // Подтверждения — взаимоисключающие листы, как на остальных экранах.
  const [confirmingDemo, setConfirmingDemo] = useState(false)
  const [wiping, setWiping] = useState(false)
  // Второй шаг стирания: достигнут после «Продолжить», сбрасывается при закрытии.
  const [wipeArmed, setWipeArmed] = useState(false)

  /** Выгрузка: строку JSON и имя файла собирают storage и backupDownload. */
  function handleExport(): void {
    downloadBackupJson(state)
  }

  /**
   * Импорт: файл → текст → parseImport (вся валидация в storage). Успех —
   * replaceState и понятное подтверждение; любая ошибка — текст пользователю,
   * данные не меняются. FileReader может отказать и до парсинга — onerror.
   */
  function handleImportFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    // value сбрасывается сразу: повторный выбор того же файла — тоже событие.
    event.target.value = ''
    if (file === undefined) return
    const reader = new FileReader()
    reader.onerror = () => {
      setNotice({ kind: 'error', text: 'Не удалось прочитать файл — попробуйте ещё раз.' })
    }
    reader.onload = () => {
      try {
        replaceState(parseImport(String(reader.result)))
        setNotice({
          kind: 'success',
          text: 'Бэкап загружен — данные приложения заменены содержимым файла.',
        })
      } catch (error) {
        setNotice({
          kind: 'error',
          text:
            error instanceof BackupImportError
              ? error.message
              : 'Файл не удалось прочитать. Убедитесь, что выбран JSON-файл бэкапа «Питомцы и дом».',
        })
      }
    }
    reader.readAsText(file)
  }

  /** Демо-набор: «сегодня» — в момент клика, картинка всегда живая (тикет 10). */
  function loadDemo(): void {
    replaceState(demoData(todayDateString()))
    setConfirmingDemo(false)
    onBack()
  }

  /** Стирание: emptyAppState — то же состояние, что у первого запуска. */
  function wipeAll(): void {
    replaceState(emptyAppState())
    closeWipe()
    onBack()
  }

  function closeWipe(): void {
    setWiping(false)
    setWipeArmed(false)
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="К списку питомцев"
        >
          ‹ Назад
        </button>
        <h1 className={styles.title}>Настройки</h1>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Бэкап данных</h2>
          <p className={styles.sectionText}>
            Все данные живут только в этом браузере. Выгружайте бэкап, чтобы не потерять историю,
            и загружайте его на новом устройстве.
          </p>

          <div className={styles.action}>
            <button type="button" className={styles.primaryButton} onClick={handleExport}>
              Выгрузить бэкап
            </button>
            <p className={styles.actionHint}>
              Скачает JSON-файл со всем: питомцами, уходом, историей выполнений, весом и кормом.
            </p>
          </div>

          <div className={styles.action}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => fileInput.current?.click()}
            >
              Загрузить бэкап
            </button>
            <p className={styles.actionHint}>
              Заменит текущие данные содержимым выбранного файла. Если нынешние данные ещё нужны —
              сначала выгрузите бэкап.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className={styles.fileInput}
              onChange={handleImportFile}
              aria-hidden="true"
              tabIndex={-1}
            />
            {notice !== null && (
              <p
                className={`${styles.notice} ${
                  notice.kind === 'error' ? styles.noticeError : styles.noticeSuccess
                }`}
                role={notice.kind === 'error' ? 'alert' : 'status'}
              >
                {notice.text}
              </p>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Демо-набор</h2>
          <p className={styles.sectionText}>
            Два питомца с историей веса, корма и ухода — посмотреть приложение в деле, не заводя
            своих данных.
          </p>
          <div className={styles.action}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirmingDemo(true)}
            >
              Загрузить демо-набор
            </button>
            <p className={styles.actionHint}>Заменит текущие данные.</p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>Опасная зона</h2>
          <p className={styles.sectionText}>
            Действия этой секции затрагивают сразу все данные приложения.
          </p>
          <div className={styles.action}>
            <button type="button" className={styles.dangerButton} onClick={() => setWiping(true)}>
              Стереть все данные
            </button>
            <p className={styles.actionHint}>
              Удалит всех питомцев и всю историю — вес, корм, события, выполнения. Безвозвратно.
            </p>
          </div>
        </section>
      </main>

      {/* Демо-набор перезапишет текущие данные — честное предупреждение до
          действия, подтверждение в один шаг (тикет 10). */}
      {confirmingDemo && (
        <BottomSheet title="Загрузить демо-набор?" onClose={() => setConfirmingDemo(false)}>
          <p className={form.note}>
            Демо-набор — два питомца с готовой историей — заменит текущие данные: питомцев, пункты
            ухода и историю выполнений, события, замеры веса и журнал корма. Отменить будет нельзя.
            Если нынешние данные нужны — сначала выгрузите бэкап.
          </p>
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              onClick={() => setConfirmingDemo(false)}
            >
              Отмена
            </button>
            <button type="button" className={form.danger} onClick={loadDemo}>
              Загрузить демо-набор
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Стирание — двойное подтверждение: первый шаг объясняет последствия,
          второй требует отдельного явного «Да, стереть всё» — два раздельных
          осознанных клика, без ввода текста. */}
      {wiping && (
        <BottomSheet title="Стереть все данные?" onClose={closeWipe}>
          {wipeArmed ? (
            <>
              <p className={form.note}>Стереть все данные приложения? Вернуть их будет нельзя.</p>
              <div className={form.actions}>
                <button type="button" className={form.secondary} onClick={closeWipe}>
                  Отмена
                </button>
                <button type="button" className={form.danger} onClick={wipeAll}>
                  Да, стереть всё
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={form.note}>
                Будут безвозвратно удалены: все питомцы, пункты ухода и история выполнений,
                разовые события, замеры веса и журнал корма. Отменить действие нельзя. Если данные
                ещё пригодятся — сначала выгрузите бэкап.
              </p>
              <div className={form.actions}>
                <button type="button" className={form.secondary} onClick={closeWipe}>
                  Отмена
                </button>
                <button type="button" className={form.danger} onClick={() => setWipeArmed(true)}>
                  Продолжить
                </button>
              </div>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  )
}
