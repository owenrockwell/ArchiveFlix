import { useEffect, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { fetchCategory } from '../services/archiveApi'
import VideoCard from './VideoCard'
import './SearchResults.css'

export default function CategoryResults({ category, loading, onPlay, onInfo }) {
  const [items, setItems] = useState([])
  const [categoryLoading, setCategoryLoading] = useState(false)

  useEffect(() => {
    if (!category) {
      setItems([])
      return
    }

    setCategoryLoading(true)
    fetchCategory(category, 80)
      .then(setItems)
      .catch(console.error)
      .finally(() => setCategoryLoading(false))
  }, [category])

  return (
    <section className="search-results">
      <h2 className="search-results__heading">{category?.label ?? 'Category not found'}</h2>

      {loading || categoryLoading ? (
        <div className="search-results__loading">
          <FiLoader className="spin" /> Loading titles...
        </div>
      ) : !category ? (
        <p className="search-results__empty">This category could not be found.</p>
      ) : items.length === 0 ? (
        <p className="search-results__empty">No titles found in this category.</p>
      ) : (
        <div className="search-results__grid">
          {items.map((item) => (
            <VideoCard key={item.identifier} item={item} onPlay={onPlay} />
          ))}
        </div>
      )}
    </section>
  )
}
