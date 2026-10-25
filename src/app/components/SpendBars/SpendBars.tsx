/**
 * Столбики расходов на корм по месяцам (тикет 09, User Story 25, ADR-0005):
 * чистый SVG без чартовых библиотек. Данные агрегирует monthlySpend, а
 * геометрию (автоскейл по максимуму, вырожденные случаи, клампинг) считает
 * barsGeometry из domain/spend — компонент только рендерит готовые
 * координаты (ADR-0005: «React-компоненты только рендерят»).
 *
 * Цвета и шрифты — только токены из tokens.css, поэтому тёмная тема
 * подхватывается автоматически, без отдельных классов.
 */

import type { ReactElement } from 'react'
import type { BarsLayout, MonthSpend } from '../../../domain/spend'
import { barsGeometry } from '../../../domain/spend'
import { formatPrice, monthShortLabel, pluralWord } from '../format'
import styles from './SpendBars.module.css'

export interface SpendBarsProps {
  /** Готовые корзины monthlySpend: от старейшего месяца окна к текущему. */
  months: readonly MonthSpend[]
}

/** «месяц / месяца / месяцев» для aria-сводки. */
const MONTH_FORMS = { one: 'месяц', few: 'месяца', many: 'месяцев' } as const

/* Рамка viewBox: слот 56px × 6 столбиков = 336 — влезает в экран от 360px
   вместе с паддингами контента; preserveAspectRatio масштабирует на любую
   ширину. Числа — параметры рамки для barsGeometry, не расчёт. */
const LAYOUT: BarsLayout = {
  slotWidth: 56,
  barWidth: 32,
  topPad: 20,
  plotHeight: 96,
  minBarHeight: 2,
}

/** Высота подписи месяца под базовой линией: нижнее поле рамки. */
const BOTTOM_PAD = 26

export function SpendBars(props: SpendBarsProps): ReactElement {
  const { months } = props

  const geometry = barsGeometry(months, LAYOUT)
  const height = geometry.baseline + BOTTOM_PAD

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${geometry.width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Расходы на корм: последние ${months.length} ${pluralWord(
        months.length,
        MONTH_FORMS,
      )}`}
    >
      <line className={styles.axis} x1={0} y1={geometry.baseline} x2={geometry.width} y2={geometry.baseline} />
      {geometry.bars.map((bar) =>
        bar.height === 0 ? (
          // Нулевой месяц — честная пустая позиция: подпись месяца без столбика и суммы.
          <text key={bar.monthKey} className={styles.monthLabel} x={bar.x} y={height - 8}>
            {monthShortLabel(bar.monthKey)}
          </text>
        ) : (
          <g key={bar.monthKey}>
            <rect
              className={styles.bar}
              x={bar.x - LAYOUT.barWidth / 2}
              y={bar.top}
              width={LAYOUT.barWidth}
              height={bar.height}
              rx={4}
            />
            <text className={styles.valueLabel} x={bar.x} y={bar.top - 5}>
              {formatPrice(bar.total)}
            </text>
            <text className={styles.monthLabel} x={bar.x} y={height - 8}>
              {monthShortLabel(bar.monthKey)}
            </text>
          </g>
        ),
      )}
    </svg>
  )
}
