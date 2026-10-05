import { Newspaper, ExternalLink, LoaderCircle, CircleAlert, RefreshCw } from 'lucide-react'
import { useNews } from '../hooks/useNews.js'
import { googleNewsUrl } from '../lib/news.js'

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d) / 86_400_000)
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

export function NewsSection({ entity, country, model }) {
  const news = useNews(entity, country, model)
  const more = news.query && googleNewsUrl(news.query, country.iso2)
  const loading = news.status === 'loading'

  return (
    <section id="sec-news" className="report-section">
      <div className="section-head">
        <Newspaper size={16} />
        <div>
          <h3>In the news</h3>
          <div className="muted small">Recent crime coverage mentioning {entity.name} · last 30 days</div>
        </div>
        {loading
          ? <LoaderCircle size={15} className="spin muted push" />
          : news.status === 'partial' && <button className="icon-btn sm push" onClick={news.refresh} title="Load the remaining excerpts"><RefreshCw size={14} /></button>}
      </div>

      {loading && !news.articles.length && <p className="chart-foot">Searching news and reading articles… the first search for a place can take a few seconds.</p>}

      {news.status === 'error' || news.status === 'unavailable' ? (
        <div className="missing">
          <div className="missing-head"><CircleAlert size={13} /> News unavailable</div>
          <div className="missing-list">{news.error}{news.code === 'no-service' ? '' : ' Use the Google News link below meanwhile.'}</div>
        </div>
      ) : null}

      {['fresh', 'cached', 'partial'].includes(news.status) && news.articles.length === 0 && (
        <p className="chart-foot">No crime-related articles mentioning {entity.name} in the last 30 days.</p>
      )}

      {news.articles.length > 0 && (
        <div className="news-cards">
          {news.articles.map((a) => (
            <article key={a.url} className={`news-card ${a.image ? 'has-img' : ''}`}>
              {a.image && (
                <a href={a.url} target="_blank" rel="noreferrer noopener" className="news-img" tabIndex={-1} aria-hidden="true">
                  <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.closest('.news-card')?.classList.remove('has-img'); e.currentTarget.parentElement.remove() }} />
                </a>
              )}
              <div className="news-body">
                <div className="news-meta">{a.source}{a.publishedAt && <> · {fmtDate(a.publishedAt)}</>}</div>
                <h4 className="news-title"><a href={a.url} target="_blank" rel="noreferrer noopener">{a.title}</a></h4>
                {a.excerpt
                  ? <p className="news-excerpt">{a.excerpt}{a.excerptFrom === 'description' && <span className="faint"> (outlet’s summary)</span>}</p>
                  : <p className="news-excerpt faint">{a.note || 'No excerpt available.'}</p>}
                <a className="news-link" href={a.url} target="_blank" rel="noreferrer noopener">Read on {a.source} <ExternalLink size={11} /></a>
              </div>
            </article>
          ))}
        </div>
      )}

      {news.status === 'partial' && <p className="chart-foot">Some excerpts are still loading — <button className="link small" onClick={news.refresh}>refresh</button>.</p>}
      <p className="chart-foot">
        Excerpts are the first lines of each article (max 400 characters), linked to the original. Coverage reflects what outlets report, not how much crime there is; it never affects scores.
        {more && <> <a href={more} target="_blank" rel="noreferrer">Search more on Google News <ExternalLink size={10} /></a></>}
      </p>
      {news.fetchedAt && <p className="chart-foot faint">Fetched {new Date(news.fetchedAt).toLocaleString()} · cached until {news.expiresAt ? new Date(news.expiresAt).toLocaleString() : '—'} · query: {news.query}{news.fallbackQuery && <> · few results, so also searched: {news.fallbackQuery}</>}</p>}
    </section>
  )
}
