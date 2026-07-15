import { fetchStrapiArmazemLocation } from './strapiGlobal.js'

/** @param {{ situacao?: string, clienteAtualId?: string|null }} contentor */
export function isContentorNoArmazem(contentor) {
  if (!contentor) return true
  if (contentor.situacao === 'armazem') return true
  return !contentor.clienteAtualId
}

/**
 * Morada e coordenadas para mapa: armazém global quando o contentor está no armazém.
 * @param {object} contentor
 */
export async function resolveMapLocationForContentor(contentor) {
  if (isContentorNoArmazem(contentor)) {
    const armazem = await fetchStrapiArmazemLocation()
    if (armazem) {
      return {
        location: armazem.morada || 'Armazém',
        locationDetail: armazem.morada || 'Armazém',
        lat: armazem.lat,
        lng: armazem.lng,
      }
    }
  }

  return {
    location: contentor.localizacao,
    locationDetail: contentor.localizacaoAtualLabel ?? contentor.localizacao,
    lat: contentor.lat ?? null,
    lng: contentor.lng ?? null,
  }
}

/** @param {object} contentor */
export async function resolveLocationLabelForContentor(contentor) {
  if (isContentorNoArmazem(contentor)) {
    const armazem = await fetchStrapiArmazemLocation()
    return armazem?.morada?.trim() || 'Armazém'
  }
  return contentor.localizacaoAtualLabel ?? contentor.localizacao ?? '—'
}
