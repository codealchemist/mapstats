// Shared with the CSS: the 820px breakpoint where side panel and reports become sheets, and
// --chrome-top, the height reserved for the top bar (redefined per breakpoint in styles.css).
export const NARROW_QUERY = '(max-width: 820px)'
export const isNarrow = () => window.matchMedia?.(NARROW_QUERY).matches ?? window.innerWidth <= 820
export const HOVER_QUERY = '(hover: hover)'

/** A media query as an external store ({ subscribe, get }, for useSyncExternalStore), its MediaQueryList made once. */
export function mediaStore(query) {
  let mql
  const list = () => (mql ??= window.matchMedia?.(query))
  return {
    subscribe: (cb) => {
      list()?.addEventListener('change', cb)
      return () => list()?.removeEventListener('change', cb)
    },
    get: () => list()?.matches ?? false,
  }
}

// Shared stores for the two queries the app reacts to: narrow screens (sheets instead of panels) and hover-capable
// pointers (hover popups and tooltips). Charts and the map read the same ones, so they agree on what a device is.
export const narrowMedia = mediaStore(NARROW_QUERY)
export const hoverMedia = mediaStore(HOVER_QUERY)

export const chromeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-top')) || 72
