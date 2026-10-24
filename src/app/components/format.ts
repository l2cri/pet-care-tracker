/**
 * Общее презентационное форматирование app-слоя: русское согласование
 * числительных, подписи интервалов, даты и тексты таймеров срочности.
 *
 * Здесь нет ни календарной арифметики (она в domain/dates), ни React:
 * чистые функции «вход → выход», общие для SubjectSheet, PetCard и
 * дашборда, чтобы одинаковые строки не расползались по компонентам.
 */

import type { DateString, IntervalUnit } from '../../domain/model'

/** Единицы интервала для select: значение — IntervalUnit, подпись — русский родительный множественного. */
export const UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
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
export function pluralWord(value: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return forms.one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few
  return forms.many
}

/** Подпись интервала для человека: «каждый месяц», «каждые 3 месяца», «каждые 2 недели». */
export function intervalLabel(value: number, unit: IntervalUnit): string {
  const forms = UNIT_WORD_FORMS[unit]
  // По-русски не говорят «каждый 1 месяц» — числительное опускается.
  if (value === 1) return `${forms.every} ${forms.one}`
  return `каждые ${value} ${pluralWord(value, forms)}`
}

/** «день / дня / дней» для таймеров срочности: 1 день / 2 дня / 5 дней. */
const DAY_FORMS = { one: 'день', few: 'дня', many: 'дней' } as const

/**
 * 'YYYY-MM-DD' → 'DD.MM.YYYY' чистой нарезкой строки, без Date и таймзон:
 * даты приложения уже локальные строки (ADR-0008), перестановка компонентов
 * безопасна — формат гарантируют домен и storage.
 */
export function formatDate(date: DateString): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
}

/**
 * Текст таймера пункта ухода. days — результат daysUntil(today, nextDue);
 * null — пустой журнал («пора сейчас»). Согласование дней русское:
 * «Просрочено на 1 день», «Через 21 день». Цвет выбирает вызывающий код
 * по urgency из домена — текст и цвет независимы.
 */
export function timerText(days: number | null): string {
  if (days === null) return 'Пора сейчас'
  if (days < 0) return `Просрочено на ${-days} ${pluralWord(-days, DAY_FORMS)}`
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Завтра'
  return `Через ${days} ${pluralWord(days, DAY_FORMS)}`
}

/**
 * Короткий таймер для бейджа карточки на дашборде: строчными и с «дн.»,
 * чтобы уместиться в одну строку рядом с названием пункта.
 */
export function timerTextShort(days: number | null): string {
  if (days === null) return 'пора сейчас'
  if (days < 0) return `просрочено на ${-days} дн.`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `через ${days} дн.`
}

/**
 * Целые граммы → килограммы для вывода (тикет 08): 4000 → «4 кг»,
 * 4100 → «4,1 кг», 4250 → «4,25 кг», 4055 → «4,055 кг». Арифметика только
 * целочисленная (глоссарий «Замер веса»): килограммы — Math.floor, остаток —
 * %, дробь — строка срезанными хвостовыми нулями, поэтому float-погрешности
 * в весе не появляются никогда. Разделитель — запятая, как в русском вводе.
 */
export function formatKg(grams: number): string {
  const kg = Math.floor(grams / 1000)
  const remainder = grams % 1000
  if (remainder === 0) return `${kg} кг`
  const fraction = String(remainder).padStart(3, '0').replace(/0+$/, '')
  return `${kg},${fraction} кг`
}
