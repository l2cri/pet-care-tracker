/**
 * Типы доменной модели «Питомцы и дом».
 *
 * Чистый TypeScript: модуль не знает о React, DOM и localStorage (см. docs/ARCHITECTURE.md).
 * Термины и кодовые имена — ровно как в docs/GLOSSARY.md.
 *
 * Даты — локальные строки 'YYYY-MM-DD' без времени и таймзон (ADR-0008).
 * Вес — целые граммы; килограммы только форматирование на выводе (ADR-0008).
 * Идентификаторы — string; crypto.randomUUID() выдаёт app-слой, домену достаточно типа.
 */

/** Локальная дата 'YYYY-MM-DD' без времени и таймзон (ADR-0008). */
export type DateString = string;

/** Идентификатор любой сущности (в app выдаётся crypto.randomUUID()). */
export type Id = string;

/** Единица интервала повтора. Определяет арифметику дат и FREQ в RRULE. */
export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';

/** Интервал: положительное целое число + единица (глоссарий: Интервал). */
export interface Interval {
  value: number;
  unit: IntervalUnit;
}

/** Тип подопечного. В MVP UI показывает только питомцев (ADR-0002). */
export type CareSubjectType = 'pet' | 'item' | 'plant';

/** Подопечный: тот, о ком заботимся (питомец, предмет ухода или растение). */
export interface CareSubject {
  id: Id;
  type: CareSubjectType;
  /** Имя, например «Барсик». */
  name: string;
  /** Вид, например «кот». */
  species: string;
  birthDate: DateString;
  /** Фото питомца (dataURL после downscale в app); может отсутствовать. */
  photo?: string;
}

/** Пункт ухода: повторяющаяся забота, привязанная к подопечному. */
export interface CareItem {
  id: Id;
  subjectId: Id;
  /** Заголовок, например «Прививка». */
  title: string;
  interval: Interval;
}

/**
 * Запись выполнения: факт «сделано» с датой и опциональной заметкой.
 * Единственное место, где хранится прошлое пункта ухода (ADR-0003):
 * lastDone и nextDue нигде не хранятся, только выводятся (dates.ts).
 */
export interface CompletionLogEntry {
  id: Id;
  careItemId: Id;
  date: DateString;
  /** Например, название вакцины или клиника. */
  note?: string;
}

/** Разовое событие: без повтора, визит к ветеринару или стрижка к дате. */
export interface OneOffEvent {
  id: Id;
  subjectId: Id;
  title: string;
  date: DateString;
  done: boolean;
  note?: string;
}

/** Замер веса: дата + вес в целых граммах (ADR-0008). */
export interface WeightEntry {
  id: Id;
  subjectId: Id;
  date: DateString;
  /** Целое число граммов; килограммы — только форматирование на выводе. */
  grams: number;
}

/** Вердикт корма: подошёл / не подошёл. */
export type FeedVerdict = 'ok' | 'bad';

/** Запись корма: строка журнала покупок с вердиктом. */
export interface FeedEntry {
  id: Id;
  subjectId: Id;
  date: DateString;
  /** Название корма. */
  foodName: string;
  /** Цена покупки. */
  price: number;
  verdict: FeedVerdict;
  note?: string;
}

/** Всё состояние приложения — то, что сериализует storage в JSON с formatVersion. */
export interface AppState {
  subjects: CareSubject[];
  careItems: CareItem[];
  completionLog: CompletionLogEntry[];
  oneOffEvents: OneOffEvent[];
  weights: WeightEntry[];
  feed: FeedEntry[];
}
