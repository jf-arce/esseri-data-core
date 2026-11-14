import { cn } from '@/lib/utils'
import { CopyIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ConfigAccionCampos,
  type ContextoConfig,
} from '@/modules/workflows/components/config-accion-campos'
import { DestinatariosCampos } from '@/modules/workflows/components/destinatarios-campos'
import { ValorComparacion } from '@/modules/workflows/components/valor-comparacion'
import { PlantillaCampos } from '@/modules/workflows/components/plantilla-campos'
import {
  CLASE_SELECT_ADAPTABLE,
  LIMITE_NOMBRE_REGLA,
  MAX_COMPARACIONES,
} from '@/modules/workflows/constants'
import type { useDestinatariosDisponibles } from '@/modules/workflows/hooks/use-destinatarios-disponibles'
import type { usePlantillas } from '@/modules/workflows/hooks/use-plantillas'
import {
  CRITICIDADES,
  type DestinatariosNodo,
  type LogicaCondicion,
  type Operador,
  type TipoAccionCatalogo,
  type TipoEvento,
} from '@/modules/workflows/types'
import {
  admiteDestinatarios,
  asignaTareas,
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  ETIQUETA_OPERADOR,
  etiquetaEvento,
  OPERADORES_POR_TIPO_DATO,
} from '@/modules/workflows/utils'
import {
  cambiarCampoDeComparacion,
  estadoDeBloque,
  GRUPOS_ACCION,
  valoresDeAccion,
  type BorradorFlujo,
  type ComparacionEditor,
  type NodoEditor,
} from '@/modules/workflows/utils-grafo'

const SIN_DESTINATARIOS: DestinatariosNodo = { roles: [], usuarios: [] }

export interface InspectorNodoProps {
  /** `'disparador'` o el nodo elegido en el lienzo. */
  seleccion: 'disparador' | NodoEditor
  borrador: BorradorFlujo
  tiposEvento: TipoEvento[]
  tiposAccion: TipoAccionCatalogo[]
  evento: TipoEvento | undefined
  contexto: ContextoConfig
  plantillas: ReturnType<typeof usePlantillas>
  destinatariosDisponibles: ReturnType<typeof useDestinatariosDisponibles>
  /** Destinatarios tal como están guardados, para mostrar usuarios que ya no están activos. */
  destinatariosGuardados: DestinatariosNodo
  soloLectura: boolean
  /** Primer problema del nodo, si falta algo. */
  error?: string
  onCambiarRegla: (cambios: Partial<Pick<BorradorFlujo, 'nombre' | 'criticidad'>>) => void
  onCambiarEvento: (tipoEventoId: string) => void
  onCambiarNodo: (id: string, cambios: Partial<NodoEditor>) => void
  onDuplicar: (id: string) => void
  onEliminar: (id: string) => void
  onCerrar: () => void
}

function Encabezado({
  titulo,
  descripcion,
  onCerrar,
}: {
  titulo: string
  descripcion: string
  onCerrar: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold break-words text-texto">{titulo}</h2>
        <p className="text-xs text-texto-2">{descripcion}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Cerrar el panel" onClick={onCerrar}>
        <XIcon />
      </Button>
    </div>
  )
}

