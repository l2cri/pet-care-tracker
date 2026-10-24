/**
 * Форма разового события в bottom-sheet (тикет 07, User Story 14): создание
 * и правка в одном компоненте — поля совпадают. Заголовок, дата и
 * опциональная заметка; повтора нет, срочность выведется из даты сама.
 *
 * Валидация — как в остальных листах: заголовок непустой после trim,
 * input[type=date] отдаёт '' или готовую 'YYYY-MM-DD'. Русские сообщения
 * вместо нативных баббл.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { Id, OneOffEvent } from '../../../domain/model'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import form from '../form.module.css'

export interface OneOffEventSheetProps {
  onClose: () => void
  /** Подопечный нового события; в режиме правки не нужен. */
  subjectId?: Id
  /** Существующее событие — режим правки; отсутствует — создание. */
  event?: OneOffEvent
}

interface FormErrors {
  title?: string
  date?: string
}

export function OneOffEventSheet(props: OneOffEventSheetProps): ReactElement {
  const { onClose, subjectId, event } = props
  const editing = event !== undefined
  const { addOneOffEvent, updateOneOffEvent } = useStore()

  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState<string>(event?.date ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const nextErrors: FormErrors = {
      title: title.trim() === '' ? 'Введите заголовок' : undefined,
      date: date === '' ? 'Укажите дату' : undefined,
    }
    if (nextErrors.title !== undefined || nextErrors.date !== undefined) {
      setErrors(nextErrors)
      return
    }

    if (editing) {
      // Заметка меняется только когда поле трогали: пустое поле после
      // правки снимает заметку (стор трактует пустую строку как «нет»).
      updateOneOffEvent(event.id, {
        title: title.trim(),
        date,
        ...(note.trim() === '' ? { note: null } : { note: note.trim() }),
      })
    } else {
      addOneOffEvent(subjectId!, {
        title: title.trim(),
        date,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      })
    }
    onClose()
  }

  return (
    <BottomSheet title={editing ? 'Изменить событие' : 'Новое событие'} onClose={onClose}>
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        <label className={form.field}>
          <span className={form.label}>Заголовок</span>
          <input
            className={
              errors.title !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={title}
            onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            placeholder="Например, визит к ветеринару"
            aria-invalid={errors.title !== undefined}
          />
          {errors.title !== undefined && <span className={form.error}>{errors.title}</span>}
        </label>

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
          <span className={form.label}>Заметка (необязательно)</span>
          <textarea
            className={form.textarea}
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            placeholder="Например: осмотр перед вакцинацией, клиника «Айболит»"
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
