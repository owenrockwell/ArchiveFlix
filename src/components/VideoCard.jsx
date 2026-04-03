import { useState } from 'react'
import { getThumbnail } from '../services/archiveApi'
import './VideoCard.css'

export default function VideoCard({ item, onPlay }) {
  const [imgError, setImgError] = useState(false)

  const thumb = getThumbnail(item.identifier)
  const title = item.title ?? 'Untitled'
  const year = item.year ?? ''
  const runtime = item.runtime ?? ''

  return (
    <div
      className="vcard"
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => onPlay(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay(item)
        }
      }}
    >
      <div className="vcard__media">
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

        <div className="vcard__hover">
          <div
            className="vcard__hover-bg"
            style={{ backgroundImage: !imgError ? `url(${thumb})` : undefined }}
          />
          <div className="vcard__hover-overlay" />
        </div>
      </div>

      <div className="vcard__body">
        <p className="vcard__title">{title}</p>
        {(year || runtime) && (
          <div className="vcard__meta">
            {year && <span className="vcard__year">{year}</span>}
            {runtime && <span className="vcard__runtime">{runtime}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
