/**
 * График веса за всю историю (тикет 08, User Stories 21–22, ADR-0005):
 * чистый SVG без библиотек. Всю геометрию — автоскейл, защитные поля,
 * вырожденные случаи «одна точка / все равны / все в один день» — считает
 * weightLineChart из ядра; компонент только рендерит готовые точки и ловит
 * тап для тултипа. Никакого ховера: мобильный ввод — палец, а не курсор.
 *
 * Тап ловит один прозрачный слой поверх всего холста и выбирает ближайшую
 * точку в радиусе: у плотной истории зоны тапа не перекрываются и каждая
 * точка доступна. Выбор хранится по id замера — удалённая точка уносит
 * тултип с собой, а не «наследует» соседнюю.
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

/**
 * Оценка ширины символа текста тултипа при --font-size-s (14px) — с запасом
 * под широкие глифы («м», «кг»), чтобы длинные даты не вылезали за плашку.
 */
const TOOLTIP_CHAR_WIDTH = 8.2
/** Высота плашки тултипа и её горизонтальные поля вокруг текста. */
const TOOLTIP_HEIGHT = 28
const TOOLTIP_INNER_X = 10
/** Отступ плашки от точки по осям до прижима к краю холста. */
const TOOLTIP_GAP = 12
/** Радиус тапа вокруг ближайшей точки в единицах viewBox; дальше — тап по фону. */
const TAP_RADIUS = 30

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export interface WeightChartProps {
  /** Вся история замеров подопечного; порядок любой — геометрия сортирует. */
  entries: readonly WeightEntry[]
}

export function WeightChart(props: WeightChartProps): ReactElement | null {
  const { entries } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Пусто — не рендеримся вовсе: пустое состояние с объяснением рисует вкладка.
  const geometry = weightLineChart(entries, VIEW_BOX)
  if (geometry === null) return null

  const { points, yMin, yMax, xFirstDate, xLastDate } = geometry
  const axisY = VIEW_BOX.height - VIEW_BOX.padding.bottom

  // Выбор живёт по id: после удаления замера (или нескольких одной даты)
  // тултип исчезает вместе с ним, а не указывает на чужую точку.
  const selectedPoint = points.find((point) => point.id === selectedId)
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

  function handleTap(tapEvent: ReactMouseEvent<SVGRectElement>): void {
    // Координаты тапа → единицы viewBox: холст растянут на ширину карточки.
    const svgRect = tapEvent.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (svgRect === undefined) return
    const x = ((tapEvent.clientX - svgRect.left) / svgRect.width) * VIEW_BOX.width
    const y = ((tapEvent.clientY - svgRect.top) / svgRect.height) * VIEW_BOX.height

    let nearestId: string | null = null
    let nearestDistanceSquared = Infinity
    for (const point of points) {
      const distanceSquared = (point.x - x) ** 2 + (point.y - y) ** 2
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared
        nearestId = point.id
      }
    }
    // Дальше радиуса от любой точки — это тап по фону: скрываем тултип.
    if (nearestId === null || nearestDistanceSquared > TAP_RADIUS * TAP_RADIUS) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => (prev === nearestId ? null : nearestId))
  }

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Ось X и подписи краёв шкалы: килограммы слева, даты снизу.
          Равные min и max (одна точка или ровная история) — одно значение,
          без дубля на обоих краях несуществующей шкалы. */}
      <line
        className={styles.axis}
        x1={VIEW_BOX.padding.left}
        y1={axisY}
        x2={VIEW_BOX.width - VIEW_BOX.padding.right}
        y2={axisY}
      />
      {yMin === yMax ? (
        <text
          className={styles.axisLabel}
          x={VIEW_BOX.padding.left - 8}
          y={(VIEW_BOX.padding.top + axisY) / 2 + 5}
          textAnchor="end"
        >
          {formatKg(yMin)}
        </text>
      ) : (
        <>
          <text
            className={styles.axisLabel}
            x={VIEW_BOX.padding.left - 8}
            y={VIEW_BOX.padding.top + 5}
            textAnchor="end"
          >
            {formatKg(yMax)}
          </text>
          <text
            className={styles.axisLabel}
            x={VIEW_BOX.padding.left - 8}
            y={axisY + 5}
            textAnchor="end"
          >
            {formatKg(yMin)}
          </text>
        </>
      )}
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

      {points.map((point) => (
        <circle
          key={point.id}
          className={
            point.id === selectedId ? `${styles.point} ${styles.pointSelected}` : styles.point
          }
          cx={point.x}
          cy={point.y}
          r={4}
          pointerEvents="none"
        />
      ))}

      {/* Тултип не ловит события: тап мимо плашки обрабатывает слой ниже. */}
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

      {/* Единственный приёмник тапов — поверх всего холста: ближайшая точка
          в радиусе выбирается, тап дальше всех точек скрывает тултип. */}
      <rect
        className={styles.hit}
        x={0}
        y={0}
        width={VIEW_BOX.width}
        height={VIEW_BOX.height}
        onClick={handleTap}
      />
    </svg>
  )
}
