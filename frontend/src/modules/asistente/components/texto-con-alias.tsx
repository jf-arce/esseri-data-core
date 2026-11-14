import { Link } from 'react-router'
import type { AliasResuelto } from '../types'
import { etiquetaGenerica, nombreCorrido, partirTextoConAlias, rutaDeEntidad } from '../utils'

interface TextoConAliasProps {
  texto: string
  /** Nombres ya resueltos por el backend, indexados por alias. */
  porAlias: Record<string, AliasResuelto>
}

/** Muestra un texto del asistente con cada alias reemplazado por el nombre real (con link a su
 * ficha) cuando el backend lo autorizó. */
export function TextoConAlias({ texto, porAlias }: TextoConAliasProps) {
  return (
    <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
      {partirTextoConAlias(texto).map((trozo, indice) => {
        if (trozo.tipo === 'texto') return <span key={indice}>{trozo.valor}</span>
        const resuelto = porAlias[trozo.alias]
        if (resuelto === undefined) {
          return (
            <span key={indice} className="font-medium text-texto-2">
              {etiquetaGenerica(trozo.alias)}
            </span>
          )
        }
        const ruta = rutaDeEntidad(resuelto.tipo, resuelto.entidad_id)
        if (ruta === null) {
          return (
            <span key={indice} className="font-medium text-texto">
              {nombreCorrido(resuelto.nombre)}
            </span>
          )
        }
        return (
          <Link
            key={indice}
            to={ruta}
            className="font-medium text-violeta underline-offset-2 hover:underline"
          >
            {nombreCorrido(resuelto.nombre)}
          </Link>
        )
      })}
    </p>
  )
}
