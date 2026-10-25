import { describe, expect, it } from 'vitest'
import { weightLineChart } from './charts'
import type { ViewBox } from './charts'
import type { DateString, WeightEntry } from './model'

/** Замер подопечного subject-1: нормализации важны только дата и граммы. */
function w(id: string, date: DateString, grams: number): WeightEntry {
  return { id, subjectId: 'subject-1', date, grams }
}

/**
 * Базовый холст 320×200 с полями 24 со всех сторон: внутренняя область
 * [24, 296] × [24, 176], внутренняя ширина 272 и высота 152, центр (160, 100).
 * Круглые числа выбраны, чтобы ожидаемые координаты считались руками.
 */
const VB: ViewBox = {
  width: 320,
  height: 200,
  padding: { top: 24, right: 24, bottom: 24, left: 24 },
}

describe('weightLineChart: нормализация замеров в геометрию (ADR-0005)', () => {
  it('пустой вход → null: пустое состояние рисует UI', () => {
    expect(weightLineChart([], VB)).toBeNull()
  })

  it('автоскейл Y: min ровно на нижней границе, max — на верхней, середина пропорционально', () => {
    // Офсеты дней от 2026-07-01: 0 / 10 / 31 (в июле 31 день). Граммы: min 4000, max 4500.
    const geometry = weightLineChart(
      [w('a', '2026-07-01', 4000), w('b', '2026-07-11', 4500), w('c', '2026-08-01', 4250)],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для трёх замеров')
    expect(geometry.yMin).toBe(4000)
    expect(geometry.yMax).toBe(4500)
    expect(geometry.xFirstDate).toBe('2026-07-01')
    expect(geometry.xLastDate).toBe('2026-08-01')
    // min 4000 → нижняя граница 176, max 4500 → верхняя 24; по X первая и
    // последняя даты — точно края внутренней области
    expect(geometry.points[0]).toMatchObject({ x: 24, y: 176 })
    // max 4500 на 10-й из 31 дня: x = 24 + (10/31)·272 = 24 + 2720/31 ≈ 111.7419355
    expect(geometry.points[1].x).toBeCloseTo(111.7419355, 6)
    expect(geometry.points[1].y).toBe(24)
    // последняя точка — середина шкалы: 4250 = 4000 + 0.5·(4500−4000) → y = 176 − 0.5·152 = 100
    expect(geometry.points[2]).toMatchObject({ x: 296, y: 100 })
  })

  it('X — по календарю, а не по индексу: замер через месяц правее, чем через день', () => {
    const geometry = weightLineChart(
      [w('a', '2026-07-01', 4200), w('b', '2026-07-02', 4300), w('c', '2026-08-01', 4400)],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для трёх замеров')
    // По индексу вторая точка сидела бы в середине (160). Календарно: 1 день из 31
    // от первой даты → x = 24 + (1/31)·272 = 24 + 272/31 ≈ 32.7741935 — у левого края.
    expect(geometry.points[1].x).toBeCloseTo(32.7741935, 6)
    // 31 день из 31 — ровно правый край
    expect(geometry.points[2].x).toBe(296)
  })

  it('защитные поля: ни одна точка не выходит за внутренний прямоугольник', () => {
    // Асимметричные поля: внутренняя область [30, 250] × [10, 140]
    const viewBox: ViewBox = {
      width: 300,
      height: 180,
      padding: { top: 10, right: 50, bottom: 40, left: 30 },
    }
    const geometry = weightLineChart(
      [
        w('a', '2026-01-31', 5000),
        w('b', '2026-02-28', 4800),
        w('c', '2026-03-31', 5200),
        w('d', '2026-04-30', 5100),
      ],
      viewBox,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для четырёх замеров')
    for (const point of geometry.points) {
      expect(point.x).toBeGreaterThanOrEqual(30)
      expect(point.x).toBeLessThanOrEqual(250)
      expect(point.y).toBeGreaterThanOrEqual(10)
      expect(point.y).toBeLessThanOrEqual(140)
    }
  })

  it('одна точка — ровно центр внутренней области, yMin === yMax', () => {
    const geometry = weightLineChart([w('solo', '2026-07-01', 4200)], VB)
    if (geometry === null) throw new Error('ожидалась геометрия для одного замера')
    // центр [24, 296] × [24, 176] = (160, 100); деления на ноль нет ни по X, ни по Y
    expect(geometry.points[0]).toMatchObject({ x: 160, y: 100 })
    expect(geometry.yMin).toBe(4200)
    expect(geometry.yMax).toBe(4200)
    expect(geometry.xFirstDate).toBe('2026-07-01')
    expect(geometry.xLastDate).toBe('2026-07-01')
  })

  it('все значения равны — горизонтальная линия по центру, yMin === yMax, без NaN', () => {
    const geometry = weightLineChart(
      [w('a', '2026-07-01', 4200), w('b', '2026-07-11', 4200), w('c', '2026-08-01', 4200)],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для трёх замеров')
    // X по-прежнему растянут по календарю: края 24 и 296; Y — центр 100 у всех
    expect(geometry.points.map((p) => p.y)).toEqual([100, 100, 100])
    expect(geometry.points[0].x).toBe(24)
    expect(geometry.points[2].x).toBe(296)
    expect(geometry.yMin).toBe(4200)
    expect(geometry.yMax).toBe(4200)
    for (const point of geometry.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
  })

  it('неотсортированный вход → points по возрастанию даты, id замеров при них', () => {
    const geometry = weightLineChart(
      [w('late', '2026-08-01', 4300), w('early', '2026-07-01', 4200), w('mid', '2026-07-11', 4250)],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для трёх замеров')
    expect(geometry.points.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-11', '2026-08-01'])
    // id приезжает с замером: рендер берёт его ключом, тултип — адресом выбора
    expect(geometry.points.map((p) => p.id)).toEqual(['early', 'mid', 'late'])
    expect(geometry.xFirstDate).toBe('2026-07-01')
    expect(geometry.xLastDate).toBe('2026-08-01')
  })

  it('две записи одной даты: один x, относительный порядок входа сохранён', () => {
    const geometry = weightLineChart(
      [
        w('first', '2026-07-01', 4200),
        w('later', '2026-08-01', 4300),
        w('heavy', '2026-07-11', 4500), // нарочно раньше лёгкого во входе
        w('light', '2026-07-11', 4000),
      ],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для четырёх замеров')
    // Оба замера 2026-07-11 на одном x = 24 + (10/31)·272; порядок входа не перевернулся:
    // сначала heavy (4500), затем light (4000) — id при точках подтверждает порядок.
    expect(geometry.points[1].x).toBeCloseTo(geometry.points[2].x, 10)
    expect(geometry.points[1].x).toBeCloseTo(111.7419355, 6)
    expect(geometry.points.map((p) => p.id)).toEqual(['first', 'heavy', 'light', 'later'])
    expect(geometry.points.map((p) => p.grams)).toEqual([4200, 4500, 4000, 4300])
    // и та же дата не сломала шкалу: min внизу, max вверху
    expect(geometry.points[1].y).toBe(24)
    expect(geometry.points[2].y).toBe(176)
  })

  it('все замеры в один день: x у всех центр, Y растянута по min/max', () => {
    const geometry = weightLineChart(
      [w('a', '2026-07-01', 4000), w('b', '2026-07-01', 4500)],
      VB,
    )
    if (geometry === null) throw new Error('ожидалась геометрия для двух замеров')
    // ось X вырождена (0 дней) — центр 160; ось Y работает: min внизу, max вверху
    expect(geometry.points[0]).toMatchObject({ x: 160, y: 176 })
    expect(geometry.points[1]).toMatchObject({ x: 160, y: 24 })
    expect(geometry.yMin).toBe(4000)
    expect(geometry.yMax).toBe(4500)
    expect(geometry.xFirstDate).toBe('2026-07-01')
    expect(geometry.xLastDate).toBe('2026-07-01')
  })

  it('чистая функция: входной массив не мутируется', () => {
    const entries = [w('a', '2026-07-11', 4500), w('b', '2026-07-01', 4000)]
    const snapshot = entries.map((entry) => ({ ...entry }))
    weightLineChart(entries, VB)
    expect(entries).toEqual(snapshot)
  })

  it('все координаты конечны во всех сценариях, включая вырожденные', () => {
    const scenarios: WeightEntry[][] = [
      [w('a', '2026-07-01', 4000), w('b', '2026-07-11', 4500), w('c', '2026-08-01', 4250)],
      [w('solo', '2026-07-01', 4000)],
      [w('e1', '2026-07-01', 4200), w('e2', '2026-08-01', 4200)],
      [w('d1', '2026-07-01', 4000), w('d2', '2026-07-01', 4500)],
    ]
    for (const entries of scenarios) {
      const geometry = weightLineChart(entries, VB)
      if (geometry === null) throw new Error(`ожидалась геометрия для ${entries.length} замеров`)
      for (const point of geometry.points) {
        expect(Number.isFinite(point.x)).toBe(true)
        expect(Number.isFinite(point.y)).toBe(true)
      }
    }
  })
})
