// ---------------------------------------------------------------------------
// Archive.org API helpers for ArchiveFlix
// ---------------------------------------------------------------------------

const BASE_SEARCH = 'https://archive.org/advancedsearch.php'
const BASE_METADATA = 'https://archive.org/metadata'
const THUMB = (id) => `https://archive.org/services/img/${id}`
const STREAM_BASE = 'https://archive.org/download'
const CACHE_PREFIX = 'archiveflix:'

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

function getSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setSessionCache(key, value) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // Ignore quota or availability failures.
  }
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
  const cacheKey = `metadata:${identifier}`
  const cached = getSessionCache(cacheKey)
  if (cached) return cached

  const res = await fetch(`${BASE_METADATA}/${identifier}`)
  if (!res.ok) throw new Error(`Metadata fetch failed for ${identifier}`)
  const data = await res.json()
  setSessionCache(cacheKey, data)
  return data
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
  const cacheKey = `search:${qs}`
  const cached = getSessionCache(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`${BASE_SEARCH}?${qs}`)
    if (!res.ok) throw new Error('Archive.org search failed')
    const data = await res.json()
    let results = data?.response?.docs ?? []
    results = filterAppropriate(results)
    setSessionCache(cacheKey, results)
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
  const cacheKey = `section-categories:${section}:${limit}`
  const cached = getSessionCache(cacheKey)
  if (cached) return cached

  const popularGenres = await fetchPopularGenres(section, limit)
  const fallbackGenres = (FALLBACK_GENRES[section] ?? FALLBACK_GENRES.home).map((g) => g.toLowerCase())
  const genres = [...new Set([...popularGenres, ...fallbackGenres])].slice(0, limit)
  const baseQuery = sectionBaseQuery(section)

  const categories = genres.map((genre) => ({
    id: `${section}_${slugifyTag(genre)}`,
    slug: slugifyTag(genre).replace(/_/g, '-'),
    label: titleCaseTag(genre),
    section,
    query: `${baseQuery} AND (genre:"${escapeQueryValue(genre)}" OR subject:"${escapeQueryValue(genre)}" OR description:(${escapeQueryValue(genre)})) AND ${CONTENT_FILTER_QUERY}`,
  }))
  setSessionCache(cacheKey, categories)
  return categories
}

// -- Category presets ---------------------------------------------------------

