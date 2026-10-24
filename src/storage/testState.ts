/**
 * Общие фикстуры тестов storage-слоя: насыщенное состояние со всеми шестью
 * коллекциями (глоссарий), у части записей заполнены опциональные note и
 * photo — именно их легче всего потерять при сериализации.
 */

import type { AppState } from '../domain/model'

/** Два питомца, три пункта ухода, журнал, события, вес и корм. */
export function sampleAppState(): AppState {
  return {
    subjects: [
      {
        id: 'subject-1',
        type: 'pet',
        name: 'Барсик',
        species: 'кот',
        birthDate: '2020-03-08',
        photo: 'data:image/png;base64,iVBORw0KGgo=',
      },
      // Без фото: опциональное поле отсутствует
      { id: 'subject-2', type: 'pet', name: 'Мурка', species: 'кошка', birthDate: '2021-11-30' },
    ],
    careItems: [
      {
        id: 'care-1',
        subjectId: 'subject-1',
        title: 'Прививка',
        interval: { value: 12, unit: 'months' },
      },
      {
        id: 'care-2',
        subjectId: 'subject-1',
        title: 'Глистогонное',
        interval: { value: 90, unit: 'days' },
      },
      { id: 'care-3', subjectId: 'subject-2', title: 'Груминг', interval: { value: 8, unit: 'weeks' } },
    ],
    completionLog: [
      { id: 'log-1', careItemId: 'care-1', date: '2026-01-31' },
      // Заметка — название вакцины и клиника (ADR-0003)
      { id: 'log-2', careItemId: 'care-1', date: '2025-01-31', note: 'Нобивак, клиника «Айболит»' },
      { id: 'log-3', careItemId: 'care-3', date: '2026-09-01', note: 'Стрижка когтей' },
    ],
    oneOffEvents: [
      {
        id: 'event-1',
        subjectId: 'subject-1',
        title: 'Визит к ветеринару',
        date: '2026-11-05',
        done: false,
        note: 'Осмотр перед вакцинацией',
      },
      { id: 'event-2', subjectId: 'subject-2', title: 'Стерилизация', date: '2026-05-20', done: true },
    ],
    weights: [
      { id: 'weight-1', subjectId: 'subject-1', date: '2026-06-01', grams: 4100 },
      { id: 'weight-2', subjectId: 'subject-1', date: '2026-08-01', grams: 4250 },
    ],
    feed: [
      {
        id: 'feed-1',
        subjectId: 'subject-1',
        date: '2026-09-15',
        foodName: 'Royal Canin Fit',
        price: 890.5,
        verdict: 'ok',
        note: 'ест охотно',
      },
      // Без заметки: опциональное поле отсутствует
      { id: 'feed-2', subjectId: 'subject-2', date: '2026-09-20', foodName: 'Whiskas Fish', price: 450, verdict: 'bad' },
    ],
  }
}
