import { useState, useEffect, useRef } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import './Navbar.css'

const NAV_LINKS = [
  { id: 'tv', label: 'TV Shows' },
  { id: 'movies', label: 'Movies' },
]

export default function Navbar({ onSearch, searchQuery, activeSection, onSectionChange, getSectionHref }) {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    setQuery(searchQuery)
    setSearchOpen(Boolean(searchQuery))
  }, [searchQuery])

  function handleSubmit(e) {
    e.preventDefault()
    onSearch(query.trim())
  }

  function clearSearch() {
    setQuery('')
    setSearchOpen(false)
    onSearch('')
  }

  function handleSectionClick(event, section) {
    event.preventDefault()
    onSectionChange(section)
  }

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__left">
        <a
          className="navbar__logo"
          href={getSectionHref('home')}
          onClick={(event) => handleSectionClick(event, 'home')}
        >
          ArchiveFlix
        </a>
        <ul className="navbar__links">
          {NAV_LINKS.map((link) => (
            <li key={link.id}>
              <a
                className={`navbar__link-btn ${activeSection === link.id ? 'navbar__link-btn--active' : ''}`}
                href={getSectionHref(link.id)}
                onClick={(event) => handleSectionClick(event, link.id)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="navbar__right">
        <form
          className={`navbar__search ${searchOpen ? 'navbar__search--open' : ''}`}
          onSubmit={handleSubmit}
        >
          <button
            type="button"
            className="navbar__icon-btn"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Toggle search"
          >
            <FiSearch />
          </button>
          {searchOpen && (
            <>
              <input
                ref={inputRef}
                className="navbar__search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Titles, people, genres…"
              />
              {query && (
                <button
                  type="button"
                  className="navbar__icon-btn navbar__icon-btn--clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </nav>
  )
}
