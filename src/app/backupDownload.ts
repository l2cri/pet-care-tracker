/**
 * Скачивание JSON-бэкапа (тикет 10; глоссарий «Бэкап»; ADR-0001). Строку JSON
 * с formatVersion собирает storage/backup.ts (exportJson) — в компоненте не
 * появляется ни сериализации, ни имён файлов: экран настроек зовёт
 * downloadBackupJson с состоянием из стора, как PetCard зовёт
 * downloadCareItemCalendar. Blob-механика — общий downloadTextFile.
 */

import type { AppState, DateString } from '../domain/model'
import { exportJson } from '../storage/backup'
import { downloadTextFile } from './downloadTextFile'
import { todayDateString } from './today'

/**
 * Имя файла «pet-care-backup-2026-10-25.json»: только ASCII-буквы, цифры,
 * дефисы и точка — безопасно в любой ОС и файловой системе. Дата — «сегодня»
 * на момент выгрузки (todayDateString), чтобы файлы разных дней не
 * перезаписывали друг друга.
 */
export function backupFileName(today: DateString): string {
  return `pet-care-backup-${today}.json`
}

/** Один клик → скачан JSON-бэкап всего состояния с formatVersion. */
export function downloadBackupJson(state: AppState, fileName?: string): void {
  downloadTextFile(
    fileName ?? backupFileName(todayDateString()),
    exportJson(state),
    'application/json;charset=utf-8',
  )
}
