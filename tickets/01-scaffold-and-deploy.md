# 01: Скаффолд и деплой на GitHub Pages

**What to build:** Живой сайт на GitHub Pages: каркас приложения «Питомцы и дом» с мобильной вёрсткой, тёмной темой по системе и зелёным CI. Пуш в ветку и в master автоматически собирает и тестирует; пуш в master публикует новую версию сайта.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Vite + React + TypeScript проект собирается, dev-сервер запускается
- [x] Vitest настроен и гоняется в CI (хотя бы один smoke-тест)
- [x] Дизайн-токены заданы: палитра, радиусы, отступы; тёмная тема через `prefers-color-scheme`
- [x] Mobile-first: вёрстка корректна от 360px
- [x] GitHub Actions (`.github/workflows/`): сборка + vitest на каждый пуш в ветки и master; публикация Pages из master (ADR-0007)
- [x] `base`-путь Vite: в CI выводится из `GITHUB_REPOSITORY` → `/pet-care-tracker/`, локально — корень; стили и скрипты грузятся на Pages (ADR-0007)
- [x] README-заглушка обновлена статусом «каркас»
