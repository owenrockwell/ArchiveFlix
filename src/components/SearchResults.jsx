import { useState, useEffect } from 'react'
import { FiSearch, FiLoader } from 'react-icons/fi'
import { searchVideos } from '../services/archiveApi'
import VideoCard from './VideoCard'
import './SearchResults.css'

export default function SearchResults({ query, section, onPlay, onInfo }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const sectionLabel =
    section === 'tv' ? 'TV Shows' : section === 'movies' ? 'Movies' : 'All Titles'

  useEffect(() => {
    if (!query) { setItems([]); return }
    setLoading(true)
    searchVideos(query, 40, section)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [query, section])

  return (
    <section className="search-results">
      <h2 className="search-results__heading">
        <FiSearch />
        {sectionLabel} results for &ldquo;{query}&rdquo;
      </h2>

      {loading ? (
        <div className="search-results__loading">
          <FiLoader className="spin" /> Searching…
        </div>
      ) : items.length === 0 ? (
        <p className="search-results__empty">No titles found. Try different keywords.</p>
      ) : (
        <div className="search-results__grid">
          {items.map((item) => (
            <VideoCard key={item.identifier} item={item} onPlay={onPlay} onInfo={onInfo} />
          ))}
        </div>
      )}
    </section>
  )
}
