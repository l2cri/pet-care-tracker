import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../domain/model'
import { demoData } from '../domain/demoData'
import { exportJson } from '../storage/backup'
import { backupFileName, downloadBackupJson } from './backupDownload'

/**
 * Внешнее поведение хелпера бэкапа (тикет 10): имя файла и Blob-механика —
 * по образцу icsDownload.test.ts: jsdom без createObjectURL, клик по ссылке
 * перехватываем, строку JSON даёт storage (exportJson), её содержание здесь
 * не перепроверяем — это backup.test.ts.
 */

/** Демо-набор на фиксированное «сегодня» — живое состояние с историей. */
function state(): AppState {
  return demoData('2026-10-25')
}

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
      return 'blob:backup-stub'
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

describe('backupFileName: ASCII-имя с датой выгрузки', () => {
  it('pet-care-backup-YYYY-MM-DD.json — только латиница, цифры, дефисы и точка', () => {
    expect(backupFileName('2026-10-25')).toBe('pet-care-backup-2026-10-25.json')
    expect(backupFileName('2027-01-05')).toMatch(/^pet-care-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('downloadBackupJson: Blob-обёртка (jsdom)', () => {
  it('кликает ссылку с данным именем и JSON из storage (exportJson)', async () => {
    const { blobs, clicked, revoked } = stubDownload()

    downloadBackupJson(state(), 'pet-care-backup-2026-10-25.json')

    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('application/json;charset=utf-8')
    expect(await blobs[0].text()).toBe(exportJson(state()))

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('pet-care-backup-2026-10-25.json')
    expect(clicked[0].href).toBe('blob:backup-stub')
    expect(revoked).toEqual(['blob:backup-stub'])
  })

  it('без имени файла берёт «сегодня»: pet-care-backup-YYYY-MM-DD.json', () => {
    const { clicked } = stubDownload()

    downloadBackupJson(state())

    expect(clicked[0].download).toMatch(/^pet-care-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })
})
