// Offline fixtures for the news pipeline: a fake web served through a mock fetch.
const legacyId = (url) => Buffer.concat([Buffer.from([0x08, 0x13, 0x22, url.length]), Buffer.from(url), Buffer.from([0xd2, 0x01, 0x00])])
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const ARTICLES = {
  'https://www.eleco.com.ar/policiales/robo-tandil': {
    html: `<html><head><title>Robo en Tandil</title><meta property="og:image" content="/img/robo.jpg"><meta property="og:site_name" content="El Eco">
      <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: 'Robo a mano armada en un comercio de Tandil: detuvieron a dos jóvenes', datePublished: '2026-10-03T14:00:00-03:00', image: { url: 'https://www.eleco.com.ar/img/robo-full.jpg' }, publisher: { name: 'El Eco de Tandil' }, articleBody: 'TANDIL.- Dos jóvenes fueron detenidos este jueves tras asaltar a mano armada un comercio de la avenida Colón, en Tandil. Según informó la Policía, los delincuentes amenazaron al empleado con un arma de fuego y se llevaron la recaudación del día. Un vecino alertó al 911 y un patrullero los interceptó a pocas cuadras. Los investigadores secuestraron un revólver calibre 22 y el dinero robado. La causa quedó a cargo de la UFI N° 2, que imputó a ambos por robo calificado. ' + 'Más texto del cuerpo. '.repeat(40) })}</script></head><body><p>…</p></body></html>`,
  },
  'https://www.clarin.com/policiales/tandil-motochorros.html': {
    html: `<html><head><title>Motochorros en Tandil - Clarín</title><meta property="og:title" content="Ola de motochorros en Tandil: vecinos reclaman más patrullajes"><meta property="og:image" content="https://images.clarin.com/moto.jpg"></head>
      <body><nav>Menú Inicio Política Sociedad</nav><article><h1>Ola de motochorros en Tandil: vecinos reclaman más patrullajes</h1>
      <p>Los vecinos del barrio La Movediza, en Tandil, denunciaron una seguidilla de robos cometidos por delincuentes en moto durante las últimas dos semanas. Según los registros de la comisaría, hubo al menos once hechos con la misma modalidad, la mayoría contra mujeres que esperaban el colectivo.</p>
      <p>La Municipalidad anunció que sumará cámaras de seguridad y que coordinará con la Policía bonaerense nuevos operativos de control vehicular en los accesos al barrio, mientras los vecinos organizan un grupo de alerta por mensajería.</p>
      <p>${'Párrafo adicional con detalles de la investigación policial. '.repeat(12)}</p></article><footer>Copyright</footer></body></html>`,
  },
  'https://www.lanacion.com.ar/seguridad/paywall-tandil-nid123/': {
    html: `<html><head><meta property="og:title" content="Homicidio en Tandil: detienen a un sospechoso"><meta property="og:description" content="La víctima, de 34 años, fue atacada en la zona del Lago del Fuerte; la fiscalía investiga el crimen."></head><body><div class="paywall">Suscribite para seguir leyendo</div></body></html>`,
  },
  'https://www.privado.com.ar/privado/tandil-secuestro': { html: '<html><head><title>no debería leerse</title></head></html>' },
  'https://www.lento.com.ar/nota-tandil': { html: '<html></html>', delayMs: 6000 },
}

