/**
 * «Сделано» в bottom-sheet (User Stories 6, 7): одна кнопка на карточке
 * пункта открывает эту форму — дата (по умолчанию сегодня) и опциональная
 * заметка (название вакцины, клиника). Подтверждение пишет запись журнала;
 * таймер пересчитается сам, потому что «следующий раз» выводный (ADR-0003).
 *
 * Прошлое не редактируется и не удаляется по отдельности — только новой
 * записью (ADR-0003); форма поэтому без режима правки.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { CareItem } from '../../../domain/model'
import { todayDateString } from '../../today'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import form from '../form.module.css'

export interface DoneSheetProps {
  /** Пункт, выполнение которого отмечаем. */
  item: CareItem
  onClose: () => void
}

export function DoneSheet(props: DoneSheetProps): ReactElement {
  const { item, onClose } = props
  const { logCompletion } = useStore()

  const [date, setDate] = useState<string>(todayDateString())
  const [note, setNote] = useState('')
  const [dateError, setDateError] = useState<string | undefined>(undefined)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // input[type=date] отдаёт '' или готовую 'YYYY-MM-DD' — достаточно
    // проверки на пусто (как с датой рождения в SubjectSheet).
    if (date === '') {
      setDateError('Укажите дату')
      return
    }
    logCompletion(item.id, date, note === '' ? undefined : note)
    onClose()
  }

  return (
    <BottomSheet title={`Сделано: ${item.title}`} onClose={onClose}>
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        <label className={form.field}>
          <span className={form.label}>Дата выполнения</span>
          <input
            type="date"
            className={
              dateError !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setDateError(undefined)
            }}
            aria-invalid={dateError !== undefined}
          />
          {dateError !== undefined && <span className={form.error}>{dateError}</span>}
        </label>

        <label className={form.field}>
          <span className={form.label}>Заметка (необязательно)</span>
          <textarea
            className={form.textarea}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например: Нобивак, клиника «Айболит»"
          />
        </label>

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={form.primary}>
            Отметить
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