function PanelDisparador({
  borrador,
  tiposEvento,
  soloLectura,
  onCambiarRegla,
  onCambiarEvento,
}: Pick<
  InspectorNodoProps,
  'borrador' | 'tiposEvento' | 'soloLectura' | 'onCambiarRegla' | 'onCambiarEvento'
>) {
  const evento = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="regla-nombre">Nombre de la regla</FieldLabel>
        <Input
          id="regla-nombre"
          value={borrador.nombre}
          maxLength={LIMITE_NOMBRE_REGLA}
          disabled={soloLectura}
          onChange={(e) => onCambiarRegla({ nombre: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="regla-evento">Cuándo se dispara</FieldLabel>
        <Select
          value={borrador.tipoEventoId}
          onValueChange={onCambiarEvento}
          disabled={soloLectura}
        >
          <SelectTrigger id="regla-evento" className={CLASE_SELECT_ADAPTABLE}>
            <SelectValue placeholder="Elegir cuándo se dispara" />
          </SelectTrigger>
          <SelectContent>
            {tiposEvento.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                {etiquetaEvento(tipo.nombre)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {evento?.descripcion && <FieldDescription>{evento.descripcion}</FieldDescription>}
      </Field>
      <Field>
        <FieldLabel htmlFor="regla-criticidad">Criticidad</FieldLabel>
        <Select
          value={borrador.criticidad}
          disabled={soloLectura}
          onValueChange={(valor) => {
            const criticidad = CRITICIDADES.find((item) => item === valor)
            if (criticidad) onCambiarRegla({ criticidad })
          }}
        >
          <SelectTrigger id="regla-criticidad" className={CLASE_SELECT_ADAPTABLE}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRITICIDADES.map((criticidad) => (
              <SelectItem key={criticidad} value={criticidad}>
                {ETIQUETA_CRITICIDAD[criticidad]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

function FilaComparacion({
  indice,
  comparacion,
  campos,
  soloLectura,
  puedeQuitar,
  onCambiar,
  onQuitar,
}: {
  indice: number
  comparacion: ComparacionEditor
  campos: TipoEvento['campos']
  soloLectura: boolean
  puedeQuitar: boolean
  onCambiar: (comparacion: ComparacionEditor) => void
  onQuitar: () => void
}) {
  const campo = campos.find((item) => item.nombre_interno === comparacion.campo)
  const operadores = campo ? OPERADORES_POR_TIPO_DATO[campo.tipo_dato] : []
  const sufijo = `comparacion-${indice}`
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg bg-fila-hover p-3">
      <legend className="sr-only">Comparación {indice + 1}</legend>
      <div className="flex items-center gap-2">
        <Select
          value={comparacion.campo}
          disabled={soloLectura}
          onValueChange={(nombre) =>
            onCambiar(
              cambiarCampoDeComparacion(
                campos.find((item) => item.nombre_interno === nombre) ?? null,
              ),
            )
          }
        >
          <SelectTrigger
            id={`${sufijo}-campo`}
            aria-label="Campo"
            className={cn(CLASE_SELECT_ADAPTABLE, 'bg-superficie')}
          >
            <SelectValue placeholder="Elegir campo" />
          </SelectTrigger>
          <SelectContent>
            {campos.map((item) => (
              <SelectItem key={item.id} value={item.nombre_interno}>
                {item.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {puedeQuitar && !soloLectura && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar la comparación ${indice + 1}`}
            onClick={onQuitar}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      {campo && (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Select
            value={comparacion.operador}
            disabled={soloLectura}
            onValueChange={(valor) => {
              const operador = operadores.find((item: Operador) => item === valor)
              if (operador) onCambiar({ ...comparacion, operador })
            }}
          >
            <SelectTrigger
              aria-label="Operador"
              className={cn(CLASE_SELECT_ADAPTABLE, 'min-w-24 bg-superficie')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operadores.map((operador: Operador) => (
                <SelectItem key={operador} value={operador}>
                  {ETIQUETA_OPERADOR[operador]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ValorComparacion
            tipoDato={campo.tipo_dato}
            valor={comparacion.valor}
            disabled={soloLectura}
            onChange={(valor) => onCambiar({ ...comparacion, valor })}
          />
        </div>
      )}
    </fieldset>
  )
}

function PanelCondicion({
  nodo,
  evento,
  soloLectura,
  onCambiarNodo,
}: {
  nodo: NodoEditor
  evento: TipoEvento | undefined
  soloLectura: boolean
  onCambiarNodo: InspectorNodoProps['onCambiarNodo']
}) {
  const campos = evento?.campos ?? []
  function cambiar(indice: number, comparacion: ComparacionEditor) {
    onCambiarNodo(nodo.id, {
      comparaciones: nodo.comparaciones.map((actual, i) => (i === indice ? comparacion : actual)),
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-texto-2">
        Si se cumple, el flujo sigue por la salida <strong className="text-exito">Sí</strong>; si
        no, por la salida <strong className="text-error">No</strong>.
      </p>
      {!evento && <FieldDescription>Elegí primero el evento disparador.</FieldDescription>}
      {nodo.comparaciones.length > 1 && (
        <Field>
          <FieldLabel htmlFor="condicion-logica">Cuándo se cumple</FieldLabel>
          <Select
            value={nodo.logica}
            disabled={soloLectura}
            onValueChange={(valor) => {
              const logica: LogicaCondicion = valor === 'alguna' ? 'alguna' : 'todas'
              onCambiarNodo(nodo.id, { logica })
            }}
          >
            <SelectTrigger id="condicion-logica" className={CLASE_SELECT_ADAPTABLE}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Se cumplen todas</SelectItem>
              <SelectItem value="alguna">Se cumple alguna</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex flex-col gap-2">
        {nodo.comparaciones.map((comparacion, indice) => (
          <FilaComparacion
            // El índice es la identidad: las comparaciones no tienen id propio.
            key={indice}
            indice={indice}
            comparacion={comparacion}
            campos={campos}
            soloLectura={soloLectura || !evento}
            puedeQuitar={nodo.comparaciones.length > 1}
            onCambiar={(nueva) => cambiar(indice, nueva)}
            onQuitar={() =>
              onCambiarNodo(nodo.id, {
                comparaciones: nodo.comparaciones.filter((_, i) => i !== indice),
              })
            }
          />
        ))}
      </div>
      {!soloLectura && nodo.comparaciones.length < MAX_COMPARACIONES && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            onCambiarNodo(nodo.id, {
              comparaciones: [...nodo.comparaciones, { campo: '', operador: '', valor: '' }],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Agregar comparación
        </Button>
      )}
    </div>
  )
}

function PanelAccion({
  nodo,
  tiposAccion,
  evento,
  contexto,
  plantillas,
  destinatariosDisponibles,
  destinatariosGuardados,
  soloLectura,
  onCambiarNodo,
}: Pick<
  InspectorNodoProps,
  | 'tiposAccion'
  | 'evento'
  | 'contexto'
  | 'plantillas'
  | 'destinatariosDisponibles'
  | 'destinatariosGuardados'
  | 'soloLectura'
  | 'onCambiarNodo'
> & { nodo: NodoEditor }) {
  const catalogo = tiposAccion.find((tipo) => tipo.tipo_accion === nodo.tipoAccion)
  const nombreEvento = evento?.nombre ?? null
  const hayColumnaExtra =
    (nodo.tipoAccion !== '' && catalogo?.admite_plantilla === true) ||
    admiteDestinatarios(nodo.tipoAccion, nodo.config)

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="accion-tipo">Tipo de acción</FieldLabel>
        <Select
          value={nodo.tipoAccion}
          disabled={soloLectura}
          onValueChange={(tipo) => {
            const elegida = tiposAccion.find((item) => item.tipo_accion === tipo)
            if (!elegida) return
            onCambiarNodo(nodo.id, {
              ...valoresDeAccion(elegida),
              plantillaId: elegida.admite_plantilla ? nodo.plantillaId : '',
            })
          }}
        >
          <SelectTrigger id="accion-tipo" className={CLASE_SELECT_ADAPTABLE}>
            <SelectValue placeholder="Elegir acción" />
          </SelectTrigger>
          <SelectContent>
            {GRUPOS_ACCION.flatMap((grupo) => grupo.acciones).map((tipo) => {
              const { estado, motivo } = estadoDeBloque(tipo, tiposAccion, nombreEvento)
              const sinConcepto =
                contexto.conceptos.length === 0 &&
                (tipo === 'generar_cargo' || tipo === 'actualizar_cuenta_corriente')
              return (
                <SelectItem
                  key={tipo}
                  value={tipo}
                  disabled={estado !== 'disponible' || sinConcepto}
                  title={motivo ?? undefined}
                >
                  {ETIQUETA_ACCION[tipo]}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </Field>
      {nodo.tipoAccion !== '' && (
        <ConfigAccionCampos
          tipoAccion={nodo.tipoAccion}
          valores={nodo.config}
          contexto={{ ...contexto, deshabilitado: soloLectura }}
          onCambiar={(nombre, valor) =>
            onCambiarNodo(nodo.id, { config: { ...nodo.config, [nombre]: valor } })
          }
        />
      )}
      <Field orientation="horizontal">
        <Switch
          id="accion-aprobacion"
          checked={nodo.requiereAprobacionHumana}
          disabled={soloLectura}
          onCheckedChange={(checked) =>
            onCambiarNodo(nodo.id, { requiereAprobacionHumana: checked })
          }
        />
        <FieldLabel htmlFor="accion-aprobacion">Requiere aprobación humana</FieldLabel>
      </Field>
      {hayColumnaExtra && (
        <div className="flex flex-col gap-4 border-t border-borde pt-4">
          {nodo.tipoAccion !== '' && catalogo?.admite_plantilla && (
            <div className="flex flex-col gap-2">
              <PlantillaCampos
                tipoAccion={nodo.tipoAccion}
                plantillaId={nodo.plantillaId}
                evento={evento}
                plantillas={plantillas}
                deshabilitado={soloLectura}
                onElegir={(plantillaId) => onCambiarNodo(nodo.id, { plantillaId })}
              />
              <p className="text-xs text-texto-2">
                Se guarda al instante y afecta a todas las reglas que la usan.
              </p>
            </div>
          )}
          {admiteDestinatarios(nodo.tipoAccion, nodo.config) && (
            <DestinatariosCampos
              seleccion={nodo.seleccion}
              guardados={destinatariosGuardados}
              disponibles={destinatariosDisponibles}
              deshabilitado={soloLectura}
              etiqueta={asignaTareas(nodo.tipoAccion) ? 'Asignar a' : undefined}
              onCambiar={(seleccion) => onCambiarNodo(nodo.id, { seleccion })}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Panel lateral no modal: edita el nodo elegido en el lienzo sin tapar el flujo. Los cambios se
 * aplican al borrador al instante; "Guardar regla" es lo que persiste. */
export function InspectorNodo(props: InspectorNodoProps) {
  const { seleccion, soloLectura, error, onCerrar, onDuplicar, onEliminar } = props
  const nodo = seleccion === 'disparador' ? null : seleccion
  const titulo = nodo === null ? 'Disparador' : nodo.tipo === 'condicion' ? 'Condición' : 'Acción'
  const descripcion =
    nodo === null
      ? 'Qué evento dispara la regla.'
      : nodo.tipo === 'condicion'
        ? 'Qué se compara para decidir entre Sí y No.'
        : 'Qué hace la regla y a quién avisa.'

  return (
    <aside
      aria-label={`Configurar ${titulo.toLowerCase()}`}
      className="panel-entrar flex min-h-0 w-full min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-panel bg-superficie p-4 break-words shadow-card"
    >
      <Encabezado titulo={titulo} descripcion={descripcion} onCerrar={onCerrar} />
      {error && <p className="text-sm font-medium text-error">{error}</p>}
      {nodo === null && <PanelDisparador {...props} />}
      {nodo?.tipo === 'condicion' && (
        <PanelCondicion
          nodo={nodo}
          evento={props.evento}
          soloLectura={soloLectura}
          onCambiarNodo={props.onCambiarNodo}
        />
      )}
      {nodo?.tipo === 'accion' && (
        <PanelAccion
          {...props}
          nodo={nodo}
          destinatariosGuardados={props.destinatariosGuardados ?? SIN_DESTINATARIOS}
        />
      )}
      {nodo && !soloLectura && (
        <div className="mt-auto flex gap-2 border-t border-borde pt-4">
          <Button variant="secondary" size="sm" onClick={() => onDuplicar(nodo.id)}>
            <CopyIcon data-icon="inline-start" />
            Duplicar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEliminar(nodo.id)}>
            <Trash2Icon data-icon="inline-start" />
            Eliminar
          </Button>
        </div>
      )}
    </aside>
  )
}
