// ---------------------------------------------------------------------------
// Archive.org API helpers for ArchiveFlix
// ---------------------------------------------------------------------------

const BASE_SEARCH = 'https://archive.org/advancedsearch.php'
const BASE_METADATA = 'https://archive.org/metadata'
const THUMB = (id) => `https://archive.org/services/img/${id}`
const STREAM_BASE = 'https://archive.org/download'

// ---------------------------------------------------------------------------
// Content filtering configuration
// ---------------------------------------------------------------------------

const EXPLICIT_SUBJECTS = [
  'xxx',
  'adult',
  'explicit',
  'pornography',
  'erotic',
  'nudity',
  'obscene',
]

const CONTENT_FILTER_QUERY = EXPLICIT_SUBJECTS.map((s) => `-subject:"${s}"`).join(' ')

export { THUMB, STREAM_BASE }

const SECTION_BASE_QUERY = {
  home: 'mediatype:movies',
  tv: 'mediatype:movies AND (subject:"television" OR title:(episode OR series OR show))',
  movies: 'mediatype:movies AND -subject:"television"',
}

const FALLBACK_GENRES = {
  home: ['Drama', 'Comedy', 'Documentary', 'Action', 'Horror', 'Romance', 'Adventure', 'Family'],
  tv: ['Drama', 'Comedy', 'Sitcom', 'Crime', 'Mystery', 'Animation', 'Adventure', 'Science Fiction', 'Western', 'Family'],
  movies: ['Drama', 'Comedy', 'Documentary', 'Horror', 'Western', 'Science Fiction', 'Adventure', 'Romance'],
}

const IGNORED_GENRES = new Set(['unknown', 'other', 'misc', 'miscellaneous', 'n/a', 'none'])
const TV_TERMS = [
  'television',
  'tv series',
  'tv show',
  'series',
  'episode',
  'season',
  'sitcom',
  'sketch comedy',
  'variety show',
]
const MOVIE_TERMS = [
  'feature film',
  'feature-length',
  'motion picture',
  'movie',
  'film',
  'cinema',
  'documentary',
]

function slugifyTag(tag) {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function titleCaseTag(tag) {
  return tag
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeGenre(genre) {
  if (!genre || typeof genre !== 'string') return null

  const cleaned = genre
    .toLowerCase()
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 3 || cleaned.length > 24) return null
  if (/^\d+$/.test(cleaned)) return null
  if (IGNORED_GENRES.has(cleaned)) return null
  return cleaned
}

function escapeQueryValue(value) {
  return value.replace(/["\\]/g, '')
}

function getItemText(item) {
  const subjects = Array.isArray(item.subject) ? item.subject.join(' ') : (item.subject || '')
  const genres = Array.isArray(item.genre) ? item.genre.join(' ') : (item.genre || '')
  return `${item.title || ''} ${item.description || ''} ${subjects} ${genres}`.toLowerCase()
}

function parseRuntimeMinutes(runtime) {
  if (runtime == null) return null
  const value = Array.isArray(runtime) ? runtime[0] : String(runtime)
  const text = value.toLowerCase().trim()

  const hourMinuteMatch = text.match(/(\d+)\s*(?:h|hr|hour)[^\d]*(\d{1,2})?\s*(?:m|min|minute)?/)
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1] || 0)
    const minutes = Number(hourMinuteMatch[2] || 0)
    return hours * 60 + minutes
  }

  const minuteMatch = text.match(/(\d{1,3})\s*(?:m|min|minute)/)
  if (minuteMatch) return Number(minuteMatch[1])

  if (/^\d{1,3}$/.test(text)) return Number(text)
  return null
}

function isTvLike(item) {
  const text = getItemText(item)
  return TV_TERMS.some((term) => text.includes(term))
}

function isMovieLike(item) {
  const text = getItemText(item)
  const runtimeMinutes = parseRuntimeMinutes(item.runtime)

  if (isTvLike(item)) return false
  if (runtimeMinutes !== null && runtimeMinutes < 35) return false
  if (runtimeMinutes !== null && runtimeMinutes >= 45) return true
  return MOVIE_TERMS.some((term) => text.includes(term))
}

function filterBySection(items, section) {
  if (section === 'tv') {
    return items.filter((item) => isTvLike(item) || parseRuntimeMinutes(item.runtime) === null || parseRuntimeMinutes(item.runtime) <= 70)
  }
  if (section === 'movies') {
    return items.filter(isMovieLike)
  }
  return items
}

function sectionBaseQuery(section) {
  return SECTION_BASE_QUERY[section] ?? SECTION_BASE_QUERY.home
}

function getSectionClause(section) {
  if (section === 'tv') {
    return ' AND (subject:"television" OR title:(episode OR series OR show))'
  }
  if (section === 'movies') {
    return ' AND -subject:"television"'
  }
  return ''
}

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
  const text = getItemText(item)
  const inappropriateKeywords = ['xxx', 'adult', 'explicit', 'pornography', 'erotic', 'nudity', 'obscene']
  return !inappropriateKeywords.some((keyword) => text.includes(keyword))
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
 * @returns {Array}        - array of items from the response
 */
