import { useState, useCallback, useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import VideoRow from './components/VideoRow'
import VideoModal from './components/VideoModal'
import SearchResults from './components/SearchResults'
import { CATEGORIES, buildSectionCategories } from './services/archiveApi'
import './App.css'

export default function App() {
  const [modal, setModal] = useState(null)   // { item, mode: 'play' | 'info' }
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('home')
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
    setActiveSection(section)
    setSearchQuery('')
  }, [])

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    setVisibleCategories([])

    buildSectionCategories(activeSection, 10)
      .then((cats) => {
        if (!cancelled) setVisibleCategories(cats)
      })
      .catch((err) => {
        console.error('Failed to load genres', err)
        if (!cancelled) {
          const fallback =
            activeSection === 'home'
              ? CATEGORIES
              : CATEGORIES.filter((cat) => cat.section === activeSection)
          setVisibleCategories(fallback)
        }
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeSection])

  return (
    <div className="app">
      <Navbar
        onSearch={setSearchQuery}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          section={activeSection}
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
