import { describe, expect, it } from 'vitest'
import { presetCareItemDrafts } from './presets'

/** Набор из спеки: прививки — 12 месяцев, паразиты — 3 месяца, груминг — 2 месяца. */
const specSet = [
  { title: 'Прививка', interval: { value: 12, unit: 'months' } },
  { title: 'Обработка от паразитов', interval: { value: 3, unit: 'months' } },
  { title: 'Груминг', interval: { value: 2, unit: 'months' } },
]

describe('presetCareItemDrafts: пресетный набор ухода', () => {
  it('возвращает набор из спеки', () => {
    expect(presetCareItemDrafts()).toEqual(specSet)
  })

  it('каждый вызов даёт свежие объекты: правки формы не протекают в следующий набор', () => {
    const first = presetCareItemDrafts()
    first[0].title = 'Изменено в форме'
    first[1].interval.value = 99
    first.pop()

    expect(presetCareItemDrafts()).toEqual(specSet)
  })
})
