/**
 * Форма записи корма в bottom-sheet (тикет 09, User Stories 23–24): создание
 * и правка в одном компоненте — поля совпадают. Дата (по умолчанию сегодня,
 * как в DoneSheet), название, цена с копейками и вердикт «подошёл / не
 * подошёл» — два крупных touch-friendly переключателя; выбранный «Не
 * подошёл» подсвечен опасным красным по токенам, чтобы плохой корм
 * останавливал глаз и при вводе, и потом в журнале.
 *
 * Валидация — как в остальных листах: русские сообщения вместо нативных
 * баббл, ошибка поля снимается первой же правкой. Цена живёт строкой до
 * подтверждения и пишется по-русски через запятую ('890,50'); inputMode
 * "decimal" даёт цифровую клавиатуру, а type=number с запятой не дружит.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { FeedEntry, FeedVerdict, Id } from '../../../domain/model'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import form from '../form.module.css'
import styles from './FeedEntrySheet.module.css'

export interface FeedEntrySheetProps {
  onClose: () => void
  /** Подопечный новой покупки; в режиме правки не нужен. */
  subjectId?: Id
  /** Существующая запись — режим правки; отсутствует — создание. */
  entry?: FeedEntry
}

interface FormErrors {
  date?: string
  foodName?: string
  price?: string
}

/** Цена по-русски: рубли и до двух цифр копеек, разделитель — запятая или точка. */
const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/

export function FeedEntrySheet(props: FeedEntrySheetProps): ReactElement {
  const { onClose, subjectId, entry } = props
  const editing = entry !== undefined
  const { addFeedEntry, updateFeedEntry } = useStore()

  const [date, setDate] = useState<string>(entry?.date ?? todayDateString())
  const [foodName, setFoodName] = useState(entry?.foodName ?? '')
  // Цена — строкой до подтверждения: '890,50' станет числом только на submit.
  const [priceText, setPriceText] = useState(entry !== undefined ? String(entry.price) : '')
  const [verdict, setVerdict] = useState<FeedVerdict>(entry?.verdict ?? 'ok')
  const [note, setNote] = useState(entry?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const trimmedPrice = priceText.trim()
    const price = Number(trimmedPrice.replace(',', '.'))
    const nextErrors: FormErrors = {
      date: date === '' ? 'Укажите дату' : undefined,
      foodName: foodName.trim() === '' ? 'Введите название' : undefined,
      price:
        trimmedPrice === ''
          ? 'Укажите цену'
          : PRICE_PATTERN.test(trimmedPrice)
            ? undefined
            : 'Цена — число от 0, копейки через запятую',
    }
    if (
      nextErrors.date !== undefined ||
      nextErrors.foodName !== undefined ||
      nextErrors.price !== undefined
    ) {
      setErrors(nextErrors)
      return
    }

    if (editing) {
      // Пустая заметка в правке снимается явно (note: null), при создании — не передаётся.
      updateFeedEntry(entry.id, {
        date,
        foodName: foodName.trim(),
        price,
        verdict,
        ...(note.trim() === '' ? { note: null } : { note: note.trim() }),
      })
    } else {
      addFeedEntry(subjectId!, {
        date,
        foodName: foodName.trim(),
        price,
        verdict,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      })
    }
    onClose()
  }

  return (
    <BottomSheet title={editing ? 'Изменить покупку' : 'Новая покупка'} onClose={onClose}>
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        <label className={form.field}>
          <span className={form.label}>Дата</span>
          <input
            type="date"
            className={
              errors.date !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={date}
            onChange={(inputEvent) => {
              setDate(inputEvent.target.value)
              setErrors((prev) => ({ ...prev, date: undefined }))
            }}
            aria-invalid={errors.date !== undefined}
          />
          {errors.date !== undefined && <span className={form.error}>{errors.date}</span>}
        </label>

        <label className={form.field}>
          <span className={form.label}>Название</span>
          <input
            className={
              errors.foodName !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={foodName}
            onChange={(inputEvent) => {
              setFoodName(inputEvent.target.value)
              setErrors((prev) => ({ ...prev, foodName: undefined }))
            }}
            placeholder="Например, корм с лососем для кошек"
            aria-invalid={errors.foodName !== undefined}
          />
          {errors.foodName !== undefined && <span className={form.error}>{errors.foodName}</span>}
        </label>

        <label className={form.field}>
          <span className={form.label}>Цена</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={
              errors.price !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={priceText}
            onChange={(inputEvent) => {
              setPriceText(inputEvent.target.value)
              setErrors((prev) => ({ ...prev, price: undefined }))
            }}
            placeholder="Например, 890 или 890,50"
            aria-invalid={errors.price !== undefined}
          />
          {errors.price !== undefined && <span className={form.error}>{errors.price}</span>}
        </label>

        <div className={form.field}>
          <span className={form.label}>Вердикт</span>
          <div className={styles.verdictRow} role="group" aria-label="Вердикт корма">
            <button
              type="button"
              className={
                verdict === 'ok'
                  ? `${styles.verdictButton} ${styles.verdictOkActive}`
                  : styles.verdictButton
              }
              aria-pressed={verdict === 'ok'}
              onClick={() => setVerdict('ok')}
            >
              Подошёл
            </button>
            <button
              type="button"
              className={
                verdict === 'bad'
                  ? `${styles.verdictButton} ${styles.verdictBadActive}`
                  : styles.verdictButton
              }
              aria-pressed={verdict === 'bad'}
              onClick={() => setVerdict('bad')}
            >
              Не подошёл
            </button>
          </div>
        </div>

        <label className={form.field}>
          <span className={form.label}>Заметка (необязательно)</span>
          <textarea
            className={form.textarea}
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            placeholder="Например: ел неохотно, зуд на лапах"
          />
        </label>

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={form.primary}>
            {editing ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
