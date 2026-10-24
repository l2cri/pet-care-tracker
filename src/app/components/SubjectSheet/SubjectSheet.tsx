/**
 * Форма подопечного в bottom-sheet (User Stories 1, 3, 4, 26): создание и
 * редактирование питомца в одном компоненте — поля совпадают, различие
 * только в наборе пунктов ухода (стартовые пресеты даются новому питомцу;
 * правка существующих пунктов — тикет 05, здесь её нет).
 *
 * Компонент не считает дат и сроков: дата рождения — просто 'YYYY-MM-DD'
 * из input[type=date], интервал — число + единица из select. Подпись
 * «каждые 3 месяца» — презентационное склонение числительного, не арифметика.
 */

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { CareSubject, IntervalUnit } from '../../../domain/model'
import { presetCareItemDrafts } from '../../../domain/presets'
import { useStore } from '../../store'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import { PhotoInput } from '../PhotoInput/PhotoInput'
import styles from './SubjectSheet.module.css'

/** Единицы интервала для select: значение — IntervalUnit, подпись — русский родительный множественного. */
const UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: 'days', label: 'дней' },
  { value: 'weeks', label: 'недель' },
  { value: 'months', label: 'месяцев' },
  { value: 'years', label: 'лет' },
]

/** Формы слов единицы: род для «каждый/каждую» плюс три формы числительного. */
const UNIT_WORD_FORMS: Record<IntervalUnit, { every: string; one: string; few: string; many: string }> = {
  days: { every: 'каждый', one: 'день', few: 'дня', many: 'дней' },
  weeks: { every: 'каждую', one: 'неделю', few: 'недели', many: 'недель' },
  months: { every: 'каждый', one: 'месяц', few: 'месяца', many: 'месяцев' },
  years: { every: 'каждый', one: 'год', few: 'года', many: 'лет' },
}

/** Русское согласование числительного: 1 месяц / 2 месяца / 5 месяцев. */
function pluralWord(value: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return forms.one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few
  return forms.many
}

/** Подпись интервала для человека: «каждый месяц», «каждые 3 месяца», «каждые 2 недели». */
function intervalLabel(value: number, unit: IntervalUnit): string {
  const forms = UNIT_WORD_FORMS[unit]
  // По-русски не говорят «каждый 1 месяц» — числительное опускается.
  if (value === 1) return `${forms.every} ${forms.one}`
  return `каждые ${value} ${pluralWord(value, forms)}`
}

/**
 * Строка редактирования пункта ухода. Число интервала держим строкой, пока
 * форма не подтверждена: контролируемый input[type=number] с пустым значением
 * иначе теряет «пользователь стирает цифру» между кадрами.
 */
interface CareDraftRow {
  title: string
  valueText: string
  unit: IntervalUnit
}

/** Ошибки валидации: по полям шапки и по индексам строк ухода. */
interface FormErrors {
  name?: string
  species?: string
  birthDate?: string
  rows?: Record<number, string>
}

export interface SubjectSheetProps {
  onClose: () => void
  /** Существующий подопечный — режим редактирования; отсутствует — создание. */
  subject?: CareSubject
}

