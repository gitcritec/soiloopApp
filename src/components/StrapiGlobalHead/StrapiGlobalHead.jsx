import { useEffect } from 'react'
import { applyStrapiGlobalHead, getStrapiGlobalDocument } from '../../lib/strapiGlobal.js'

/**
 * Sincroniza título, meta description e favicon com o single type Global (Strapi).
 */
export default function StrapiGlobalHead() {
  useEffect(() => {
    let cancelled = false
    getStrapiGlobalDocument().then((doc) => {
      if (!cancelled) applyStrapiGlobalHead(doc)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
