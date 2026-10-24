/**
 * Нормализация данных для графиков (ADR-0005).
 *
 * Чистая функция «замеры + viewBox → геометрия»: ни одного объекта Date и ни
 * одного UTC-преобразования — день-офсеты считает публичный diffInDays из
 * dates.ts (ADR-0008). Вся математика линии (автоскейл, защитные поля,
 * вырожденные случаи) живёт здесь и проверяется юнит-тестами, а React-компонент
 * только рендерит готовые точки и ловит тап для тултипа.
 */

import { diffInDays } from './dates'
import type { DateString, WeightEntry } from './model'

/** Защитные поля внутри viewBox: со всех сторон от краёв до области данных. */
export interface ChartPadding {
  top: number
  right: number
  bottom: number
  left: number
}

/** Размер и поля SVG-холста, на котором разложится линия. */
export interface ViewBox {
  width: number
  height: number
  padding: ChartPadding
}

/** Замер и его точка в пикселях viewBox. */
export interface WeightPointGeometry {
  date: DateString
  grams: number
  x: number
  y: number
}

/** Готовая геометрия линии веса: рендер, тултип и подписи осей берут её как есть. */
export interface WeightLineGeometry {
  /** По возрастанию даты; замеры одной даты сохраняют относительный порядок входа. */
  points: WeightPointGeometry[]
  /** Граммы на нижней границе шкалы Y — для подписи оси. */
  yMin: number
  /** Граммы на верхней границе шкалы Y. */
  yMax: number
  /** Дата первого замера — подпись левого края оси X. */
  xFirstDate: DateString
  /** Дата последнего замера — подпись правого края. */
  xLastDate: DateString
}

/**
 * Нормализация замеров → геометрия линии внутри viewBox.
 * null — замеров нет (пустое состояние рисует UI).
 *
 * X — по календарным дням от первой даты, а не по индексу: пропуски во времени
 * видны на графике как ровные участки. Y — автоскейл по min/max граммов:
 * min ровно на нижней границе внутренней области, max — на верхней. Вырожденные
 * случаи (одна точка, все значения равны, все замеры в один день) дают
 * центр/растяжку без деления на ноль (ADR-0005).
 */
export function weightLineChart(
  entries: readonly WeightEntry[],
  viewBox: ViewBox,
): WeightLineGeometry | null {
  if (entries.length === 0) return null

  // Вход может приходить неотсортированным; копия — чтобы не мутировать чужой массив.
  // 'YYYY-MM-DD' сравнивается лексикографически так же, как хронологически,
  // а sort стабилен — замеры одной даты сохраняют относительный порядок входа.
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const innerLeft = viewBox.padding.left
  const innerRight = viewBox.width - viewBox.padding.right
  const innerTop = viewBox.padding.top
  const innerBottom = viewBox.height - viewBox.padding.bottom
  const innerWidth = innerRight - innerLeft
  const innerHeight = innerBottom - innerTop

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  // День-офсеты от первой даты: первая точка на левом краю, последняя — на правом.
  const totalDays = diffInDays(first.date, last.date)
  const xOf = (date: DateString): number =>
    totalDays === 0
      ? innerLeft + innerWidth / 2 // все замеры в один день — центр, без деления на ноль
      : innerLeft + (diffInDays(first.date, date) / totalDays) * innerWidth

  // Минимум и максимум граммов — единственный источник шкалы Y (автоскейл ADR-0005).
  let yMin = sorted[0].grams
  let yMax = sorted[0].grams
  for (const entry of sorted) {
    if (entry.grams < yMin) yMin = entry.grams
    if (entry.grams > yMax) yMax = entry.grams
  }
  const yOf = (grams: number): number =>
    yMin === yMax
      ? innerTop + innerHeight / 2 // все значения равны — горизонтальная линия по центру
      : innerBottom - ((grams - yMin) / (yMax - yMin)) * innerHeight

  return {
    points: sorted.map((entry) => ({
      date: entry.date,
      grams: entry.grams,
      x: xOf(entry.date),
      y: yOf(entry.grams),
    })),
    yMin,
    yMax,
    xFirstDate: first.date,
    xLastDate: last.date,
  }
}
