import { useState } from 'react'
import { FiPlay, FiInfo, FiThumbsUp } from 'react-icons/fi'
import { getThumbnail } from '../services/archiveApi'
import './VideoCard.css'

export default function VideoCard({ item, onPlay, onInfo }) {
  const [imgError, setImgError] = useState(false)

  const thumb = getThumbnail(item.identifier)
  const title = item.title ?? 'Untitled'
  const year = item.year ?? ''

  return (
    <div className="vcard" role="button" tabIndex={0} aria-label={title}>
      {/* Thumbnail */}
      <div className="vcard__thumb">
        {!imgError ? (
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="vcard__no-img">
            <span>{title.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="vcard__gradient" />
      </div>

      {/* Hover panel */}
      <div className="vcard__hover">
        <div
          className="vcard__hover-bg"
          style={{ backgroundImage: !imgError ? `url(${thumb})` : undefined }}
        />
        <div className="vcard__hover-overlay" />
        <div className="vcard__hover-content">
          <div className="vcard__hover-actions">
            <button
              className="vcard__action-btn vcard__action-btn--play"
              onClick={(e) => { e.stopPropagation(); onPlay(item) }}
              title="Play"
              aria-label="Play"
            >
              <FiPlay />
            </button>
            <button
              className="vcard__action-btn"
              title="Like"
              aria-label="Like"
              onClick={(e) => e.stopPropagation()}
            >
              <FiThumbsUp />
            </button>
            <button
              className="vcard__action-btn vcard__action-btn--info"
              title="More Info"
              aria-label="More info"
              onClick={(e) => { e.stopPropagation(); onInfo(item) }}
            >
              <FiInfo />
            </button>
          </div>
          <p className="vcard__hover-title">{title}</p>
          <div className="vcard__hover-meta">
            {year && <span className="vcard__year">{year}</span>}
            {item.runtime && (
              <span className="vcard__runtime">{item.runtime}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
