import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './SectionTitleWithIcon.css'

function splitHeadingTitle(title) {
  const trimmed = (title ?? '').trim()
  if (!trimmed) {
    return { firstWord: '', rest: '' }
  }
  const parts = trimmed.split(/\s+/)
  return {
    firstWord: parts[0],
    rest: parts.length > 1 ? parts.slice(1).join(' ') : '',
  }
}

export default function SectionTitleWithIcon({ title, id, icon }) {
  const { firstWord, rest } = splitHeadingTitle(title)

  return (
    <h2 id={id} className="section-title-with-icon">
      {icon ? (
        <span className="section-title-with-icon__icon" aria-hidden="true">
          <FontAwesomeIcon icon={icon} className="section-title-with-icon__fa" />
        </span>
      ) : null}
      <span className="section-title-with-icon__text">
        <span className="section-title-with-icon__first">{firstWord}</span>
        {rest ? <span className="section-title-with-icon__rest">{rest}</span> : null}
      </span>
    </h2>
  )
}
