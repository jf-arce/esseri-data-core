// Tres puntos que saltan en secuencia: indica que el valor se está cargando.
export function PuntosCargando() {
  return (
    <span className="flex items-center gap-1" role="status" aria-label="Cargando">
      {[0, 150, 300].map((demora) => (
        <span
          key={demora}
          className="size-1.5 animate-bounce rounded-full bg-texto-3 motion-reduce:animate-pulse"
          style={{ animationDelay: `${demora}ms` }}
        />
      ))}
    </span>
  )
}
