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

function isFaIconDefinition(icon) {
  return (
    icon &&
    typeof icon === 'object' &&
    typeof icon.iconName === 'string' &&
    Array.isArray(icon.icon)
  )
}

export default function SectionTitleWithIcon({
  title,
  id,
  icon,
  titleTone = 'default',
  iconSize = 'default',
}) {
  const { firstWord, rest } = splitHeadingTitle(title)
  const rootClass = [
    'section-title-with-icon',
    iconSize === 'large' ? 'section-title-with-icon--icon-lg' : '',
    titleTone === 'swapped' ? 'section-title-with-icon--tone-swapped' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <h2 id={id} className={rootClass}>
      {icon ? (
        <span className="section-title-with-icon__icon" aria-hidden="true">
          {isFaIconDefinition(icon) ? (
            <FontAwesomeIcon icon={icon} className="section-title-with-icon__fa" />
          ) : (
            icon
          )}
        </span>
      ) : null}
      <span className="section-title-with-icon__text">
        <span className="section-title-with-icon__first">{firstWord}</span>
        {rest ? <span className="section-title-with-icon__rest">{rest}</span> : null}
      </span>
    </h2>
  )
}
