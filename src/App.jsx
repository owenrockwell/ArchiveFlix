import { useState, useCallback, useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import VideoRow from './components/VideoRow'
import VideoModal from './components/VideoModal'
import SearchResults from './components/SearchResults'
import { CATEGORIES } from './services/archiveApi'
import './App.css'

export default function App() {
  const [modal, setModal] = useState(null)   // { item, mode: 'play' | 'info' }
  const [searchQuery, setSearchQuery] = useState('')

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

  return (
    <div className="app">
      <Navbar onSearch={setSearchQuery} />

      {searchQuery ? (
        <SearchResults query={searchQuery} onPlay={openPlay} onInfo={openInfo} />
      ) : (
        <>
          <Hero onPlay={openPlay} onInfo={openInfo} />

          <main className="app__main">
            {CATEGORIES.map((cat) => (
              <VideoRow
                key={cat.id}
                category={cat}
                onPlay={openPlay}
                onInfo={openInfo}
              />
            ))}
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
