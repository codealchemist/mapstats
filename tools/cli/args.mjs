// Minimal argument parsing for the CLI: positional values, then --flag value / --flag (true); repeated flags
// collect into arrays.
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const [k, inline] = a.slice(2).split(/=(.*)/s)
    const v = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
    out[k] = k in out ? [].concat(out[k], v) : v
  }
  return out
}