const article = (headline, body, publisher) => ({ html: `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline, datePublished: '2026-10-04T10:00:00-03:00', publisher: { name: publisher }, articleBody: body + ' ' + 'Más detalles de la causa. '.repeat(15) })}</script></head><body></body></html>` })
ARTICLES['https://www.adnsur.com.ar/trelew-turistas'] = article('Robaron a turistas de Tandil en Trelew: allanaron la casa del sospechoso', 'Una pareja de turistas sufrió un robo mientras visitaba el Museo Egidio Feruglio en la ciudad de Trelew. El delincuente rompió un vidrio de la camioneta y se llevó sus pertenencias; la Policía allanó la casa del sospechoso.', 'ADNSUR')
// No JSON-LD here: Readability's text starts with the <h1> headline (as on the real site), so the
// "happened elsewhere" check must look past the headline.
ARTICLES['https://www.diariojornada.com.ar/trelew-camioneta'] = { html: `<html><head><title>Jornada</title></head><body><article><h1>Allanaron y le secuestraron la camioneta al sospechado del robo a los turistas de Tandil</h1>
  <p>Personal de la comisaría segunda de Trelew este jueves realizó un allanamiento en calle Teresa de Calcuta al 4000. Se trata del domicilio del apuntado como autor del robo a una pareja de turistas en el Museo Egidio Feruglio.</p>
  <p>${'Los investigadores secuestraron la camioneta y otros elementos de interés para la causa. '.repeat(8)}</p></article></body></html>` }
ARTICLES['https://www.eldiariodetandil.com/nota-operativos'] = article('Múltiples operativos policiales en Tandil: motos recuperadas y una detención', 'Durante los últimos días, personal de las distintas dependencias policiales de Tandil llevó adelante una serie de procedimientos que permitieron recuperar cuatro motos robadas y detener a un hombre.', 'Mundo Poder')

const GN_ITEMS = [
  { url: 'https://www.eleco.com.ar/policiales/robo-tandil', title: 'Robo a mano armada en Tandil: detuvieron a dos - El Eco', source: 'El Eco', legacy: true },
  { url: 'https://www.clarin.com/policiales/tandil-motochorros.html', title: 'Ola de motochorros en Tandil - Clarín', source: 'Clarín', legacy: false, id: 'AU_yqLclarin' },
  { url: 'https://www.lanacion.com.ar/seguridad/paywall-tandil-nid123/', title: 'Homicidio en Tandil: detienen a un sospechoso - LA NACION', source: 'LA NACION', legacy: true },
  { url: 'https://www.privado.com.ar/privado/tandil-secuestro', title: 'Secuestro exprés en Tandil - Privado', source: 'Privado', legacy: true },
  { url: 'https://www.lento.com.ar/nota-tandil', title: 'Tiroteo en Tandil - Lento', source: 'Lento', legacy: true },
  { url: 'https://www.eleco.com.ar/sociales/sepelios', title: 'Sepelios y participaciones de Tandil - El Eco', source: 'El Eco', legacy: true },
  { url: 'https://www.infobae.com/x', title: 'Robo a mano armada en Tandil: detuvieron a dos - Infobae', source: 'Infobae', legacy: true },
  { url: 'https://www.adnsur.com.ar/trelew-turistas', title: 'Robaron a turistas de Tandil en Trelew: allanaron la casa del sospechoso y secuestraron su camioneta - ADNSUR', source: 'ADNSUR', legacy: true },
  { url: 'https://www.diariojornada.com.ar/trelew-camioneta', title: 'Allanaron y le secuestraron la camioneta al sospechado del robo a los turistas de Tandil - Diario Jornada', source: 'Diario Jornada', legacy: true },
  { url: 'https://www.eldiariodetandil.com/nota-operativos', title: 'Múltiples operativos policiales en Tandil: motos recuperadas y una detención - El Diario de Tandil', source: 'El Diario de Tandil', legacy: true },
]

