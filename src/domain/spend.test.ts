import { describe, expect, it } from 'vitest'
import type { FeedEntry } from './model'
import { barsGeometry, monthlySpend } from './spend'

/** Минимальная запись корма для агрегации: дата и цена, остальные поля — константы. */
function feed(date: string, price: number): FeedEntry {
  return {
    id: `feed-${date}-${price}`,
    subjectId: 'subject-1',
    date,
    foodName: 'Корм',
    price,
    verdict: 'ok',
  }
}

/** Ключи месяцев корзин: ['2026-05', …] → читаемое сравнение целиком. */
function monthKeys(bins: ReturnType<typeof monthlySpend>): string[] {
  return bins.map((b) => b.monthKey)
}

describe('monthlySpend: окно и корзины', () => {
  it('пустой список: ровно 6 нулевых корзин, окно заканчивается месяцем today', () => {
    const bins = monthlySpend([], '2026-10-15')
    expect(bins).toHaveLength(6)
    expect(monthKeys(bins)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(bins.every((b) => b.total === 0)).toBe(true)
  })

  it('покупки разных месяцев окна ложатся в свои корзины, месяцы без покупок остаются нулевыми', () => {
    const bins = monthlySpend(
      [feed('2026-05-03', 1500), feed('2026-08-20', 2000), feed('2026-10-01', 900)],
      '2026-10-15',
    )
    expect(bins).toEqual([
      { monthKey: '2026-05', total: 1500 },
      { monthKey: '2026-06', total: 0 },
      { monthKey: '2026-07', total: 0 },
      { monthKey: '2026-08', total: 2000 },
      { monthKey: '2026-09', total: 0 },
      { monthKey: '2026-10', total: 900 },
    ])
  })

  it('несколько покупок одного месяца суммируются в одну корзину', () => {
    const bins = monthlySpend(
      [feed('2026-07-02', 1200.5), feed('2026-07-25', 300.25), feed('2026-07-31', 99.25)],
      '2026-07-31',
    )
    const july = bins.find((b) => b.monthKey === '2026-07')
    expect(july?.total).toBe(1600)
  })

  it('переход через границу года: декабрь 2025 и январь 2026 — соседние корзины', () => {
    // Порядок записей в массиве не важен — специально подан вразнобой.
    const bins = monthlySpend(
      [
        feed('2026-01-05', 400),
        feed('2025-12-10', 1200),
        feed('2025-08-01', 500),
        feed('2025-11-17', 800),
        feed('2025-09-30', 600),
        feed('2025-10-22', 700),
      ],
      '2026-01-15',
    )
    expect(monthKeys(bins)).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
    expect(bins.map((b) => b.total)).toEqual([500, 600, 700, 800, 1200, 400])
  })

  it('записи старше окна и из будущего относительно today игнорируются', () => {
    const bins = monthlySpend(
      [
        feed('2024-01-01', 500), // задолго до окна
        feed('2025-12-31', 9999), // месяц, соседний с окном снизу
        feed('2026-03-08', 100), // внутри окна
        feed('2026-07-01', 777), // месяц, соседний с окном сверху
        feed('2027-03-05', 888), // заметно из будущего
      ],
      '2026-06-10',
    )
    expect(bins).toHaveLength(6)
    expect(monthKeys(bins)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'])
    expect(bins.map((b) => b.total)).toEqual([0, 0, 100, 0, 0, 0])
  })

  it('гранулярность окна — месяц: покупка позже дня today, но в текущем месяце, попадает в корзину', () => {
    // Окно «заканчивается месяцем today» (контракт): 20-е число при today 15-го
    // — это тот же последний месяц окна, а не будущее.
    const bins = monthlySpend([feed('2026-10-20', 250)], '2026-10-15')
    expect(bins[bins.length - 1]).toEqual({ monthKey: '2026-10', total: 250 })
  })
})

describe('monthlySpend: float-гигиена цен', () => {
  it('0.1 + 0.2 дают ровно 0.3, а не 0.30000000000000004', () => {
    const bins = monthlySpend([feed('2026-09-01', 0.1), feed('2026-09-28', 0.2)], '2026-09-30')
    const september = bins.find((b) => b.monthKey === '2026-09')
    expect(september?.total).toBe(0.3)
  })

  it('копейки округляются до целых: цена с float-хвостом не ломает сумму', () => {
    // 10.01 × 100 = 1000.9999999999999 → округляется до 1001 копейки.
    const bins = monthlySpend([feed('2026-02-10', 10.01), feed('2026-02-11', 0.04)], '2026-02-28')
    const february = bins.find((b) => b.monthKey === '2026-02')
    expect(february?.total).toBe(10.05)
  })
})

describe('monthlySpend: monthCount', () => {
  it('нестандартный monthCount: окно из 3 месяцев', () => {
    const bins = monthlySpend([feed('2026-08-31', 700)], '2026-10-15', 3)
    expect(monthKeys(bins)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(bins.map((b) => b.total)).toEqual([700, 0, 0])
  })

  it('monthCount = 1: только текущий месяц', () => {
    const bins = monthlySpend([], '2026-10-15', 1)
    expect(monthKeys(bins)).toEqual(['2026-10'])
  })

  it('некорректный monthCount бросает RangeError', () => {
    expect(() => monthlySpend([], '2026-10-15', 0)).toThrow(RangeError)
    expect(() => monthlySpend([], '2026-10-15', -2)).toThrow(RangeError)
    expect(() => monthlySpend([], '2026-10-15', 2.5)).toThrow(RangeError)
  })
})

/** Компактная рамка для тестов геометрии: числа подобраны под простые пропорции. */
const LAYOUT = { slotWidth: 50, barWidth: 30, topPad: 10, plotHeight: 100, minBarHeight: 2 }

/** Корзины без агрегации — геометрии достаточно monthKey/total. */
function bins(totals: number[]): ReturnType<typeof monthlySpend> {
  return totals.map((total, index) => ({ monthKey: `2026-${String(index + 5).padStart(2, '0')}`, total }))
}

describe('barsGeometry: геометрия столбиков (ADR-0005)', () => {
  it('высоты пропорциональны максимуму окна, координаты — по слотам', () => {
    const geometry = barsGeometry(bins([1000, 500, 0]), LAYOUT)
    expect(geometry.width).toBe(150) // 3 слота × 50
    expect(geometry.baseline).toBe(110) // topPad + plotHeight
    expect(geometry.bars).toEqual([
      { monthKey: '2026-05', x: 25, top: 10, height: 100, total: 1000 },
      { monthKey: '2026-06', x: 75, top: 60, height: 50, total: 500 },
      { monthKey: '2026-07', x: 125, top: 110, height: 0, total: 0 },
    ])
  })

  it('окно из одних нулей не делит на ноль: все высоты 0', () => {
    const geometry = barsGeometry(bins([0, 0, 0, 0]), LAYOUT)
    expect(geometry.bars.every((bar) => bar.height === 0 && bar.top === geometry.baseline)).toBe(true)
  })

  it('крохотная сумма на фоне гиганта клампится к minBarHeight', () => {
    const geometry = barsGeometry(bins([1, 10000]), LAYOUT)
    expect(geometry.bars[0]!.height).toBe(2)
    expect(geometry.bars[0]!.top).toBe(108) // baseline − minBarHeight
    expect(geometry.bars[1]!.height).toBe(100)
  })

  it('пустой список — пустой рисунок, viewBox не схлопывается', () => {
    const geometry = barsGeometry([], LAYOUT)
    expect(geometry.bars).toEqual([])
    expect(geometry.width).toBe(0)
    expect(geometry.baseline).toBe(110)
  })

  it('некорректная рамка бросает RangeError', () => {
    expect(() => barsGeometry(bins([1]), { ...LAYOUT, slotWidth: 0 })).toThrow(RangeError)
    expect(() => barsGeometry(bins([1]), { ...LAYOUT, plotHeight: -5 })).toThrow(RangeError)
    expect(() => barsGeometry(bins([1]), { ...LAYOUT, barWidth: 51 })).toThrow(RangeError)
  })
})
