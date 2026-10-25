/**
 * Демо-набор: два питомца с полной историей (глоссарий: «Демо-набор»; тикет 10).
 *
 * Данные для кнопки «Загрузить демо-набор» в настройках: скриншоты README
 * (SPEC: «README — только на русском; скриншоты — с демо-набором») и
 * демонстрация всех возможностей — пункты ухода во всех трёх срочностях,
 * пункт с пустым журналом («пора сейчас»), история веса с трендом «котёнок
 * растёт → стабилизируется», журнал корма с обоими вердиктами и расходами
 * по месяцам, разовые события. Чистая функция: «сегодня» приходит параметром,
 * домен не читает часы; все даты выводятся из today арифметикой dates.ts —
 * ни одного литерала даты и ни одного объекта Date (ADR-0008).
 *
 * Сдвиги выполнений подобраны так, чтобы срочности не зависели от дня
 * загрузки. Интервалы в месяцах живут на шкале «59–62 дня» (2 мес),
 * «89–92 дня» (3 мес) и «365/366 дней» (12 мес), и смещения лежат внутри
 * этих коридоров с запасом к границе окна «скоро» (7 дней):
 *   393 дня назад + 12 мес → просрочка на 27–28 дней (overdue, кот);
 *   360 дней назад + 12 мес → через 5–6 дней (soon, собака);
 *   87 дней назад  + 3 мес  → через 2–5 дней (soon, кот);
 *   95 дней назад  + 3 мес  → просрочка на 3–6 дней (overdue, собака);
 *   45 дней назад  + 2 мес  → через 14–17 дней (calm, оба);
 *   10 дней назад  + 3 нед  → через 11 дней (calm, собака).
 * Поэтому у обоих питомцев одновременно есть overdue / soon / calm в любой
 * день — набор не «протухает» и всегда годится для скриншотов.
 *
 * Идентификаторы — читаемые детерминированные литералы ('demo-subject-cat',
 * 'demo-item-cat-vaccination', …): для демо-набора воспроизводимость важнее
 * случайности — стабильные тесты и одинаковые скриншоты. Формально это
 * исключение из ADR-0008 («идентификаторы сущностей — crypto.randomUUID()»,
 * выдача — app-слой): ADR говорит о сущностях, создаваемых приложением,
 * а демо-набор — фиксированные данные целиком, как готовый бэкап.
 * Уникальность внутри состояния гарантируют префиксы demo-* и суффиксы сущностей.
 *
 * Набор обязан проходить валидацию импорта storage/backup.ts (parseImport):
 * даты — корректные 'YYYY-MM-DD', grams — целые, interval.value —
 * положительные целые, verdict — 'ok' | 'bad', все subjectId/careItemId
 * указывают на существующие сущности. Тест demoData.test.ts проверяет эту
 * консистентность утверждениями — сам storage домен не импортирует
 * (запрещённое направление зависимостей, docs/ARCHITECTURE.md).
 */

import type {
  AppState,
  CareItem,
  CompletionLogEntry,
  DateString,
  FeedEntry,
  FeedVerdict,
  Interval,
  WeightEntry,
} from './model'
import { addInterval, diffInDays, parseDate, toDateString } from './dates'

