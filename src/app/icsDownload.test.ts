import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CareItem } from '../domain/model'
import { calendarStart, downloadCareItemCalendar, icsFileName, utcStamp } from './icsDownload'

/**
 * Чистая часть хелпера (имя файла, DTSTAMP, выбор старта) — детерминированные
 * юнит-тесты по образцу domain/ics.test.ts; DOM-часть (Blob + ссылка) — под
 * заглушками jsdom: createObjectURL там нет, клик по ссылке перехватываем.
 */

/** Пункт ухода «Прививка» Барсика — как в эталонах domain/ics.test.ts. */
function vaccine(): CareItem {
  return { id: 'care-1', subjectId: 'subject-1', title: 'Прививка', interval: { value: 12, unit: 'months' } }
}

describe('icsFileName: «пункт — питомец.ics»', () => {
  it('человекочитаемое имя из заголовка и имени подопечного', () => {
    expect(icsFileName('Прививка', 'Барсик')).toBe('Прививка — Барсик.ics')
  })

  it('запрещённые в файлах символы → пробелы, двойные дырки схлопываются', () => {
    expect(icsFileName('Груминг/когти: стрижка', 'Мур*ка?')).toBe('Груминг когти стрижка — Мур ка.ics')
  })
})

describe('utcStamp: DTSTAMP из UTC-компонентов Date', () => {
  it('YYYYMMDDTHHMMSSZ без до-полнения нулями', () => {
    expect(utcStamp(new Date(Date.UTC(2026, 9, 24, 18, 30, 0)))).toBe('20261024T183000Z')
  })

  it('месяц, день и время дополняются до двух цифр', () => {
    expect(utcStamp(new Date(Date.UTC(2026, 0, 5, 3, 4, 5)))).toBe('20260105T030405Z')
  })
})

describe('calendarStart: старт события', () => {
  it('непустой журнал — вычисленный nextDue', () => {
    expect(calendarStart('2026-11-05', '2026-10-25')).toBe('2026-11-05')
  })

  it('пустой журнал («пора сейчас») — сегодня', () => {
    expect(calendarStart(null, '2026-10-25')).toBe('2026-10-25')
  })
})

describe('downloadCareItemCalendar: Blob-обёртка (jsdom)', () => {
  // jsdom не реализует createObjectURL/revokeObjectURL — подменяем на
  // записывающие заглушки и возвращаем оригиналы после каждого теста.
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
      configurable: true,
    })
  })

  /** Заглушки скачивания: собирают Blob, кликнутую ссылку и отозванные URL. */
  function stubDownload(): { blobs: Blob[]; clicked: HTMLAnchorElement[]; revoked: string[] } {
    const blobs: Blob[] = []
    const clicked: HTMLAnchorElement[] = []
    const revoked: string[] = []
    Object.defineProperty(URL, 'createObjectURL', {
      value: (blob: Blob): string => {
        blobs.push(blob)
        return 'blob:ics-stub'
      },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: (url: string): void => {
        revoked.push(url)
      },
      writable: true,
      configurable: true,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
    return { blobs, clicked, revoked }
  }

  it('кликает ссылку с download «Прививка — Барсик.ics» и VCALENDAR из ядра', async () => {
    const { blobs, clicked, revoked } = stubDownload()

    downloadCareItemCalendar({
      item: vaccine(),
      subjectName: 'Барсик',
      nextDue: '2026-11-05',
      today: '2026-10-25',
    })

    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('text/calendar;charset=utf-8')
    const text = await blobs[0].text()
    expect(text).toContain('BEGIN:VCALENDAR')
    // DTSTART — nextDue, SUMMARY — «пункт — питомец» (сборка входа хелпером).
    expect(text).toContain('DTSTART;VALUE=DATE:20261105')
    expect(text).toContain('SUMMARY:Прививка — Барсик')
    // uid и dtStamp недетерминированы — проверяем форму, а не значение.
    expect(text).toMatch(/UID:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\r\n/)
    expect(text).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/)

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('Прививка — Барсик.ics')
    expect(clicked[0].href).toBe('blob:ics-stub')
    expect(revoked).toEqual(['blob:ics-stub'])
  })

  it('пустой журнал — DTSTART сегодня', async () => {
    const { blobs } = stubDownload()

    downloadCareItemCalendar({ item: vaccine(), subjectName: 'Барсик', nextDue: null, today: '2026-10-25' })

    expect(await blobs[0].text()).toContain('DTSTART;VALUE=DATE:20261025')
  })
})