export const CATEGORIES = [
  {
    id: 'feature_films',
    slug: 'feature-films',
    label: '🎬 Feature Films',
    section: 'movies',
    query: `mediatype:movies AND subject:"feature film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'classic_tv',
    slug: 'classic-tv',
    label: '📺 Classic TV',
    section: 'tv',
    query: `mediatype:movies AND subject:"television" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'documentaries',
    slug: 'documentaries',
    label: '🎥 Documentaries',
    section: 'movies',
    query: `mediatype:movies AND subject:"documentary" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'animation',
    slug: 'animation-cartoons',
    label: '🎭 Animation & Cartoons',
    section: 'movies',
    query: `collection:animationandcartoons AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'short_films',
    slug: 'short-films',
    label: '🎞 Short Films',
    section: 'movies',
    query: `mediatype:movies AND subject:"short film" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'horror',
    slug: 'horror',
    label: '👻 Horror',
    section: 'movies',
    query: `mediatype:movies AND subject:"horror" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'science_fiction',
    slug: 'science-fiction',
    label: '🚀 Science Fiction',
    section: 'movies',
    query: `mediatype:movies AND subject:"science fiction" AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'comedy',
    slug: 'comedy',
    label: '😂 Comedy',
    section: 'movies',
    query: `mediatype:movies AND (subject:"comedy" OR description:"comedy") AND ${CONTENT_FILTER_QUERY}`,
  },
  {
    id: 'silent_films',
    slug: 'silent-films',
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
  const cacheKey = `hero:${section}`
  const cached = getSessionCache(cacheKey)
  if (cached) return cached

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
  const item = items[idx] ?? null
  setSessionCache(cacheKey, item)
  return item
}

/**
 * Given an archive.org identifier, return a streamable video URL.
 * Fetches the item's file list and picks the best video file.
 */
export async function getStreamUrl(identifier) {
  try {
    const cacheKey = `stream:${identifier}`
    const cached = getSessionCache(cacheKey)
    if (cached) return cached

    const meta = await fetchMetadata(identifier)
    const files = meta?.files ?? []

    const derivMp4 = files.find(
      (f) => f.name?.toLowerCase().endsWith('.mp4') && f.source === 'derivative'
    )
    if (derivMp4) {
      const url = `${STREAM_BASE}/${identifier}/${encodeURIComponent(derivMp4.name)}`
      setSessionCache(cacheKey, url)
      return url
    }

    const anyMp4 = files.find((f) => f.name?.toLowerCase().endsWith('.mp4'))
    if (anyMp4) {
      const url = `${STREAM_BASE}/${identifier}/${encodeURIComponent(anyMp4.name)}`
      setSessionCache(cacheKey, url)
      return url
    }

    for (const ext of ['webm', 'ogv', 'mpeg', 'mpg']) {
      const match = files.find((f) => f.name?.toLowerCase().endsWith(`.${ext}`))
      if (match) {
        const url = `${STREAM_BASE}/${identifier}/${encodeURIComponent(match.name)}`
        setSessionCache(cacheKey, url)
        return url
      }
    }
  } catch (e) {
    console.warn('getStreamUrl error', e)
  }
  return null
}

/**
 * Check if a file is a video file.
 */
function isVideoFile(filename) {
  if (!filename || typeof filename !== 'string') return false
  const lower = filename.toLowerCase()
  const videoExts = ['mp4', 'webm', 'ogv', 'mpeg', 'mpg', 'mov', 'avi', 'mkv']
  return videoExts.some((ext) => lower.endsWith(`.${ext}`))
}

/**
 * Parse episode info from a filename.
 * Returns { number, title } extracted from patterns like "101", "s01e01", "episode-5", etc.
 */
function parseEpisodeInfo(filename) {
  if (!filename) return { number: null, title: filename, hasMarker: false }

  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  let number = null
  let title = nameWithoutExt
  let hasMarker = false

  // Try patterns: "s01e05" or "S01E05"
  const seasonEpisode = nameWithoutExt.match(/s(\d+)e(\d+)/i)
  if (seasonEpisode) {
    const season = parseInt(seasonEpisode[1], 10)
    const episode = parseInt(seasonEpisode[2], 10)
    number = season * 100 + episode
    title = `S${seasonEpisode[1]}E${seasonEpisode[2]}`
    hasMarker = true
  }

  // Try pattern: "101" (season 1, episode 1) or "205" (season 2, episode 5)
  if (!number) {
    const simple = nameWithoutExt.match(/^(\d{2,3})$/)
    if (simple) {
      number = parseInt(simple[1], 10)
      const season = Math.floor(number / 100) || 1
      const episode = number % 100
      title = `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`
      hasMarker = true
    }
  }

  // Try pattern: "episode 5" or "ep. 10"
  if (!number) {
    const ep = nameWithoutExt.match(/ep(?:isode)?[.\s]+(\d+)/i)
    if (ep) {
      number = parseInt(ep[1], 10)
      title = `Episode ${ep[1]}`
      hasMarker = true
    }
  }

  return { number: number ?? 0, title, hasMarker }
}

function normalizeEpisodeKey(episode) {
  if (episode.hasMarker) return `marker:${episode.title.toLowerCase()}`

  return String(episode.title || '')
    .toLowerCase()
    .replace(/\.ia$/i, '')
    .replace(/[_\-. ](?:512kb|256kb|128kb|low|med|medium|high|hq|hd|edit|dubbed|dub)$/, '')
    .replace(/[_\-. ]+/g, ' ')
    .trim()
}

function getEpisodeRank(episode) {
  const lowerName = String(episode.name || '').toLowerCase()
  let score = 0

  if (episode.hasMarker) score += 1000
  if (!lowerName.includes('.ia.')) score += 200
  if (!lowerName.endsWith('.ogv') && !lowerName.endsWith('.mpeg') && !lowerName.endsWith('.mpg')) score += 50
  score += Number(episode.size || 0) / 1000000

  return score
}

function dedupeEpisodes(episodes) {
  const bestByKey = new Map()

  for (const episode of episodes) {
    const key = normalizeEpisodeKey(episode)
    if (!key) continue

    const existing = bestByKey.get(key)
    if (!existing || getEpisodeRank(episode) > getEpisodeRank(existing)) {
      bestByKey.set(key, episode)
    }
  }

  return [...bestByKey.values()]
}

function looksLikeSeries(item, episodes = []) {
  const structuredEpisodes = episodes.filter((episode) => episode.hasMarker)
  const distinctStructuredTitles = new Set(structuredEpisodes.map((episode) => episode.title)).size

  if (distinctStructuredTitles >= 2) return true
  return isTvLike(item)
}

/**
 * Fetch all video episodes from an item.
 * Returns array of episodes, sorted by episode number.
 */
export async function getEpisodes(identifier) {
  try {
    const cacheKey = `episodes:v3:${identifier}`
    const cached = getSessionCache(cacheKey)
    if (cached) return cached

    const meta = await fetchMetadata(identifier)
    const files = meta?.files ?? []

    // Find all video files
    const videoFiles = files
      .filter((f) => isVideoFile(f.name) && f.source !== 'metadata')
      .map((f) => ({
        name: f.name,
        size: f.size ?? 0,
        mtime: f.mtime ?? 0,
        source: f.source ?? '',
        ...parseEpisodeInfo(f.name),
      }))

    const dedupedFiles = dedupeEpisodes(videoFiles)
      .filter((episode) => !String(episode.name).toLowerCase().endsWith('.ia.mp4'))
      .sort((a, b) => {
        // Sort by episode number if available, otherwise by filename
        if (a.number && b.number) return a.number - b.number
        return a.name.localeCompare(b.name)
      })

    setSessionCache(cacheKey, dedupedFiles)
    return dedupedFiles
  } catch (e) {
    console.warn('getEpisodes error', e)
    return []
  }
}

export function shouldShowEpisodes(item, section = 'home', episodes = []) {
  if (section === 'movies') return false
  if (section === 'tv') return looksLikeSeries(item, episodes)
  return looksLikeSeries(item, episodes) && episodes.filter((episode) => episode.hasMarker).length >= 2
}

/**
 * Get the stream URL for a specific video file within an item.
 */
export async function getStreamUrlForFile(identifier, filename) {
  try {
    const cacheKey = `stream:${identifier}:${filename}`
    const cached = getSessionCache(cacheKey)
    if (cached) return cached

    const url = `${STREAM_BASE}/${identifier}/${encodeURIComponent(filename)}`
    setSessionCache(cacheKey, url)
    return url
  } catch (e) {
    console.warn('getStreamUrlForFile error', e)
    return null
  }
}
