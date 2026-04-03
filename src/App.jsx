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

function buildUrl(section, query = '', categorySlug = '') {
  const trimmedQuery = query.trim()
  const path = trimmedQuery
    ? getPathForSection(section)
    : categorySlug
      ? getPathForCategory(section, categorySlug)
      : getPathForSection(section)

  if (!trimmedQuery) return path

  const params = new URLSearchParams()
  params.set('q', trimmedQuery)
  return `${path}?${params.toString()}`
}

function getRouteFromLocation() {
  const basePath = getBasePath()
  const currentPath = window.location.pathname
  const relativePath = currentPath.startsWith(basePath)
    ? currentPath.slice(basePath.length)
    : currentPath
  const segments = relativePath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)

  if (segments[0] === 'tv-shows') {
    return { section: 'tv', categorySlug: segments[1] ?? '', query: getSearchQueryFromLocation() }
  }

  if (segments[0] === 'movies') {
    return { section: 'movies', categorySlug: segments[1] ?? '', query: getSearchQueryFromLocation() }
  }

  return { section: 'home', categorySlug: segments[0] ?? '', query: getSearchQueryFromLocation() }
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

  // Close modal on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openPlay = useCallback((item) => setModal({ item, mode: 'play' }), [])
  const openInfo = useCallback((item) => setModal({ item, mode: 'info' }), [])
  const closeModal = useCallback(() => setModal(null), [])
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
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const canonicalUrl = buildUrl(activeSection, searchQuery, activeCategorySlug)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== canonicalUrl) {
      window.history.replaceState(
        { section: activeSection, categorySlug: activeCategorySlug, query: searchQuery },
        '',
        canonicalUrl
      )
    }
  }, [activeSection, activeCategorySlug, searchQuery])

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
          onClose={closeModal}
        />
      )}
    </div>
  )
}
