// ────────────────────────────────────────────────────────────────────────────
//  Archive.org API helpers for ArchiveFlix
// ────────────────────────────────────────────────────────────────────────────

const BASE_SEARCH = 'https://archive.org/advancedsearch.php'
const BASE_METADATA = 'https://archive.org/metadata'
const THUMB = (id) => `https://archive.org/services/img/${id}`
const STREAM_BASE = 'https://archive.org/download'

export { THUMB, STREAM_BASE }

/**
 * Build a thumbnail URL with a fallback.
 */
export const getThumbnail = (identifier) =>
  `https://archive.org/services/img/${identifier}`

/**
 * Fetch metadata for a single item.
 * Returns the full metadata object from archive.org.
 */
export async function fetchMetadata(identifier) {
  const res = await fetch(`${BASE_METADATA}/${identifier}`)
  if (!res.ok) throw new Error(`Metadata fetch failed for ${identifier}`)
  return res.json()
}

/**
 * Generic search helper.
 * @param {object} params  - key/value pairs added to the query string
 * @returns {Array}         - array of items from the response
 */
async function search(params) {
  const defaults = {
    output: 'json',
    'fl[]': 'identifier,title,description,subject,year,runtime,creator,downloads',
    rows: 24,
    page: 1,
    'sort[]': 'downloads desc',
  }
  const merged = { ...defaults, ...params }
  const qs = Object.entries(merged)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(`${BASE_SEARCH}?${qs}`)
  if (!res.ok) throw new Error('Archive.org search failed')
  const data = await res.json()
  return data?.response?.docs ?? []
}

// ── Category presets ──────────────────────────────────────────────────────────

export const CATEGORIES = [
  {
    id: 'feature_films',
    label: '🎬 Feature Films',
    query: 'mediatype:movies AND subject:"feature film" AND -subject:xxx',
  },
  {
    id: 'classic_tv',
    label: '📺 Classic TV',
    query: 'mediatype:movies AND subject:"television" AND -subject:xxx',
  },
  {
    id: 'documentaries',
    label: '🎥 Documentaries',
    query: 'mediatype:movies AND subject:"documentary" AND -subject:xxx',
  },
  {
    id: 'animation',
    label: '🎭 Animation & Cartoons',
    query: 'collection:animationandcartoons AND -subject:xxx',
  },
  {
    id: 'short_films',
    label: '🎞 Short Films',
    query: 'mediatype:movies AND subject:"short film" AND -subject:xxx',
  },
  {
    id: 'horror',
    label: '👻 Horror',
    query: 'mediatype:movies AND subject:"horror" AND -subject:xxx',
  },
  {
    id: 'science_fiction',
    label: '🚀 Science Fiction',
    query: 'mediatype:movies AND subject:"science fiction" AND -subject:xxx',
  },
  {
    id: 'comedy',
    label: '😂 Comedy',
    query: 'mediatype:movies AND subject:"comedy" AND -subject:xxx',
  },
  {
    id: 'silent_films',
    label: '🎩 Silent Films',
    query: 'collection:silenthalloffame AND -subject:xxx',
  },
  {
    id: 'news',
    label: '📰 News & Public Affairs',
    query: 'collection:news_and_public_affairs AND -subject:xxx',
  },
]

/**
 * Fetch videos for a specific category.
 */
export async function fetchCategory(categoryId, rows = 24) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)
  if (!cat) throw new Error(`Unknown category: ${categoryId}`)
  return search({ q: cat.query, rows })
}

/**
 * Search across all video content.
 */
export async function searchVideos(query, rows = 40) {
  return search({
    q: `mediatype:movies AND (title:(${query}) OR subject:(${query})) AND -subject:xxx`,
    rows,
    'sort[]': 'downloads desc',
  })
}

/**
 * Fetch a curated hero item by picking the most-downloaded item from feature films.
 */
export async function fetchHeroItem() {
  const items = await search({
    q: 'mediatype:movies AND subject:"feature film" AND -subject:xxx AND year:[1930 TO 1980]',
    rows: 20,
    'sort[]': 'downloads desc',
  })
  // Pick a semi-random item from top results so it feels fresh
  const idx = Math.floor(Math.random() * Math.min(items.length, 10))
  return items[idx] ?? null
}

/**
 * Given an archive.org identifier, return a streamable video URL.
 * Fetches the item's file list and picks the best video file.
 */
export async function getStreamUrl(identifier) {
  try {
    const meta = await fetchMetadata(identifier)
    const files = meta?.files ?? []

    // Archive.org transcodes originals into derivative mp4s for browser streaming.
    // Prefer those first; fall back to any mp4, then other browser-native formats.
    // Avoid avi / mov / mkv – browsers cannot natively stream these.

    // 1. Derivative mp4 (H.264 web-optimised transcode)
    const derivMp4 = files.find(
      (f) => f.name?.toLowerCase().endsWith('.mp4') && f.source === 'derivative'
    )
    if (derivMp4) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(derivMp4.name)}`

    // 2. Any mp4 (original or unknown source)
    const anyMp4 = files.find((f) => f.name?.toLowerCase().endsWith('.mp4'))
    if (anyMp4) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(anyMp4.name)}`

    // 3. Other browser-playable formats
    for (const ext of ['webm', 'ogv', 'mpeg', 'mpg']) {
      const match = files.find((f) => f.name?.toLowerCase().endsWith(`.${ext}`))
      if (match) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(match.name)}`
    }
  } catch (e) {
    console.warn('getStreamUrl error', e)
  }
  return null
}
