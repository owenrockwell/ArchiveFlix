import { useState, useCallback, useEffect, useMemo } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import VideoRow from './components/VideoRow'
import VideoModal from './components/VideoModal'
import SearchResults from './components/SearchResults'
import CategoryResults from './components/CategoryResults'
import { CATEGORIES, buildSectionCategories } from './services/archiveApi'
import './App.css'

const SECTION_SLUGS = {
  home: '',
  tv: 'tv-shows',
  movies: 'movies',
}

function getVideoIdFromLocation() {
  const params = new URLSearchParams(window.location.search)
  return params.get('v')?.trim() ?? ''
}

function getModalModeFromLocation() {
  const params = new URLSearchParams(window.location.search)
  return params.get('mode')?.trim() === 'info' ? 'info' : 'play'
}

function getBasePath() {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function getPathForSection(section) {
  const basePath = getBasePath()
  const slug = SECTION_SLUGS[section] ?? ''
  return slug ? `${basePath}/${slug}` : `${basePath}/`
}

function getPathForCategory(section, categorySlug) {
  const sectionPath = getPathForSection(section).replace(/\/$/, '')
  return `${sectionPath}/${categorySlug}`
}

function getSearchQueryFromLocation() {
  const params = new URLSearchParams(window.location.search)
  return params.get('q')?.trim() ?? ''
}

function buildUrl(section, query = '', categorySlug = '', modal = null) {
  const trimmedQuery = query.trim()
  const path = trimmedQuery
    ? getPathForSection(section)
    : categorySlug
      ? getPathForCategory(section, categorySlug)
      : getPathForSection(section)

  const params = new URLSearchParams()
  if (trimmedQuery) params.set('q', trimmedQuery)
  if (modal?.item?.identifier) {
    params.set('v', modal.item.identifier)
    params.set('mode', modal.mode === 'info' ? 'info' : 'play')
  }

  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

function getRouteFromLocation() {
  const basePath = getBasePath()
  const currentPath = window.location.pathname
  const relativePath = currentPath.startsWith(basePath)
    ? currentPath.slice(basePath.length)
    : currentPath
  const segments = relativePath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)

  if (segments[0] === 'tv-shows') {
    return {
      section: 'tv',
      categorySlug: segments[1] ?? '',
      query: getSearchQueryFromLocation(),
      videoId: getVideoIdFromLocation(),
      mode: getModalModeFromLocation(),
    }
  }

  if (segments[0] === 'movies') {
    return {
      section: 'movies',
      categorySlug: segments[1] ?? '',
      query: getSearchQueryFromLocation(),
      videoId: getVideoIdFromLocation(),
      mode: getModalModeFromLocation(),
    }
  }

  return {
    section: 'home',
    categorySlug: segments[0] ?? '',
    query: getSearchQueryFromLocation(),
    videoId: getVideoIdFromLocation(),
    mode: getModalModeFromLocation(),
  }
}

function ensureCategorySlug(category) {
  if (category.slug) return category.slug
  if (category.label) {
    return category.label
      .replace(/^[^A-Za-z0-9]+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  return category.id.replace(/_/g, '-')
}

export default function App() {
  const initialRoute = getRouteFromLocation()
  const [modal, setModal] = useState(null)   // { item, mode: 'play' | 'info' }
  const [searchQuery, setSearchQuery] = useState(initialRoute.query)
  const [activeSection, setActiveSection] = useState(initialRoute.section)
  const [activeCategorySlug, setActiveCategorySlug] = useState(initialRoute.categorySlug)
  const [visibleCategories, setVisibleCategories] = useState(CATEGORIES)
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  const closeModal = useCallback(() => {
    const hasModalInUrl = Boolean(getVideoIdFromLocation())
    if (hasModalInUrl && window.history.state?.modal) {
      window.history.back()
      return
    }
    setModal(null)
  }, [])

  // Close modal on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  const openPlay = useCallback(
    (item) => {
      const nextModal = { item, mode: 'play', section: activeSection }
      const nextUrl = buildUrl(activeSection, searchQuery, activeCategorySlug, nextModal)
      window.history.pushState(
        {
          section: activeSection,
          categorySlug: activeCategorySlug,
          query: searchQuery,
          modal: nextModal,
        },
        '',
        nextUrl
      )
      setModal(nextModal)
    },
    [activeCategorySlug, activeSection, searchQuery]
  )
  const openInfo = useCallback(
    (item) => {
      const nextModal = { item, mode: 'info', section: activeSection }
      const nextUrl = buildUrl(activeSection, searchQuery, activeCategorySlug, nextModal)
      window.history.pushState(
        {
          section: activeSection,
          categorySlug: activeCategorySlug,
          query: searchQuery,
          modal: nextModal,
        },
        '',
        nextUrl
      )
      setModal(nextModal)
    },
    [activeCategorySlug, activeSection, searchQuery]
  )

  const handleSectionChange = useCallback((section) => {
    const nextUrl = getPathForSection(section)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.pushState({ section, categorySlug: '', query: '' }, '', nextUrl)
    }
    setActiveSection(section)
    setActiveCategorySlug('')
    setSearchQuery('')
  }, [])

  const handleCategoryChange = useCallback((category) => {
    const categorySlug = ensureCategorySlug(category)
    const nextUrl = getPathForCategory(activeSection, categorySlug)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.pushState({ section: activeSection, categorySlug, query: '' }, '', nextUrl)
    }
    setActiveCategorySlug(categorySlug)
    setSearchQuery('')
  }, [activeSection])

  const handleSearchChange = useCallback((query) => {
    const nextUrl = buildUrl(activeSection, query)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.pushState({ section: activeSection, categorySlug: '', query }, '', nextUrl)
    }
    setActiveCategorySlug('')
    setSearchQuery(query)
  }, [activeSection])

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromLocation()
      setActiveSection(route.section)
      setActiveCategorySlug(route.categorySlug)
      setSearchQuery(route.query)
      setModal(window.history.state?.modal ?? null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const canonicalUrl = buildUrl(activeSection, searchQuery, activeCategorySlug, modal)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== canonicalUrl) {
      window.history.replaceState(
        {
          section: activeSection,
          categorySlug: activeCategorySlug,
          query: searchQuery,
          modal,
        },
        '',
        canonicalUrl
      )
    }
  }, [activeSection, activeCategorySlug, searchQuery, modal])

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    setVisibleCategories([])

    buildSectionCategories(activeSection, 10)
      .then((cats) => {
        if (!cancelled) {
          setVisibleCategories(cats.map((cat) => ({ ...cat, slug: ensureCategorySlug(cat) })))
        }
      })
      .catch((err) => {
        console.error('Failed to load genres', err)
        if (!cancelled) {
          const fallback =
            activeSection === 'home'
              ? CATEGORIES
              : CATEGORIES.filter((cat) => cat.section === activeSection)
          setVisibleCategories(fallback.map((cat) => ({ ...cat, slug: ensureCategorySlug(cat) })))
        }
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeSection])

  const activeCategory = useMemo(
    () => visibleCategories.find((category) => category.slug === activeCategorySlug) ?? null,
    [visibleCategories, activeCategorySlug]
  )

  return (
    <div className="app">
      <Navbar
        onSearch={handleSearchChange}
        searchQuery={searchQuery}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        getSectionHref={getPathForSection}
      />

      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          section={activeSection}
          onPlay={openPlay}
          onInfo={openInfo}
        />
      ) : activeCategorySlug ? (
        <CategoryResults
          category={activeCategory}
          loading={categoriesLoading}
          onPlay={openPlay}
          onInfo={openInfo}
        />
      ) : (
        <>
          <Hero section={activeSection} onPlay={openPlay} onInfo={openInfo} />

          <main className="app__main">
            {categoriesLoading && visibleCategories.length === 0 ? (
              <p className="app__section-loading">Loading genres...</p>
            ) : (
              visibleCategories.map((cat) => (
                <VideoRow
                  key={cat.id}
                  category={cat}
                  categoryHref={getPathForCategory(activeSection, cat.slug)}
                  onOpenCategory={handleCategoryChange}
                  onPlay={openPlay}
                  onInfo={openInfo}
                />
              ))
            )}
          </main>

          <footer className="app__footer">
            <p>
              All content is provided by{' '}
              <a href="https://archive.org" target="_blank" rel="noreferrer">
                Internet Archive
              </a>{' '}
              under their open-access collections. ArchiveFlix is a fan project.
            </p>
          </footer>
        </>
      )}

      {modal && (
        <VideoModal
          item={modal.item}
          mode={modal.mode}
          section={modal.section}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
