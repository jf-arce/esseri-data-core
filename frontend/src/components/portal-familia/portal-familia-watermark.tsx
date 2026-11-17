/** Decorative brand layer, below page content and outside data surfaces. */
export function PortalFamiliaWatermark() {
  return (
    <div
      data-slot="portal-familia-watermark"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      <img
        src="/esseri-icon.png"
        alt=""
        draggable={false}
        className="absolute right-4 bottom-8 w-[min(55vw,16rem)] opacity-10 sm:right-8"
      />
    </div>
  )
}