const rss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Google News</title>${items.map((it) => {
  const id = it.legacy ? legacyId(it.url) : it.id
  return `<item><title>${it.title}</title><link>https://news.google.com/rss/articles/${id}?oc=5</link><guid isPermaLink="false">${id}</guid><pubDate>Fri, 03 Oct 2026 17:00:00 GMT</pubDate><description>&lt;a href="x"&gt;${it.title}&lt;/a&gt;</description><source url="https://www.${it.source.toLowerCase().replace(/\W/g, '')}.com">${it.source}</source></item>`
}).join('')}</channel></rss>`

const OUTLET_FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>El Eco</title>
  <item><title>Allanamientos en Tandil por una banda de ladrones de autos</title><link>https://www.eleco.com.ar/policiales/allanamientos</link><pubDate>Sat, 04 Oct 2026 10:00:00 GMT</pubDate><description>La Policía realizó cinco allanamientos en Tandil y detuvo a tres personas acusadas de robar autos.</description><enclosure url="https://www.eleco.com.ar/img/allan.jpg" type="image/jpeg"/></item>
  <item><title>Fiesta de la Miel en Tandil</title><link>https://www.eleco.com.ar/cultura/miel</link><pubDate>Sat, 04 Oct 2026 09:00:00 GMT</pubDate><description>Programa completo de la fiesta.</description></item>
</channel></rss>`
ARTICLES['https://www.eleco.com.ar/policiales/allanamientos'] = { html: `<html><head><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"Allanamientos en Tandil por una banda de ladrones de autos","articleBody":"La Policía de la provincia de Buenos Aires realizó cinco allanamientos simultáneos en Tandil y detuvo a tres personas acusadas de integrar una banda dedicada al robo de autos. En los procedimientos se secuestraron dos vehículos con pedido de captura, herramientas para forzar cerraduras y documentación apócrifa. ${'Más información. '.repeat(20)}"}]}</script></head><body></body></html>` }

export function makeWeb({ down = false, thinScoped = false } = {}) {
  const log = []
  const respond = (body, { status = 200, type = 'text/html' } = {}) => ({ ok: status < 400, status, url: undefined, headers: { get: () => type }, text: async () => body })
  const fetchImpl = async (url, opts = {}) => {
    log.push(url)
    if (down) throw new Error('network down')
    const u = new URL(url)
    if (u.pathname === '/robots.txt') return respond(u.host.includes('privado') ? 'User-agent: *\nDisallow: /privado/\n' : 'User-agent: *\nDisallow: /admin/\n', { type: 'text/plain' })
    if (u.host === 'news.google.com' && u.pathname === '/rss/search') {
      // thinScoped: the place + province + country search finds a single article (as for small towns).
      const scoped = u.searchParams.get('q').includes('"Argentina"')
      return respond(rss(thinScoped && scoped ? GN_ITEMS.slice(0, 1) : GN_ITEMS), { type: 'application/rss+xml' })
    }
    if (u.host === 'news.google.com' && u.pathname === '/rss/articles/AU_yqLclarin') return respond('<html><c-wiz><div jscontroller="x" data-n-a-sg="SIG123" data-n-a-ts="1759500000"></div></c-wiz></html>')
    if (u.host === 'news.google.com' && u.pathname.includes('batchexecute')) {
      const ok = String(opts.body).includes('SIG123') && String(opts.body).includes('AU_yqLclarin')
      return respond(`)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"${ok ? 'https://www.clarin.com/policiales/tandil-motochorros.html' : ''}\\",1]",null,null,null,"generic"]]`)
    }
    if (u.host === 'www.eleco.com.ar' && u.pathname === '/') return respond('<html><head><link rel="alternate" type="application/rss+xml" href="/rss/policiales.xml"></head></html>')
    if (u.host === 'www.eleco.com.ar' && u.pathname === '/rss/policiales.xml') return respond(OUTLET_FEED, { type: 'application/rss+xml' })
    if (url === 'https://articapiv3.eleco.com.ar/feed-notes') return respond(OUTLET_FEED, { type: 'application/rss+xml' })
    const a = ARTICLES[url]
    if (a) {
      if (a.delayMs) await new Promise((r, j) => { const t = setTimeout(r, a.delayMs); opts.signal?.addEventListener('abort', () => { clearTimeout(t); j(new Error('aborted')) }) })
      return respond(a.html)
    }
    return respond('not found', { status: 404 })
  }
  return { fetchImpl, log }
}
