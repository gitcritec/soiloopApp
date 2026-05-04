import './SectionTitleWithIcon.css'

export default function SectionTitleWithIcon({ title, id, icon }) {
  return (
    <h2 id={id} className="section-title-with-icon">
      {icon ? (
        <span className="section-title-with-icon__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{title}</span>
    </h2>
  )
}
