/**
 * JSON-бэкап всего состояния (глоссарий: «Бэкап»; ADR-0001).
 *
 * Формат — конверт { formatVersion, state }. Тот же конверт физически лежит
 * и в localStorage (localStorageRepo.ts): одна точка миграций по formatVersion.
 * Импорт валидирует каждый тип и каждое поле; неправильный файл отклоняется
 * целиком — текущее состояние не меняется, пока парсинг не прошёл успешно.
 *
 * Валидация дат — доменовой функцией isValidDateString (ADR-0008), storage
 * собственную календарную логику не дублирует.
 */

import { isValidDateString } from '../domain/dates'
import type { AppState } from '../domain/model'

/** Текущая версия формата. Меняется при смене схемы данных — вместе с шагом миграции ниже. */
export const CURRENT_FORMAT_VERSION = 1

/** Конверт бэкапа: то, что физически лежит в файле и в localStorage. */
export interface StorageEnvelope {
  formatVersion: number
  state: AppState
}

/** Ошибка импорта: сообщение на русском показывается пользователю в настройках (тикет 10). */
export class BackupImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupImportError'
  }
}

/** Конверт до валидации: state ещё неизвестного вида (миграция работает с таким). */
interface RawEnvelope {
  formatVersion: number
  state: unknown
}

/**
 * Миграции конверта с версии n на n + 1. Пока версия формата одна, реестр
 * пуст; при появлении версии 2 здесь появится шаг 1 → 2 — и старые бэкапы
 * и localStorage начнут подниматься без переписывания этого модуля.
 */
const migrations: Partial<Record<number, (envelope: RawEnvelope) => RawEnvelope>> = {}

/** Пропущенное поле/коллекция/тип — ошибка с адресом поля. */
function fail(path: string, expected: string): never {
  throw new BackupImportError(`Некорректный бэкап: ${path} — ожидается ${expected}`)
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'объект')
  return value as Record<string, unknown>
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'массив')
  return value
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'строка')
  return value
}

/** Локальная дата 'YYYY-MM-DD' — валидируется доменом (ADR-0008). */
function asDate(value: unknown, path: string): string {
  const date = asString(value, path)
  if (!isValidDateString(date)) fail(path, 'дата в формате YYYY-MM-DD')
  return date
}

function asInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(path, 'целое число')
  return value
}

function asPositiveInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(path, 'положительное целое число')
  }
  return value
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'число')
  return value
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'true или false')
  return value
}

function asEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  const option = asString(value, path)
  if (!allowed.includes(option as T)) fail(path, `одно из: ${allowed.join(' / ')}`)
  return option as T
}

/** Опциональное поле (note, photo): отсутствует или строка — null не допускается. */
function asOptionalString(value: unknown, path: string): void {
  if (value !== undefined) asString(value, path)
}

function validateSubject(value: unknown, path: string): void {
  const subject = asObject(value, path)
  asString(subject.id, `${path}.id`)
  asEnum(subject.type, `${path}.type`, ['pet', 'item', 'plant'])
  asString(subject.name, `${path}.name`)
  asString(subject.species, `${path}.species`)
  asDate(subject.birthDate, `${path}.birthDate`)
  asOptionalString(subject.photo, `${path}.photo`)
}

function validateCareItem(value: unknown, path: string): void {
  const item = asObject(value, path)
  asString(item.id, `${path}.id`)
  asString(item.subjectId, `${path}.subjectId`)
  asString(item.title, `${path}.title`)
  const interval = asObject(item.interval, `${path}.interval`)
  asPositiveInt(interval.value, `${path}.interval.value`)
  asEnum(interval.unit, `${path}.interval.unit`, ['days', 'weeks', 'months', 'years'])
}

function validateCompletionLogEntry(value: unknown, path: string): void {
  const entry = asObject(value, path)
  asString(entry.id, `${path}.id`)
  asString(entry.careItemId, `${path}.careItemId`)
  asDate(entry.date, `${path}.date`)
  asOptionalString(entry.note, `${path}.note`)
}

