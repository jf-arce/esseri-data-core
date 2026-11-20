import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JSONContent } from '@tiptap/react'
import { expect, it, vi } from 'vitest'
import { EditorMensaje } from '../editor-mensaje'

const rico: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [{ type: 'text', text: 'Título', marks: [{ type: 'bold' }] }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hola ' },
        {
          type: 'text',
          text: 'familia',
          marks: [
            { type: 'italic' },
            { type: 'underline' },
            { type: 'strike' },
            { type: 'highlight', attrs: { color: '#fff2a8' } },
            { type: 'textStyle', attrs: { color: '#783abc' } },
          ],
        },
      ],
    },
  ],
}

it('has a fixed highlighter without text or background color pickers', async () => {
  const { container } = render(<EditorMensaje texto="" disabled={false} onChange={vi.fn()} />)

  expect(await screen.findByRole('button', { name: 'Resaltar' })).toBeEnabled()
  expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0)
})

it('restores a server rich document without emitting a change', async () => {
  const onChange = vi.fn()
  const { rerender } = render(
    <>
      <span id="mensaje-etiqueta">Mensaje</span>
      <EditorMensaje texto="" disabled={false} onChange={onChange} />
    </>,
  )
  const editor = await screen.findByRole('textbox', { name: 'Mensaje' })
  rerender(
    <>
      <span id="mensaje-etiqueta">Mensaje</span>
      <EditorMensaje texto="" cuerpoRico={rico} disabled={false} onChange={onChange} />
    </>,
  )
  await screen.findByText('Título')
  expect(editor.querySelector('h2')?.textContent).toBe('Título')
  expect(editor.querySelector('h2 strong')?.textContent).toBe('Título')
  expect(editor.querySelector('em')?.textContent).toBe('familia')
  expect(editor.querySelector('u')?.textContent).toBe('familia')
  expect(editor.querySelector('s')?.textContent).toBe('familia')
  expect(editor.querySelector('h2')?.getAttribute('style')).toContain('text-align: center')
  expect(onChange).not.toHaveBeenCalled()
})

it('opens legacy plain text literally, one paragraph per line', async () => {
  const onChange = vi.fn()
  render(
    <>
      <span id="mensaje-etiqueta">Mensaje</span>
      <EditorMensaje texto={'Línea 1\n<b>no es html</b>'} disabled={false} onChange={onChange} />
    </>,
  )
  const editor = await screen.findByRole('textbox', { name: 'Mensaje' })
  expect(editor.querySelectorAll('p')).toHaveLength(2)
  expect(editor.querySelector('b')).toBeNull()
  expect(editor.textContent).toContain('<b>no es html</b>')
  expect(onChange).not.toHaveBeenCalled()
})

it('keeps compatible formatting from pasted HTML', async () => {
  const onChange = vi.fn()
  render(
    <>
      <span id="mensaje-etiqueta">Mensaje</span>
      <EditorMensaje texto="" disabled={false} onChange={onChange} />
    </>,
  )
  const editor = await screen.findByRole('textbox', { name: 'Mensaje' })
  editor.focus()
  const datos = {
    types: ['text/html', 'text/plain'],
    getData: (tipo: string) =>
      tipo === 'text/html'
        ? '<p><strong>Pegado</strong> y <em>cursiva</em></p>'
        : 'Pegado y cursiva',
  }
  const evento = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(evento, 'clipboardData', { value: datos })
  editor.dispatchEvent(evento)
  await waitFor(() => {
    expect(editor.querySelector('strong')?.textContent).toBe('Pegado')
    expect(editor.querySelector('em')?.textContent).toBe('cursiva')
  })
  const emitido = JSON.stringify(onChange.mock.lastCall?.[1])
  expect(emitido).toContain('"bold"')
  expect(emitido).toContain('"italic"')
})

it('opens existing text literally and emits the formatted document when edited', async () => {
  const onChange = vi.fn()
  render(
    <>
      <span id="mensaje-etiqueta">Mensaje</span>
      <EditorMensaje texto="Mensaje anterior" disabled={false} onChange={onChange} />
    </>,
  )
  const editor = await screen.findByRole('textbox', { name: 'Mensaje' })
  expect(editor).toHaveTextContent('Mensaje anterior')
  const user = userEvent.setup()
  editor.focus()
  window.getSelection()?.selectAllChildren(editor.querySelector('p')!)
  fireEvent(document, new Event('selectionchange'))
  await user.click(screen.getByRole('button', { name: 'Negrita' }))
  await waitFor(() => expect(editor.querySelector('strong')).toHaveTextContent('Mensaje anterior'))
  expect(onChange.mock.lastCall?.[0]).toBe('Mensaje anterior')
  expect(JSON.stringify(onChange.mock.lastCall?.[1])).toContain('"type":"bold"')
})
