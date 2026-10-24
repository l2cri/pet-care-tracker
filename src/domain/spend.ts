/**
 * Агрегация расходов на корм по месяцам (ADR-0005, тикет 09: столбики расходов).
 *
 * Чистая функция «записи корма + окно → данные столбиков»: React-компонент
 * SpendBars только рисует готовые корзины. Фильтрацию по подопечному делает
 * вызывающий (UI передаёт уже отфильтрованный список).
 *
 * Даты — локальные строки 'YYYY-MM-DD' без Date и таймзон (ADR-0008): месяц
 * записи выводится целочисленно через parseDate из единой точки входа dates.ts.
 * Цены суммируются в целых копейках, чтобы 0.1 + 0.2 не давали
 * 0.30000000000000004 — тот же принцип гигиены, что и целые граммы веса.
 */

import type { DateString, FeedEntry } from './model'
import { parseDate } from './dates'

/** Один столбик: месяц 'YYYY-MM' и сумма цен покупок этого месяца в рублях. */
export interface MonthSpend {
  monthKey: string
  total: number
}

/**
 * Суммы цен записей корма по месяцам за окно, заканчивающееся месяцем today.
 *
 * Всегда возвращает monthCount (по умолчанию 6) корзин от старейшего месяца к
 * текущему, включая месяцы без покупок (total: 0). Записи вне окна — старше
 * его начала или из будущего относительно today — игнорируются.
 *
 * Бросает RangeError при нецелом или неположительном monthCount
 * (по образцу assertValidInterval в dates.ts).
 */
export function monthlySpend(feed: readonly FeedEntry[], today: DateString, monthCount = 6): MonthSpend[] {
  if (!Number.isInteger(monthCount) || monthCount <= 0) {
    throw new RangeError(`monthCount должен быть целым положительным числом: ${monthCount}`)
  }

  // Абсолютный индекс месяца (год × 12 + месяц) — шкала, на которой окно
  // считается простым вычитанием, без Date и без ветвления на границы года.
  const end = parseDate(today)
  const endIndex = end.year * 12 + (end.month - 1)
  const startIndex = endIndex - monthCount + 1

  const bins: MonthSpend[] = []
  const kopecks: number[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    const year = Math.floor(i / 12)
    const month = (i % 12) + 1
    const pad = (n: number): string => String(n).padStart(2, '0')
    bins.push({ monthKey: `${String(year).padStart(4, '0')}-${pad(month)}`, total: 0 })
    kopecks.push(0)
  }

  for (const entry of feed) {
    const at = parseDate(entry.date)
    const index = at.year * 12 + (at.month - 1)
    if (index < startIndex || index > endIndex) continue
    // Целочисленные копейки: Math.round гасит float-погрешность входной цены.
    kopecks[index - startIndex] += Math.round(entry.price * 100)
  }

  for (let i = 0; i < bins.length; i++) {
    // Деление целых копеек на 100 даёт ближайший к сумме double — тот же
    // результат, что Math.round(x * 100) / 100, но без повторного округления.
    bins[i].total = kopecks[i] / 100
  }
  return bins
}
