import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('Каркас приложения', () => {
  it('рендерит заголовок «Питомцы и дом»', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Питомцы и дом' })).toBeTruthy()
  })
})
