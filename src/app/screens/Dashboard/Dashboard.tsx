import styles from './Dashboard.module.css'

/** Заглушка дашборда для каркаса (тикет 01); карточки подопечных — тикет 04. */
export function Dashboard() {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Питомцы и дом</h1>
      </header>
      <main className={styles.content}>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Здесь появится дашборд</h2>
          <p className={styles.emptyText}>
            «Питомцы и дом» — локальный трекер ухода за питомцами: прививки, обработка
            от паразитов, график веса и журнал корма. Данные хранятся только в вашем
            браузере.
          </p>
          <p className={styles.emptyText}>
            Каркас приложения готов, экраны собираются по тикетам — карточки питомцев
            и пункты ухода совсем скоро.
          </p>
        </div>
      </main>
    </div>
  )
}
