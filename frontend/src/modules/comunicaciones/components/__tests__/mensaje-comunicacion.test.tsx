import { render } from '@testing-library/react'
import type { JSONContent } from '@tiptap/react'
import { expect, it } from 'vitest'
import { MensajeComunicacion } from '../mensaje-comunicacion'

it('renders only supported nodes and neutralizes hostile input', () => {
  const hostil = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'expression(alert(1))' },
        content: [
          {
            type: 'text',
            text: '<script>alert(1)</script>',
            marks: [
              { type: 'link', attrs: { href: 'javascript:alert(1)' } },
              { type: 'link', attrs: { href: 'data:text/html,<script>x</script>' } },
              { type: 'textStyle', attrs: { color: 'red;background:url(javascript:1)' } },
              { type: 'script', attrs: {} },
            ],
          },
          {
            type: 'text',
            text: 'enlace',
            marks: [{ type: 'link', attrs: { href: 'https://ok.example/x' } }],
          },
        ],
      },
      { type: 'script', attrs: { src: 'https://evil.example/x.js' } },
    ],
  } as unknown as JSONContent
  const { container } = render(<MensajeComunicacion texto="" cuerpoRico={hostil} />)
  expect(container.querySelector('script')).toBeNull()
  expect(container.innerHTML).not.toContain('javascript:')
  expect(container.innerHTML).not.toContain('data:')
  expect(container.textContent).toContain('<script>alert(1)</script>')
  expect(container.querySelector('p')?.getAttribute('style')).toBeNull()
  const enlaces = [...container.querySelectorAll('a')]
  expect(enlaces).toHaveLength(1)
  expect(enlaces[0].getAttribute('href')).toBe('https://ok.example/x')
  expect(enlaces[0].getAttribute('rel')).toContain('noopener')
})

it('falls back to the stored plain text for legacy messages', () => {
  const { container } = render(
    <MensajeComunicacion texto={'Uno\nDos <b>x</b>'} cuerpoRico={null} />,
  )
  expect(container.textContent).toBe('Uno\nDos <b>x</b>')
  expect(container.querySelector('b')).toBeNull()
})
