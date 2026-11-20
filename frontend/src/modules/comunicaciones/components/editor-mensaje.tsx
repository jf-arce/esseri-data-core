import { useEffect, useState } from 'react'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Plugin } from '@tiptap/pm/state'
import { EditorContent, Extension, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLASES_MENSAJE } from './mensaje-comunicacion'

function documentoPlano(texto: string): JSONContent {
  return {
    type: 'doc',
    content: texto.split(/\r?\n/).map((linea) => ({
      type: 'paragraph',
      ...(linea ? { content: [{ type: 'text', text: linea }] } : {}),
    })),
  }
}

const LimiteMensaje = Extension.create({
  name: 'limiteMensaje',
  addProseMirrorPlugins: () => [
    new Plugin({
      filterTransaction: (tr) =>
        !tr.docChanged ||
        Array.from(tr.doc.textBetween(0, tr.doc.content.size, '\n', '\n')).length <= 20_000,
    }),
  ],
})

const extensiones = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, defaultProtocol: 'https' },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  LimiteMensaje,
]

export function EditorMensaje({
  texto,
  cuerpoRico,
  disabled,
  onChange,
}: {
  texto: string
  cuerpoRico?: JSONContent | null
  disabled: boolean
  onChange: (texto: string, cuerpoRico: JSONContent) => void
}) {
  const [enlace, setEnlace] = useState<string | null>(null)
  const [errorEnlace, setErrorEnlace] = useState(false)
  const editor = useEditor({
    extensions: extensiones,
    content: cuerpoRico ?? documentoPlano(texto),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        id: 'mensaje',
        role: 'textbox',
        'aria-labelledby': 'mensaje-etiqueta',
        'aria-multiline': 'true',
        class: `${CLASES_MENSAJE} min-h-36 px-3 py-2 outline-none`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getText({ blockSeparator: '\n' }), editor.getJSON()),
  })

  useEffect(() => {
    editor?.setEditable(!disabled, false)
  }, [editor, disabled])
  useEffect(() => {
    if (!editor) return
    const siguiente = cuerpoRico ?? documentoPlano(texto)
    if (
      cuerpoRico
        ? JSON.stringify(editor.getJSON()) !== JSON.stringify(siguiente)
        : editor.getText({ blockSeparator: '\n' }) !== texto
    ) {
      editor.commands.setContent(siguiente, { emitUpdate: false })
    }
  }, [editor, cuerpoRico, texto])

  if (!editor) return null
  const acciones = [
    [
      'Deshacer',
      Undo2Icon,
      () => editor.chain().focus().undo().run(),
      undefined,
      editor.can().undo(),
    ],
    [
      'Rehacer',
      Redo2Icon,
      () => editor.chain().focus().redo().run(),
      undefined,
      editor.can().redo(),
    ],
    [
      'Negrita',
      BoldIcon,
      () => editor.chain().focus().toggleBold().run(),
      editor.isActive('bold'),
      true,
    ],
    [
      'Cursiva',
      ItalicIcon,
      () => editor.chain().focus().toggleItalic().run(),
      editor.isActive('italic'),
      true,
    ],
    [
      'Subrayado',
      UnderlineIcon,
      () => editor.chain().focus().toggleUnderline().run(),
      editor.isActive('underline'),
      true,
    ],
    [
      'Tachado',
      StrikethroughIcon,
      () => editor.chain().focus().toggleStrike().run(),
      editor.isActive('strike'),
      true,
    ],
    [
      'Viñetas',
      ListIcon,
      () => editor.chain().focus().toggleBulletList().run(),
      editor.isActive('bulletList'),
      true,
    ],
    [
      'Lista numerada',
      ListOrderedIcon,
      () => editor.chain().focus().toggleOrderedList().run(),
      editor.isActive('orderedList'),
      true,
    ],
    ...(
      [
        ['left', 'Alinear a la izquierda', AlignLeftIcon],
        ['center', 'Centrar', AlignCenterIcon],
        ['right', 'Alinear a la derecha', AlignRightIcon],
        ['justify', 'Justificar', AlignJustifyIcon],
      ] as const
    ).map(
      ([valor, etiqueta, Icono]) =>
        [
          etiqueta,
          Icono,
          () => editor.chain().focus().setTextAlign(valor).run(),
          editor.isActive({ textAlign: valor }),
          true,
        ] as const,
    ),
    [
      'Enlace',
      LinkIcon,
      () => {
        setErrorEnlace(false)
        setEnlace(editor.getAttributes('link').href ?? '')
      },
      editor.isActive('link'),
      true,
    ],
  ] as const
  const formato = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? 0
  function aplicarEnlace() {
    if (enlace === null || !editor) return
    const valor = enlace.trim()
    if (!valor) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      try {
        const url = new URL(valor)
        if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error()
        editor.chain().focus().extendMarkRange('link').setLink({ href: valor }).run()
      } catch {
        setErrorEnlace(true)
        return
      }
    }
    setEnlace(null)
  }
  return (
    <div className="overflow-hidden rounded-lg border border-borde focus-within:border-violeta">
      <div
        role="group"
        aria-label="Formato del mensaje"
        className="flex flex-wrap items-center gap-1 border-b border-borde p-1"
      >
        <Select
          value={String(formato)}
          disabled={disabled}
          onValueChange={(value) => {
            const cadena = editor.chain().focus()
            if (value === '1' || value === '2' || value === '3') {
              cadena.setHeading({ level: Number(value) as 1 | 2 | 3 }).run()
            } else cadena.setParagraph().run()
          }}
        >
          <SelectTrigger size="sm" aria-label="Estilo de párrafo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value="0">Párrafo</SelectItem>
              {[1, 2, 3].map((nivel) => (
                <SelectItem key={nivel} value={String(nivel)}>
                  Título {nivel}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {acciones.map(([etiqueta, Icono, accion, activo, disponible]) => (
          <Button
            key={etiqueta}
            type="button"
            variant={activo ? 'secondary' : 'ghost'}
            size="icon-sm"
            disabled={disabled || !disponible}
            aria-label={etiqueta}
            aria-pressed={activo}
            title={etiqueta}
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={accion}
          >
            <Icono aria-hidden="true" />
          </Button>
        ))}
        <Button
          type="button"
          variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label="Resaltar"
          title="Resaltar"
          aria-pressed={editor.isActive('highlight')}
          disabled={disabled}
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fff2a8' }).run()}
        >
          <HighlighterIcon aria-hidden="true" />
        </Button>
      </div>
      {enlace !== null && (
        <div className="flex flex-wrap items-center gap-2 border-b border-borde p-2">
          <Input
            type="url"
            aria-label="Dirección del enlace"
            aria-invalid={errorEnlace}
            disabled={disabled}
            className="min-w-36 flex-1"
            placeholder="https://…"
            maxLength={2048}
            value={enlace}
            onChange={(evento) => {
              setEnlace(evento.target.value)
              setErrorEnlace(false)
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault()
                aplicarEnlace()
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={aplicarEnlace}
          >
            Aplicar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEnlace(null)}>
            Cancelar
          </Button>
          {errorEnlace && (
            <p role="alert" className="w-full text-sm text-error">
              Ingresá un enlace válido.
            </p>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
