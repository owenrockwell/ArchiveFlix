import { useState, useEffect } from 'react'
import { FiPlay, FiInfo, FiRefreshCw } from 'react-icons/fi'
import { fetchHeroItem, getThumbnail } from '../services/archiveApi'
import './Hero.css'

export default function Hero({ section, onPlay, onInfo }) {
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadHero() {
    setLoading(true)
    try {
      const data = await fetchHeroItem(section)
      setItem(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHero()
  }, [section])

  if (loading) {
    return (
      <div className="hero hero--skeleton">
        <div className="hero__shimmer" />
      </div>
    )
  }

  if (!item) return null

  const thumb = getThumbnail(item.identifier)
  const description = Array.isArray(item.description)
    ? item.description[0]
    : item.description ?? ''
  const shortDesc =
    description.length > 220 ? description.slice(0, 220) + '…' : description

  return (
    <div className="hero">
      {/* Background image */}
      <div
        className="hero__bg"
        style={{ backgroundImage: `url(${thumb})` }}
      />
      <div className="hero__overlay" />

      <div className="hero__content">
        <div className="hero__meta">
          {item.year && <span className="hero__year">{item.year}</span>}
          {item.runtime && (
            <span className="hero__runtime">
              {item.runtime}
            </span>
          )}
        </div>

        <h1 className="hero__title">{item.title}</h1>
        {shortDesc && <p className="hero__desc">{shortDesc}</p>}

        <div className="hero__actions">
          <button className="hero__btn hero__btn--play" onClick={() => onPlay(item)}>
            <FiPlay /> Play
          </button>
          <button className="hero__btn hero__btn--info" onClick={() => onInfo(item)}>
            <FiInfo /> More Info
          </button>
          <button
            className="hero__btn hero__btn--refresh"
            onClick={loadHero}
            title="Show another title"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>
    </div>
  )
}
