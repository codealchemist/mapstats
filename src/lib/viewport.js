// Shared with the CSS: the 820px breakpoint where side panel and reports become sheets, and
// --chrome-top, the height reserved for the top bar (redefined per breakpoint in styles.css).
export const NARROW_QUERY = '(max-width: 820px)'
export const isNarrow = () => window.matchMedia?.(NARROW_QUERY).matches ?? window.innerWidth <= 820

export const chromeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-top')) || 72
