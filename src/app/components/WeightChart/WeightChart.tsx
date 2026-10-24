/**
 * График веса за всю историю (тикет 08, User Stories 21–22, ADR-0005):
 * чистый SVG без библиотек. Всю геометрию — автоскейл, защитные поля,
 * вырожденные случаи «одна точка / все равны / все в один день» — считает
 * weightLineChart из ядра; компонент только рендерит готовые точки и ловит
 * тап для тултипа. Никакого ховера: мобильный ввод — палец, а не курсор.
 *
 * Цвета и размер шрифта — только через CSS-переменные токенов (ADR-0006),
 * поэтому тёмная тема получается сама, без дублирования значений.
 */

import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'
import type { WeightEntry } from '../../../domain/model'
import { weightLineChart } from '../../../domain/charts'
import type { ViewBox } from '../../../domain/charts'
import { formatDate, formatKg } from '../format'
import styles from './WeightChart.module.css'

/**
 * Холст фиксированный, тянется на ширину карточки пропорционально.
 * Левое поле 64 — под подписи килограммов («80,25 кг» при --font-size-s
 * не наезжает на точки), нижнее 28 — под даты краёв оси X.
 */
const VIEW_BOX: ViewBox = {
  width: 320,
  height: 220,
  padding: { top: 20, right: 20, bottom: 28, left: 64 },
}

/** Оценка ширины символа текста тултипа при --font-size-s (14px). */
const TOOLTIP_CHAR_WIDTH = 7.5
/** Высота плашки тултипа и её горизонтальные поля вокруг текста. */
const TOOLTIP_HEIGHT = 28
const TOOLTIP_INNER_X = 10
/** Отступ плашки от точки по осям до прижима к краю холста. */
const TOOLTIP_GAP = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export interface WeightChartProps {
  /** Вся история замеров подопечного; порядок любой — геометрия сортирует. */
  entries: readonly WeightEntry[]
}

export function WeightChart(props: WeightChartProps): ReactElement | null {
  const { entries } = props
  const [selected, setSelected] = useState<number | null>(null)

  // Пусто — не рендеримся вовсе: пустое состояние с объяснением рисует вкладка.
  const geometry = weightLineChart(entries, VIEW_BOX)
  if (geometry === null) return null

  const { points, yMin, yMax, xFirstDate, xLastDate } = geometry
  const axisY = VIEW_BOX.height - VIEW_BOX.padding.bottom

  // Индекс может остаться от прошлой истории (замер удалили) — тогда тултип
  // просто не находится и тап по фону его не покажет.
  const selectedPoint = selected !== null ? points[selected] : undefined
  let tooltip: { left: number; top: number; width: number; text: string } | undefined
  if (selectedPoint !== undefined) {
    const text = `${formatDate(selectedPoint.date)}, ${formatKg(selectedPoint.grams)}`
    const width = text.length * TOOLTIP_CHAR_WIDTH + TOOLTIP_INNER_X * 2
    // Плашка прижимается внутрь холста: у правого края уходит левее точки,
    // у верхнего — опускается, за границы viewBox ничего не выходит.
    tooltip = {
      width,
      text,
      left: clamp(selectedPoint.x + TOOLTIP_GAP, 2, VIEW_BOX.width - width - 2),
      top: clamp(
        selectedPoint.y - TOOLTIP_HEIGHT - TOOLTIP_GAP,
        2,
        VIEW_BOX.height - TOOLTIP_HEIGHT - 2,
      ),
    }
  }

  // Последний по дате замер — правый край истории; «с … по …» звучит и для
  // единственной точки, поэтому отдельной ветки нет.
  const first = points[0]
  const last = points[points.length - 1]
  const ariaLabel =
    points.length === 1
      ? `График веса: один замер, ${formatKg(first.grams)}`
      : `График веса: с ${formatKg(first.grams)} по ${formatKg(last.grams)}`

  function handlePointTap(
    tapEvent: ReactMouseEvent<SVGCircleElement>,
    index: number,
  ): void {
    // Тап по точке не должен добивать до фона SVG — тот скрывает тултип.
    tapEvent.stopPropagation()
    setSelected((prev) => (prev === index ? null : index))
  }

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      role="img"
      aria-label={ariaLabel}
      onClick={() => setSelected(null)}
    >
      {/* Ось X и подписи краёв шкалы: килограммы слева, даты снизу. */}
      <line
        className={styles.axis}
        x1={VIEW_BOX.padding.left}
        y1={axisY}
        x2={VIEW_BOX.width - VIEW_BOX.padding.right}
        y2={axisY}
      />
      <text
        className={styles.axisLabel}
        x={VIEW_BOX.padding.left - 8}
        y={VIEW_BOX.padding.top + 5}
        textAnchor="end"
      >
        {formatKg(yMax)}
      </text>
      <text className={styles.axisLabel} x={VIEW_BOX.padding.left - 8} y={axisY + 5} textAnchor="end">
        {formatKg(yMin)}
      </text>
      <text className={styles.axisLabel} x={VIEW_BOX.padding.left} y={VIEW_BOX.height - 8}>
        {formatDate(xFirstDate)}
      </text>
      <text
        className={styles.axisLabel}
        x={VIEW_BOX.width - VIEW_BOX.padding.right}
        y={VIEW_BOX.height - 8}
        textAnchor="end"
      >
        {formatDate(xLastDate)}
      </text>

      {/* Линия имеет смысл от двух точек; единственный замер ядро кладёт
          в центр — его рисует видимая точка ниже. */}
      {points.length > 1 && (
        <polyline
          className={styles.line}
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        />
      )}

      {points.map((point, index) => (
        <g key={`${point.date}-${index}`}>
          <circle
            className={
              index === selected ? `${styles.point} ${styles.pointSelected}` : styles.point
            }
            cx={point.x}
            cy={point.y}
            r={4}
            pointerEvents="none"
          />
          {/* Невидимая зона тапа поверх точки: палец в r=4 не попадает. */}
          <circle
            className={styles.hit}
            cx={point.x}
            cy={point.y}
            r={20}
            onClick={(tapEvent) => handlePointTap(tapEvent, index)}
          />
        </g>
      ))}

      {/* Тултип не ловит события: тап мимо плашки закрывает её через фон. */}
      {tooltip !== undefined && (
        <g className={styles.tooltip} pointerEvents="none">
          <rect x={tooltip.left} y={tooltip.top} width={tooltip.width} height={TOOLTIP_HEIGHT} rx={6} />
          <text
            x={tooltip.left + tooltip.width / 2}
            y={tooltip.top + TOOLTIP_HEIGHT / 2 + 5}
            textAnchor="middle"
          >
            {tooltip.text}
          </text>
        </g>
      )}
    </svg>
  )
}
