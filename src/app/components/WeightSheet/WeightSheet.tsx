/**
 * Форма нового замера веса в bottom-sheet (тикет 08, User Story 20):
 * вводим килограммы, храним целые граммы (глоссарий «Замер веса», ADR-0008).
 * Правки замера нет — ошибочный удаляется и вводится заново (контракт стора),
 * поэтому у листа единственный режим «создание».
 *
 * Валидация — как в остальных листах: русские сообщения вместо нативных
 * баббл. Дата обязательна (input[type=date] отдаёт '' или готовую
 * 'YYYY-MM-DD'), вес — положительное число ≤ 999 кг с дробной частью
 * не длиннее трёх знаков. Десятичный разделитель — запятая и точка:
 * русская клавиатура телефона даёт запятую, привычка — точку.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { Id } from '../../../domain/model'
import { useStore } from '../../store'
import { todayDateString } from '../../today'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import form from '../form.module.css'

/** Верхняя граница веса в килограммах: запас на любого питомца. */
const MAX_KG = 999

interface FormErrors {
  date?: string
  weight?: string
}

/**
 * Строка поля «килограммы» → целые граммы или русское сообщение об ошибке.
 * Умножение на 1000 с округлением снимает float-погрешность разбора:
 * «4,25» → ровно 4250, «4,1» → ровно 4100.
 */
function parseKgToGrams(raw: string): { grams: number } | { error: string } {
  const text = raw.trim().replace(',', '.')
  if (text === '') return { error: 'Введите вес' }
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    return { error: 'Введите число, например 4,25' }
  }
  const fraction = text.split('.')[1] ?? ''
  if (fraction.length > 3) {
    return { error: 'С точностью до грамма' }
  }
  const kg = Number(text)
  if (kg <= 0) return { error: 'Вес должен быть больше нуля' }
  if (kg > MAX_KG) return { error: `Максимум ${MAX_KG} кг` }
  return { grams: Math.round(kg * 1000) }
}

export interface WeightSheetProps {
  /** Подопечный, которому добавляется замер. */
  subjectId: Id
  onClose: () => void
}

export function WeightSheet(props: WeightSheetProps): ReactElement {
  const { subjectId, onClose } = props
  const { addWeight } = useStore()

  const [date, setDate] = useState<string>(todayDateString())
  const [weight, setWeight] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const parsed = parseKgToGrams(weight)
    const nextErrors: FormErrors = {
      date: date === '' ? 'Укажите дату' : undefined,
      weight: 'error' in parsed ? parsed.error : undefined,
    }
    if (nextErrors.date !== undefined || nextErrors.weight !== undefined) {
      setErrors(nextErrors)
      return
    }

    if ('grams' in parsed) {
      addWeight(subjectId, { date, grams: parsed.grams })
    }
    onClose()
  }

  return (
    <BottomSheet title="Новый замер" onClose={onClose}>
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
          <span className={form.label}>Вес, кг</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={
              errors.weight !== undefined ? `${form.input} ${form.inputInvalid}` : form.input
            }
            value={weight}
            onChange={(inputEvent) => {
              setWeight(inputEvent.target.value)
              setErrors((prev) => ({ ...prev, weight: undefined }))
            }}
            placeholder="Например, 4,25"
            aria-invalid={errors.weight !== undefined}
          />
          {errors.weight !== undefined && <span className={form.error}>{errors.weight}</span>}
          <p className={form.hint}>Запятая или точка, с точностью до грамма.</p>
        </label>

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={form.primary}>
            Добавить
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
