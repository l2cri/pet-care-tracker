/**
 * Форма пункта ухода в bottom-sheet (User Stories 5, 28): создание и правка
 * в одном компоненте — поля совпадают. Интервал — «каждые N дней/недель/
 * месяцев/лет»; смена интервала пересчитает «следующий раз» сама, потому
 * что он выводится из журнала, а не хранится (ADR-0003).
 *
 * Валидация — как в строках ухода SubjectSheet: заголовок непустой после
 * trim, интервал — целое от 1. Русские сообщения вместо нативных баббл.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { CareItem, Id, IntervalUnit } from '../../../domain/model'
import { intervalLabel, UNIT_OPTIONS } from '../format'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import form from '../form.module.css'

export interface CareItemSheetProps {
  onClose: () => void
  /** Подопечный нового пункта; в режиме правки не нужен. */
  subjectId?: Id
  /** Существующий пункт — режим правки; отсутствует — создание. */
  item?: CareItem
}

interface FormErrors {
  title?: string
  interval?: string
}

export function CareItemSheet(props: CareItemSheetProps): ReactElement {
  const { onClose, subjectId, item } = props
  const editing = item !== undefined
  const { addCareItem, updateCareItem } = useStore()

  const [title, setTitle] = useState(item?.title ?? '')
  // Число интервала — строкой до подтверждения формы: контролируемый
  // input[type=number] с пустым значением иначе теряет «пользователь
  // стирает цифру» между кадрами (как в SubjectSheet).
  const [valueText, setValueText] = useState(String(item?.interval.value ?? ''))
  const [unit, setUnit] = useState<IntervalUnit>(item?.interval.unit ?? 'months')
  const [errors, setErrors] = useState<FormErrors>({})

  const valueValid = /^\d+$/.test(valueText.trim()) && Number(valueText.trim()) >= 1
  const hint = valueValid ? intervalLabel(Number(valueText.trim()), unit) : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: FormErrors = {
      title: title.trim() === '' ? 'Введите заголовок' : undefined,
      interval: valueValid ? undefined : 'Интервал — целое число от 1',
    }
    if (nextErrors.title !== undefined || nextErrors.interval !== undefined) {
      setErrors(nextErrors)
      return
    }

    const interval = { value: Number(valueText.trim()), unit }
    if (editing) {
      updateCareItem(item.id, { title: title.trim(), interval })
    } else {
      addCareItem(subjectId!, { title: title.trim(), interval })
    }
    onClose()
  }

  return (
    <BottomSheet title={editing ? 'Изменить пункт ухода' : 'Новый пункт ухода'} onClose={onClose}>
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        <label className={form.field}>
          <span className={form.label}>Заголовок</span>
          <input
            className={
              errors.title !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, стрижка когтей"
            aria-invalid={errors.title !== undefined}
          />
          {errors.title !== undefined && <span className={form.error}>{errors.title}</span>}
        </label>

        <div className={form.field}>
          <span className={form.label}>Повторять</span>
          <div className={form.intervalRow}>
            <span className={form.intervalWord}>каждые</span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={
                errors.interval !== undefined
                  ? `${form.input} ${form.inputInvalid} ${form.intervalValue}`
                  : `${form.input} ${form.intervalValue}`
              }
              value={valueText}
              onChange={(event) => setValueText(event.target.value)}
              aria-label="Интервал: число"
              aria-invalid={errors.interval !== undefined}
            />
            <select
              className={form.input}
              value={unit}
              onChange={(event) => setUnit(event.target.value as IntervalUnit)}
              aria-label="Единица интервала"
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hint !== null && <p className={form.hint}>{hint}</p>}
          {errors.interval !== undefined && (
            <span className={form.error}>{errors.interval}</span>
          )}
        </div>

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
