# 01: Скаффолд и деплой на GitHub Pages

**What to build:** Живой сайт на GitHub Pages: каркас приложения «Питомцы и дом» с мобильной вёрсткой, тёмной темой по системе и зелёным CI. Пуш в ветку и в master автоматически собирает и тестирует; пуш в master публикует новую версию сайта.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [ ] Vite + React + TypeScript проект собирается, dev-сервер запускается
- [ ] Vitest настроен и гоняется в CI (хотя бы один smoke-тест)
- [ ] Дизайн-токены заданы: палитра, радиусы, отступы; тёмная тема через `prefers-color-scheme`
- [ ] Mobile-first: вёрстка корректна от 360px
- [ ] GitHub Actions (`.github/workflows/`): сборка + vitest на каждый пуш в ветки и master; публикация Pages из master (ADR-0007)
- [ ] `base`-путь Vite указан (`/pet-care-tracker/`) — стили и скрипты грузятся на Pages (ADR-0007)
- [ ] README-заглушка обновлена статусом «каркас»
