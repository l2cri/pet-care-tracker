/**
 * Выбор фото подопечного (User Story 2): тап по превью открывает выбор файла,
 * картинка сжимается на клиенте до ~512px через canvas и живёт как dataURL —
 * сервера нет, localStorage при таком размере хватает (ADR-0001).
 *
 * Ошибки чтения и декодирования тихо игнорируются: фото — необязательное
 * поле, из-за него форма добавления питомца ломаться не должна.
 */

import { useRef } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import styles from './PhotoInput.module.css'

/** Максимальная сторона миниатюры: достаточно для карточки и не распирает localStorage. */
const PHOTO_MAX_SIDE = 512
/** JPEG 0.85 — незаметная потеря качества при кратном уменьшении размера. */
const PHOTO_JPEG_QUALITY = 0.85

/** Читает файл как dataURL — входная точка конвейера сжатия. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Декодирует dataURL в HTMLImageElement для отрисовки на canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось декодировать изображение'))
    image.src = src
  })
}

/**
 * Вписывает изображение в квадрат maxSide по большей стороне и отдаёт JPEG
 * dataURL. Никогда не увеличивает: маленькие картинки остаются как есть.
 * Экспортирована отдельно от компонента — canvas это app-слой, и функцию
 * удобно звать из любого места (не только из этого поля ввода).
 */
export async function downscalePhoto(file: File, maxSide = PHOTO_MAX_SIDE): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)
  // Масштаб не выше 1 — не апскейлим; Math.max(1, …) страхует вырожденный 0×0.
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) {
    throw new Error('Контекст canvas недоступен')
  }
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY)
}

export interface PhotoInputProps {
  /** Текущее фото (dataURL) или undefined — покажется заглушка. */
  value?: string
  /** Новый dataURL после выбора файла; undefined — фото убрали. */
  onChange: (photo: string | undefined) => void
}

export function PhotoInput(props: PhotoInputProps): ReactElement {
  const { value, onChange } = props
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Сброс значения: без него повторный выбор того же файла не вызовет onChange.
    event.target.value = ''
    if (!file) return
    downscalePhoto(file)
      .then(onChange)
      // Тихий отказ: фото необязательно, форма остаётся рабочей.
      .catch(() => undefined)
  }

  return (
    <div className={styles.photoInput}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.fileInput}
        onChange={handleFile}
      />
      <button
        type="button"
        className={styles.preview}
        onClick={() => inputRef.current?.click()}
        aria-label={value ? 'Заменить фото' : 'Добавить фото'}
      >
        {value ? (
          // Фото — украшение рядом с именем, имя читает скринридер; alt пустой.
          <img src={value} alt="" className={styles.image} />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            🐾
          </span>
        )}
      </button>
      <div className={styles.side}>
        <p className={styles.hint}>{value ? 'Нажмите, чтобы заменить' : 'Нажмите, чтобы выбрать фото'}</p>
        {value && (
          <button type="button" className={styles.remove} onClick={() => onChange(undefined)}>
            Убрать фото
          </button>
        )}
      </div>
    </div>
  )
}
