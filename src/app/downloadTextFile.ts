/**
 * Общая DOM-механика скачивания текстового файла: Blob → временная ссылка →
 * клик → revoke. Выделена из icsDownload.ts, когда появился второй потребитель
 * — JSON-бэкап (backupDownload.ts, тикет 10): механика одна, три копий её не
 * нужно. Сервера нет (ADR-0001, ADR-0004) — файл рождается целиком в браузере.
 */

/** Скачивает text как файл fileName с заданным MIME type. */
export function downloadTextFile(fileName: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // Firefox кликает только ссылку в документе — она в DOM на один тик.
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
