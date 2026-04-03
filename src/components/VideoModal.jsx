import { useState, useEffect, useRef } from 'react'
import {
  FiX,
  FiPlay,
  FiPause,
  FiVolume2,
  FiVolumeX,
  FiMaximize,
  FiLoader,
  FiExternalLink,
} from 'react-icons/fi'
import { getStreamUrl, getThumbnail } from '../services/archiveApi'
import './VideoModal.css'

export default function VideoModal({ item, mode, onClose }) {
  const [streamUrl, setStreamUrl] = useState(null)
  const [loadingStream, setLoadingStream] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [streamError, setStreamError] = useState(false)
  const videoRef = useRef(null)
  const controlsTimer = useRef(null)
  const thumb = getThumbnail(item.identifier)

  const description = Array.isArray(item.description)
    ? item.description[0]
    : item.description ?? 'No description available.'

  useEffect(() => {
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    getStreamUrl(item.identifier)
      .then((url) => {
        setStreamUrl(url)
        if (!url) setStreamError(true)
      })
      .catch(() => setStreamError(true))
      .finally(() => setLoadingStream(false))
  }, [item.identifier])

  // Auto-play when stream is ready and we're in play mode
  useEffect(() => {
    if (streamUrl && mode === 'play' && videoRef.current) {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {})
    }
  }, [streamUrl, mode])

  function resetControlsTimer() {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().then(() => setPlaying(true))
    } else {
      v.pause()
      setPlaying(false)
    }
    resetControlsTimer()
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  function handleTimeUpdate() {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress((v.currentTime / v.duration) * 100)
    setDuration(v.duration)
  }

  function handleSeek(e) {
    const v = videoRef.current
    if (!v || !v.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    v.currentTime = ratio * v.duration
    resetControlsTimer()
  }

  function handleFullscreen() {
    const v = videoRef.current
    if (!v) return
    if (v.requestFullscreen) v.requestFullscreen()
  }

  function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const archiveUrl = `https://archive.org/details/${item.identifier}`

  return (
    <div className="vmodal" onClick={onClose}>
      <div
        className="vmodal__box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        {/* ── Close button ── */}
        <button className="vmodal__close" onClick={onClose} aria-label="Close">
          <FiX />
        </button>

        {/* ── Video / Poster area ── */}
        <div
          className="vmodal__media"
          onMouseMove={resetControlsTimer}
          onMouseLeave={() => playing && setShowControls(false)}
          onClick={togglePlay}
        >
          {/* Poster / backdrop */}
          <div
            className="vmodal__poster"
            style={{ backgroundImage: `url(${thumb})` }}
          />
          <div className="vmodal__poster-overlay" />

          {/* Loading spinner */}
          {loadingStream && (
            <div className="vmodal__spinner">
              <FiLoader className="spin" />
            </div>
          )}

          {/* Stream error */}
          {streamError && !loadingStream && (
            <div className="vmodal__error">
              <p>No streamable file found.</p>
              <a href={archiveUrl} target="_blank" rel="noreferrer" className="vmodal__ext-link">
                <FiExternalLink /> Open on Archive.org
              </a>
            </div>
          )}

          {/* Video element */}
          {streamUrl && (
            <video
              ref={videoRef}
              src={streamUrl}
              className="vmodal__video"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setStreamError(true)}
              playsInline
            />
          )}

          {/* Controls overlay */}
          {streamUrl && !streamError && (
            <div className={`vmodal__controls ${showControls || !playing ? '' : 'vmodal__controls--hidden'}`}>
              {/* Progress bar */}
              <div className="vmodal__progress" onClick={handleSeek}>
                <div className="vmodal__progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="vmodal__ctrl-row">
                <button
                  className="vmodal__ctrl-btn vmodal__ctrl-btn--play"
                  onClick={(e) => { e.stopPropagation(); togglePlay() }}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? <FiPause /> : <FiPlay />}
                </button>

                <span className="vmodal__time">
                  {fmtTime(videoRef.current?.currentTime)} / {fmtTime(duration)}
                </span>

                <button
                  className="vmodal__ctrl-btn"
                  onClick={(e) => { e.stopPropagation(); toggleMute() }}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <FiVolumeX /> : <FiVolume2 />}
                </button>

                <button
                  className="vmodal__ctrl-btn"
                  onClick={(e) => { e.stopPropagation(); handleFullscreen() }}
                  aria-label="Fullscreen"
                >
                  <FiMaximize />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Info panel ── */}
        <div className="vmodal__info">
          <div className="vmodal__info-top">
            <div>
              <h2 className="vmodal__title">{item.title}</h2>
              <div className="vmodal__meta">
                {item.year && <span className="vmodal__tag">{item.year}</span>}
                {item.runtime && <span className="vmodal__tag">{item.runtime}</span>}
                {item.creator && (
                  <span className="vmodal__tag">
                    {Array.isArray(item.creator) ? item.creator[0] : item.creator}
                  </span>
                )}
              </div>
            </div>
            <a
              href={archiveUrl}
              target="_blank"
              rel="noreferrer"
              className="vmodal__archive-link"
              title="Open on Archive.org"
            >
              <FiExternalLink /> Archive.org
            </a>
          </div>
          <p className="vmodal__desc">{description}</p>
          {item.subject && (
            <div className="vmodal__subjects">
              {(Array.isArray(item.subject) ? item.subject : [item.subject])
                .slice(0, 8)
                .map((s) => (
                  <span key={s} className="vmodal__subject-tag">{s}</span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