async function search(params) {
  const defaults = {
    output: 'json',
    'fl[]': 'identifier,title,description,subject,genre,year,runtime,creator,downloads',
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
    results = filterAppropriate(results)
    return results
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

async function fetchPopularGenres(section = 'home', limit = 6) {
  const baseQuery = sectionBaseQuery(section)
  const docs = await search({
    q: `${baseQuery} AND ${CONTENT_FILTER_QUERY}`,
    rows: 400,
    'fl[]': 'genre,downloads',
    'sort[]': 'downloads desc',
  })

  const scores = new Map()

  for (const doc of docs) {
    const rawGenres = Array.isArray(doc.genre) ? doc.genre : [doc.genre]
    const weight = Math.max(1, Math.log10(Number(doc.downloads || 0) + 10))

    for (const raw of rawGenres) {
      if (!raw || typeof raw !== 'string') continue
      for (const part of raw.split(/[,;/|]/)) {
        const genre = normalizeGenre(part)
        if (!genre) continue
        scores.set(genre, (scores.get(genre) || 0) + weight)
      }
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)
    .slice(0, limit)
}

export async function buildSectionCategories(section = 'home', limit = 10) {
  const popularGenres = await fetchPopularGenres(section, limit)
  const fallbackGenres = (FALLBACK_GENRES[section] ?? FALLBACK_GENRES.home).map((g) => g.toLowerCase())
  const genres = [...new Set([...popularGenres, ...fallbackGenres])].slice(0, limit)
  const baseQuery = sectionBaseQuery(section)

  return genres.map((genre) => ({
    id: `${section}_${slugifyTag(genre)}`,
    label: titleCaseTag(genre),
    section,
    query: `${baseQuery} AND (genre:"${escapeQueryValue(genre)}" OR subject:"${escapeQueryValue(genre)}" OR description:(${escapeQueryValue(genre)})) AND ${CONTENT_FILTER_QUERY}`,
  }))
}

// -- Category presets ---------------------------------------------------------

export const CATEGORIES = [
  {
    id: 'feature_films',
    label: '🎬 Feature Films',
    section: 'movies',
    query: `mediatype:movies AND subject:"feature film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'classic_tv',
    label: '📺 Classic TV',
    section: 'tv',
    query: `mediatype:movies AND subject:"television" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'documentaries',
    label: '🎥 Documentaries',
    section: 'movies',
    query: `mediatype:movies AND subject:"documentary" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'animation',
    label: '🎭 Animation & Cartoons',
    section: 'movies',
    query: `collection:animationandcartoons AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'short_films',
    label: '🎞 Short Films',
    section: 'movies',
    query: `mediatype:movies AND subject:"short film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'horror',
    label: '👻 Horror',
    section: 'movies',
    query: `mediatype:movies AND subject:"horror" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'science_fiction',
    label: '🚀 Science Fiction',
    section: 'movies',
    query: `mediatype:movies AND subject:"science fiction" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'comedy',
    label: '😂 Comedy',
    section: 'movies',
    query: `mediatype:movies AND (subject:"comedy" OR description:"comedy") AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'silent_films',
    label: '🎩 Silent Films',
    section: 'movies',
    query: `collection:silenthalloffame AND ${CONTENT_FILTER_QUERY}`,
  },
]

/**
 * Fetch videos for a specific category.
 */
export async function fetchCategory(categoryId, rows = 40) {
  const cat =
    typeof categoryId === 'string'
      ? CATEGORIES.find((c) => c.id === categoryId)
      : categoryId
  if (!cat) throw new Error(`Unknown category: ${categoryId}`)
  return search({ q: cat.query, rows })
}

/**
 * Search across all video content.
 */
export async function searchVideos(query, rows = 40, section = 'home') {
  const sectionClause = getSectionClause(section)
  const results = await search({
    q: `mediatype:movies${sectionClause} AND (title:(${query}) OR subject:(${query})) AND ${CONTENT_FILTER_QUERY}`,
    rows,
    'sort[]': 'downloads desc',
  })
  return filterBySection(results, section)
}

/**
 * Fetch a curated hero item by picking the most-downloaded item from feature films.
 */
export async function fetchHeroItem(section = 'home') {
  const heroQueryBySection = {
    tv: `mediatype:movies AND subject:"television" AND year:[1930 TO 1995] AND ${CONTENT_FILTER_QUERY}`,
    movies: `mediatype:movies AND subject:"feature film" AND year:[1930 TO 1980] AND ${CONTENT_FILTER_QUERY}`,
    home: `mediatype:movies AND subject:"feature film" AND year:[1930 TO 1980] AND ${CONTENT_FILTER_QUERY}`,
  }

  const items = await search({
    q: heroQueryBySection[section] ?? heroQueryBySection.home,
    rows: 20,
    'sort[]': 'downloads desc',
  })
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

    const derivMp4 = files.find(
      (f) => f.name?.toLowerCase().endsWith('.mp4') && f.source === 'derivative'
    )
    if (derivMp4) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(derivMp4.name)}`

    const anyMp4 = files.find((f) => f.name?.toLowerCase().endsWith('.mp4'))
    if (anyMp4) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(anyMp4.name)}`

    for (const ext of ['webm', 'ogv', 'mpeg', 'mpg']) {
      const match = files.find((f) => f.name?.toLowerCase().endsWith(`.${ext}`))
      if (match) return `${STREAM_BASE}/${identifier}/${encodeURIComponent(match.name)}`
    }
  } catch (e) {
    console.warn('getStreamUrl error', e)
  }
  return null
}
