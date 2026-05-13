export function IconRecycle({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7.5 4.5 4.5 7.5M19.5 16.5l-3 3M16.5 4.5l3 3M4.5 16.5 7.5 19.5M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 9 3-3 3 3M9 15l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconTrash({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 4h6l1 2h4v2H4V6h4l1-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6 8h12l-1 14H7L6 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11v8M14 11v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconLocationPin({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IconBarcodeScan({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 7V4h3M17 4h3v3M4 17v3h3M17 20h3v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 8h1.5v8H8M11.25 8H13v8h-1.75M15.5 8H17v8h-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconMenu({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconMovimentos({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M17 3v6h-6M7 21v-6h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 12A8.5 8.5 0 0 0 12 3.5l-.5.05M3.5 12A8.5 8.5 0 0 0 12 20.5l.5-.05"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconHome({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconHistorico({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Equipa / utilizadores (navegação admin). */
export function IconUsersGroup({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M16 11a3.25 3.25 0 1 0-6.5 0 3.25 3.25 0 0 0 6.5 0ZM8.25 11a2.25 2.25 0 1 0-4.5 0 2.25 2.25 0 0 0 4.5 0Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.75 18.5c.35-2.1 2.15-3.5 4.5-3.5h.5M12.25 15h1.5c2.35 0 4.15 1.4 4.5 3.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path
        d="M20.25 10.25a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM17.5 15.5h.25c1.65 0 2.9.95 3.35 2.35"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tickets / mensagens (navegação admin). */
export function IconTickets({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 9.5h6a2 2 0 0 1 2 2V18H7a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M11 18h6a2 2 0 0 0 2-2v-4.5a2 2 0 0 0-2-2h-1.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.5h.01M12 12.5h.01M14.5 12.5h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconChevronRight({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconCalendarSmall({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4v4M16 4v4M4 11h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