export function SubjectSheet(props: SubjectSheetProps): ReactElement {
  const { onClose, subject } = props
  const editing = subject !== undefined
  const { addSubject, updateSubject } = useStore()

  const [name, setName] = useState(subject?.name ?? '')
  const [species, setSpecies] = useState(subject?.species ?? '')
  const [birthDate, setBirthDate] = useState(subject?.birthDate ?? '')
  // Фото: текущее превью + признак «пользователь трогал». Для редактирования
  // он различает «не менял» (undefined — не трогать) и «убрал» (null — удалить).
  const [photo, setPhoto] = useState<string | undefined>(subject?.photo)
  const [photoTouched, setPhotoTouched] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  // Пресеты — только новому питомцу. useState-инициализатор зовёт
  // presetCareItemDrafts() один раз на монтирование листа: каждый новый
  // питомец получает свежую копию, правки прошлой формы не протекают.
  const [careRows, setCareRows] = useState<CareDraftRow[]>(() =>
    editing ? [] : presetCareItemDrafts().map((draft) => ({
      title: draft.title,
      valueText: String(draft.interval.value),
      unit: draft.interval.unit,
    })),
  )

  function patchRow(index: number, patch: Partial<CareDraftRow>) {
    setCareRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    setCareRows((rows) => rows.filter((_, i) => i !== index))
  }

  function handlePhotoChange(next: string | undefined) {
    setPhoto(next)
    setPhotoTouched(true)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Валидация одним местом при отправке: имя/вид — после trim, дата —
    // непустая (input[date] отдаёт '' или готовый 'YYYY-MM-DD'), интервал —
    // целое ≥ 1. Русские сообщения вместо нативных баббл (noValidate выше).
    const rows: Record<number, string> = {}
    careRows.forEach((row, index) => {
      if (row.title.trim() === '') rows[index] = 'Введите заголовок'
      else if (!/^\d+$/.test(row.valueText.trim()) || Number(row.valueText.trim()) < 1) {
        rows[index] = 'Интервал — целое число от 1'
      }
    })
    const nextErrors: FormErrors = {
      name: name.trim() === '' ? 'Введите имя' : undefined,
      species: species.trim() === '' ? 'Укажите вид' : undefined,
      birthDate: birthDate === '' ? 'Укажите дату рождения' : undefined,
      rows: Object.keys(rows).length > 0 ? rows : undefined,
    }
    if (nextErrors.name || nextErrors.species || nextErrors.birthDate || nextErrors.rows) {
      setErrors(nextErrors)
      return
    }

    if (editing) {
      // Фото трогали: выбрали новое (строка) или убрали (undefined → null).
      updateSubject(subject.id, {
        name: name.trim(),
        species: species.trim(),
        birthDate,
        photo: photoTouched ? photo ?? null : undefined,
      })
    } else {
      addSubject({
        name: name.trim(),
        species: species.trim(),
        birthDate,
        ...(photo !== undefined ? { photo } : {}),
        careItems: careRows.map((row) => ({
          title: row.title.trim(),
          interval: { value: Number(row.valueText), unit: row.unit },
        })),
      })
    }
    onClose()
  }

  return (
    <BottomSheet title={editing ? 'Изменить питомца' : 'Новый питомец'} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Имя</span>
          <input
            className={errors.name !== undefined ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Барсик"
            aria-invalid={errors.name !== undefined}
          />
          {errors.name !== undefined && <span className={styles.error}>{errors.name}</span>}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Вид</span>
          <input
            className={errors.species !== undefined ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            placeholder="кот, собака…"
            aria-invalid={errors.species !== undefined}
          />
          {errors.species !== undefined && <span className={styles.error}>{errors.species}</span>}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Дата рождения</span>
          <input
            type="date"
            className={errors.birthDate !== undefined ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            aria-invalid={errors.birthDate !== undefined}
          />
          {errors.birthDate !== undefined && <span className={styles.error}>{errors.birthDate}</span>}
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Фото</span>
          <PhotoInput value={photo} onChange={handlePhotoChange} />
        </div>

        {!editing && (
          <section className={styles.care}>
            <h3 className={styles.careTitle}>Пункты ухода</h3>
            <p className={styles.careHint}>
              Стартовый набор под питомца — правьте названия и интервалы или удалите лишнее.
            </p>
            {careRows.length > 0 && (
              <ul className={styles.careList}>
                {careRows.map((row, index) => {
                  const rowError = errors.rows?.[index]
                  const parsed = Number(row.valueText.trim())
                  const hint =
                    /^\d+$/.test(row.valueText.trim()) && parsed >= 1
                      ? intervalLabel(parsed, row.unit)
                      : null
                  return (
                    <li key={index} className={styles.careRow}>
                      <div className={styles.careRowTop}>
                        <input
                          className={styles.input}
                          value={row.title}
                          onChange={(event) => patchRow(index, { title: event.target.value })}
                          placeholder="Например, стрижка когтей"
                          aria-label={`Заголовок пункта ухода ${index + 1}`}
                          aria-invalid={rowError !== undefined}
                        />
                        <button
                          type="button"
                          className={styles.careRemove}
                          onClick={() => removeRow(index)}
                          aria-label={`Удалить пункт ухода ${index + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                      <div className={styles.careInterval}>
                        <span className={styles.every}>каждые</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          className={`${styles.input} ${styles.careValue}`}
                          value={row.valueText}
                          onChange={(event) => patchRow(index, { valueText: event.target.value })}
                          aria-label={`Интервал пункта ухода ${index + 1}: число`}
                          aria-invalid={rowError !== undefined}
                        />
                        <select
                          className={styles.input}
                          value={row.unit}
                          onChange={(event) => patchRow(index, { unit: event.target.value as IntervalUnit })}
                          aria-label={`Единица интервала пункта ухода ${index + 1}`}
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {hint !== null && <p className={styles.careSummary}>{hint}</p>}
                      {rowError !== undefined && <span className={styles.error}>{rowError}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            {careRows.length === 0 && (
              <p className={styles.careEmpty}>Без пунктов ухода — добавить их можно будет позже.</p>
            )}
          </section>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={styles.primary}>
            Сохранить
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
