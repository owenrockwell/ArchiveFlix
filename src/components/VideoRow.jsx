import { useState, useEffect, useRef } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { fetchCategory } from '../services/archiveApi'
import VideoCard from './VideoCard'
import './VideoRow.css'

export default function VideoRow({ category, categoryHref, onOpenCategory, onPlay, onInfo }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const rowRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCategory(category)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [category.id, category.query])

  function updateScrollButtons() {
    const el = rowRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  function scroll(dir) {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir * 600, behavior: 'smooth' })
    setTimeout(updateScrollButtons, 400)
  }

  function handleCategoryClick(event) {
    event.preventDefault()
    onOpenCategory(category)
  }

  return (
    <section className="vrow">
      <h2 className="vrow__title">
        <a className="vrow__title-link" href={categoryHref} onClick={handleCategoryClick}>
          {category.label}
        </a>
      </h2>

      <div className="vrow__wrapper">
        {canScrollLeft && (
          <button
            className="vrow__arrow vrow__arrow--left"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
          >
            <FiChevronLeft />
          </button>
        )}

        <div
          className="vrow__track"
          ref={rowRef}
          onScroll={updateScrollButtons}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="vrow__skeleton" />
              ))
            : items.map((item) => (
                <VideoCard
                  key={item.identifier}
                  item={item}
                  onPlay={onPlay}
                  onInfo={onInfo}
                />
              ))}
        </div>

        {canScrollRight && items.length > 0 && (
          <button
            className="vrow__arrow vrow__arrow--right"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
          >
            <FiChevronRight />
          </button>
        )}
      </div>
    </section>
  )
}
