// ────────────────────────────────────────────────────────────────────────────
//  Archive.org API helpers for ArchiveFlix
// ────────────────────────────────────────────────────────────────────────────

const BASE_SEARCH = 'https://archive.org/advancedsearch.php'
const BASE_METADATA = 'https://archive.org/metadata'
const THUMB = (id) => `https://archive.org/services/img/${id}`
const STREAM_BASE = 'https://archive.org/download'

// ────────────────────────────────────────────────────────────────────────────
//  Content filtering configuration
// ────────────────────────────────────────────────────────────────────────────

const EXPLICIT_SUBJECTS = [
  'xxx',
  'adult',
  'explicit',
  'pornography',
  'erotic',
  'nudity',
  'obscene',
]

const CONTENT_FILTER_QUERY = EXPLICIT_SUBJECTS.map(s => `-subject:"${s}"`).join(' ')

export { THUMB, STREAM_BASE }

/**
 * Build a thumbnail URL with a fallback.
 */
export const getThumbnail = (identifier) =>
  `https://archive.org/services/img/${identifier}`

/**
 * Check if an item should be filtered based on its metadata.
 * This is a client-side safety check to catch inappropriate content.
 */
function isAppropriate(item) {
  const subjects = Array.isArray(item.subject) ? item.subject.join(' ') : (item.subject || '')
  const text = `${item.title || ''} ${item.description || ''} ${subjects}`.toLowerCase()
  const inappropriateKeywords = [
    'xxx', 'adult', 'explicit', 'pornography', 'erotic', 'nudity', 'obscene'
  ]
  return !inappropriateKeywords.some(keyword => text.includes(keyword))
}

/**
 * Filter array of items to exclude inappropriate content.
 */
function filterAppropriate(items) {
  return items.filter(isAppropriate)
}

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
    rows: 20,
    page: 1,
    'sort[]': 'downloads desc',
  }
  const merged = { ...defaults, ...params }
  const qs = Object.entries(merged)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  
  try {
    const res = await fetch(`${BASE_SEARCH}?${qs}`)
    if (!res.ok) throw new Error('Archive.org search failed')
    const data = await res.json()
    let results = data?.response?.docs ?? []
    // Apply client-side filtering as a safety measure
    results = filterAppropriate(results)
    return results
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

// ── Category presets ──────────────────────────────────────────────────────────

export const CATEGORIES = [
  {
    id: 'feature_films',
    label: '🎬 Feature Films',
    query: `mediatype:movies AND subject:"feature film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'classic_tv',
    label: '📺 Classic TV',
    query: `mediatype:movies AND subject:"television" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'documentaries',
    label: '🎥 Documentaries',
    query: `mediatype:movies AND subject:"documentary" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'animation',
    label: '🎭 Animation & Cartoons',
    query: `collection:animationandcartoons AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'short_films',
    label: '🎞 Short Films',
    query: `mediatype:movies AND subject:"short film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'horror',
    label: '👻 Horror',
    query: `mediatype:movies AND subject:"horror" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'science_fiction',
    label: '🚀 Science Fiction',
    query: `mediatype:movies AND subject:"science fiction" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'comedy',
    label: '😂 Comedy',
    query: `mediatype:movies AND (subject:"comedy" OR description:"comedy") AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'silent_films',
    label: '🎩 Silent Films',
    query: `collection:silenthalloffame AND ${CONTENT_FILTER_QUERY}`,
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
    q: `mediatype:movies AND (title:(${query}) OR subject:(${query})) AND ${CONTENT_FILTER_QUERY}`,
    rows,
    'sort[]': 'downloads desc',
  })
}

/**
 * Fetch a curated hero item by picking the most-downloaded item from feature films.
 */
export async function fetchHeroItem() {
  const items = await search({
    q: `mediatype:movies AND subject:"feature film" AND year:[1930 TO 1980] AND ${CONTENT_FILTER_QUERY}`,
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
