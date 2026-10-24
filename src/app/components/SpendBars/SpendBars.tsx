/**
 * Столбики расходов на корм по месяцам (тикет 09, User Story 25, ADR-0005):
 * чистый SVG без чартовых библиотек. Данные уже агрегированы ядром —
 * monthlySpend из domain/spend зовёт вызывающий и передаёт корзины
 * «месяц → сумма»; здесь остаётся только презентационный масштаб по
 * максимуму окна и отрисовка готовых чисел.
 *
 * Защита от вырождения: max(total, 1) — окно из одних нулей не делит на
 * ноль, нулевые месяцы остаются честными пустыми позициями с подписью.
 * Цвета и шрифты — только токены из tokens.css, поэтому тёмная тема
 * подхватывается автоматически, без отдельных классов.
 */

import type { ReactElement } from 'react'
import type { MonthSpend } from '../../../domain/spend'
import { formatPrice, monthShortLabel, pluralWord } from '../format'
import styles from './SpendBars.module.css'

export interface SpendBarsProps {
  /** Готовые корзины monthlySpend: от старейшего месяца окна к текущему. */
  months: readonly MonthSpend[]
}

/** «месяц / месяца / месяцев» для aria-сводки. */
const MONTH_FORMS = { one: 'месяц', few: 'месяца', many: 'месяцев' } as const

/* Геометрия в координатах viewBox: слот 56px × 6 столбиков = 336 — влезает
   в экран от 360px вместе с паддингами контента; preserveAspectRatio
   масштабирует картинку на любую ширину. */
const SLOT_WIDTH = 56
const BAR_WIDTH = 32
const TOP_PAD = 20
const PLOT_HEIGHT = 96
const BOTTOM_PAD = 26
/** Крохотная ненулевая сумма на фоне гиганта — минимум видимой высоты. */
const MIN_BAR_HEIGHT = 2

export function SpendBars(props: SpendBarsProps): ReactElement {
  const { months } = props

  // Пустой массив не схлопывает viewBox (месячный контракт — 6 корзин).
  const width = Math.max(months.length, 1) * SLOT_WIDTH
  const height = TOP_PAD + PLOT_HEIGHT + BOTTOM_PAD
  const plotBottom = TOP_PAD + PLOT_HEIGHT
  const maxTotal = Math.max(...months.map((month) => month.total), 1)

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Расходы на корм: последние ${months.length} ${pluralWord(
        months.length,
        MONTH_FORMS,
      )}`}
    >
      <line className={styles.axis} x1={0} y1={plotBottom} x2={width} y2={plotBottom} />
      {months.map((month, index) => {
        const center = index * SLOT_WIDTH + SLOT_WIDTH / 2
        // Нулевой месяц — честная пустая позиция: подпись месяца без столбика и суммы.
        if (month.total <= 0) {
          return (
            <text key={month.monthKey} className={styles.monthLabel} x={center} y={height - 8}>
              {monthShortLabel(month.monthKey)}
            </text>
          )
        }
        const barHeight = Math.max((month.total / maxTotal) * PLOT_HEIGHT, MIN_BAR_HEIGHT)
        const barTop = plotBottom - barHeight
        return (
          <g key={month.monthKey}>
            <rect
              className={styles.bar}
              x={center - BAR_WIDTH / 2}
              y={barTop}
              width={BAR_WIDTH}
              height={barHeight}
              rx={4}
            />
            <text className={styles.valueLabel} x={center} y={barTop - 5}>
              {formatPrice(month.total)}
            </text>
            <text className={styles.monthLabel} x={center} y={height - 8}>
              {monthShortLabel(month.monthKey)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