function validateOneOffEvent(value: unknown, path: string): void {
  const event = asObject(value, path)
  asString(event.id, `${path}.id`)
  asString(event.subjectId, `${path}.subjectId`)
  asString(event.title, `${path}.title`)
  asDate(event.date, `${path}.date`)
  asBoolean(event.done, `${path}.done`)
  asOptionalString(event.note, `${path}.note`)
}

function validateWeightEntry(value: unknown, path: string): void {
  const entry = asObject(value, path)
  asString(entry.id, `${path}.id`)
  asString(entry.subjectId, `${path}.subjectId`)
  asDate(entry.date, `${path}.date`)
  // Целые граммы — инвариант данных (ADR-0008)
  asInt(entry.grams, `${path}.grams`)
}

function validateFeedEntry(value: unknown, path: string): void {
  const entry = asObject(value, path)
  asString(entry.id, `${path}.id`)
  asString(entry.subjectId, `${path}.subjectId`)
  asDate(entry.date, `${path}.date`)
  asString(entry.foodName, `${path}.foodName`)
  asNumber(entry.price, `${path}.price`)
  asEnum(entry.verdict, `${path}.verdict`, ['ok', 'bad'])
  asOptionalString(entry.note, `${path}.note`)
}

/** Проверка всех шести коллекций по типам model.ts; возвращает то же значение типизированным. */
function validateAppState(value: unknown, path: string): AppState {
  const state = asObject(value, path)
  const collections: readonly [string, (value: unknown, path: string) => void][] = [
    ['subjects', validateSubject],
    ['careItems', validateCareItem],
    ['completionLog', validateCompletionLogEntry],
    ['oneOffEvents', validateOneOffEvent],
    ['weights', validateWeightEntry],
    ['feed', validateFeedEntry],
  ]
  for (const [key, validateEntity] of collections) {
    const list = asArray(state[key], `${path}.${key}`)
    list.forEach((entity, index) => validateEntity(entity, `${path}.${key}[${index}]`))
  }
  // Все шесть ключей проверены циклом выше — приведение обосновано,
  // TS вывести это по Record<string, unknown> не может.
  return state as unknown as AppState
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new BackupImportError(`Не удалось разобрать JSON: ${reason}`)
  }
}

/** Поднимает конверт с любой поддерживаемой версии до текущей (реестр миграций выше). */
function migrateToCurrent(envelope: RawEnvelope): RawEnvelope {
  let current = envelope
  for (let version = envelope.formatVersion; version < CURRENT_FORMAT_VERSION; version++) {
    const step = migrations[version]
    if (!step) {
      throw new BackupImportError(
        `Нет миграции данных с formatVersion ${version} на ${version + 1}: файл слишком старый для этой версии приложения`,
      )
    }
    current = step(current)
  }
  return current
}

/** Экспорт всего состояния в JSON-файл с formatVersion (кнопка в настройках, тикет 10). */
export function exportJson(state: AppState): string {
  const envelope: StorageEnvelope = { formatVersion: CURRENT_FORMAT_VERSION, state }
  return JSON.stringify(envelope, null, 2)
}

/**
 * Импорт бэкапа: разобрать конверт, сверить версию, провести миграции,
 * провалидировать каждую коллекцию. Любой дефект — BackupImportError
 * с понятным текстом; до успешного завершения ничего не возвращается
 * и никакое состояние не меняется.
 */
export function parseImport(text: string): AppState {
  const root = asObject(parseJson(text), 'файл')
  const formatVersion = root.formatVersion
  if (
    typeof formatVersion !== 'number' ||
    !Number.isInteger(formatVersion) ||
    formatVersion < 1
  ) {
    throw new BackupImportError(
      'Файл не похож на бэкап «Питомцы и дом»: ожидался JSON-конверт { formatVersion, state }',
    )
  }
  if (formatVersion > CURRENT_FORMAT_VERSION) {
    throw new BackupImportError(
      `Бэкап создан более новой версией приложения (formatVersion ${formatVersion}, ` +
        `приложение понимает ${CURRENT_FORMAT_VERSION}). Обновите приложение и повторите импорт.`,
    )
  }
  const migrated = migrateToCurrent({ formatVersion, state: root.state })
  return validateAppState(migrated.state, 'state')
}
