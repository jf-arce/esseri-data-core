import { Link } from 'react-router'
import { EyeIcon, PencilIcon } from 'lucide-react'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReglaWorkflow, TipoEvento } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  VARIANTE_CRITICIDAD,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto' },
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28' },
  { tipo: 'chip' },
  { tipo: 'texto', ancho: 'h-4 w-10' },
  { tipo: 'chip' },
  { tipo: 'accion' },
]

interface ReglasWorkflowTablaProps {
  reglas: ReglaWorkflow[]
  tiposEvento: TipoEvento[]
  cargando: boolean
  /** Con permiso de actualización: "Editar" y "Activar/Desactivar". Sin él, solo "Ver". */
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}

export function ReglasWorkflowTabla({
  reglas,
  tiposEvento,
  cargando,
  puedeActualizar,
  onCambiarActivo,
}: ReglasWorkflowTablaProps) {
  const nombreEvento = new Map(tiposEvento.map((tipo) => [tipo.id, tipo.nombre]))

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead>Regla</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Criticidad</TableHead>
            <TableHead>Aprob. humana</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead data-align="end">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} />
          ) : (
            reglas.map((regla) => (
              <TableRow key={regla.id}>
                <TableCell className="font-medium">{regla.nombre}</TableCell>
                <TableCell className="text-texto-2">
                  {nombreEvento.get(regla.tipo_evento_id) ?? 'Evento desconocido'}
                </TableCell>
                <TableCell>{ETIQUETA_ACCION[regla.tipo_accion]}</TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_CRITICIDAD[regla.criticidad]}>
                    {ETIQUETA_CRITICIDAD[regla.criticidad]}
                  </Badge>
                </TableCell>
                <TableCell>{regla.requiere_aprobacion_humana ? 'Sí' : 'No'}</TableCell>
                <TableCell>
                  <Badge variant={regla.activo ? 'exito' : 'neutro'}>
                    {regla.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/workflows/reglas/${regla.id}`}>
                        {puedeActualizar ? (
                          <PencilIcon data-icon="inline-start" />
                        ) : (
                          <EyeIcon data-icon="inline-start" />
                        )}
                        {puedeActualizar ? 'Editar' : 'Ver'}
                      </Link>
                    </Button>
                    {puedeActualizar && (
                      <Button variant="ghost" size="sm" onClick={() => onCambiarActivo(regla)}>
                        {regla.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