/** Целое неотрицательное смещение — общий контракт аргументов этого модуля. */
function assertOffset(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${what} должно быть целым неотрицательным числом: ${n}`)
  }
}

/**
 * 1-е число месяца за offsetMonths до/после месяца today (−1 — предыдущий).
 * Абсолютный индекс месяца (год × 12 + месяц) — та же шкала, что в
 * monthlySpend (spend.ts); день 1 существует в любом месяце, поэтому
 * toDateString всегда валиден и клампинг дня не нужен.
 */
function monthStart(today: DateString, offsetMonths: number): DateString {
  assertOffset(Math.abs(offsetMonths), 'Смещение в месяцах')
  const { year, month } = parseDate(today)
  const total = year * 12 + (month - 1) + offsetMonths
  const shiftedYear = Math.floor(total / 12)
  // total − shiftedYear×12 ∈ [0, 11] и для отрицательных total — без JS-остатка.
  return toDateString({ year: shiftedYear, month: total - shiftedYear * 12 + 1, day: 1 })
}

/**
 * today − n дней. dates.ts умеет только складывать интервалы, поэтому идём
 * от якоря «1-е число месяца ceil(n/28) месяцев назад» вперёд: якорь отстоит
 * от today минимум на 28 × ceil(n/28) ≥ n дней, значит офсет до цели
 * неотрицателен, а его точное значение даёт diffInDays. n = 0 → сам today.
 */
function daysAgo(today: DateString, n: number): DateString {
  assertOffset(n, 'Смещение в днях')
  const anchor = monthStart(today, -Math.ceil(n / 28))
  const offset = diffInDays(anchor, today) - n
  return offset === 0 ? anchor : addInterval(anchor, { value: offset, unit: 'days' })
}

/** today + n дней — прямое сложение dates.ts. */
function daysAhead(today: DateString, n: number): DateString {
  assertOffset(n, 'Смещение в днях')
  return addInterval(today, { value: n, unit: 'days' })
}

/** Спецификация записи выполнения: какой пункт, сколько дней назад, заметка. */
interface LogSpec {
  id: string
  itemId: string
  daysAgo: number
  note?: string
}

/** Спецификация замера веса: сколько дней назад и сколько целых граммов. */
interface WeightSpec {
  id: string
  daysAgo: number
  grams: number
}

/**
 * Дата покупки корма: либо «1-е число месяца monthsAgo плюс plusDays дней» —
 * надёжно попадает в конкретный месяц окна расходов при любом today, либо
 * «daysAgo дней назад» — свежая покупка, всегда не в будущем.
 */
type FeedWhen = { monthsAgo: number; plusDays: number } | { daysAgo: number }

/** Спецификация записи корма: когда, что, почём, вердикт, заметка. */
interface FeedSpec {
  id: string
  when: FeedWhen
  foodName: string
  price: number
  verdict: FeedVerdict
  note?: string
}

const CAT_ID = 'demo-subject-cat'
const DOG_ID = 'demo-subject-dog'

function careItem(id: string, subjectId: string, title: string, interval: Interval): CareItem {
  return { id, subjectId, title, interval }
}

/** Спецификации → записи журнала выполнений (ADR-0003: только факты, без nextDue). */
function logEntries(today: DateString, specs: readonly LogSpec[]): CompletionLogEntry[] {
  return specs.map(({ id, itemId, daysAgo: ago, note }) => ({
    id,
    careItemId: itemId,
    date: daysAgo(today, ago),
    ...(note === undefined ? {} : { note }),
  }))
}

/** Спецификации → замеры веса, от старого к новому (grams — целые, ADR-0008). */
function weightEntries(today: DateString, subjectId: string, specs: readonly WeightSpec[]): WeightEntry[] {
  return specs.map(({ id, daysAgo: ago, grams }) => ({
    id,
    subjectId,
    date: daysAgo(today, ago),
    grams,
  }))
}

/** Спецификации → записи журнала корма. */
function feedEntries(today: DateString, subjectId: string, specs: readonly FeedSpec[]): FeedEntry[] {
  return specs.map(({ id, when, foodName, price, verdict, note }) => {
    const date =
      'monthsAgo' in when
        ? (() => {
            const first = monthStart(today, -when.monthsAgo)
            // plusDays 0 — само 1-е число: addInterval требует значение > 0.
            return when.plusDays === 0 ? first : addInterval(first, { value: when.plusDays, unit: 'days' })
          })()
        : daysAgo(today, when.daysAgo)
    return {
      id,
      subjectId,
      date,
      foodName,
      price,
      verdict,
      ...(note === undefined ? {} : { note }),
    }
  })
}

/**
 * Кот: первичная вакцинация двумя дозами (последняя 393 дня назад + 12 мес —
 * просрочка), паразиты по графику (87 дней назад + 3 мес — «скоро»),
 * груминг (45 дней назад + 2 мес — «спокойно»). Стрижка когтей — без записей:
 * новый пункт, «пора сейчас».
 */
const CAT_LOG: readonly LogSpec[] = [
  { id: 'demo-log-cat-vaccination-1', itemId: 'demo-item-cat-vaccination', daysAgo: 424, note: 'Quadricat, первая доза' },
  { id: 'demo-log-cat-vaccination-2', itemId: 'demo-item-cat-vaccination', daysAgo: 393, note: 'Quadricat, ревакцинация' },
  { id: 'demo-log-cat-parasites-1', itemId: 'demo-item-cat-parasites', daysAgo: 178, note: 'капли на холку' },
  { id: 'demo-log-cat-parasites-2', itemId: 'demo-item-cat-parasites', daysAgo: 87 },
  { id: 'demo-log-cat-grooming-1', itemId: 'demo-item-cat-grooming', daysAgo: 105 },
  { id: 'demo-log-cat-grooming-2', itemId: 'demo-item-cat-grooming', daysAgo: 45, note: 'мытьё и вычёсывание дома' },
]

/**
 * Собака: ежегодная прививка (360 дней назад + 12 мес — «скоро»), паразиты
 * просрочены (95 дней назад + 3 мес), груминг и стрижка когтей — «спокойно».
 */
const DOG_LOG: readonly LogSpec[] = [
  { id: 'demo-log-dog-vaccination-1', itemId: 'demo-item-dog-vaccination', daysAgo: 725, note: 'Нобивак DHLPP' },
  { id: 'demo-log-dog-vaccination-2', itemId: 'demo-item-dog-vaccination', daysAgo: 360, note: 'Нобивак RL, ежегодная' },
  { id: 'demo-log-dog-parasites-1', itemId: 'demo-item-dog-parasites', daysAgo: 186 },
  { id: 'demo-log-dog-parasites-2', itemId: 'demo-item-dog-parasites', daysAgo: 95, note: 'таблетки от гельминтов' },
  { id: 'demo-log-dog-grooming-1', itemId: 'demo-item-dog-grooming', daysAgo: 105, note: 'салон, полный комплекс' },
  { id: 'demo-log-dog-grooming-2', itemId: 'demo-item-dog-grooming', daysAgo: 45 },
  { id: 'demo-log-dog-nails-1', itemId: 'demo-item-dog-nails', daysAgo: 31 },
  { id: 'demo-log-dog-nails-2', itemId: 'demo-item-dog-nails', daysAgo: 10 },
]

/**
 * Кот (родился ~500 дней назад): рост котёнка с замедлением — прирост
 * 330 г за первые 40 дней стабилизируется к 20 г к году, линия графика
 * «крутой подъём → плато» (ADR-0005).
 */
const CAT_WEIGHTS: readonly WeightSpec[] = [
  { id: 'demo-weight-cat-1', daysAgo: 340, grams: 2620 },
  { id: 'demo-weight-cat-2', daysAgo: 300, grams: 2950 },
  { id: 'demo-weight-cat-3', daysAgo: 260, grams: 3260 },
  { id: 'demo-weight-cat-4', daysAgo: 220, grams: 3520 },
  { id: 'demo-weight-cat-5', daysAgo: 180, grams: 3740 },
  { id: 'demo-weight-cat-6', daysAgo: 140, grams: 3910 },
  { id: 'demo-weight-cat-7', daysAgo: 100, grams: 4030 },
  { id: 'demo-weight-cat-8', daysAgo: 60, grams: 4110 },
  { id: 'demo-weight-cat-9', daysAgo: 25, grams: 4160 },
  { id: 'demo-weight-cat-10', daysAgo: 3, grams: 4180 },
]

/** Собака (взрослая, ~3 года): стабильные 12,3–12,5 кг с колебаниями ±100 г. */
const DOG_WEIGHTS: readonly WeightSpec[] = [
  { id: 'demo-weight-dog-1', daysAgo: 170, grams: 12350 },
  { id: 'demo-weight-dog-2', daysAgo: 140, grams: 12410 },
  { id: 'demo-weight-dog-3', daysAgo: 110, grams: 12280 },
  { id: 'demo-weight-dog-4', daysAgo: 75, grams: 12380 },
  { id: 'demo-weight-dog-5', daysAgo: 40, grams: 12450 },
  { id: 'demo-weight-dog-6', daysAgo: 8, grams: 12390 },
]

/**
 * Корм кота: по покупке в месяц последние полгода, «плохой» паучи-опыт
 * и переход на другой корм по совету ветеринара.
 */
const CAT_FEED: readonly FeedSpec[] = [
  { id: 'demo-feed-cat-1', when: { monthsAgo: 5, plusDays: 10 }, foodName: 'Royal Canin Kitten, 2 кг', price: 1290, verdict: 'ok' },
  { id: 'demo-feed-cat-2', when: { monthsAgo: 4, plusDays: 14 }, foodName: 'Royal Canin Kitten, 2 кг', price: 1290, verdict: 'ok', note: 'взяли запас' },
  { id: 'demo-feed-cat-3', when: { monthsAgo: 3, plusDays: 7 }, foodName: 'Whiskas Junior, паучи 1,2 кг', price: 640, verdict: 'bad', note: 'ел неохотно' },
  { id: 'demo-feed-cat-4', when: { monthsAgo: 2, plusDays: 18 }, foodName: 'Royal Canin Kitten, 2 кг', price: 1350, verdict: 'ok', note: 'подорожал' },
  { id: 'demo-feed-cat-5', when: { monthsAgo: 1, plusDays: 9 }, foodName: 'Grandorf Kitten, 1,5 кг', price: 1480, verdict: 'ok', note: 'совет ветеринара' },
  { id: 'demo-feed-cat-6', when: { daysAgo: 2 }, foodName: 'Grandorf Kitten, 1,5 кг', price: 1480, verdict: 'ok' },
]

/**
 * Корм собаки: мешки сухого раз в полтора-два месяца, неудачные паучи и
 * проба нового вкуса; один месяц без покупок — честный нулевой столбик.
 */
const DOG_FEED: readonly FeedSpec[] = [
  { id: 'demo-feed-dog-1', when: { monthsAgo: 5, plusDays: 5 }, foodName: 'Brit Care Adult Lamb, 3 кг', price: 1750, verdict: 'ok' },
  { id: 'demo-feed-dog-2', when: { monthsAgo: 4, plusDays: 21 }, foodName: 'Chappie, паучи 1,2 кг', price: 520, verdict: 'bad', note: 'расстроился живот' },
  { id: 'demo-feed-dog-3', when: { monthsAgo: 3, plusDays: 16 }, foodName: 'Brit Care Adult Lamb, 3 кг', price: 1750, verdict: 'ok' },
  { id: 'demo-feed-dog-4', when: { monthsAgo: 1, plusDays: 12 }, foodName: 'Brit Care Adult Lamb, 3 кг', price: 1790, verdict: 'ok', note: 'новая партия' },
  { id: 'demo-feed-dog-5', when: { daysAgo: 0 }, foodName: 'Go! Adult Salmon, 2 кг', price: 1610, verdict: 'ok', note: 'пробуем новый вкус' },
]

/**
 * Демо-набор для «сегодня» = today: кот Персик и собака Бублик с полным
 * анамнезом. Все даты — функции от today, поэтому кнопка «Загрузить
 * демо-набор» даёт живую картинку в любой день: просрочки остаются
 * просрочками, «скоро» — «скоро», свежие замеры — свежими.
 */
export function demoData(today: DateString): AppState {
  return {
    subjects: [
      // Котёнок на момент набора — подросток: рождение ~16 месяцев назад.
      { id: CAT_ID, type: 'pet', name: 'Персик', species: 'кот', birthDate: daysAgo(today, 500) },
      // Взрослая собака ~3 лет.
      { id: DOG_ID, type: 'pet', name: 'Бублик', species: 'собака', birthDate: daysAgo(today, 1135) },
    ],
    careItems: [
      // Пресеты из presets.ts один в один (проверяется тестом)…
      careItem('demo-item-cat-vaccination', CAT_ID, 'Прививка', { value: 12, unit: 'months' }),
      careItem('demo-item-cat-parasites', CAT_ID, 'Обработка от паразитов', { value: 3, unit: 'months' }),
      careItem('demo-item-cat-grooming', CAT_ID, 'Груминг', { value: 2, unit: 'months' }),
      // …и нестандартный пункт (User Story 5): у кота — с пустым журналом.
      careItem('demo-item-cat-nails', CAT_ID, 'Стрижка когтей', { value: 3, unit: 'weeks' }),
      careItem('demo-item-dog-vaccination', DOG_ID, 'Прививка', { value: 12, unit: 'months' }),
      careItem('demo-item-dog-parasites', DOG_ID, 'Обработка от паразитов', { value: 3, unit: 'months' }),
      careItem('demo-item-dog-grooming', DOG_ID, 'Груминг', { value: 2, unit: 'months' }),
      careItem('demo-item-dog-nails', DOG_ID, 'Стрижка когтей', { value: 3, unit: 'weeks' }),
    ],
    completionLog: [...logEntries(today, CAT_LOG), ...logEntries(today, DOG_LOG)],
    oneOffEvents: [
      {
        id: 'demo-event-vet-visit',
        subjectId: DOG_ID,
        title: 'Приём у ветеринара',
        // Предстоящее, в окне «скоро»: через 4 дня от today.
        date: daysAhead(today, 4),
        done: false,
        note: 'плановый осмотр, кардиолог',
      },
      {
        id: 'demo-event-grooming-done',
        subjectId: CAT_ID,
        title: 'Стрижка в груминг-салоне',
        // Выполненное: ушло из списка дел в историю (тикет 07).
        date: daysAgo(today, 20),
        done: true,
        note: 'короткий летний вариант',
      },
    ],
    weights: [...weightEntries(today, CAT_ID, CAT_WEIGHTS), ...weightEntries(today, DOG_ID, DOG_WEIGHTS)],
    feed: [...feedEntries(today, CAT_ID, CAT_FEED), ...feedEntries(today, DOG_ID, DOG_FEED)],
  }
}
