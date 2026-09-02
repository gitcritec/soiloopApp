import { STRAPI_JWT_STORAGE_KEY, fetchStrapiCurrentUser, ensureStoredStrapiUserRefs, getStoredStrapiUserId, getStoredStrapiUserRefs } from './strapiAuth.js'
import {
  applyStrapiContentorAfterEntrega,
  applyStrapiContentorAfterRecolha,
  CONTENTOR_SITUACAO_ARMAZEM,
  CONTENTOR_SITUACAO_CLIENTE,
  CONTENTOR_SITUACAO_EM_TRANSITO,
  fetchStrapiContentorByCid,
  fetchStrapiClienteContentores,
  fetchStrapiContentores,
  fetchStrapiContentoresByClienteAtual,
  mapContentorItemToInstalledCard,
  mapContentorToClienteCard,
  normalizeCapacidadeLitros,
  reserveStrapiContentorParaEntrega,
  updateStrapiContentorSituacao,
} from './strapiContentores.js'
import {
  buildCodigosLerRelationWrite,
  coerceCodigosLerRelation,
} from './strapiCodigoLer.js'
import {
  buildEstadoAuxRelationWrite,
  coerceEstadoAuxRelation,
  fetchStrapiEstadosResiduo,
  isEstadoResiduoContaminado,
} from './strapiEstadosAuxiliares.js'
import { createStrapiTicketForCliente } from './strapiTickets.js'
import {
  alignDateToWeekday,
  computeRecorrenciaHorizonEndIso,
  createStrapiRecorrencia,
  deactivateStrapiRecorrencia,
  fetchStrapiRecorrenciasAtivas,
  generateWeeklyDatesAfter,
  generateWeeklyOccurrenceDates,
  pickRecorrenciaIdFromRelation,
  RECORRENCIA_HORIZONTE_SEMANAS,
  todayIsoLocal,
} from './strapiRecorrencias.js'
import { normalizePeriodoForStrapi } from './movimentoPeriodo.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'
const MOVIMENTO_ESTADO_PEDIDO = 'pedido'
const MOVIMENTO_ESTADO_CONCLUIDO = 'concluido'
const MOVIMENTO_ESTADO_CANCELAMENTO = 'cancelamento'
const MOVIMENTO_TIPO_RECOLHA = 'recolha'
const MOVIMENTO_TIPO_ENTREGA = 'entrega'

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function authHeaders() {
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

function pickString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

function pickNumberField(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickLocalizacaoCoords(localizacaoEntity) {
  const loc = unwrapEntity(localizacaoEntity)
  if (!loc) return { lat: null, lng: null }
  return {
    lat: pickNumberField(loc.lat),
    lng: pickNumberField(loc.lng),
  }
}

function parseStrapiListRows(json) {
  if (!json || typeof json !== 'object') return []
  const d = json.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.results)) return d.results
    if (d.id != null || d.documentId != null || d.attributes) return [d]
  }
  return []
}

function unwrapEntity(entity) {
  if (!entity || typeof entity !== 'object') return null
  const data = entity.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, ...(data.attributes ?? {}) }
  }
  return { ...entity, ...(entity.attributes ?? {}) }
}

function pickRelationId(entity) {
  const unwrapped = unwrapEntity(entity)
  if (!unwrapped) return null
  return pickString(unwrapped.documentId ?? unwrapped.id)
}

function pickClienteRelationRefs(clienteEntity) {
  const cliente = unwrapEntity(clienteEntity)
  if (!cliente) {
    return { clienteId: null, clienteDocumentId: null }
  }
  return {
    clienteId: pickString(cliente.id),
    clienteDocumentId: pickString(cliente.documentId),
  }
}

function pickOperadorRelationRefs(operadorEntity) {
  if (operadorEntity == null) {
    return { operadorId: null, operadorDocumentId: null }
  }
  if (typeof operadorEntity === 'number' || typeof operadorEntity === 'string') {
    const ref = pickString(operadorEntity)
    if (!ref) return { operadorId: null, operadorDocumentId: null }
    if (/^\d+$/.test(ref)) return { operadorId: ref, operadorDocumentId: null }
    return { operadorId: null, operadorDocumentId: ref }
  }
  const operador = unwrapEntity(operadorEntity)
  if (!operador) {
    return { operadorId: null, operadorDocumentId: null }
  }
  return {
    operadorId: pickString(operador.id),
    operadorDocumentId: pickString(operador.documentId),
  }
}

function pickUserIdAliases(entity) {
  const unwrapped = unwrapEntity(entity)
  if (!unwrapped) return []
  const aliases = new Set()
  for (const value of [unwrapped.id, unwrapped.documentId]) {
    const ref = pickString(value)
    if (ref) aliases.add(ref)
  }
  return [...aliases]
}

function pickUserDisplayName(userEntity) {
  const user = unwrapEntity(userEntity)
  if (!user) return null
  return (
    pickString(user.username) ??
    pickString(user.nome) ??
    pickString(user.email) ??
    null
  )
}

function pickClienteNameFromMovimento(attrs) {
  const fromCliente = pickUserDisplayName(attrs?.cliente)
  if (fromCliente) return fromCliente
  const localizacao = unwrapEntity(attrs?.localizacao)
  return pickUserDisplayName(localizacao?.user)
}

function pickClienteIdFromMovimento(attrs) {
  const cliente = unwrapEntity(attrs?.cliente)
  if (cliente) {
    const numeric = pickString(cliente.id)
    const doc = pickString(cliente.documentId)
    return numeric ?? doc ?? pickRelationId(attrs.cliente)
  }
  const localizacao = unwrapEntity(attrs?.localizacao)
  const user = unwrapEntity(localizacao?.user)
  if (user) {
    return pickString(user.id) ?? pickString(user.documentId) ?? pickRelationId(localizacao?.user)
  }
  return null
}

function pickClienteIdAliasesFromMovimento(attrs) {
  const aliases = new Set()
  for (const ref of pickUserIdAliases(attrs?.cliente)) aliases.add(ref)
  const localizacao = unwrapEntity(attrs?.localizacao)
  for (const ref of pickUserIdAliases(localizacao?.user)) aliases.add(ref)
  const direct = pickClienteIdFromMovimento(attrs)
  if (direct) aliases.add(direct)
  return [...aliases]
}

/** @param {object} card */
export function movimentoCardBelongsToCliente(card, cliente) {
  if (!card || !cliente) return false
  const targetIds = new Set(
    [cliente.id, cliente.documentId, ...(cliente.idAliases ?? [])]
      .map((value) => pickString(value))
      .filter(Boolean),
  )
  const cardIds = new Set(
    [card.clienteId, ...(card.clienteIdAliases ?? [])].map((value) => pickString(value)).filter(Boolean),
  )
  for (const id of cardIds) {
    if (targetIds.has(id)) return true
  }
  const locId = pickString(card.localizacaoId)
  const clientLocIds = (cliente.localizacoes ?? [])
    .map((loc) => pickString(loc.strapiId))
    .filter(Boolean)
  if (locId && clientLocIds.some((clientLocId) => String(clientLocId) === String(locId))) {
    return true
  }
  return false
}

function pickMovimentoClienteLabel(attrs, row, contentor) {
  return (
    pickUserDisplayName(attrs?.cliente ?? row?.cliente) ??
    pickUserDisplayName(contentor?.clienteAtual) ??
    null
  )
}

function movimentoBelongsToOperador(item, currentOperadorIds, options = {}) {
  if (!item || !(currentOperadorIds instanceof Set) || currentOperadorIds.size === 0) {
    return false
  }
  const refs = [item.operadorId, item.operadorDocumentId].filter(Boolean).map(String)
  if (refs.length === 0) return Boolean(options.trustApiScope)
  return refs.some((ref) => currentOperadorIds.has(ref))
}

/** Contagens de stats: só movimentos com operador explicitamente associado. */
function movimentoBelongsToOperadorStrict(item, currentOperadorIds) {
  return movimentoBelongsToOperador(item, currentOperadorIds, { trustApiScope: false })
}

function movimentoBelongsToCliente(item, currentClienteIds) {
  if (!item || !(currentClienteIds instanceof Set) || currentClienteIds.size === 0) {
    return false
  }
  const refs = [item.clienteId, item.clienteDocumentId].filter(Boolean).map(String)
  if (refs.length > 0) {
    return refs.some((ref) => currentClienteIds.has(ref))
  }
  // Movimentos da API do cliente sem relação `cliente` preenchida (legado / permissões).
  return true
}

/** Contagens de stats: só movimentos com cliente explicitamente associado. */
function movimentoBelongsToClienteStrict(item, currentClienteIds) {
  if (!item || !(currentClienteIds instanceof Set) || currentClienteIds.size === 0) {
    return false
  }
  const refs = [item.clienteId, item.clienteDocumentId].filter(Boolean).map(String)
  if (refs.length === 0) return false
  return refs.some((ref) => currentClienteIds.has(ref))
}

function movimentoBelongsToOtherCliente(item, currentClienteIds) {
  if (!item || !(currentClienteIds instanceof Set) || currentClienteIds.size === 0) {
    return false
  }
  const refs = [item.clienteId, item.clienteDocumentId].filter(Boolean).map(String)
  if (refs.length === 0) return false
  return !refs.some((ref) => currentClienteIds.has(ref))
}

const LOCALIZACAO_MORADA_KEYS = ['morada', 'endereco', 'localizacao', 'descricao', 'titulo', 'title']
const LOCALIZACAO_NOME_KEYS = ['nome', 'name', 'designacao', 'denominacao', 'label']

function includesIgnoreCase(haystack, needle) {
  if (!haystack || !needle) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function pickFirstStringField(obj, keys) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of keys) {
    const value = pickString(obj[key])
    if (value) return value
  }
  return null
}

function joinLocalizacaoParts(morada, nome) {
  const m = morada?.trim()
  const n = nome?.trim()
  if (m && n) {
    if (includesIgnoreCase(m, n)) {
      return { location: n, locationPrefix: null, locationDetail: n }
    }
    return {
      location: n,
      locationPrefix: m,
      locationDetail: n,
    }
  }
  if (m) return { location: m, locationPrefix: null, locationDetail: m }
  if (n) return { location: n, locationPrefix: null, locationDetail: n }
  return { location: null, locationPrefix: null, locationDetail: null }
}

/**
 * @returns {{ location: string|null, locationPrefix: string|null, locationDetail: string|null }}
 */
function pickLocalizacaoDisplay(localizacaoEntity, contentor) {
  const loc = unwrapEntity(localizacaoEntity)
  if (loc) {
    const moradaLike = pickFirstStringField(loc, LOCALIZACAO_MORADA_KEYS)
    const nome = pickFirstStringField(loc, LOCALIZACAO_NOME_KEYS)
    if (moradaLike && nome && includesIgnoreCase(moradaLike, nome)) {
      return { location: nome, locationPrefix: null, locationDetail: nome }
    }
    if (moradaLike && !nome) {
      return { location: moradaLike, locationPrefix: null, locationDetail: moradaLike }
    }
    const joined = joinLocalizacaoParts(moradaLike, nome)
    if (joined.location) return joined
  }

  const fromContentor = pickString(contentor?.localizacao)
  if (fromContentor) {
    return { location: fromContentor, locationPrefix: null, locationDetail: fromContentor }
  }

  return { location: null, locationPrefix: null, locationDetail: null }
}

/** Agrupa recolhas e entregas de troca mesmo com datas ligeiramente diferentes no Strapi. */
function buildPedidoTrocaPoolKey(row) {
  const periodo = normalizeText(row.periodo ?? row.scheduledAt?.split(/\s+/).pop())
  return `${row.clienteId ?? 'none'}|${row.localizacaoId ?? 'none'}|${periodo}`
}

function pedidoGroupHasTaskType(items, taskType) {
  return items.some((item) => item.taskType === taskType)
}

/** Entrega pendente de contentor (par de uma troca), ainda sem CID atribuído. */
function isTrocaEntregaMovimento(item) {
  if (!item || item.taskType !== 'entregar') return false
  if (pickString(item.contentorStrapiId)) return false
  const cid = pickString(item.contentorId)
  return !cid || cid === 'Não definido'
}

/** Troca = recolha do contentor atual + entrega de um novo (no mesmo pedido). */
function pedidoGroupIsTroca(items) {
  if (!Array.isArray(items) || items.length < 2) return false
  return pedidoGroupHasTaskType(items, 'recolher') && pedidoGroupHasTaskType(items, 'entregar')
}

function buildPedidoSubgroupKey(subgroup) {
  if (!pedidoGroupIsTroca(subgroup)) {
    const row = subgroup[0]
    return pickString(row?.movimentoKey) ?? `${row?.id ?? 'mov'}-${row?.taskType ?? 'pedido'}`
  }
  const recolha = subgroup.find((item) => item.taskType === 'recolher') ?? subgroup[0]
  const contentorId = pickPedidoGroupContentorId(subgroup)
  const periodo = normalizeText(recolha.periodo ?? recolha.scheduledAt?.split(/\s+/).pop())
  return `troca|${recolha.clienteId ?? 'none'}|${contentorId ?? 'none'}|${recolha.dateSortValue}|${periodo}`
}

function findTrocaEntregaIndex(recolha, looseEntregas) {
  const sameDateIdx = looseEntregas.findIndex(
    (item) => isTrocaEntregaMovimento(item) && item.dateSortValue === recolha.dateSortValue,
  )
  if (sameDateIdx >= 0) return sameDateIdx

  const trocaEntregas = looseEntregas
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isTrocaEntregaMovimento(item))
  if (trocaEntregas.length === 1) return trocaEntregas[0].index

  return looseEntregas.findIndex((item) => isTrocaEntregaMovimento(item))
}

function partitionPedidoSubgroups(siblings) {
  const recolhas = siblings.filter((item) => item.taskType === 'recolher')
  const entregas = siblings.filter((item) => item.taskType === 'entregar')
  const rest = siblings.filter((item) => item.taskType !== 'recolher' && item.taskType !== 'entregar')
  const subgroups = []
  const looseEntregas = [...entregas]

  for (const recolha of recolhas) {
    const trocaEntregaIdx = findTrocaEntregaIndex(recolha, looseEntregas)
    if (trocaEntregaIdx >= 0) {
      subgroups.push([recolha, looseEntregas.splice(trocaEntregaIdx, 1)[0]])
    } else {
      subgroups.push([recolha])
    }
  }

  for (const entrega of looseEntregas) {
    subgroups.push([entrega])
  }

  for (const item of rest) {
    subgroups.push([item])
  }

  return subgroups
}

function pickPedidoGroupClientName(siblings) {
  for (const item of siblings) {
    const name = pickString(item.clientName)
    if (name) return name
  }
  return null
}

function pickPedidoGroupContentorId(items) {
  const recolha = items.find(
    (item) =>
      item.taskType === 'recolher' &&
      item.contentorId &&
      item.contentorId !== 'Não definido',
  )
  if (recolha?.contentorId) return recolha.contentorId
  const withId = items.find((item) => item.id && item.id !== 'Não definido')
  return withId?.contentorId ?? withId?.id ?? null
}

function buildPedidoGroupTasks(siblings) {
  return siblings.map((item) => ({
    movimentoKey: item.movimentoKey,
    taskType: item.taskType,
    label: item.taskType === 'entregar' ? 'Entrega de contentor' : 'Recolha de contentor',
    collectionId: item.id,
  }))
}

function pickCanonicalPedidoCliente(items) {
  const recolha = items.find((item) => item.taskType === 'recolher' && pickString(item.clienteLabel))
  if (recolha?.clienteLabel) return recolha.clienteLabel
  const withLabel = items.find((item) => pickString(item.clienteLabel))
  return withLabel?.clienteLabel ?? null
}

function pickCanonicalPedidoLocation(items) {
  const recolha = items.find(
    (item) => item.taskType === 'recolher' && item.contentorId && item.location,
  )
  if (recolha) {
    return {
      location: recolha.location,
      locationPrefix: recolha.locationPrefix,
      locationDetail: recolha.locationDetail,
    }
  }

  const withLocation = items.filter((item) => item.location)
  if (withLocation.length === 0) return null

  const best = withLocation.reduce((current, item) =>
    item.location.length > current.location.length ? item : current,
  )
  return {
    location: best.location,
    locationPrefix: best.locationPrefix,
    locationDetail: best.locationDetail,
  }
}

/** Alinha morada e metadados de grupo (recolha + entrega quando é troca). */
function enrichMovimentosPedidoGroups(rows) {
  const trocaPools = new Map()

  for (const row of rows) {
    const key = buildPedidoTrocaPoolKey(row)
    const list = trocaPools.get(key) ?? []
    list.push(row)
    trocaPools.set(key, list)
  }

  const subgroupByMovimentoKey = new Map()
  for (const poolSiblings of trocaPools.values()) {
    for (const subgroup of partitionPedidoSubgroups(poolSiblings)) {
      const groupKey = buildPedidoSubgroupKey(subgroup)
      for (const item of subgroup) {
        const movKey = pickString(item.movimentoKey)
        if (movKey) subgroupByMovimentoKey.set(movKey, { subgroup, groupKey })
      }
    }
  }

  return rows.map((row) => {
    const movKey = pickString(row.movimentoKey)
    const meta = (movKey && subgroupByMovimentoKey.get(movKey)) || {
      subgroup: [row],
      groupKey: buildPedidoSubgroupKey([row]),
    }
    const siblings = meta.subgroup
    const canonical = pickCanonicalPedidoLocation(siblings)
    const canonicalCliente = pickCanonicalPedidoCliente(siblings)
    const contentorId = pickPedidoGroupContentorId(siblings)
    const pedidoGroupMovimentoKeys = siblings.map((item) => item.movimentoKey).filter(Boolean)
    const pedidoGroupTasks = buildPedidoGroupTasks(siblings)
    const groupClientName = pickPedidoGroupClientName(siblings)

    return {
      ...row,
      pedidoGroupKey: meta.groupKey,
      pedidoGroupMovimentoKeys,
      pedidoGroupTasks,
      pedidoGroupContentorId: contentorId,
      pedidoGroupSiblingCount: siblings.length,
      hasTroca: pedidoGroupIsTroca(siblings),
      ...(groupClientName ? { clientName: groupClientName } : {}),
      ...(canonical?.location
        ? {
            location: canonical.location,
            locationPrefix: canonical.locationPrefix ?? row.locationPrefix,
            locationDetail: canonical.locationDetail ?? row.locationDetail,
          }
        : {}),
      ...(canonicalCliente ? { clienteLabel: canonicalCliente } : {}),
    }
  })
}

/** @param {object} item */
export function getPedidoGroupMovimentoKeys(item) {
  const keys = item?.pedidoGroupMovimentoKeys
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.filter(Boolean)
  }
  const single = pickString(item?.movimentoKey)
  return single ? [single] : []
}

/** @param {object} pedido */
export function pedidoHasTroca(pedido) {
  if (!pedido) return false
  if (typeof pedido.hasTroca === 'boolean') return pedido.hasTroca
  return pedidoGroupIsTroca(pedido.pedidoGroupTasks ?? [])
}

/** @param {object} pedido */
export function pedidoIsEntregaSimples(pedido) {
  if (!pedido || pedidoHasTroca(pedido)) return false
  if (pedido.taskType === 'entregar') return true
  const tasks = pedido.pedidoGroupTasks ?? []
  return pedidoGroupHasTaskType(tasks, 'entregar') && !pedidoGroupHasTaskType(tasks, 'recolher')
}

/** @param {object} pedido */
export function pedidoAdminBadgeLabel(pedido) {
  if (pedidoHasTroca(pedido)) return 'Pedido · Troca'
  if (pedidoIsEntregaSimples(pedido)) return 'Pedido · Entrega'
  return 'Pedido'
}

/** @param {object} pedido */
export function cancelamentoAdminBadgeLabel(pedido) {
  if (pedidoHasTroca(pedido)) return 'Cancelamento · Troca'
  if (pedidoIsEntregaSimples(pedido)) return 'Cancelamento · Entrega'
  if (pedido?.taskType === 'entregar') return 'Cancelamento · Entrega'
  return 'Cancelamento · Recolha'
}

/** @param {object} pedido */
export function pickPedidoClienteId(pedido) {
  if (!pedido) return null
  const direct = pickString(pedido.clienteId)
  if (direct) return direct
  for (const alias of pedido.clienteIdAliases ?? []) {
    const id = pickString(alias)
    if (id) return id
  }
  return null
}

/** @param {object} pedido */
export function pedidoNeedsEntregaContentor(pedido) {
  return pedidoHasTroca(pedido) || pedidoIsEntregaSimples(pedido)
}

/** @param {object} pedido */
export function getPedidoEntregaCapacidadeId(pedido) {
  if (!pedido) return null
  if (pedidoHasTroca(pedido)) {
    return pickString(pedido.recolhaCapacidadeId ?? pedido.contentorCapacidadeId)
  }
  return pickString(
    pedido.entregaCapacidadeId ??
      pedido.pedidoCapacidadeId ??
      pedido.contentorCapacidadeId,
  )
}

/** @param {object} pedido */
export function getPedidoEntregaCapacidadeLabel(pedido) {
  if (!pedido) return '—'
  if (pedidoHasTroca(pedido)) {
    return (
      formatCapacidadeLabel(pedido.recolhaCapacidadeLitros, pedido.recolhaLitrosLabel) ??
      formatCapacidadeLabel(pedido.contentorLitros, pedido.litrosLabel) ??
      '—'
    )
  }
  return (
    pedido.entregaLitrosLabel ??
    pedido.pedidoLitrosLabel ??
    formatCapacidadeLabel(pedido.entregaCapacidadeLitros ?? pedido.pedidoCapacidadeLitros, pedido.litrosLabel) ??
    '—'
  )
}

/** @param {object} pedido */
export function getPedidoEntregaMovimentoKey(pedido) {
  const direct = pickString(pedido?.entregaMovimentoKey)
  if (direct) return direct
  const fromTasks = pedido?.pedidoGroupTasks?.find((task) => task.taskType === 'entregar')
  const fromTask = pickString(fromTasks?.movimentoKey)
  if (fromTask) return fromTask
  if (pedidoIsEntregaSimples(pedido)) return pickString(pedido?.movimentoKey)
  return null
}

function enrichPedidoTrocaMeta(canonicalRow, allPedidos) {
  const groupKey = canonicalRow.pedidoGroupKey
  const siblings = groupKey
    ? allPedidos.filter((item) => item.pedidoGroupKey === groupKey)
    : [canonicalRow]
  const recolha = siblings.find((item) => item.taskType === 'recolher') ?? canonicalRow
  const entrega = siblings.find((item) => item.taskType === 'entregar')
  const entregaRow = entrega ?? (canonicalRow.taskType === 'entregar' ? canonicalRow : null)
  const hasTroca = pedidoGroupIsTroca(siblings)
  const entregaCapacidadeId =
    entregaRow?.pedidoCapacidadeId ??
    entregaRow?.contentorCapacidadeId ??
    canonicalRow.pedidoCapacidadeId ??
    canonicalRow.contentorCapacidadeId ??
    null
  const entregaCapacidadeLitros =
    entregaRow?.pedidoCapacidadeLitros ??
    entregaRow?.contentorLitros ??
    canonicalRow.pedidoCapacidadeLitros ??
    canonicalRow.contentorLitros ??
    null
  const entregaLitrosLabel =
    entregaRow?.pedidoLitrosLabel ??
    formatCapacidadeLabel(entregaCapacidadeLitros, entregaRow?.litrosLabel) ??
    canonicalRow.pedidoLitrosLabel ??
    formatCapacidadeLabel(canonicalRow.pedidoCapacidadeLitros, canonicalRow.litrosLabel)

  return {
    ...canonicalRow,
    hasTroca,
    entregaMovimentoKey:
      entrega?.movimentoKey ??
      canonicalRow.pedidoGroupTasks?.find((task) => task.taskType === 'entregar')?.movimentoKey ??
      (canonicalRow.taskType === 'entregar' ? canonicalRow.movimentoKey : null),
    entregaCapacidadeId,
    entregaCapacidadeLitros,
    entregaLitrosLabel,
    recolhaContentorCid: recolha.contentorId ?? recolha.id,
    recolhaLitrosLabel:
      formatCapacidadeLabel(recolha.contentorLitros, recolha.litrosLabel) ??
      formatCapacidadeLabel(canonicalRow.contentorLitros, canonicalRow.litrosLabel),
    recolhaCapacidadeId: recolha.contentorCapacidadeId ?? canonicalRow.contentorCapacidadeId ?? null,
    recolhaCapacidadeLitros: recolha.contentorLitros ?? canonicalRow.contentorLitros ?? null,
  }
}

function isPedidoTrocarGroup(items) {
  if (!Array.isArray(items) || items.length < 2) return false
  const types = new Set(items.map((item) => item.taskType))
  return types.has('recolher') && types.has('entregar')
}

function pickRecolhaFromPedidoGroup(items) {
  return (
    items.find((item) => item.taskType === 'recolher') ??
    items.find((item) => item.contentorId && item.contentorId !== 'Não definido') ??
    items[0]
  )
}

function buildTrocarDisplayCard(siblings) {
  const recolha = pickRecolhaFromPedidoGroup(siblings)
  const contentorId =
    recolha.pedidoGroupContentorId ?? recolha.contentorId ?? recolha.id ?? 'Não definido'

  return {
    ...recolha,
    id: contentorId,
    taskType: 'trocar',
    pedidoDisplayMode: 'trocar',
    pedidoGroupMovimentoKeys: siblings.map((item) => item.movimentoKey).filter(Boolean),
    pedidoGroupTasks: buildPedidoGroupTasks(siblings),
    pedidoGroupContentorId: contentorId,
    pedidoGroupSiblingCount: siblings.length,
  }
}

/**
 * Agrupa par recolha+entrega (trocar contentor) num único card de listagem.
 * @param {Array<object>} rows
 */
export function collapseMovimentosPedidoCards(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const groups = new Map()
  const groupOrder = []

  for (const row of rows) {
    const key =
      row.pedidoGroupKey ??
      pickString(row.movimentoKey) ??
      `${row.id ?? 'item'}|${row.dateSortValue}|${row.taskType}`
    if (!groups.has(key)) {
      groups.set(key, [])
      groupOrder.push(key)
    }
    groups.get(key).push(row)
  }

  return groupOrder.map((key) => {
    const siblings = groups.get(key) ?? []
    if (isPedidoTrocarGroup(siblings)) return buildTrocarDisplayCard(siblings)
    return siblings[0]
  })
}

/**
 * Séries semanais: um card por recorrência (próxima ocorrência), estilo calendário.
 * @param {Array<object>} rows
 */
export function collapseRecorrenciaSeriesCards(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  /** @type {Map<string, object>} */
  const seriesNext = new Map()
  /** @type {string[]} */
  const seriesOrder = []
  /** @type {object[]} */
  const standalone = []

  for (const row of rows) {
    const rid = pickString(row.recorrenciaId)
    const isSeriesEstado =
      row.estadoKey === MOVIMENTO_ESTADO_AGENDADO ||
      row.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO
    if (!rid || !isSeriesEstado) {
      standalone.push(row)
      continue
    }

    const existing = seriesNext.get(rid)
    if (!existing) {
      seriesNext.set(rid, row)
      seriesOrder.push(rid)
      continue
    }

    const rowDate = Number(row.dateSortValue) || 0
    const exDate = Number(existing.dateSortValue) || 0
    const rowUpcoming = rowDate >= todayMs
    const exUpcoming = exDate >= todayMs
    if (rowUpcoming && !exUpcoming) {
      seriesNext.set(rid, row)
    } else if (rowUpcoming === exUpcoming && rowDate < exDate) {
      seriesNext.set(rid, row)
    }
  }

  const seriesCards = seriesOrder
    .map((rid) => {
      const item = seriesNext.get(rid)
      if (!item) return null
      const isCancelamento = item.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO
      return {
        ...item,
        recorrenciaSemanal: true,
        badgeLabel: isCancelamento ? 'Cancelamento pendente' : 'Semanal',
      }
    })
    .filter(Boolean)

  return [...standalone, ...seriesCards].sort((a, b) => {
    const aCancel = a.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO ? 0 : 1
    const bCancel = b.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO ? 0 : 1
    if (aCancel !== bCancel) return aCancel - bCancel
    const aPedido = a.estadoKey === MOVIMENTO_ESTADO_PEDIDO ? 0 : 1
    const bPedido = b.estadoKey === MOVIMENTO_ESTADO_PEDIDO ? 0 : 1
    if (aPedido !== bPedido) return aPedido - bPedido
    return (a.dateSortValue ?? 0) - (b.dateSortValue ?? 0)
  })
}

/**
 * Listagem cliente/admin: agrupa trocas + colapsa séries semanais.
 * @param {Array<object>} rows
 */
export function collapseMovimentosListagemCards(rows) {
  return collapseRecorrenciaSeriesCards(collapseMovimentosPedidoCards(rows))
}
function formatDate(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatDateTime(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function pickHistoricoScheduledAt(attrs, dateLabel, periodo) {
  const updated = formatDateTime(attrs.updatedAt ?? attrs.publishedAt)
  if (updated) return updated
  if (dateLabel && periodo) {
    const p = normalizeText(periodo)
    if (p === 'indiferente') return dateLabel
    const periodTime = p === 'tarde' ? '14:00' : '10:00'
    return `${dateLabel} ${periodTime}`
  }
  return dateLabel
}

function parseDateOnly(value) {
  const raw = pickString(value)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDateStatus(value) {
  const date = parseDateOnly(value)
  if (!date) return 'agendada'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = addDays(today, 1)

  if (date.getTime() < today.getTime()) return 'atrasado'
  if (date.getTime() === today.getTime()) return 'hoje'
  if (date.getTime() === tomorrow.getTime()) return 'amanha'
  return 'agendada'
}

function normalizeTipoMovimento(value, fallback = 'recolher') {
  const raw = pickString(value)
  if (!raw) return fallback
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (s.includes('entrega') || s.includes('entregar')) return 'entregar'
  if (s.includes('recolha') || s.includes('recolher')) return 'recolher'
  return fallback
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isEstadoAgendado(value) {
  const s = normalizeText(value)
  return s === MOVIMENTO_ESTADO_AGENDADO || s === 'agendada'
}

function isEstadoPedido(value) {
  return normalizeText(value) === MOVIMENTO_ESTADO_PEDIDO
}

function isEstadoCancelamento(value) {
  return normalizeText(value) === MOVIMENTO_ESTADO_CANCELAMENTO
}

function isEstadoPedidoVisivel(value) {
  return isEstadoAgendado(value) || isEstadoPedido(value) || isEstadoCancelamento(value)
}

function isEstadoConcluido(value) {
  const s = normalizeText(value)
  return (
    s === MOVIMENTO_ESTADO_CONCLUIDO ||
    s === 'concluida' ||
    s === 'finalizado' ||
    s === 'finalizada'
  )
}

function normalizeEstadoKey(value) {
  if (isEstadoPedido(value)) return MOVIMENTO_ESTADO_PEDIDO
  if (isEstadoAgendado(value)) return MOVIMENTO_ESTADO_AGENDADO
  if (isEstadoConcluido(value)) return MOVIMENTO_ESTADO_CONCLUIDO
  if (isEstadoCancelamento(value)) return MOVIMENTO_ESTADO_CANCELAMENTO
  return normalizeText(value)
}

function formatCapacidadeLabel(litros, litrosLabel) {
  if (litros != null && Number.isFinite(Number(litros))) return `${Number(litros)} L`
  const raw = pickString(litrosLabel)
  if (!raw) return null
  const normalized = raw.replace(/\s*L\s*$/i, '').trim()
  if (!normalized) return null
  return `${normalized} L`
}

function pickContentorLitros(contentor, fallback) {
  if (!contentor) return fallback
  const capacidadeRaw = contentor.capacidade
  const litros =
    normalizeCapacidadeLitros(capacidadeRaw) ??
    normalizeCapacidadeLitros(unwrapEntity(capacidadeRaw)) ??
    normalizeCapacidadeLitros(contentor)
  if (litros != null) return `${litros} L`
  return fallback
}

function pickCapacidadeLitrosFromObservacoes(value) {
  const text = pickString(value)
  if (!text) return null
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*l(?:itros?)?\b/i)
  if (!match) return null
  const n = Number(String(match[1]).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function pickMovimentoCapacidadeMeta(attrs, contentorMeta = {}) {
  const capacidadeRaw = attrs?.capacidade
  const capacidadeEntity = unwrapEntity(capacidadeRaw)
  const fromMovimentoLitros =
    normalizeCapacidadeLitros(capacidadeRaw) ?? normalizeCapacidadeLitros(capacidadeEntity)
  const fromMovimentoId =
    pickRelationId(capacidadeRaw) ?? pickRelationId(capacidadeEntity) ?? null

  if (fromMovimentoLitros != null || fromMovimentoId) {
    return {
      pedidoCapacidadeId: fromMovimentoId,
      pedidoCapacidadeLitros: fromMovimentoLitros,
      pedidoLitrosLabel: formatCapacidadeLabel(fromMovimentoLitros, null),
    }
  }

  const fromObservacoes = pickCapacidadeLitrosFromObservacoes(attrs?.observacoesCliente)
  if (fromObservacoes != null) {
    return {
      pedidoCapacidadeId: null,
      pedidoCapacidadeLitros: fromObservacoes,
      pedidoLitrosLabel: formatCapacidadeLabel(fromObservacoes, null),
    }
  }

  if (contentorMeta.contentorCapacidadeId || contentorMeta.contentorLitros != null) {
    return {
      pedidoCapacidadeId: contentorMeta.contentorCapacidadeId ?? null,
      pedidoCapacidadeLitros: contentorMeta.contentorLitros ?? null,
      pedidoLitrosLabel: formatCapacidadeLabel(
        contentorMeta.contentorLitros,
        pickContentorLitros(unwrapEntity(attrs?.contentor), null),
      ),
    }
  }

  return {
    pedidoCapacidadeId: null,
    pedidoCapacidadeLitros: null,
    pedidoLitrosLabel: null,
  }
}

function pickContentorCapacidadeMeta(contentor) {
  if (!contentor) {
    return { contentorStrapiId: null, contentorCapacidadeId: null, contentorLitros: null }
  }
  const contentorStrapiId = pickRelationId(contentor) ?? pickString(contentor.documentId ?? contentor.id)
  const capacidadeRaw = contentor.capacidade
  const capacidadeEntity = unwrapEntity(capacidadeRaw)
  const contentorLitros =
    normalizeCapacidadeLitros(capacidadeRaw) ??
    normalizeCapacidadeLitros(capacidadeEntity) ??
    normalizeCapacidadeLitros(contentor)
  const contentorCapacidadeId =
    pickRelationId(capacidadeRaw) ?? pickRelationId(capacidadeEntity) ?? null
  return { contentorStrapiId, contentorCapacidadeId, contentorLitros }
}

function pickContentorQrCode(contentor, fallback) {
  return (
    pickString(
      contentor?.QRCode ??
        contentor?.qrCode ??
        contentor?.qrcode ??
        contentor?.QR ??
        contentor?.qr ??
        contentor?.codigo ??
        contentor?.Codigo,
    ) ??
    fallback ??
    ''
  )
}

function pickBinNumber(contentor, fallback) {
  const cid = pickString(contentor?.CID ?? contentor?.cid)
  const match = cid?.match(/(\d+)$/)
  if (match) return String(Number(match[1])).padStart(2, '0')
  return fallback
}

function getDateSortValue(value) {
  const raw = pickString(value)
  if (!raw) return Number.POSITIVE_INFINITY
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime()
}

function parsePtDateTimeSortValue(value) {
  const raw = pickString(value)
  if (!raw) return null
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!match) return null
  const [, day, month, year, hours = '0', minutes = '0'] = match
  const ts = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime()
  return Number.isNaN(ts) ? null : ts
}

function getHistoricoSortValue(source, dataValue) {
  const updated = getDateSortValue(source?.updatedAt ?? source?.publishedAt ?? source?.createdAt)
  const dataTs = getDateSortValue(dataValue)
  if (Number.isFinite(updated) && updated !== Number.POSITIVE_INFINITY) {
    return Math.max(updated, dataTs === Number.POSITIVE_INFINITY ? updated : dataTs)
  }
  return dataTs
}

/** @param {object} item */
function getMovimentoHistoricoSortValue(item) {
  const fromLabel = parsePtDateTimeSortValue(item?.historicoScheduledAt)
  if (fromLabel != null) return fromLabel
  const historicoTs = item?.historicoSortValue
  if (Number.isFinite(historicoTs) && historicoTs !== Number.POSITIVE_INFINITY) return historicoTs
  const dataTs = item?.dateSortValue
  if (Number.isFinite(dataTs) && dataTs !== Number.POSITIVE_INFINITY) return dataTs
  return 0
}

/** Movimentos do histórico: mais recentes primeiro. */
export function sortMovimentosHistoricoDesc(items) {
  return [...items].sort((a, b) => {
    const sortDiff = getMovimentoHistoricoSortValue(b) - getMovimentoHistoricoSortValue(a)
    if (sortDiff !== 0) return sortDiff
    return String(b.movimentoKey ?? '').localeCompare(String(a.movimentoKey ?? ''), 'pt')
  })
}

function getTodayStartSortValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function getTodayEndSortValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
}

function pickDataFromFallback(fallback) {
  const iso = pickDataIso(fallback?.dataIso)
  if (iso) return iso
  const scheduled = pickString(fallback?.scheduledAt)
  const match = scheduled?.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function pickDataIso(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data estritamente posterior a hoje (fim do dia). */
export function isMovimentoDateAfterToday(dateSortValue) {
  return Number.isFinite(dateSortValue) && dateSortValue > getTodayEndSortValue()
}

export function canDeleteMovimentoCliente(item) {
  if (!item) return false
  if (item.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO) return false
  if (item.estadoKey === MOVIMENTO_ESTADO_PEDIDO) return true
  return isMovimentoDateAfterToday(item.dateSortValue)
}

export function canEditMovimentoCliente(item) {
  if (!item) return false
  if (item.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO) return false
  return item.estadoKey === MOVIMENTO_ESTADO_PEDIDO || item.estadoKey === MOVIMENTO_ESTADO_AGENDADO
}

/**
 * @param {unknown} row
 * @param {Partial<import('../pages/Dashboard/Cliente/mockData.js').MockClientRequest>} [fallback]
 */
function coerceMovimentoRow(row, fallback = {}) {
  if (!row || typeof row !== 'object') return null
  const base = strapiBaseUrl()
  const attrs = row.attributes ?? row
  const contentor = unwrapEntity(attrs.contentor)
  const operador = unwrapEntity(attrs.operador)
  const localizacaoEntity = attrs.localizacao
  const localizacaoDisplay = pickLocalizacaoDisplay(localizacaoEntity, contentor)
  const { lat: localizacaoLat, lng: localizacaoLng } = pickLocalizacaoCoords(localizacaoEntity)
  const localizacaoId = pickRelationId(localizacaoEntity)
  const { clienteId: relationClienteId, clienteDocumentId } = pickClienteRelationRefs(attrs.cliente)
  const { operadorId: relationOperadorId, operadorDocumentId } = pickOperadorRelationRefs(attrs.operador ?? row.operador)
  const clienteLabel = pickMovimentoClienteLabel(attrs, row, contentor) ?? ''
  const movimentoKey =
    pickString(attrs.documentId ?? row.documentId ?? attrs.id ?? row.id) ??
    fallback.movimentoKey ??
    fallback.id ??
    'MOV-000'
  const contentorCid = pickString(contentor?.CID ?? contentor?.cid)
  const effectiveData = attrs.data ?? pickDataFromFallback(fallback)
  const status = getDateStatus(effectiveData)
  const estado = pickString(attrs.estado) ?? MOVIMENTO_ESTADO_AGENDADO
  const date = formatDate(effectiveData)
  const periodo = pickString(attrs.periodo)
  const scheduledAt = [date, periodo].filter(Boolean).join(' ')
  const taskType = normalizeTipoMovimento(
    attrs.tipoMovimento ?? (contentorCid ? MOVIMENTO_TIPO_RECOLHA : MOVIMENTO_TIPO_ENTREGA),
    fallback.taskType,
  )
  const locationText =
    localizacaoDisplay.location ?? fallback.locationDetail ?? fallback.location ?? null
  const clientName =
    pickClienteNameFromMovimento(attrs) ?? pickString(fallback.clientName) ?? null
  const clienteId = relationClienteId ?? pickClienteIdFromMovimento(attrs) ?? fallback.clienteId ?? null
  const clienteIdAliases = pickClienteIdAliasesFromMovimento(attrs)
  const operadorId = relationOperadorId ?? pickRelationId(attrs.operador) ?? fallback.operadorId ?? null
  const operadorName =
    pickString(operador?.username) ?? pickString(operador?.email) ?? fallback.operadorName ?? null
  const ordemOperadorRaw = attrs.ordemOperador ?? fallback.ordemOperador
  const ordemOperador =
    ordemOperadorRaw != null && ordemOperadorRaw !== '' && Number.isFinite(Number(ordemOperadorRaw))
      ? Number(ordemOperadorRaw)
      : 0
  const { contentorStrapiId, contentorCapacidadeId, contentorLitros } = pickContentorCapacidadeMeta(contentor)
  const contentorSituacaoRaw = pickString(contentor?.situacao)
  const contentorSituacao = contentorSituacaoRaw
    ? normalizeText(contentorSituacaoRaw).includes('transito')
      ? 'em-transito'
      : normalizeText(contentorSituacaoRaw) === 'cliente'
        ? 'cliente'
        : 'armazem'
    : null
  const { pedidoCapacidadeId, pedidoCapacidadeLitros, pedidoLitrosLabel } = pickMovimentoCapacidadeMeta(
    attrs,
    { contentorCapacidadeId, contentorLitros },
  )
  const fotografias = pickMovimentoFotografias(attrs.fotografias, base)
  const historicoScheduledAt =
    pickHistoricoScheduledAt(attrs, date, periodo) || fallback.historicoScheduledAt || ''
  const historicoSortValue = Math.max(
    getHistoricoSortValue({ ...row, ...attrs }, attrs.data),
    parsePtDateTimeSortValue(historicoScheduledAt) ?? 0,
  )

  return {
    id: contentorCid ?? 'Não definido',
    movimentoKey,
    clientName,
    clienteId,
    clienteIdAliases,
    operadorId,
    operadorName,
    ordemOperador,
    contentorStrapiId,
    contentorCapacidadeId,
    contentorLitros,
    contentorSituacao,
    contentorSituacaoLabel: contentorSituacaoRaw ?? '',
    pedidoCapacidadeId,
    pedidoCapacidadeLitros,
    pedidoLitrosLabel,
    location: locationText,
    locationPrefix: localizacaoDisplay.locationPrefix ?? null,
    locationDetail:
      localizacaoDisplay.locationDetail ?? localizacaoDisplay.location ?? fallback.locationDetail,
    lat: localizacaoLat ?? fallback.lat ?? null,
    lng: localizacaoLng ?? fallback.lng ?? null,
    localizacaoId: localizacaoId ?? fallback.localizacaoId,
    clienteDocumentId: clienteDocumentId ?? fallback.clienteDocumentId,
    operadorDocumentId: operadorDocumentId ?? fallback.operadorDocumentId,
    clienteLabel,
    periodo: normalizePeriodoForStrapi(periodo) || periodo || fallback.periodo,
    status,
    scheduledAt: scheduledAt || pickContentorLitros(contentor, fallback.scheduledAt ?? ''),
    binNumber: pickBinNumber(contentor, fallback.binNumber ?? '01'),
    taskType,
    contentorId: contentorCid ?? fallback.contentorId,
    qrCode: pickContentorQrCode(contentor, fallback.qrCode ?? contentorCid),
    litrosLabel: pickContentorLitros(contentor, fallback.litrosLabel ?? fallback.scheduledAt ?? ''),
    egar: pickString(attrs.egar) ?? fallback.egar ?? '',
    peso: formatMovimentoPeso(attrs.peso ?? fallback.peso),
    pesoRaw: attrs.peso ?? fallback.peso ?? null,
    codigosLer: coerceCodigosLerRelation(attrs.codigosLer ?? row.codigosLer ?? fallback.codigosLer),
    recorrenciaId:
      pickRecorrenciaIdFromRelation(attrs.recorrencia ?? row.recorrencia) ??
      fallback.recorrenciaId ??
      null,
    estadoContentor: pickString(attrs.estadoContentor) ?? fallback.estadoContentor ?? '',
    estadoContentorLabel:
      formatEstadoContentorLabel(attrs.estadoContentor) ||
      fallback.estadoContentorLabel ||
      '',
    estadoPedidoId: coerceEstadoAuxRelation(attrs.estadoPedido ?? row.estadoPedido)?.id ?? '',
    estadoPedidoLabel:
      coerceEstadoAuxRelation(attrs.estadoPedido ?? row.estadoPedido)?.nome ??
      fallback.estadoPedidoLabel ??
      '',
    observacaoOperador:
      pickString(attrs.observacaoOperador) ?? fallback.observacaoOperador ?? '',
    observacoesCliente:
      pickString(attrs.observacoesCliente) ?? fallback.observacoesCliente ?? '',
    notas: pickString(attrs.notas) ?? fallback.notas ?? '',
    periodoLabel: formatPeriodoLabel(periodo) || formatPeriodoLabel(fallback.periodo),
    fotografias: fotografias.length > 0 ? fotografias : fallback.fotografias ?? [],
    estado,
    estadoKey: normalizeEstadoKey(estado),
    dateSortValue: getDateSortValue(effectiveData),
    historicoSortValue,
    dataIso: pickDataIso(effectiveData),
    historicoScheduledAt:
      pickHistoricoScheduledAt(attrs, date, periodo) || fallback.historicoScheduledAt || '',
    completedAtSortValue: getDateSortValue(attrs.updatedAt ?? attrs.publishedAt ?? attrs.data),
  }
}

function getMovimentoTimelineSortValue(item) {
  const completed = item?.completedAtSortValue
  if (Number.isFinite(completed)) return completed
  return item?.dateSortValue ?? Number.POSITIVE_INFINITY
}

function pickLastConcluidoMovimento(items) {
  const concluidos = items.filter((item) => isEstadoConcluido(item.estado))
  if (concluidos.length === 0) return null
  return [...concluidos].sort(
    (a, b) => getMovimentoTimelineSortValue(a) - getMovimentoTimelineSortValue(b),
  ).at(-1)
}

function pickPendingRecolhaMovimento(items, currentClienteIds) {
  const pending = items.filter(
    (item) =>
      item.taskType === 'recolher' &&
      isEstadoPedidoVisivel(item.estado) &&
      movimentoBelongsToCliente(item, currentClienteIds),
  )
  if (pending.length === 0) return null
  return [...pending].sort(
    (a, b) => getMovimentoTimelineSortValue(a) - getMovimentoTimelineSortValue(b),
  ).at(-1)
}

/**
 * Contentor instalado no cliente quando o último movimento concluído do contentor
 * é uma entrega associada a este cliente. Recolha concluída posterior remove o contentor.
 */
function pickInstalledContentorMovimento(items, currentClienteIds) {
  const lastConcluido = pickLastConcluidoMovimento(items)
  if (!lastConcluido) return null
  if (lastConcluido.taskType === 'recolher') return null
  if (movimentoBelongsToOtherCliente(lastConcluido, currentClienteIds)) return null
  if (!movimentoBelongsToCliente(lastConcluido, currentClienteIds)) return null

  return lastConcluido
}

function resolveContentorDisplayMovimento(items, currentClienteIds) {
  const lastConcluido = pickLastConcluidoMovimento(items)
  const pendingRecolha = pickPendingRecolhaMovimento(items, currentClienteIds)
  const installedMovimento = pickInstalledContentorMovimento(items, currentClienteIds)

  if (lastConcluido?.taskType === 'recolher') return null

  if (
    lastConcluido?.taskType === 'entregar' &&
    movimentoBelongsToOtherCliente(lastConcluido, currentClienteIds)
  ) {
    return null
  }

  if (installedMovimento) {
    return { movimento: installedMovimento, hasPendingPickup: Boolean(pendingRecolha) }
  }

  if (pendingRecolha) {
    return { movimento: pendingRecolha, hasPendingPickup: true }
  }

  return null
}

function createContentorCardFromMovimentos(items, fallback = {}, currentClienteIds) {
  if (!items?.length) return null
  if (!(currentClienteIds instanceof Set) || currentClienteIds.size === 0) return null

  const resolved = resolveContentorDisplayMovimento(items, currentClienteIds)
  if (!resolved) return null

  const { movimento: displayMovimento, hasPendingPickup } = resolved

  return {
    ...fallback,
    ...displayMovimento,
    id: displayMovimento.contentorId ?? displayMovimento.id ?? fallback.id,
    qrCode:
      displayMovimento.qrCode ?? fallback.qrCode ?? displayMovimento.contentorId,
    litrosLabel:
      displayMovimento.litrosLabel ??
      fallback.litrosLabel ??
      displayMovimento.scheduledAt,
    estadoLabel: hasPendingPickup ? 'Em recolha' : 'Reutilizável',
    canRequestPickup: !hasPendingPickup,
  }
}

async function fetchMovimentosRows(base, params) {
  const res = await fetch(`${base}/api/movimentos?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ? ` — ${err.error.message}` : ''
    } catch {
      detail = ''
    }
    throw new Error(`Strapi movimentos: HTTP ${res.status}${detail}`)
  }

  const json = await res.json()
  return parseStrapiListRows(json)
}

function addMovimentosCommonParams(params) {
  params.set('sort', 'data:asc')
  params.set('pagination[pageSize]', '200')
  return params
}

function addMovimentoRelationsPopulate(params) {
  params.set('populate[cliente]', 'true')
  params.set('populate[operador]', 'true')
  params.set('populate[localizacao]', 'true')
  params.set('populate[recorrencia]', 'true')
  params.set('populate[estadoPedido]', 'true')
  params.set('populate[contentor][populate][clienteAtual]', 'true')
  params.set('populate[contentor][populate][localizacaoAtual]', 'true')
  params.set('populate[contentor][populate][estadoFisico]', 'true')
  params.set('populate[contentor][populate][estadoResiduo]', 'true')
}

function createEstadoMovimentosParams(estado, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addMovimentosCommonParams(params)
}

function addMovimentosDeepPopulateParams(params) {
  params.set('populate[contentor][populate][capacidade]', 'true')
  params.set('populate[localizacao][populate][user]', 'true')
  params.set('populate[localizacao]', 'true')
  params.set('populate[cliente]', 'true')
  params.set('populate[operador]', 'true')
  params.set('populate[fotografias]', 'true')
  params.set('populate[codigosLer]', 'true')
  params.set('populate[recorrencia]', 'true')
  params.set('populate[estadoPedido]', 'true')
  params.set('populate[contentor][populate][estadoFisico]', 'true')
  params.set('populate[contentor][populate][estadoResiduo]', 'true')
  return params
}

function absoluteMediaUrl(base, path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  if (!base) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** @param {unknown} media */
function pickSingleMediaUrl(media, base) {
  if (!media) return null
  if (typeof media === 'string') return absoluteMediaUrl(base, media)
  if (typeof media !== 'object') return null
  const attrs = media.attributes ?? media.data?.attributes ?? media.data ?? media
  if (typeof attrs?.url === 'string') return absoluteMediaUrl(base, attrs.url)
  if (typeof media.url === 'string') return absoluteMediaUrl(base, media.url)
  if (media.data) return pickSingleMediaUrl(media.data, base)
  return null
}

/** @param {unknown} mediaField */
function pickMovimentoFotografias(mediaField, base) {
  if (!mediaField) return []
  const raw = mediaField.data ?? mediaField
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
  const urls = []
  for (const item of list) {
    const url = pickSingleMediaUrl(item, base)
    if (url) urls.push(url)
  }
  return urls
}

function formatEstadoContentorLabel(value) {
  const s = pickString(value)
  if (!s) return ''
  const key = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (key === 'reutilizavel') return 'Reutilizável'
  if (key === 'danificado') return 'Danificado'
  if (key === 'infetado') return 'Infetado'
  return s
}

function formatMovimentoPeso(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return `${n}%`
}

function formatPeriodoLabel(value) {
  const s = pickString(value)
  if (!s) return ''
  const key = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (key === 'manha') return 'Manhã'
  if (key === 'tarde') return 'Tarde'
  if (key === 'indiferente') return 'Indiferente'
  return s
}

function createAdminPedidoMovimentosParams(estado) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  addMovimentosDeepPopulateParams(params)
  return addMovimentosCommonParams(params)
}

function createAllMovimentosParams(withPopulate = true) {
  const params = new URLSearchParams()
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addMovimentosCommonParams(params)
}

function addHistoricoSortParams(params) {
  params.set('sort[0]', 'updatedAt:desc')
  params.set('sort[1]', 'data:desc')
  params.set('pagination[pageSize]', '100')
  return params
}

function createEstadoMovimentosParamsHistorico(estado, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addHistoricoSortParams(params)
}

function createContentorMovimentosParams(contentorRef, withPopulate = true) {
  const ref = pickString(contentorRef)
  if (!ref) return null
  const params = new URLSearchParams()
  if (/^CNT-/i.test(ref)) {
    params.set('filters[contentor][CID][$eq]', ref)
  } else if (/^\d+$/.test(ref)) {
    params.set('filters[contentor][id][$eq]', ref)
  } else {
    params.set('filters[contentor][documentId][$eq]', ref)
  }
  if (withPopulate) params.set('populate', '*')
  params.set('sort[0]', 'updatedAt:desc')
  params.set('sort[1]', 'data:desc')
  params.set('pagination[pageSize]', '100')
  return params
}

function movimentoRowBelongsToContentor(row, contentorStrapiId, contentorCid) {
  if (!row || typeof row !== 'object') return false
  const attrs = row.attributes ?? row
  const contentor = unwrapEntity(attrs.contentor)
  if (!contentor) return false
  const strapiId = pickString(contentorStrapiId)
  const cid = pickString(contentorCid)
  const rowStrapiId = pickString(contentor.documentId ?? contentor.id)
  const rowCid = pickString(contentor.CID ?? contentor.cid)
  if (strapiId && rowStrapiId === strapiId) return true
  if (cid && rowCid === cid) return true
  return false
}

/**
 * Histórico de movimentos de um contentor (entregas/recolhas), mais recentes primeiro.
 * @param {string} [contentorStrapiId]
 * @param {string} [contentorCid]
 */
export async function fetchStrapiContentorMovimentosHistorico(contentorStrapiId, contentorCid) {
  const base = strapiBaseUrl()
  if (!base) return []

  const strapiId = pickString(contentorStrapiId)
  const cid = pickString(contentorCid)
  if (!strapiId && !cid) return []

  const fallback = {
    contentorId: cid ?? undefined,
    id: cid ?? undefined,
  }

  const refs = [...new Set([cid, strapiId].filter(Boolean))]

  for (const ref of refs) {
    for (const withPopulate of [true, false]) {
      try {
        const params = createContentorMovimentosParams(ref, withPopulate)
        if (!params) continue
        const rows = await fetchMovimentosRows(base, params)
        if (rows.length === 0) continue
        return sortMovimentosHistoricoDesc(
          rows.map((row) => coerceMovimentoRow(row, fallback)).filter(Boolean),
        )
      } catch {
        /* tentar próxima combinação */
      }
    }
  }

  for (const withPopulate of [true, false]) {
    try {
      const params = createAllMovimentosParams(withPopulate)
      params.set('sort[0]', 'updatedAt:desc')
      params.set('sort[1]', 'data:desc')
      const rows = await fetchMovimentosRows(base, params)
      const historico = sortMovimentosHistoricoDesc(
        rows
          .filter((row) => movimentoRowBelongsToContentor(row, strapiId, cid))
          .map((row) => coerceMovimentoRow(row, fallback))
          .filter(Boolean),
      )
      if (historico.length > 0) return historico
    } catch {
      /* ignorar */
    }
  }

  return []
}

/**
 * Lista movimentos nos estados "agendado" e "pedido" do cliente autenticado.
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosAgendados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  await ensureStrapiRecorrenciasHorizon().catch(() => {})

  const clienteRefs = await ensureStoredStrapiUserRefs()

  /** @type {URLSearchParams[]} */
  const attempts = []

  for (const ref of clienteRefs) {
    for (const refKey of ['id', 'documentId']) {
      for (const estado of [
        'agendado',
        'pedido',
        'cancelamento',
        'Agendado',
        'Pedido',
        'Cancelamento',
        'agendada',
        'Agendada',
      ]) {
        const params = new URLSearchParams()
        params.set('filters[estado][$eq]', estado)
        params.set(`filters[cliente][${refKey}][$eq]`, ref)
        addMovimentoRelationsPopulate(params)
        addMovimentosCommonParams(params)
        attempts.push(params)

        const paramsPlain = new URLSearchParams()
        paramsPlain.set('filters[estado][$eq]', estado)
        paramsPlain.set(`filters[cliente][${refKey}][$eq]`, ref)
        addMovimentosCommonParams(paramsPlain)
        attempts.push(paramsPlain)
      }
    }
  }

  attempts.push(
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('cancelamento', true),
    createEstadoMovimentosParams('agendado', false),
    createEstadoMovimentosParams('pedido', false),
    createEstadoMovimentosParams('cancelamento', false),
    createAllMovimentosParams(true),
    createAllMovimentosParams(false),
  )

  let lastError = null
  let lastProcessed = []

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const pedidos = enrichMovimentosPedidoGroups(
        rows
          .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
          .filter((item) => item && isEstadoPedidoVisivel(item.estado))
          .filter((item) =>
            clienteRefs.size > 0
              ? movimentoBelongsToClienteStrict(item, clienteRefs)
              : true,
          )
          .sort((a, b) => a.dateSortValue - b.dateSortValue),
      )
      if (pedidos.length > 0) return pedidos
      lastProcessed = pedidos
      if (rows.length === 0 && params.toString().includes('filters%5Bcliente%5D')) {
        continue
      }
    } catch (err) {
      lastError = err
    }
  }

  if (lastProcessed.length > 0) return lastProcessed
  if (lastError) throw lastError
  return []
}

function pickAdminPedidoListRows(rows) {
  const byGroup = new Map()

  for (const row of rows) {
    const key = row.pedidoGroupKey ?? row.movimentoKey ?? `${row.id}-${row.taskType}`
    const list = byGroup.get(key) ?? []
    list.push(row)
    byGroup.set(key, list)
  }

  return [...byGroup.values()]
    .map((siblings) => siblings.find((item) => item.taskType === 'recolher') ?? siblings[0])
    .sort((a, b) => a.dateSortValue - b.dateSortValue)
}

/**
 * Lista movimentos com estado "pedido" (admin — para aprovar).
 */
export async function fetchStrapiAdminMovimentosPedido() {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createAdminPedidoMovimentosParams('pedido'),
    createAdminPedidoMovimentosParams('Pedido'),
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('pedido', false),
    createEstadoMovimentosParams('Pedido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const pedidos = enrichMovimentosPedidoGroups(
        rows
          .map((row) => coerceMovimentoRow(row))
          .filter((item) => item && item.estadoKey === MOVIMENTO_ESTADO_PEDIDO),
      )
      return pickAdminPedidoListRows(pedidos).map((row) => enrichPedidoTrocaMeta(row, pedidos))
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

/**
 * Lista movimentos com estado "cancelamento" (admin — aprovar/recusar cancelamento).
 */
export async function fetchStrapiAdminMovimentosCancelamento() {
  const rows = await fetchStrapiAdminMovimentosCancelamentoRaw()
  const list = pickAdminPedidoListRows(rows).map((row) => {
    const enriched = enrichPedidoTrocaMeta(row, rows)
    return {
      ...enriched,
      badgeLabel: cancelamentoAdminBadgeLabel(enriched),
    }
  })
  return collapseRecorrenciaSeriesCards(list)
}

async function fetchStrapiAdminMovimentosCancelamentoRaw() {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createAdminPedidoMovimentosParams('cancelamento'),
    createAdminPedidoMovimentosParams('Cancelamento'),
    createEstadoMovimentosParams('cancelamento', true),
    createEstadoMovimentosParams('Cancelamento', true),
    createEstadoMovimentosParams('cancelamento', false),
    createEstadoMovimentosParams('Cancelamento', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      return enrichMovimentosPedidoGroups(
        rows
          .map((row) => coerceMovimentoRow(row))
          .filter((item) => item && item.estadoKey === MOVIMENTO_ESTADO_CANCELAMENTO),
      )
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

function createOperadorAgendaParams(operadorId, dataIso, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', MOVIMENTO_ESTADO_AGENDADO)
  params.set('filters[data][$eq]', dataIso)
  params.set('filters[operador][id][$eq]', operadorId)
  params.set('sort[0]', 'ordemOperador:asc')
  params.set('sort[1]', 'data:asc')
  if (withPopulate) params.set('populate', '*')
  params.set('pagination[pageSize]', '100')
  return params
}

/**
 * Agenda de um operador num dia (movimentos agendados, ordenados).
 * @param {string} operadorId
 * @param {string} dataIso YYYY-MM-DD
 */
export async function fetchStrapiOperadorAgenda(operadorId, dataIso) {
  const opId = pickString(operadorId)
  const data = pickString(dataIso)
  if (!opId || !data) return []

  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createOperadorAgendaParams(opId, data, true),
    createOperadorAgendaParams(opId, data, false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      return rows
        .map((row) => coerceMovimentoRow(row))
        .filter((item) => item && item.estadoKey === MOVIMENTO_ESTADO_AGENDADO)
        .sort((a, b) => {
          const orderDiff = (a.ordemOperador ?? 0) - (b.ordemOperador ?? 0)
          if (orderDiff !== 0) return orderDiff
          return a.dateSortValue - b.dateSortValue
        })
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

/**
 * Lista movimentos concluídos do cliente autenticado, ordenados por data (mais recentes primeiro).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosHistorico(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const clienteRefs = await ensureStoredStrapiUserRefs()

  /** @type {URLSearchParams[]} */
  const attempts = []
  const estados = ['concluido', 'Concluido', 'concluído', 'Concluído']

  for (const ref of clienteRefs) {
    for (const refKey of ['id', 'documentId']) {
      for (const estado of ['concluido', 'Concluido']) {
        const params = new URLSearchParams()
        params.set('filters[estado][$eq]', estado)
        params.set(`filters[cliente][${refKey}][$eq]`, ref)
        addMovimentoRelationsPopulate(params)
        addHistoricoSortParams(params)
        attempts.push(params)

        const paramsPlain = new URLSearchParams()
        paramsPlain.set('filters[estado][$eq]', estado)
        paramsPlain.set(`filters[cliente][${refKey}][$eq]`, ref)
        addHistoricoSortParams(paramsPlain)
        attempts.push(paramsPlain)
      }
    }
  }

  for (const estado of estados) {
    attempts.push(createEstadoMovimentosParamsHistorico(estado, true))
  }
  attempts.push(createEstadoMovimentosParamsHistorico('concluido', false))
  attempts.push(createEstadoMovimentosParamsHistorico('Concluido', false))

  let lastError = null
  let lastProcessed = []

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const historico = enrichMovimentosPedidoGroups(
        rows
          .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
          .filter((item) => item && isEstadoConcluido(item.estado))
          .filter((item) =>
            clienteRefs.size > 0
              ? movimentoBelongsToClienteStrict(item, clienteRefs)
              : true,
          ),
      )
      const sorted = sortMovimentosHistoricoDesc(historico)
      if (sorted.length > 0) return sorted
      lastProcessed = sorted
    } catch (err) {
      lastError = err
    }
  }

  if (lastProcessed.length > 0) return lastProcessed
  if (lastError) throw lastError
  return []
}

/**
 * Recolhas pendentes do cliente indexadas por CID do contentor.
 * @returns {Promise<Map<string, ReturnType<typeof coerceMovimentoRow>>>}
 */
async function fetchStrapiClientePendingRecolhasByContentor() {
  const base = strapiBaseUrl()
  /** @type {Map<string, NonNullable<ReturnType<typeof coerceMovimentoRow>>>} */
  const byContentor = new Map()
  if (!base) return byContentor

  await ensureStoredStrapiUserRefs()
  const currentClienteIds = getStoredStrapiUserRefs()
  if (currentClienteIds.size === 0) return byContentor

  const attempts = [
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('Agendado', true),
  ]

  /** @type {Map<string, NonNullable<ReturnType<typeof coerceMovimentoRow>>>} */
  const merged = new Map()

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      for (const row of rows) {
        const item = coerceMovimentoRow(row)
        if (!item?.contentorId || item.contentorId === 'Não definido') continue
        if (item.taskType !== 'recolher') continue
        if (!isEstadoPedidoVisivel(item.estado)) continue
        if (!movimentoBelongsToCliente(item, currentClienteIds)) continue
        merged.set(item.movimentoKey, item)
      }
    } catch {
      /* tenta próximo estado */
    }
  }

  for (const item of merged.values()) {
    const cid = pickString(item.contentorId)
    if (!cid) continue
    const existing = byContentor.get(cid)
    if (!existing || item.dateSortValue < existing.dateSortValue) {
      byContentor.set(cid, item)
    }
  }

  return byContentor
}

/**
 * Lista contentores do cliente a partir da entidade Contentor (`clienteAtual`, `situacao`).
 * Enriquece com recolhas pendentes dos movimentos (estado «Em recolha»).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteContentoresInstalados(fallbackRows = []) {
  try {
    const user = await fetchStrapiCurrentUser()
    const userId = pickString(user?.id ?? user?.documentId)
    if (userId) {
      const items = await fetchStrapiContentoresByClienteAtual(userId)
      if (items.length > 0) {
        const pendingByCid = await fetchStrapiClientePendingRecolhasByContentor()
        return items
          .map((item) =>
            mapContentorItemToInstalledCard(item, null, pendingByCid.get(item.cid) ?? null),
          )
          .sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt'))
      }
    }
  } catch {
    /* fallback movimentos */
  }

  const base = strapiBaseUrl()
  if (!base) return []

  const [contentores, pendingByCid] = await Promise.all([
    fetchStrapiClienteContentores(),
    fetchStrapiClientePendingRecolhasByContentor(),
  ])

  return contentores
    .map((contentor, index) =>
      mapContentorToClienteCard(contentor, fallbackRows[index], pendingByCid.get(contentor.cid) ?? null),
    )
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id, 'pt'))
}

function groupMovimentosByContentor(rows, fallbackRows = []) {
  const grouped = new Map()
  rows
    .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.contentorId ?? item.id
      if (!key) return
      const current = grouped.get(key) ?? []
      current.push(item)
      grouped.set(key, current)
    })
  return grouped
}

async function fetchMovimentosRowsForDisponibilidade(base) {
  const attempts = [
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Agendado', true),
    createAllMovimentosParams(true),
  ]

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      if (rows.length > 0) return rows
    } catch {
      /* tentar próximo */
    }
  }
  return []
}

function collectContentoresCidsIndisponiveisParaEntrega(rows) {
  const grouped = groupMovimentosByContentor(rows)
  const reservados = new Set()

  for (const row of rows) {
    const item = coerceMovimentoRow(row)
    if (!item) continue
    if (item.taskType === 'entregar' && isEstadoPedidoVisivel(item.estado)) {
      const entregaCid = pickString(item.contentorId)
      if (entregaCid) reservados.add(entregaCid)
    }
  }

  const instalados = new Set()
  for (const items of grouped.values()) {
    const card = createContentorCardFromMovimentos(items, {}, getStoredStrapiUserRefs())
    const cid = pickString(card?.contentorId ?? card?.id)
    if (cid) instalados.add(cid)
  }

  return new Set([...reservados, ...instalados])
}

async function fetchStrapiContentoresCidsIndisponiveisParaEntrega() {
  const base = strapiBaseUrl()
  if (!base) return new Set()

  try {
    const [rows, allContentores] = await Promise.all([
      fetchMovimentosRowsForDisponibilidade(base),
      fetchStrapiContentores(),
    ])
    const cids = rows.length > 0 ? collectContentoresCidsIndisponiveisParaEntrega(rows) : new Set()
    for (const item of allContentores) {
      if (item.situacao === 'cliente' || item.clienteAtualId) {
        cids.add(String(item.cid))
      }
    }
    return cids
  } catch {
    return new Set()
  }
}

function filterContentoresDisponiveisParaEntrega(all, indisponiveisCids) {
  return all.filter(
    (item) =>
      item.estado !== 'danificado' &&
      item.situacao !== 'cliente' &&
      !item.clienteAtualId &&
      !indisponiveisCids.has(String(item.cid)),
  )
}

/**
 * Contentores disponíveis para entrega (troca/entrega simples).
 * Prioriza a mesma capacidade; se não houver, devolve todos os disponíveis.
 * @param {string} [capacidadeId]
 * @returns {Promise<{ contentores: object[], semContentoresMesmaCapacidade: boolean }>}
 */
export async function fetchStrapiContentoresParaEntrega(capacidadeId) {
  const capacidadeRef = pickString(capacidadeId)
  const [all, indisponiveisCids] = await Promise.all([
    fetchStrapiContentores(),
    fetchStrapiContentoresCidsIndisponiveisParaEntrega(),
  ])

  const disponiveis = filterContentoresDisponiveisParaEntrega(all, indisponiveisCids)

  if (!capacidadeRef) {
    return { contentores: disponiveis, semContentoresMesmaCapacidade: false }
  }

  const mesmaCapacidade = disponiveis.filter(
    (item) => String(item.capacidadeId) === String(capacidadeRef),
  )

  if (mesmaCapacidade.length > 0) {
    return { contentores: mesmaCapacidade, semContentoresMesmaCapacidade: false }
  }

  return { contentores: disponiveis, semContentoresMesmaCapacidade: true }
}

/**
 * Cartões de contentores instalados (todos os clientes).
 * @returns {Promise<object[]>}
 */
export async function fetchStrapiContentoresInstaladosCards() {
  try {
    const all = await fetchStrapiContentores()
    return all
      .filter((item) => item.situacao === 'cliente' || item.clienteAtualId)
      .map((item) => mapContentorItemToInstalledCard(item))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt'))
  } catch {
    return []
  }
}

/**
 * Número de contentores instalados por cliente (`clienteAtual` no Strapi).
 * Alinhado com `fetchStrapiClienteContentoresInstaladosPorCliente` (detalhe).
 * @param {Array<import('./strapiClientes.js').ClienteItem>} [clientes]
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchStrapiContentorCountsByClienteId(clientes = []) {
  const allContentores = await fetchStrapiContentores()
  const counts = new Map()

  for (const cliente of clientes) {
    const clientRef = pickString(cliente?.id)
    if (!clientRef) continue

    const targetIds = new Set(
      [cliente.id, cliente.documentId, ...(cliente.idAliases ?? [])]
        .map((value) => pickString(value))
        .filter(Boolean),
    )

    const uniqueCids = new Set(
      allContentores
        .filter((item) => {
          const id = pickString(item.clienteAtualId)
          const docId = pickString(item.clienteAtualDocumentId)
          return (id && targetIds.has(id)) || (docId && targetIds.has(docId))
        })
        .map((item) => pickString(item.cid))
        .filter(Boolean),
    )

    for (const alias of cliente.idAliases ?? []) {
      const aliasRef = pickString(alias)
      if (aliasRef && aliasRef !== clientRef) {
        counts.set(aliasRef, uniqueCids.size)
      }
    }
    counts.set(String(cliente.id), uniqueCids.size)
    if (cliente.documentId) counts.set(String(cliente.documentId), uniqueCids.size)
  }

  return counts
}

/**
 * Contentores instalados num cliente específico (admin).
 * @param {import('./strapiClientes.js').ClienteItem} cliente
 * @returns {Promise<object[]>}
 */
export async function fetchStrapiClienteContentoresInstaladosPorCliente(cliente) {
  if (!cliente) return []

  const refs = [
    ...new Set(
      [cliente.id, cliente.documentId, ...(cliente.idAliases ?? [])]
        .map((value) => pickString(value))
        .filter(Boolean),
    ),
  ]

  const byCid = new Map()

  for (const ref of refs) {
    try {
      const items = await fetchStrapiContentoresByClienteAtual(ref, refs)
      for (const item of items) {
        byCid.set(item.cid, mapContentorItemToInstalledCard(item, cliente))
      }
    } catch {
      /* tentar próximo alias */
    }
  }

  if (byCid.size > 0) {
    return [...byCid.values()].sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt'))
  }

  const cards = await fetchStrapiContentoresInstaladosCards()
  return cards
    .filter((card) => movimentoCardBelongsToCliente(card, cliente))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt'))
}

function resolveRelationRef(ref) {
  if (ref == null) return undefined
  const s = String(ref).trim()
  if (!s) return undefined
  if (/^\d+$/.test(s)) return Number(s)
  return s
}

function buildContentRelationConnect(ref) {
  const resolved = resolveRelationRef(ref)
  if (resolved == null) return undefined
  return { connect: [resolved] }
}

function buildMovimentoCreatePayload(scalars, localizacaoId, contentorId, withContentor, clienteId = null) {
  const localizacao = buildContentRelationConnect(localizacaoId)
  if (!localizacao) throw new Error('Localização em falta.')

  const cliente = buildContentRelationConnect(clienteId)
  if (!cliente) throw new Error('Cliente em falta.')

  /** @type {Record<string, unknown>} */
  const payload = {
    ...scalars,
    localizacao,
    cliente,
  }

  if (withContentor) {
    const contentor = buildContentRelationConnect(contentorId)
    if (!contentor) throw new Error('Contentor em falta.')
    payload.contentor = contentor
  }

  const clienteRef = pickString(clienteId)
  if (clienteRef) {
    const clienteRel = buildContentRelationConnect(clienteRef)
    if (clienteRel) payload.cliente = clienteRel
  }

  const operadorId = pickString(scalars.operadorId)
  if (operadorId) {
    const operador = buildContentRelationConnect(operadorId)
    if (operador) payload.operador = operador
    delete payload.operadorId
  }

  const recorrenciaId = pickString(scalars.recorrenciaId)
  if (recorrenciaId) {
    const recorrencia = buildContentRelationConnect(recorrenciaId)
    if (recorrencia) payload.recorrencia = recorrencia
    delete payload.recorrenciaId
  }

  return payload
}

async function resolveClienteRefForMovimentoCreate(contentor = null) {
  await ensureStoredStrapiUserRefs()

  const userId = getStoredStrapiUserId()
  if (userId != null) return userId

  const refs = getStoredStrapiUserRefs()
  const firstRef = [...refs][0]
  if (firstRef) return resolveRelationRef(firstRef)

  const fromContentor =
    pickString(contentor?.clienteAtualId) ?? pickString(contentor?.clienteAtualDocumentId)
  if (fromContentor) return resolveRelationRef(fromContentor)

  throw new Error('Cliente em falta. Não foi possível associar o pedido.')
}

function appendCapacidadeObservacoes(observacoes, capacidadeLabel) {
  const label = pickString(capacidadeLabel)
  if (!label) return pickString(observacoes) ?? ''
  const line = `Capacidade solicitada: ${label}`
  const base = pickString(observacoes)
  return base ? `${base}\n${line}` : line
}

function toDirectRelationPayload(payload) {
  /** @type {Record<string, unknown>} */
  const next = { ...payload }
  for (const field of ['localizacao', 'contentor', 'cliente', 'operador', 'recorrencia']) {
    const value = next[field]
    if (value && typeof value === 'object' && Array.isArray(value.connect) && value.connect.length > 0) {
      next[field] = value.connect[0]
    }
  }
  const codigosLer = next.codigosLer
  if (codigosLer && typeof codigosLer === 'object') {
    if (Array.isArray(codigosLer.set)) next.codigosLer = codigosLer.set
    else if (Array.isArray(codigosLer.connect)) next.codigosLer = codigosLer.connect
  }
  return next
}

function isTrocarContentorSim(value) {
  return normalizeText(value) === 'sim'
}

function formatStrapiErrorJson(errorJson, fallback) {
  if (!errorJson || typeof errorJson !== 'object') return fallback
  const err = errorJson.error ?? errorJson
  const validationErrors = err?.details?.errors
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return validationErrors
      .map((item) => {
        const path = Array.isArray(item?.path) ? item.path.join('.') : pickString(item?.path)
        const message = pickString(item?.message) ?? 'Valor inválido.'
        return path ? `${path}: ${message}` : message
      })
      .join(' · ')
  }

  const detail =
    err?.message ?? err?.details?.errors?.[0]?.message ?? errorJson?.message
  return detail ? String(detail) : fallback
}

function isInvalidKeyError(errorJson) {
  const msg = String(errorJson?.error?.message ?? '').toLowerCase()
  return msg.includes('invalid key')
}

async function parseStrapiMovimentoError(res, fallback) {
  try {
    const err = await res.json()
    return formatStrapiErrorJson(err, fallback)
  } catch {
    /* ignore */
  }
  return fallback
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false, status: number, errorJson: unknown }>}
 */
async function postStrapiMovimentoRaw(data) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/movimentos`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  let errorJson = null
  if (!res.ok) {
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    return { ok: false, status: res.status, errorJson }
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { ok: true, data: json?.data ?? json }
}

/**
 * Cria um movimento com no máximo 2 tentativas (connect → ids diretos).
 * @param {Record<string, unknown>} data
 */
async function postStrapiMovimentoCreate(data) {
  const primary = await postStrapiMovimentoRaw(data)
  if (primary.ok) return primary.data

  if (isInvalidKeyError(primary.errorJson)) {
    const fallback = await postStrapiMovimentoRaw(toDirectRelationPayload(data))
    if (fallback.ok) return fallback.data
    throw new Error(
      formatStrapiErrorJson(
        fallback.errorJson,
        `Strapi movimentos: HTTP ${fallback.errorJson?.error?.status ?? 400}`,
      ),
    )
  }

  throw new Error(
    formatStrapiErrorJson(
      primary.errorJson,
      `Strapi movimentos: HTTP ${primary.errorJson?.error?.status ?? 400}`,
    ),
  )
}

/**
 * @typedef {object} CreateClienteSolicitacaoRecolhaPayload
 * @property {string} [contentorId] CID do contentor (ex.: CNT-001)
 * @property {string[]} [contentorIds] Vários CIDs (pedido em lote)
 * @property {string} [localizacaoId] ID/documentId da relação Localização (só 1 contentor)
 * @property {string} [localizacao]
 * @property {string} data Data no formato YYYY-MM-DD
 * @property {string} periodo
 * @property {string} [observacoes]
 * @property {string} trocarContentor Sim/Não
 */

/**
 * Regista pedido(s) no Strapi (estado `pedido`) para um ou vários contentores.
 * Por contentor: cria `recolha`; se Trocar Contentor = Sim, cria também `entrega`.
 * @param {CreateClienteSolicitacaoRecolhaPayload} payload
 * @returns {Promise<{ created: number, contentorIds: string[] }>}
 */
export async function createStrapiClienteSolicitacaoRecolha(payload) {
  const fromList = Array.isArray(payload.contentorIds)
    ? payload.contentorIds.map((id) => pickString(id)).filter(Boolean)
    : []
  const single = pickString(payload.contentorId)
  const contentorIds = [...new Set(fromList.length > 0 ? fromList : single ? [single] : [])]
  if (contentorIds.length === 0) throw new Error('Seleciona pelo menos um contentor.')

  const data = pickString(payload.data)
  if (!data) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const observacoes = pickString(payload.observacoes)
  const trocar = isTrocarContentorSim(payload.trocarContentor)

  /** @type {string[]} */
  const created = []
  /** @type {Array<{ contentorId: string, message: string }>} */
  const failures = []

  for (const contentorCid of contentorIds) {
    try {
      const contentor = await fetchStrapiContentorByCid(contentorCid)
      if (!contentor?.id) throw new Error('Contentor não encontrado.')

      const localizacaoId =
        (contentorIds.length === 1 ? pickString(payload.localizacaoId) : null) ??
        pickString(contentor.localizacaoAtualId)

      if (!localizacaoId) {
        throw new Error('Localização do contentor em falta.')
      }

      const clienteRef = await resolveClienteRefForMovimentoCreate(contentor)

      /** @type {Record<string, unknown>} */
      const scalars = {
        estado: MOVIMENTO_ESTADO_PEDIDO,
        data,
        periodo,
        ...(observacoes ? { observacoesCliente: observacoes } : {}),
      }

      await postStrapiMovimentoCreate(
        buildMovimentoCreatePayload(
          { ...scalars, tipoMovimento: MOVIMENTO_TIPO_RECOLHA },
          localizacaoId,
          contentor.id,
          true,
          clienteRef,
        ),
      )

      if (trocar) {
        await postStrapiMovimentoCreate(
          buildMovimentoCreatePayload(
            { ...scalars, tipoMovimento: MOVIMENTO_TIPO_ENTREGA },
            localizacaoId,
            null,
            false,
            clienteRef,
          ),
        )
      }

      created.push(contentorCid)
    } catch (err) {
      failures.push({
        contentorId: contentorCid,
        message: err instanceof Error ? err.message : 'Falha ao criar pedido.',
      })
    }
  }

  if (created.length === 0) {
    throw new Error(failures[0]?.message ?? 'Não foi possível solicitar a recolha.')
  }

  if (failures.length > 0) {
    const detail = failures.map((item) => `${item.contentorId}: ${item.message}`).join(' · ')
    throw new Error(
      `Pedidos criados para ${created.length} de ${contentorIds.length} contentores. Falhas: ${detail}`,
    )
  }

  return { created: created.length, contentorIds: created }
}

export async function fetchStrapiMovimentoByKey(movimentoKey) {
  const key = pickString(movimentoKey)
  if (!key) return null

  const base = strapiBaseUrl()
  if (!base) return null

  const attempts = [
    () => {
      const params = new URLSearchParams()
      addMovimentosDeepPopulateParams(params)
      return params
    },
    () => {
      const params = new URLSearchParams()
      addMovimentoRelationsPopulate(params)
      return params
    },
    () => {
      const params = new URLSearchParams()
      params.set('populate', '*')
      return params
    },
  ]

  for (const buildParams of attempts) {
    const params = buildParams()
    const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}?${params.toString()}`, {
      headers: authHeaders(),
    })
    if (!res.ok) continue

    let json = null
    try {
      json = await res.json()
    } catch {
      continue
    }

    const row = json?.data ?? json
    const item = coerceMovimentoRow(row)
    if (item) return item
  }

  return null
}

/**
 * Detalhe completo de um movimento (operador, fotografias, peso, e-GAR, etc.).
 * @param {string} movimentoKey
 */
export async function fetchStrapiMovimentoDetalhe(movimentoKey) {
  return fetchStrapiMovimentoByKey(movimentoKey)
}

async function syncContentorSituacaoFromConcluidoMovimento(movimentoKey) {
  const item = await fetchStrapiMovimentoByKey(movimentoKey)
  if (!item || !isEstadoConcluido(item.estado)) return

  const contentorId = pickString(item.contentorStrapiId)
  if (!contentorId) return

  const locLabel = item.locationDetail ?? item.location ?? '—'

  if (item.taskType === 'entregar') {
    const clienteId = pickString(item.clienteId)
    if (!clienteId) return
    await updateStrapiContentorSituacao(contentorId, {
      clienteAtualId: clienteId,
      localizacaoAtualId: item.localizacaoId ?? null,
      situacao: CONTENTOR_SITUACAO_CLIENTE,
      localizacaoLabel: locLabel,
    })
    return
  }

  if (item.taskType === 'recolher') {
    await updateStrapiContentorSituacao(contentorId, {
      clienteAtualId: null,
      localizacaoAtualId: null,
      situacao: CONTENTOR_SITUACAO_ARMAZEM,
      localizacaoLabel: 'Armazém',
    })
  }
}

/**
 * @typedef {object} CreateClienteSolicitacaoContentorPayload
 * @property {string} localizacaoId ID/documentId da relação Localização
 * @property {string} [localizacao]
 * @property {string} data Data no formato YYYY-MM-DD
 * @property {string} periodo
 * @property {string} [observacoes]
 * @property {string} capacidadeId ID Strapi da capacidade (referência interna)
 * @property {string} [capacidadeLabel] Ex.: "800 L" — gravado em observacoesCliente
 */

/**
 * Regista pedido de entrega de novo contentor (estado `pedido`, sem contentor associado).
 * @param {CreateClienteSolicitacaoContentorPayload} payload
 */
export async function createStrapiClienteSolicitacaoContentor(payload) {
  const data = pickString(payload.data)
  if (!data) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const capacidadeId = pickString(payload.capacidadeId)
  if (!capacidadeId) throw new Error('Capacidade em falta.')

  const localizacaoId = pickString(payload.localizacaoId)
  if (!localizacaoId) {
    throw new Error('Localização em falta. Não foi possível associar o pedido.')
  }

  const observacoes = appendCapacidadeObservacoes(payload.observacoes, payload.capacidadeLabel)

  const clienteRef = await resolveClienteRefForMovimentoCreate()

  /** @type {Record<string, unknown>} */
  const scalars = {
    estado: MOVIMENTO_ESTADO_PEDIDO,
    data,
    periodo,
    tipoMovimento: MOVIMENTO_TIPO_ENTREGA,
    ...(observacoes ? { observacoesCliente: observacoes } : {}),
  }

  await postStrapiMovimentoCreate(
    buildMovimentoCreatePayload(scalars, localizacaoId, null, false, clienteRef),
  )
}

/**
 * Cria serviço admin (recolha / entrega / troca), one-shot ou série semanal (estilo calendário).
 * Gera ocorrências já em estado `agendado`.
 * @param {object} payload
 * @param {'recolha'|'entrega'|'troca'} payload.tipo
 * @param {string} payload.clienteId
 * @param {string} payload.localizacaoId
 * @param {string} payload.data YYYY-MM-DD (1ª ocorrência)
 * @param {string} payload.periodo
 * @param {string} [payload.operadorId]
 * @param {string} [payload.contentorCid] obrigatório em recolha/troca
 * @param {string} [payload.capacidadeId]
 * @param {string} [payload.capacidadeLabel]
 * @param {string} [payload.observacoes]
 * @param {boolean} [payload.repetirSemanalmente]
 * @param {number} [payload.diaSemana] 0–6; se omitido usa o dia de `data`
 * @param {number} [payload.horizonteSemanas]
 */
export async function createStrapiAdminServico(payload) {
  const tipo = pickString(payload.tipo)
  if (tipo !== 'recolha' && tipo !== 'entrega' && tipo !== 'troca') {
    throw new Error('Tipo de serviço inválido.')
  }

  const clienteId = pickString(payload.clienteId)
  if (!clienteId) throw new Error('Cliente em falta.')

  const localizacaoId = pickString(payload.localizacaoId)
  if (!localizacaoId) throw new Error('Localização em falta.')

  const dataInicial = pickString(payload.data)
  if (!dataInicial) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const operadorId = pickString(payload.operadorId)
  const observacoes = pickString(payload.observacoes)
  const repetir = Boolean(payload.repetirSemanalmente)

  let contentorStrapiId = null
  if (tipo === 'recolha' || tipo === 'troca') {
    const contentorCid = pickString(payload.contentorCid)
    if (!contentorCid) throw new Error('Contentor em falta.')
    const contentor = await fetchStrapiContentorByCid(contentorCid)
    if (!contentor?.id) throw new Error('Contentor não encontrado.')
    contentorStrapiId = contentor.id
  }

  const capacidadeLabel =
    pickString(payload.capacidadeLabel) ??
    (pickString(payload.capacidadeId) ? `Capacidade ID ${pickString(payload.capacidadeId)}` : null)

  const observacoesFinais =
    tipo === 'entrega' || tipo === 'troca'
      ? appendCapacidadeObservacoes(observacoes, capacidadeLabel)
      : observacoes ?? ''

  let dates = [dataInicial]
  let recorrenciaId = null

  if (repetir) {
    const startDate = parseIsoDateParts(dataInicial)
    const diaSemana =
      payload.diaSemana != null && Number.isFinite(Number(payload.diaSemana))
        ? Number(payload.diaSemana)
        : startDate
          ? startDate.getDay()
          : 5
    const dataInicio = alignDateToWeekday(dataInicial, diaSemana)
    dates = generateWeeklyOccurrenceDates(
      dataInicio,
      payload.horizonteSemanas ?? RECORRENCIA_HORIZONTE_SEMANAS,
    )

    const created = await createStrapiRecorrencia({
      tipo,
      clienteId,
      localizacaoId,
      contentorId: contentorStrapiId,
      operadorId,
      diaSemana,
      periodo,
      dataInicio,
      // Sem dataFim: série aberta; o horizonte é prolongado automaticamente.
      capacidadeLabel,
      observacoes: observacoesFinais,
      ativo: true,
    })
    recorrenciaId = created.id
  }

  for (const data of dates) {
    await createMovimentosForServicoOcorrencia({
      tipo,
      data,
      periodo,
      operadorId,
      recorrenciaId,
      observacoesFinais,
      localizacaoId,
      contentorStrapiId,
      clienteId,
    })
  }

  if (contentorStrapiId) {
    try {
      await updateStrapiContentorSituacao(contentorStrapiId, {
        situacao: CONTENTOR_SITUACAO_EM_TRANSITO,
      })
    } catch {
      /* serviço criado; situação pode falhar sem bloquear */
    }
  }

  return {
    ocorrencias: dates.length,
    recorrenciaId,
    repetirSemanalmente: repetir,
  }
}

/**
 * @param {{
 *   tipo: string,
 *   data: string,
 *   periodo: string,
 *   operadorId?: string|null,
 *   recorrenciaId?: string|null,
 *   observacoesFinais?: string|null,
 *   localizacaoId: string,
 *   contentorStrapiId?: string|null,
 *   clienteId: string,
 * }} opts
 */
async function createMovimentosForServicoOcorrencia(opts) {
  const tipo = opts.tipo
  const localizacaoId = opts.localizacaoId
  const contentorStrapiId = opts.contentorStrapiId ?? null
  const clienteId = opts.clienteId
  const observacoesFinais = pickString(opts.observacoesFinais)

  /** @type {Record<string, unknown>} */
  const baseScalars = {
    estado: MOVIMENTO_ESTADO_AGENDADO,
    data: opts.data,
    periodo: opts.periodo,
    ...(opts.operadorId ? { operadorId: opts.operadorId } : {}),
    ...(opts.recorrenciaId ? { recorrenciaId: opts.recorrenciaId } : {}),
    ...(observacoesFinais ? { observacoesCliente: observacoesFinais } : {}),
  }

  if (tipo === 'recolha' || tipo === 'troca') {
    await postStrapiMovimentoCreate(
      buildMovimentoCreatePayload(
        { ...baseScalars, tipoMovimento: MOVIMENTO_TIPO_RECOLHA },
        localizacaoId,
        contentorStrapiId,
        true,
        clienteId,
      ),
    )
  }

  if (tipo === 'entrega' || tipo === 'troca') {
    await postStrapiMovimentoCreate(
      buildMovimentoCreatePayload(
        { ...baseScalars, tipoMovimento: MOVIMENTO_TIPO_ENTREGA },
        localizacaoId,
        null,
        false,
        clienteId,
      ),
    )
  }
}

function parseIsoDateParts(iso) {
  const s = pickString(iso)
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Lista movimentos agendados (admin) — próximos serviços.
 * Prolongá séries ativas e devolve lista (ainda completa; a UI colapsa).
 */
export async function fetchStrapiAdminMovimentosAgendados() {
  await ensureStrapiRecorrenciasHorizon().catch(() => {})
  return fetchStrapiAdminMovimentosAgendadosRaw()
}

/**
 * Lista movimentos concluídos (admin — histórico).
 * @returns {Promise<object[]>}
 */
export async function fetchStrapiAdminMovimentosHistorico() {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createEstadoMovimentosParamsHistorico('concluido', true),
    createEstadoMovimentosParamsHistorico('Concluido', true),
    createEstadoMovimentosParamsHistorico('concluido', false),
    createEstadoMovimentosParamsHistorico('Concluido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      return sortMovimentosHistoricoDesc(
        enrichMovimentosPedidoGroups(
          rows
            .map((row) => coerceMovimentoRow(row))
            .filter((item) => item && isEstadoConcluido(item.estado)),
        ),
      )
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

/**
 * Classifica um movimento para o calendário admin.
 * @param {object} item
 * @returns {'agendado'|'em-transito'|'historico'|null}
 */
export function classifyAdminCalendarioKind(item) {
  if (!item) return null
  if (isEstadoConcluido(item.estado) || item.estadoKey === MOVIMENTO_ESTADO_CONCLUIDO) {
    return 'historico'
  }
  const pedidoLabel = normalizeText(item.estadoPedidoLabel ?? '')
  const contentorEmTransito =
    item.contentorSituacao === 'em-transito' ||
    normalizeText(item.contentorSituacaoLabel ?? '').includes('transito')
  if (pedidoLabel.includes('transito') || contentorEmTransito) return 'em-transito'
  if (item.estadoKey === MOVIMENTO_ESTADO_AGENDADO || isEstadoAgendado(item.estado)) {
    return 'agendado'
  }
  return null
}

/**
 * Eventos do calendário admin: agendados + em trânsito + histórico.
 * @returns {Promise<Array<object & { calendarioKind: 'agendado'|'em-transito'|'historico' }>>}
 */
export async function fetchStrapiAdminCalendarioRecolhas() {
  const [agendados, historico] = await Promise.all([
    fetchStrapiAdminMovimentosAgendados().catch(() => []),
    fetchStrapiAdminMovimentosHistorico().catch(() => []),
  ])

  /** @type {Map<string, object>} */
  const byKey = new Map()

  for (const item of [...agendados, ...historico]) {
    if (!item) continue
    const kind = classifyAdminCalendarioKind(item)
    if (!kind) continue
    const dataIso = pickString(item.dataIso)
    if (!dataIso) continue
    const key =
      pickString(item.movimentoKey) ??
      `${item.id ?? 'mov'}|${dataIso}|${item.taskType ?? ''}|${kind}`
    if (byKey.has(key)) continue
    byKey.set(key, { ...item, calendarioKind: kind })
  }

  return [...byKey.values()].sort((a, b) => {
    const dateDiff = String(a.dataIso).localeCompare(String(b.dataIso))
    if (dateDiff !== 0) return dateDiff
    return (a.dateSortValue ?? 0) - (b.dateSortValue ?? 0)
  })
}

async function fetchStrapiAdminMovimentosAgendadosRaw() {
  const base = strapiBaseUrl()
  if (!base) return []

  const baseAttempts = [
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Agendado', true),
    createEstadoMovimentosParams('agendado', false),
  ]

  let lastError = null
  for (const baseParams of baseAttempts) {
    for (const withDeepPopulate of [true, false]) {
      try {
        const params = new URLSearchParams(baseParams)
        if (withDeepPopulate) addMovimentosDeepPopulateParams(params)
        params.set('sort', 'data:asc')
        params.set('pagination[pageSize]', '200')
        const rows = await fetchMovimentosRows(base, params)
        return enrichMovimentosPedidoGroups(
          rows
            .map((row) => coerceMovimentoRow(row))
            .filter((item) => item && item.estadoKey === MOVIMENTO_ESTADO_AGENDADO),
        ).sort((a, b) => (a.dateSortValue ?? 0) - (b.dateSortValue ?? 0))
      } catch (err) {
        lastError = err
      }
    }
  }

  if (lastError) throw lastError
  return []
}

let ensureRecorrenciasPromise = null
let ensureRecorrenciasLastAt = 0

/**
 * Garante que cada série ativa tem movimentos até ~26 semanas à frente.
 * Throttle de 5 min para não repetir em cada navegação.
 */
export async function ensureStrapiRecorrenciasHorizon() {
  const now = Date.now()
  if (ensureRecorrenciasPromise) return ensureRecorrenciasPromise
  if (now - ensureRecorrenciasLastAt < 5 * 60 * 1000) return { extended: 0 }

  ensureRecorrenciasPromise = (async () => {
    const recorrencias = await fetchStrapiRecorrenciasAtivas()
    if (recorrencias.length === 0) return { extended: 0 }

    const agendados = await fetchStrapiAdminMovimentosAgendadosRaw()
    const today = todayIsoLocal()
    let extended = 0

    for (const rec of recorrencias) {
      if (!rec?.id || !rec.localizacaoId || !rec.clienteId) continue
      if (!Number.isFinite(rec.diaSemana)) continue

      const seriesDates = agendados
        .filter((item) => pickString(item.recorrenciaId) === rec.id)
        .map((item) => pickString(item.dataIso))
        .filter(Boolean)
        .sort()

      // Séries ativas são abertas: dataFim legado não encerra. Só `ativo: false` para.
      if (rec.dataFim && rec.dataFim < today && !seriesDates.some((d) => d >= today)) continue

      const lastDate = seriesDates.length > 0 ? seriesDates[seriesDates.length - 1] : null
      const horizonEnd = computeRecorrenciaHorizonEndIso(rec.diaSemana, RECORRENCIA_HORIZONTE_SEMANAS)

      if (lastDate && lastDate >= horizonEnd) continue

      const dates = lastDate
        ? generateWeeklyDatesAfter(lastDate, rec.diaSemana, horizonEnd)
        : generateWeeklyOccurrenceDates(
            alignDateToWeekday(rec.dataInicio || today, rec.diaSemana),
            RECORRENCIA_HORIZONTE_SEMANAS,
          ).filter((d) => d <= horizonEnd)

      if (dates.length === 0) continue

      const periodo = normalizePeriodoForStrapi(rec.periodo) ?? 'indiferente'
      for (const data of dates) {
        await createMovimentosForServicoOcorrencia({
          tipo: rec.tipo,
          data,
          periodo,
          operadorId: rec.operadorId,
          recorrenciaId: rec.id,
          observacoesFinais: rec.observacoes,
          localizacaoId: rec.localizacaoId,
          contentorStrapiId: rec.contentorId,
          clienteId: rec.clienteId,
        })
        extended += 1
      }
    }

    return { extended }
  })()
    .catch((err) => {
      throw err
    })
    .finally(() => {
      ensureRecorrenciasLastAt = Date.now()
      ensureRecorrenciasPromise = null
    })

  return ensureRecorrenciasPromise
}

/**
 * Resolve chaves de movimento para ação em série (só esta vs esta e futuras).
 * @param {string} movimentoKey
 * @param {{ mode?: 'single'|'future', recorrenciaId?: string|null, dataIso?: string|null }} [options]
 * @returns {Promise<{ keys: string[], recorrenciaId: string|null, dataIso: string|null, mode: 'single'|'future' }>}
 */
async function resolveSerieMovimentoKeys(movimentoKey, options = {}) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const mode = options.mode === 'future' ? 'future' : 'single'
  const movimento = await fetchStrapiMovimentoByKey(key)
  const recorrenciaId = pickString(options.recorrenciaId) ?? pickString(movimento?.recorrenciaId)
  const dataIso = pickString(options.dataIso) ?? pickString(movimento?.dataIso)

  if (mode === 'single' || !recorrenciaId) {
    if (!movimento) return { keys: [key], recorrenciaId, dataIso, mode: 'single' }
    const pairKeys = await findTrocaSiblingKeys(movimento)
    return {
      keys: [...new Set([key, ...pairKeys])],
      recorrenciaId,
      dataIso,
      mode: 'single',
    }
  }

  const all = await fetchStrapiAdminMovimentosAgendadosRaw()
  const toTouch = all.filter((item) => {
    if (pickString(item.recorrenciaId) !== recorrenciaId) return false
    if (!dataIso) return true
    const itemDate = pickString(item.dataIso)
    if (!itemDate) return false
    return itemDate >= dataIso
  })

  const keys = [
    ...new Set(
      toTouch
        .map((item) => pickString(item.movimentoKey))
        .filter(Boolean),
    ),
  ]
  if (keys.length === 0) {
    return { keys: [key], recorrenciaId, dataIso, mode: 'future' }
  }
  return { keys, recorrenciaId, dataIso, mode: 'future' }
}

/**
 * Apaga um movimento (e o par troca do mesmo dia/cliente/local se existir).
 * @param {string} movimentoKey
 * @param {{ mode?: 'single'|'future', recorrenciaId?: string|null, dataIso?: string|null }} [options]
 */
export async function deleteStrapiAdminMovimentoComSerie(movimentoKey, options = {}) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const resolved = await resolveSerieMovimentoKeys(key, options)
  if (resolved.keys.length === 0) {
    await deleteStrapiMovimento(key)
    return { deleted: 1 }
  }

  await deleteStrapiMovimentosBatch(resolved.keys)
  if (resolved.mode === 'future' && resolved.recorrenciaId) {
    let dataFim = null
    if (resolved.dataIso) {
      const d = parseIsoDateParts(resolved.dataIso)
      if (d) {
        d.setDate(d.getDate() - 1)
        dataFim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
    }
    await deactivateStrapiRecorrencia(resolved.recorrenciaId, dataFim)
  }
  return { deleted: resolved.keys.length }
}

/**
 * Cliente pede cancelamento: marca movimentos como `cancelamento` (sem DELETE).
 * @param {object} card
 * @param {{ mode?: 'single'|'future' }} [options]
 */
export async function requestStrapiClienteCancelamento(card, options = {}) {
  if (!card) throw new Error('Pedido em falta.')
  const mode = options.mode === 'future' ? 'future' : 'single'
  const primaryKey =
    pickString(card.movimentoKey) ?? getPedidoGroupMovimentoKeys(card)[0] ?? null
  if (!primaryKey) throw new Error('Movimento em falta.')

  const groupKeys = getPedidoGroupMovimentoKeys(card)
  let keys = []

  if (mode === 'future' && pickString(card.recorrenciaId)) {
    const resolved = await resolveSerieMovimentoKeys(primaryKey, {
      mode: 'future',
      recorrenciaId: card.recorrenciaId,
      dataIso: card.dataIso,
    })
    keys = [...new Set([...resolved.keys, ...groupKeys, primaryKey])]
  } else if (groupKeys.length > 0) {
    keys = groupKeys
  } else {
    const resolved = await resolveSerieMovimentoKeys(primaryKey, {
      mode: 'single',
      recorrenciaId: card.recorrenciaId,
      dataIso: card.dataIso,
    })
    keys = resolved.keys
  }

  await updateStrapiMovimentosBatch(keys, { estado: MOVIMENTO_ESTADO_CANCELAMENTO })
  return { updated: keys.length, movimentoKeys: keys }
}

/**
 * Chaves de cancelamento a tratar no admin (grupo + série a partir da data).
 * @param {object} card
 */
async function resolveCancelamentoKeysForAdminAction(card) {
  const groupKeys = getPedidoGroupMovimentoKeys(card)
  const primaryKey = pickString(card?.movimentoKey) ?? groupKeys[0] ?? null
  const recorrenciaId = pickString(card?.recorrenciaId)
  const dataIso = pickString(card?.dataIso)

  if (!recorrenciaId) {
    if (groupKeys.length > 0) return { keys: groupKeys, recorrenciaId: null, dataIso, multiDate: false }
    if (primaryKey) return { keys: [primaryKey], recorrenciaId: null, dataIso, multiDate: false }
    throw new Error('Movimento em falta.')
  }

  const allCancel = await fetchStrapiAdminMovimentosCancelamentoRaw()
  const fromSerie = allCancel.filter((item) => {
    if (pickString(item.recorrenciaId) !== recorrenciaId) return false
    if (!dataIso) return true
    const itemDate = pickString(item.dataIso)
    if (!itemDate) return false
    return itemDate >= dataIso
  })
  const keys = [
    ...new Set(
      [
        ...fromSerie.map((item) => pickString(item.movimentoKey)),
        ...groupKeys,
        primaryKey,
      ].filter(Boolean),
    ),
  ]
  const dates = new Set(
    fromSerie.map((item) => pickString(item.dataIso)).filter(Boolean),
  )
  return {
    keys,
    recorrenciaId,
    dataIso,
    multiDate: dates.size > 1,
  }
}

/**
 * Admin aprova cancelamento: apaga os movimentos (e encerra série se não restarem ocorrências).
 * @param {object} card
 */
export async function approveStrapiAdminCancelamento(card) {
  const resolved = await resolveCancelamentoKeysForAdminAction(card)
  if (resolved.keys.length === 0) throw new Error('Movimento em falta.')

  await deleteStrapiMovimentosBatch(resolved.keys)

  if (resolved.recorrenciaId && resolved.dataIso) {
    const restantes = (await fetchStrapiAdminMovimentosAgendadosRaw()).filter((item) => {
      if (pickString(item.recorrenciaId) !== resolved.recorrenciaId) return false
      const itemDate = pickString(item.dataIso)
      if (!itemDate) return false
      return itemDate >= resolved.dataIso
    })
    if (restantes.length === 0) {
      let dataFim = null
      const d = parseIsoDateParts(resolved.dataIso)
      if (d) {
        d.setDate(d.getDate() - 1)
        dataFim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      await deactivateStrapiRecorrencia(resolved.recorrenciaId, dataFim)
    }
  }

  return { deleted: resolved.keys.length }
}

/**
 * Admin recusa cancelamento: restaura `agendado` (se tinha operador) ou `pedido`.
 * @param {object} card
 */
export async function rejectStrapiAdminCancelamento(card) {
  const resolved = await resolveCancelamentoKeysForAdminAction(card)
  if (resolved.keys.length === 0) throw new Error('Movimento em falta.')

  await Promise.all(
    resolved.keys.map(async (key) => {
      const movimento = await fetchStrapiMovimentoByKey(key)
      const estado =
        pickString(movimento?.operadorId) || pickString(movimento?.operadorDocumentId)
          ? MOVIMENTO_ESTADO_AGENDADO
          : MOVIMENTO_ESTADO_PEDIDO
      await updateStrapiMovimento(key, { estado })
    }),
  )

  return { restored: resolved.keys.length }
}

async function findTrocaSiblingKeys(movimento) {
  if (!movimento) return []
  const clienteId = pickString(movimento.clienteId) ?? pickString(movimento.clienteDocumentId)
  const localizacaoId = pickString(movimento.localizacaoId)
  const dataIso = pickString(movimento.dataIso)
  const periodo = normalizePeriodoForStrapi(movimento.periodo)
  const otherType = movimento.taskType === 'recolher' ? 'entregar' : 'recolher'
  if (!clienteId || !localizacaoId || !dataIso) return []

  const all = await fetchStrapiAdminMovimentosAgendadosRaw()
  return all
    .filter((item) => {
      if (pickString(item.movimentoKey) === pickString(movimento.movimentoKey)) return false
      if (item.taskType !== otherType) return false
      if (pickString(item.dataIso) !== dataIso) return false
      if (normalizePeriodoForStrapi(item.periodo) !== periodo) return false
      const itemCliente = pickString(item.clienteId) ?? pickString(item.clienteDocumentId)
      if (itemCliente !== clienteId) return false
      return pickString(item.localizacaoId) === localizacaoId
    })
    .map((item) => pickString(item.movimentoKey))
    .filter(Boolean)
}

/**
 * Chaves de movimento de um cartão do operador (inclui par troca se existir no card).
 * @param {object} card
 * @returns {string[]}
 */
export function getOperadorServicoMovimentoKeys(card) {
  if (!card) return []
  const fromGroup = Array.isArray(card.pedidoGroupMovimentoKeys)
    ? card.pedidoGroupMovimentoKeys.map((key) => pickString(key)).filter(Boolean)
    : []
  if (fromGroup.length > 0) return [...new Set(fromGroup)]

  const fromLines = Array.isArray(card.taskLines)
    ? card.taskLines.map((line) => pickString(line?.movimentoKey)).filter(Boolean)
    : []
  if (fromLines.length > 0) return [...new Set(fromLines)]

  const single = pickString(card.movimentoKey)
  return single ? [single] : []
}

/**
 * Altera data/período (e opcionalmente notas) de um serviço do operador.
 * Se for troca (recolha+entrega associadas), atualiza os dois movimentos.
 * @param {object} card Cartão do dashboard ou objeto com movimentoKey
 * @param {{ data: string, periodo?: string, notas?: string }} payload
 */
export async function rescheduleStrapiOperadorServico(card, payload) {
  const data = pickString(payload?.data)
  if (!data) throw new Error('Data em falta.')

  let keys = getOperadorServicoMovimentoKeys(card)
  if (keys.length === 0) throw new Error('Movimento em falta.')

  if (keys.length === 1) {
    const movimento = await fetchStrapiMovimentoByKey(keys[0])
    if (movimento) {
      const siblings = await findTrocaSiblingKeys(movimento)
      keys = [...new Set([...keys, ...siblings])]
    }
  }

  /** @type {{ data: string, periodo?: string, notas?: string }} */
  const update = { data }
  const periodo = normalizePeriodoForStrapi(payload?.periodo)
  if (periodo) update.periodo = periodo
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, 'notas')) {
    update.notas = pickString(payload.notas) ?? ''
  }

  await updateStrapiMovimentosBatch(keys, update)
  return { updated: keys.length, movimentoKeys: keys }
}

/**
 * @param {string} movimentoKey documentId ou id do movimento
 * @param {{ data?: string, periodo?: string, estado?: string, operadorId?: string, ordemOperador?: number, contentorId?: string, notas?: string }} payload
 */
export async function updateStrapiMovimento(movimentoKey, payload) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  /** @type {Record<string, unknown>} */
  const data = {}
  const nextData = pickString(payload.data)
  const nextPeriodo = normalizePeriodoForStrapi(payload.periodo)
  const nextEstado = pickString(payload.estado)
  const operadorId = pickString(payload.operadorId)
  const ordemOperador = payload.ordemOperador
  const contentorId = pickString(payload.contentorId)

  if (nextData) data.data = nextData
  if (nextPeriodo) data.periodo = nextPeriodo
  if (nextEstado) data.estado = nextEstado
  if (Object.prototype.hasOwnProperty.call(payload, 'notas')) {
    data.notas = pickString(payload.notas) ?? ''
  }
  if (operadorId) {
    const relation = buildContentRelationConnect(operadorId)
    if (relation) data.operador = relation
  }
  if (contentorId) {
    const relation = buildContentRelationConnect(contentorId)
    if (relation) data.contentor = relation
  }
  if (ordemOperador != null && Number.isFinite(Number(ordemOperador))) {
    data.ordemOperador = Number(ordemOperador)
  }

  if (Object.keys(data).length === 0) {
    throw new Error('Nada para atualizar.')
  }

  const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let errorJson = null
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    throw new Error(formatStrapiErrorJson(errorJson, `Strapi movimentos: HTTP ${res.status}`))
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (nextEstado && isEstadoConcluido(nextEstado)) {
    try {
      await syncContentorSituacaoFromConcluidoMovimento(key)
    } catch {
      /* não bloquear conclusão do movimento */
    }
  }

  return json?.data ?? json
}

/**
 * @param {string[]} movimentoKeys
 * @param {{ data?: string, periodo?: string, estado?: string, operadorId?: string, ordemOperador?: number }} payload
 */
export async function updateStrapiMovimentosBatch(movimentoKeys, payload) {
  const keys = [...new Set((movimentoKeys ?? []).map((key) => pickString(key)).filter(Boolean))]
  if (keys.length === 0) throw new Error('Movimento em falta.')
  await Promise.all(keys.map((key) => updateStrapiMovimento(key, payload)))
}

function pickMediaRef(media) {
  if (media == null) return null
  if (typeof media === 'number') return media
  if (typeof media === 'string' && /^\d+$/.test(media)) return Number(media)
  if (typeof media !== 'object') return null

  const candidates = [media.id, media.documentId, media.data?.id, media.data?.documentId]
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') {
      return /^\d+$/.test(String(c)) ? Number(c) : String(c)
    }
  }
  return null
}

/** @param {File} file */
async function uploadStrapiMovimentoFile(file) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const form = new FormData()
  form.append('files', file, file.name)

  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })

  if (!res.ok) {
    const message = await parseStrapiMovimentoError(res, 'Não foi possível enviar a fotografia.')
    throw new Error(message)
  }

  const json = await res.json()
  const uploaded = Array.isArray(json) ? json[0] : json
  const ref = pickMediaRef(uploaded) ?? pickMediaRef(uploaded?.data)
  if (ref == null) throw new Error('Upload concluído mas sem referência de ficheiro.')
  return ref
}

/** @param {File[]} [files] */
async function uploadStrapiMovimentoFiles(files = []) {
  const refs = []
  for (const file of files) {
    if (!file) continue
    refs.push(await uploadStrapiMovimentoFile(file))
  }
  return refs
}

/**
 * @param {string} movimentoKey
 * @param {Record<string, unknown>} data
 */
async function putStrapiMovimentoRaw(movimentoKey, data) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let errorJson = null
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    return { ok: false, status: res.status, errorJson }
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { ok: true, data: json?.data ?? json }
}

/**
 * @param {string} movimentoKey
 * @param {Record<string, unknown>} data
 */
async function putStrapiMovimentoUpdate(movimentoKey, data) {
  const primary = await putStrapiMovimentoRaw(movimentoKey, data)
  if (primary.ok) return primary.data

  if (isInvalidKeyError(primary.errorJson)) {
    const fallback = await putStrapiMovimentoRaw(movimentoKey, toDirectRelationPayload(data))
    if (fallback.ok) return fallback.data
    throw new Error(
      formatStrapiErrorJson(
        fallback.errorJson,
        `Strapi movimentos: HTTP ${fallback.errorJson?.error?.status ?? 400}`,
      ),
    )
  }

  throw new Error(
    formatStrapiErrorJson(
      primary.errorJson,
      `Strapi movimentos: HTTP ${primary.errorJson?.error?.status ?? 400}`,
    ),
  )
}

/** @param {Array<string|number>} refs */
function buildFotografiasWriteVariants(refs) {
  const unique = [...new Set(refs.filter((ref) => ref != null))]
  if (unique.length === 0) return []

  return [
    { fotografias: unique },
    { fotografias: { connect: unique.map((id) => ({ id })) } },
    { fotografias: { set: unique } },
  ]
}

/**
 * @param {object} [card]
 * @returns {string}
 */
export function resolveOperadorEntregaMovimentoKeyFromCard(card) {
  const lines = Array.isArray(card?.taskLines) ? card.taskLines : []
  const entregaLine = lines.find((line) => line.type === 'entregar')
  const fromLine = pickString(entregaLine?.movimentoKey)
  if (fromLine) return fromLine
  if (card?.taskType === 'entregar') return pickString(card?.movimentoKey) ?? ''
  return ''
}

/**
 * @param {object} [card]
 * @returns {string}
 */
export function resolveOperadorEntregaContentorIdFromCard(card) {
  const lines = Array.isArray(card?.taskLines) ? card.taskLines : []
  const entregaLine = lines.find((line) => line.type === 'entregar')
  const fromLine = pickString(entregaLine?.collectionId)
  if (fromLine && fromLine !== 'Não definido') return fromLine

  if (card?.taskType === 'entregar') {
    const fromCard = pickString(card?.contentorId) ?? pickString(card?.collectionId)
    if (fromCard && fromCard !== 'Não definido') return fromCard
  }

  return ''
}

/**
 * @param {object} [card]
 * @returns {string}
 */
export function resolveOperadorRecolhaMovimentoKeyFromCard(card) {
  const lines = Array.isArray(card?.taskLines) ? card.taskLines : []
  const recolhaLine = lines.find((line) => line.type === 'recolher')
  const fromLine = pickString(recolhaLine?.movimentoKey)
  if (fromLine) return fromLine
  if (card?.taskType === 'recolher') return pickString(card?.movimentoKey) ?? ''
  return ''
}

export function resolveOperadorRecolhaContentorIdFromCard(card) {
  const lines = Array.isArray(card?.taskLines) ? card.taskLines : []
  const recolhaLine = lines.find((line) => line.type === 'recolher')
  const fromLine = pickString(recolhaLine?.collectionId)
  if (fromLine && fromLine !== 'Não definido') return fromLine

  if (card?.taskType === 'recolher' || card?.taskType === 'trocar') {
    const fromCard = pickString(card?.contentorId) ?? pickString(card?.collectionId)
    if (fromCard && fromCard !== 'Não definido') return fromCard
  }

  return ''
}

function pickMovimentoClienteRef(movimento, contentor = null) {
  return (
    pickString(movimento?.clienteDocumentId) ??
    pickString(movimento?.clienteId) ??
    pickString(contentor?.clienteAtualDocumentId) ??
    pickString(contentor?.clienteAtualId) ??
    null
  )
}

/**
 * @param {{ movimentoKey?: string, contentorId?: string }} params
 */
export async function resolveStrapiOperadorRecolhaMovimentoKey({ movimentoKey, contentorId }) {
  const explicit = pickString(movimentoKey)
  if (explicit) return explicit

  const cid = pickString(contentorId)
  if (!cid) throw new Error('Movimento de recolha em falta.')

  const rows = await fetchStrapiOperadorMovimentosAgendados()
  const recolhas = rows.filter(
    (row) => row.taskType === 'recolher' && isEstadoAgendado(row.estado),
  )

  const withCid = recolhas.filter((row) => pickString(row.contentorId) === cid)
  if (withCid.length === 1) return withCid[0].movimentoKey ?? ''
  if (withCid.length > 1) {
    throw new Error('Existem várias recolhas agendadas para este contentor. Abra o serviço no dashboard.')
  }

  throw new Error('Não foi encontrado um movimento de recolha agendado para este contentor.')
}

/**
 * @param {{ movimentoKey?: string, contentorId?: string }} params
 */
export async function resolveStrapiOperadorEntregaMovimentoKey({ movimentoKey, contentorId }) {
  const explicit = pickString(movimentoKey)
  if (explicit) return explicit

  const cid = pickString(contentorId)
  if (!cid) throw new Error('Movimento de entrega em falta.')

  const rows = await fetchStrapiOperadorMovimentosAgendados()
  const entregas = rows.filter(
    (row) => row.taskType === 'entregar' && isEstadoAgendado(row.estado),
  )

  const withCid = entregas.filter((row) => pickString(row.contentorId) === cid)
  if (withCid.length === 1) return withCid[0].movimentoKey ?? ''
  if (withCid.length > 1) {
    throw new Error('Existem várias entregas agendadas para este contentor. Abra o serviço no dashboard.')
  }

  const withoutCid = entregas.filter(
    (row) => !pickString(row.contentorId) || row.contentorId === 'Não definido',
  )
  if (withoutCid.length === 1) return withoutCid[0].movimentoKey ?? ''
  if (withoutCid.length > 1) {
    throw new Error('Existem várias entregas agendadas. Abra o serviço no dashboard.')
  }

  throw new Error('Não foi encontrado um movimento de entrega agendado para este contentor.')
}

/**
 * Conclui entrega do operador: observação, fotografias e estado `concluido`.
 * @param {{ movimentoKey?: string, contentorId: string, observacoes?: string, fotografias?: File[] }} payload
 */
export async function completeStrapiOperadorEntrega(payload) {
  const contentorId = pickString(payload.contentorId)
  if (!contentorId) throw new Error('ID do contentor em falta.')

  const movimentoKey = await resolveStrapiOperadorEntregaMovimentoKey({
    movimentoKey: payload.movimentoKey,
    contentorId,
  })
  if (!movimentoKey) throw new Error('Movimento de entrega em falta.')

  const movimento = await fetchStrapiMovimentoByKey(movimentoKey)
  const contentor = await fetchStrapiContentorByCid(contentorId)
  if (!contentor) throw new Error('Contentor não encontrado.')

  const clienteAtualId = pickMovimentoClienteRef(movimento, contentor)
  const localizacaoAtualId = pickString(movimento?.localizacaoId)
  if (!localizacaoAtualId) throw new Error('Localização do movimento em falta.')
  if (!clienteAtualId) throw new Error('Cliente do movimento em falta.')

  const fotoRefs = await uploadStrapiMovimentoFiles(payload.fotografias ?? [])
  const observacao = pickString(payload.observacoes) ?? ''

  /** @type {Record<string, unknown>} */
  const base = {
    estado: MOVIMENTO_ESTADO_CONCLUIDO,
    observacaoOperador: observacao,
    contentor: buildContentRelationConnect(contentor.id),
  }

  const fotoVariants = buildFotografiasWriteVariants(fotoRefs)
  const attempts = fotoVariants.length > 0 ? fotoVariants.map((fotos) => ({ ...base, ...fotos })) : [base]

  let lastError = null
  for (const data of attempts) {
    try {
      const updated = await putStrapiMovimentoUpdate(movimentoKey, data)
      await applyStrapiContentorAfterEntrega(contentor.id, {
        localizacaoAtualId,
        clienteAtualId,
        localizacao: movimento?.locationDetail ?? movimento?.location ?? undefined,
      })
      return updated
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Não foi possível concluir a entrega.')
    }
  }

  throw lastError ?? new Error('Não foi possível concluir a entrega.')
}

/**
 * Conclui uma ou mais recolhas do operador com os mesmos dados de formulário.
 * @param {{
 *   movimentoKey?: string,
 *   contentorId: string,
 *   observacoes?: string,
 *   estado?: string,
 *   estadoFisicoId?: string,
 *   estadoResiduoId?: string,
 *   estadoPedidoId?: string,
 *   peso?: string,
 *   numeroEgar?: string,
 *   codigoLerIds?: string[],
 *   codigoLerLabels?: string[],
 *   fotografias?: File[],
 *   extraItems?: Array<{ movimentoKey?: string, contentorId: string }>
 * }} payload
 */
export async function completeStrapiOperadorRecolha(payload) {
  const primaryContentorId = pickString(payload.contentorId)
  if (!primaryContentorId) throw new Error('ID do contentor em falta.')

  const primaryMovimentoKey = await resolveStrapiOperadorRecolhaMovimentoKey({
    movimentoKey: payload.movimentoKey,
    contentorId: primaryContentorId,
  })
  if (!primaryMovimentoKey) throw new Error('Movimento de recolha em falta.')

  const pesoRaw = pickString(payload.peso)
  const pesoNum = pesoRaw != null ? Number(pesoRaw) : NaN
  const pesoLabel = Number.isFinite(pesoNum) ? `${pesoNum}%` : pesoRaw
  const codigosLerRel = buildCodigosLerRelationWrite(payload.codigoLerIds ?? [])
  const codigoLerText = (payload.codigoLerLabels ?? [])
    .map((value) => pickString(value))
    .filter(Boolean)
    .join(', ')

  const observacaoParts = [
    pickString(payload.observacoes),
    pesoLabel ? `Peso: ${pesoLabel}` : null,
    pickString(payload.numeroEgar) ? `EGAR: ${pickString(payload.numeroEgar)}` : null,
    codigoLerText ? `Códigos LER: ${codigoLerText}` : null,
  ].filter(Boolean)
  const observacaoOperador = observacaoParts.join('\n')
  const egar = pickString(payload.numeroEgar)
  const estadoPedidoRel = buildEstadoAuxRelationWrite(payload.estadoPedidoId)

  const fotoRefs = await uploadStrapiMovimentoFiles(payload.fotografias ?? [])

  /** @type {Array<{ movimentoKey: string, contentorId: string }>} */
  const queue = [{ movimentoKey: primaryMovimentoKey, contentorId: primaryContentorId }]
  for (const extra of payload.extraItems ?? []) {
    const contentorId = pickString(extra?.contentorId)
    if (!contentorId) continue
    let movimentoKey = pickString(extra?.movimentoKey)
    if (!movimentoKey) {
      movimentoKey = await resolveStrapiOperadorRecolhaMovimentoKey({ contentorId })
    }
    if (!movimentoKey) continue
    if (queue.some((item) => item.movimentoKey === movimentoKey || item.contentorId === contentorId)) {
      continue
    }
    queue.push({ movimentoKey, contentorId })
  }

  const results = []
  const failures = []

  const estadosResiduo = await fetchStrapiEstadosResiduo()
  const residuoContaminado = isEstadoResiduoContaminado(payload.estadoResiduoId, estadosResiduo)

  for (const item of queue) {
    try {
      const contentor = await fetchStrapiContentorByCid(item.contentorId)
      if (!contentor) throw new Error(`Contentor ${item.contentorId} não encontrado.`)

      const movimento = await fetchStrapiMovimentoByKey(item.movimentoKey)
      const clienteId = pickMovimentoClienteRef(movimento, contentor)
      const localizacaoId = pickString(movimento?.localizacaoId)

      /** @type {Record<string, unknown>} */
      const base = {
        estado: MOVIMENTO_ESTADO_CONCLUIDO,
        observacaoOperador,
        contentor: buildContentRelationConnect(contentor.id),
      }
      if (Number.isFinite(pesoNum)) base.peso = pesoNum
      if (egar) base.egar = egar
      if (codigosLerRel) base.codigosLer = codigosLerRel
      if (estadoPedidoRel) base.estadoPedido = estadoPedidoRel

      const fotoVariants = buildFotografiasWriteVariants(fotoRefs)
      const attempts = fotoVariants.length > 0 ? fotoVariants.map((fotos) => ({ ...base, ...fotos })) : [base]

      let updated = null
      let lastError = null
      for (const data of attempts) {
        try {
          updated = await putStrapiMovimentoUpdate(item.movimentoKey, data)
          break
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Não foi possível concluir a recolha.')
        }
      }
      if (!updated) {
        throw lastError ?? new Error('Não foi possível concluir a recolha.')
      }

      await applyStrapiContentorAfterRecolha(contentor.id, {
        estadoFisicoId: pickString(payload.estadoFisicoId) ?? undefined,
        estadoResiduoId: pickString(payload.estadoResiduoId) ?? undefined,
        localizacao: contentor.localizacao ?? undefined,
      })

      if (residuoContaminado && clienteId) {
        try {
          await createStrapiTicketForCliente({
            assunto: `Contentor contaminado — ${item.contentorId}`,
            mensagem: `[Sistema] Foi detetada contaminação no contentor ${item.contentorId} durante a recolha. A equipa Soiloop irá analisar a situação.`,
            clienteId,
            localizacaoId,
            contentorId: contentor.id,
            prioridade: 'alta',
          })
        } catch {
          /* Recolha concluída; falha ao notificar cliente não bloqueia o fluxo. */
        }
      }

      results.push(updated)
    } catch (err) {
      failures.push({
        contentorId: item.contentorId,
        message: err instanceof Error ? err.message : 'Falha ao concluir a recolha.',
      })
    }
  }

  if (results.length === 0) {
    throw new Error(failures[0]?.message ?? 'Não foi possível concluir a recolha.')
  }

  if (failures.length > 0) {
    const detail = failures.map((item) => `${item.contentorId}: ${item.message}`).join(' · ')
    throw new Error(
      `Concluídas ${results.length} de ${queue.length} recolhas. Falhas: ${detail}`,
    )
  }

  return results.length === 1 ? results[0] : results
}

/**
 * @param {string} movimentoKey documentId ou id do movimento
 */
export async function deleteStrapiMovimento(movimentoKey) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!res.ok) {
    let errorJson = null
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    throw new Error(formatStrapiErrorJson(errorJson, `Strapi movimentos: HTTP ${res.status}`))
  }
}

/**
 * @param {string[]} movimentoKeys
 */
export async function deleteStrapiMovimentosBatch(movimentoKeys) {
  const keys = [...new Set((movimentoKeys ?? []).map((key) => pickString(key)).filter(Boolean))]
  if (keys.length === 0) throw new Error('Movimento em falta.')
  await Promise.all(keys.map((key) => deleteStrapiMovimento(key)))
}

/**
 * Aprova pedido(s) e insere na agenda do operador.
 * @param {object} options
 * @param {string[]} options.movimentoKeys
 * @param {string} options.operadorId
 * @param {string} options.data YYYY-MM-DD
 * @param {string} [options.periodo]
 * @param {number} [options.insertIndex] Posição na agenda (0 = início)
 * @param {string} [options.entregaMovimentoKey] Movimento de entrega (troca)
 * @param {string} [options.entregaContentorId] ID Strapi do contentor a entregar
 * @param {string} [options.entregaClienteId] Cliente destino da entrega
 * @param {string} [options.entregaLocalizacaoId] Localização destino da entrega
 * @param {string} [options.entregaLocalizacaoLabel] Morada legível para o contentor
 */
export async function scheduleStrapiMovimentoPedido({
  movimentoKeys,
  operadorId,
  data,
  periodo,
  insertIndex = 0,
  entregaMovimentoKey,
  entregaContentorId,
  entregaClienteId,
  entregaLocalizacaoId,
  entregaLocalizacaoLabel,
}) {
  const keys = [...new Set((movimentoKeys ?? []).map((key) => pickString(key)).filter(Boolean))]
  const opId = pickString(operadorId)
  const dataIso = pickString(data)
  if (keys.length === 0) throw new Error('Pedido em falta.')
  if (!opId) throw new Error('Seleciona um operador.')
  if (!dataIso) throw new Error('Data em falta.')

  const agenda = await fetchStrapiOperadorAgenda(opId, dataIso)
  const existing = agenda.filter((item) => !keys.includes(item.movimentoKey))
  const insertAt = Math.max(0, Math.min(insertIndex, existing.length))

  const reorderUpdates = []
  for (let i = 0; i < existing.length; i += 1) {
    const item = existing[i]
    const nextOrder = i >= insertAt ? i + 1 : i
    if ((item.ordemOperador ?? 0) !== nextOrder) {
      reorderUpdates.push(
        updateStrapiMovimento(item.movimentoKey, { ordemOperador: nextOrder }),
      )
    }
  }

  const pedidoPayload = {
    estado: MOVIMENTO_ESTADO_AGENDADO,
    data: dataIso,
    operadorId: opId,
    ordemOperador: insertAt,
    ...(periodo ? { periodo: normalizePeriodoForStrapi(periodo) } : {}),
  }

  await Promise.all(reorderUpdates)
  await updateStrapiMovimentosBatch(keys, pedidoPayload)

  // Contentores dos movimentos agendados passam a «Em trânsito».
  await Promise.all(
    keys.map(async (key) => {
      try {
        const movimento = await fetchStrapiMovimentoByKey(key)
        const contentorId = pickString(movimento?.contentorStrapiId)
        if (!contentorId) return
        await updateStrapiContentorSituacao(contentorId, {
          situacao: CONTENTOR_SITUACAO_EM_TRANSITO,
        })
      } catch {
        /* não bloquear agendamento se a situação do contentor falhar */
      }
    }),
  )

  const entregaKey = pickString(entregaMovimentoKey)
  const entregaContentor = pickString(entregaContentorId)
  if (entregaKey && entregaContentor) {
    await updateStrapiMovimento(entregaKey, { contentorId: entregaContentor })

    let clienteId = pickString(entregaClienteId)
    let localizacaoId = pickString(entregaLocalizacaoId)
    let localizacaoLabel = pickString(entregaLocalizacaoLabel)

    if (!clienteId || !localizacaoId) {
      const movimento = await fetchStrapiMovimentoByKey(entregaKey)
      clienteId = clienteId ?? pickPedidoClienteId(movimento)
      localizacaoId = localizacaoId ?? pickString(movimento?.localizacaoId)
      localizacaoLabel =
        localizacaoLabel ?? pickString(movimento?.locationDetail ?? movimento?.location)
    }

    await reserveStrapiContentorParaEntrega(entregaContentor, {
      ...(clienteId ? { clienteAtualId: clienteId } : {}),
      ...(localizacaoId ? { localizacaoAtualId: localizacaoId } : {}),
      ...(localizacaoLabel ? { localizacaoLabel } : {}),
    })
    try {
      await updateStrapiContentorSituacao(entregaContentor, {
        situacao: CONTENTOR_SITUACAO_EM_TRANSITO,
      })
    } catch {
      /* não bloquear agendamento */
    }
  }
}

function buildOperadorCardTaskLines(item) {
  const tasks = item?.pedidoGroupTasks
  if (Array.isArray(tasks) && tasks.length > 0) {
    const sorted = [...tasks].sort((a, b) => {
      if (a.taskType === 'recolher' && b.taskType === 'entregar') return -1
      if (a.taskType === 'entregar' && b.taskType === 'recolher') return 1
      return 0
    })
    return sorted.map((task) => ({
      key: task.movimentoKey ?? `${task.taskType}-${task.collectionId}`,
      movimentoKey: pickString(task.movimentoKey) ?? '',
      type: task.taskType === 'entregar' ? 'entregar' : 'recolher',
      label: task.taskType === 'entregar' ? 'Entrega' : 'Recolha',
      collectionId: task.collectionId ?? item.contentorId ?? item.id,
    }))
  }

  const type = item?.taskType === 'entregar' ? 'entregar' : 'recolher'
  return [
    {
      key: item.movimentoKey ?? `${type}-${item.contentorId ?? item.id}`,
      movimentoKey: pickString(item.movimentoKey) ?? '',
      type,
      label: type === 'entregar' ? 'Entrega' : 'Recolha',
      collectionId: item.contentorId ?? item.id,
    },
  ]
}

/** @param {ReturnType<typeof coerceMovimentoRow>} item */
export function mapMovimentoToOperadorCard(item) {
  const pedidoGroupMovimentoKeys = Array.isArray(item.pedidoGroupMovimentoKeys)
    ? item.pedidoGroupMovimentoKeys.filter(Boolean)
    : item.movimentoKey
      ? [item.movimentoKey]
      : []

  return {
    id: item.movimentoKey ?? item.id,
    collectionId: item.pedidoGroupContentorId ?? item.contentorId ?? item.id,
    clienteLabel: item.clienteLabel ?? item.clientName ?? '',
    clientName: item.clientName ?? item.clienteLabel ?? '',
    clienteId: item.clienteId ?? null,
    clienteDocumentId: item.clienteDocumentId ?? null,
    clienteIdAliases: item.clienteIdAliases ?? [],
    localizacaoId: item.localizacaoId ?? null,
    locationDetail: item.locationDetail ?? item.location ?? '',
    location: item.location ?? item.locationDetail ?? '',
    locationPrefix: item.locationPrefix ?? null,
    status: item.status,
    scheduledAt: item.scheduledAt,
    taskLines: buildOperadorCardTaskLines(item),
    dateSortValue: item.dateSortValue,
    dataIso: item.dataIso ?? '',
    periodo: item.periodo ?? '',
    notas: item.notas ?? '',
    movimentoKey: item.movimentoKey,
    contentorId: item.contentorId,
    qrCode: item.qrCode,
    taskType: item.taskType,
    pedidoDisplayMode: item.pedidoDisplayMode ?? null,
    pedidoGroupMovimentoKeys,
    pedidoGroupTasks: item.pedidoGroupTasks ?? [],
    pedidoGroupContentorId: item.pedidoGroupContentorId ?? item.contentorId ?? item.id,
    hasTroca: Boolean(item.hasTroca) || item.pedidoDisplayMode === 'trocar',
    lat: item.lat ?? null,
    lng: item.lng ?? null,
  }
}

/**
 * Extrai candidatas de recolha (1 por movimento/contentor) a partir dos cartões do dashboard.
 * @param {Array<object>} cards
 * @returns {Array<{ movimentoKey: string, contentorId: string, clienteId: string|null, clienteDocumentId: string|null, clienteIdAliases: string[], localizacaoId: string|null, locationDetail: string, clienteLabel: string }>}
 */
export function collectOperadorRecolhaCandidatesFromCards(cards = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map()

  for (const card of cards) {
    if (!card) continue
    const clienteMeta = {
      clienteId: pickString(card.clienteId),
      clienteDocumentId: pickString(card.clienteDocumentId),
      clienteIdAliases: Array.isArray(card.clienteIdAliases) ? card.clienteIdAliases : [],
      localizacaoId: pickString(card.localizacaoId),
      locationDetail: pickString(card.locationDetail ?? card.location) ?? '',
      clienteLabel: pickString(card.clienteLabel ?? card.clientName) ?? '',
    }

    const lines = Array.isArray(card.taskLines)
      ? card.taskLines.filter((line) => line?.type === 'recolher')
      : []

    if (lines.length > 0) {
      for (const line of lines) {
        const movimentoKey = pickString(line.movimentoKey) ?? pickString(card.movimentoKey)
        const contentorId = pickString(line.collectionId) ?? pickString(card.contentorId)
        if (!movimentoKey || !contentorId || contentorId === 'Não definido') continue
        byKey.set(movimentoKey, { movimentoKey, contentorId, ...clienteMeta })
      }
      continue
    }

    if (card.taskType === 'recolher') {
      const movimentoKey = pickString(card.movimentoKey)
      const contentorId = pickString(card.contentorId) ?? pickString(card.collectionId)
      if (!movimentoKey || !contentorId || contentorId === 'Não definido') continue
      byKey.set(movimentoKey, { movimentoKey, contentorId, ...clienteMeta })
    }
  }

  return [...byKey.values()].sort((a, b) =>
    String(a.contentorId).localeCompare(String(b.contentorId), 'pt'),
  )
}

function clienteRefsFromRecolhaCandidate(item) {
  const refs = new Set()
  for (const value of [item?.clienteId, item?.clienteDocumentId, ...(item?.clienteIdAliases ?? [])]) {
    const ref = pickString(value)
    if (ref) refs.add(ref)
  }
  return refs
}

/**
 * Outras recolhas agendadas da mesma empresa (cliente) que a recolha actual.
 * @param {Array<object>} cards
 * @param {{ movimentoKey?: string, contentorId?: string, clienteId?: string|null, clienteDocumentId?: string|null, clienteIdAliases?: string[] }} current
 */
export function findOperadorRecolhaSiblingsForCliente(cards = [], current = {}) {
  const candidates = collectOperadorRecolhaCandidatesFromCards(cards)
  const currentKey = pickString(current.movimentoKey)
  const currentCid = pickString(current.contentorId)

  let currentCandidate =
    candidates.find((item) => currentKey && item.movimentoKey === currentKey) ??
    candidates.find((item) => currentCid && item.contentorId === currentCid) ??
    null

  if (!currentCandidate && (currentKey || currentCid)) {
    currentCandidate = {
      movimentoKey: currentKey ?? '',
      contentorId: currentCid ?? '',
      clienteId: pickString(current.clienteId),
      clienteDocumentId: pickString(current.clienteDocumentId),
      clienteIdAliases: Array.isArray(current.clienteIdAliases) ? current.clienteIdAliases : [],
    }
  }

  const currentRefs = clienteRefsFromRecolhaCandidate(currentCandidate)
  if (currentRefs.size === 0) return []

  return candidates.filter((item) => {
    if (currentKey && item.movimentoKey === currentKey) return false
    if (currentCid && item.contentorId === currentCid) return false
    const itemRefs = clienteRefsFromRecolhaCandidate(item)
    for (const ref of itemRefs) {
      if (currentRefs.has(ref)) return true
    }
    return false
  })
}

/**
 * Separa movimentos agendados do operador: dia (hoje + atrasados) e próximos dias.
 * @param {Array<ReturnType<typeof coerceMovimentoRow>>} rows
 */
export function splitOperadorDashboardMovimentos(rows) {
  const todayStart = getTodayStartSortValue()
  const todayEnd = getTodayEndSortValue()
  /** @type {Array<ReturnType<typeof mapMovimentoToOperadorCard>>} */
  const dayCollections = []
  /** @type {Array<ReturnType<typeof mapMovimentoToOperadorCard>>} */
  const upcomingCollections = []

  for (const row of rows ?? []) {
    const card = mapMovimentoToOperadorCard(row)
    const dateVal = row.dateSortValue

    if (!Number.isFinite(dateVal)) {
      upcomingCollections.push({ ...card, status: 'agendada', dateSortValue: dateVal })
      continue
    }

    if (dateVal < todayStart) {
      dayCollections.push({ ...card, status: 'atrasado', dateSortValue: dateVal })
    } else if (dateVal <= todayEnd) {
      dayCollections.push({ ...card, status: 'hoje', dateSortValue: dateVal })
    } else {
      const status = getDateStatus(row.dataIso)
      upcomingCollections.push({ ...card, status, dateSortValue: dateVal })
    }
  }

  dayCollections.sort((a, b) => {
    const aOverdue = a.status === 'atrasado' ? 0 : 1
    const bOverdue = b.status === 'atrasado' ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    return (a.dateSortValue ?? 0) - (b.dateSortValue ?? 0)
  })

  upcomingCollections.sort((a, b) => (a.dateSortValue ?? 0) - (b.dateSortValue ?? 0))

  const overdueCount = dayCollections.filter((item) => item.status === 'atrasado').length

  return {
    dayCollections,
    upcomingCollections,
    overdueCount,
    stats: {
      recolhasHoje: dayCollections.filter((item) => item.status === 'hoje').length,
      recolhasAgendadas: dayCollections.length + upcomingCollections.length,
    },
  }
}

function getTodayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function createOperadorDataDiaParams(operadorRef, refKey, dataIso, withPopulate) {
  const params = new URLSearchParams()
  params.set('filters[data][$eq]', dataIso)
  if (operadorRef) {
    params.set(`filters[operador][${refKey}][$eq]`, operadorRef)
  }
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addMovimentosCommonParams(params)
}

function countOperadorServicosHojeFromRows(rows, operadorRefs) {
  const todayStart = getTodayStartSortValue()
  const todayEnd = getTodayEndSortValue()

  return rows
    .map((row) => coerceMovimentoRow(row))
    .filter((item) => item && !isEstadoPedido(item.estado))
    .filter((item) => movimentoBelongsToOperadorStrict(item, operadorRefs))
    .filter((item) => {
      const dateVal = item.dateSortValue
      return Number.isFinite(dateVal) && dateVal >= todayStart && dateVal <= todayEnd
    }).length
}

/**
 * Conta movimentos do operador logado com data de hoje (exclui estado «pedido»).
 * @returns {Promise<number>}
 */
async function fetchStrapiOperadorServicosHojeCount() {
  const base = strapiBaseUrl()
  if (!base) return 0

  const operadorRefs = await ensureStoredStrapiUserRefs()
  if (operadorRefs.size === 0) return 0

  const todayIso = getTodayIsoDate()
  /** @type {URLSearchParams[]} */
  const attempts = []

  for (const ref of operadorRefs) {
    for (const refKey of ['id', 'documentId']) {
      attempts.push(createOperadorDataDiaParams(ref, refKey, todayIso, true))
      attempts.push(createOperadorDataDiaParams(ref, refKey, todayIso, false))
    }
  }

  let bestCount = 0
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const count = countOperadorServicosHojeFromRows(rows, operadorRefs)
      if (count > bestCount) bestCount = count
      if (count > 0) return count
    } catch {
      /* tentar próxima query */
    }
  }

  return bestCount
}

function createOperadorAgendadoParams(operadorRef, refKey, estado, withPopulate) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (operadorRef) {
    params.set(`filters[operador][${refKey}][$eq]`, operadorRef)
  }
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addMovimentosCommonParams(params)
}

function sortOperadorMovimentos(a, b) {
  const ordA = Number.isFinite(a.ordemOperador) ? a.ordemOperador : Number.POSITIVE_INFINITY
  const ordB = Number.isFinite(b.ordemOperador) ? b.ordemOperador : Number.POSITIVE_INFINITY
  if (ordA !== ordB) return ordA - ordB
  return (a.dateSortValue ?? Number.POSITIVE_INFINITY) - (b.dateSortValue ?? Number.POSITIVE_INFINITY)
}

function processOperadorMovimentosRows(rows, fallbackRows, operadorRefs, options = {}) {
  return enrichMovimentosPedidoGroups(
    rows
      .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
      .filter((item) => item && isEstadoAgendado(item.estado))
      .filter((item) =>
        options.strict
          ? movimentoBelongsToOperadorStrict(item, operadorRefs)
          : movimentoBelongsToOperador(item, operadorRefs, options),
      )
      .sort(sortOperadorMovimentos),
  )
}

function buildOperadorAgendadoFetchAttempts(operadorRefs) {
  const refs = [...operadorRefs]
  /** @type {Array<{ params: URLSearchParams, trustApiScope: boolean, strict?: boolean }>} */
  const attempts = []

  // Preferir filtros por operador — evita contar movimentos de outros / sem operador.
  for (const ref of refs) {
    for (const refKey of ['id', 'documentId']) {
      attempts.push({
        params: createOperadorAgendadoParams(ref, refKey, 'agendado', true),
        trustApiScope: false,
        strict: true,
      })
      attempts.push({
        params: createOperadorAgendadoParams(ref, refKey, 'agendado', false),
        trustApiScope: false,
        strict: true,
      })
    }
  }

  attempts.push({
    params: createEstadoMovimentosParams('agendado', true),
    trustApiScope: false,
    strict: true,
  })
  attempts.push({
    params: createEstadoMovimentosParams('agendado', false),
    trustApiScope: false,
    strict: true,
  })

  return attempts
}

/**
 * Movimentos agendados do operador autenticado.
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiOperadorMovimentosAgendados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const operadorRefs = await ensureStoredStrapiUserRefs()
  if (operadorRefs.size === 0) return []

  const attempts = buildOperadorAgendadoFetchAttempts(operadorRefs)
  let hadSuccessfulFetch = false
  let lastProcessed = []

  for (const { params, trustApiScope, strict } of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      hadSuccessfulFetch = true
      const pedidos = processOperadorMovimentosRows(rows, fallbackRows, operadorRefs, {
        trustApiScope,
        strict,
      })
      if (pedidos.length > 0) return pedidos
      lastProcessed = pedidos
      if (rows.length === 0) return pedidos
    } catch {
      // Tentar próxima combinação de query (populate, filtros, etc.)
    }
  }

  if (hadSuccessfulFetch) return lastProcessed
  return []
}

function createOperadorHistoricoParams(operadorRef, refKey, estado, withPopulate) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (operadorRef) {
    params.set(`filters[operador][${refKey}][$eq]`, operadorRef)
  }
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addHistoricoSortParams(params)
}

function processOperadorHistoricoRows(rows, fallbackRows, operadorRefs) {
  return sortMovimentosHistoricoDesc(
    enrichMovimentosPedidoGroups(
      rows
        .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
        .filter((item) => item && isEstadoConcluido(item.estado))
        .filter((item) => movimentoBelongsToOperadorStrict(item, operadorRefs)),
    ),
  )
}

function buildOperadorHistoricoFetchAttempts(operadorRefs) {
  const refs = [...operadorRefs]
  /** @type {URLSearchParams[]} */
  const attempts = []
  const estados = ['concluido', 'Concluido', 'concluído', 'Concluído']

  for (const ref of refs) {
    for (const refKey of ['id', 'documentId']) {
      for (const estado of ['concluido', 'Concluido']) {
        attempts.push(createOperadorHistoricoParams(ref, refKey, estado, true))
        attempts.push(createOperadorHistoricoParams(ref, refKey, estado, false))
      }
    }
  }

  for (const estado of estados) {
    attempts.push(createEstadoMovimentosParamsHistorico(estado, true))
  }
  for (const estado of ['concluido', 'Concluido']) {
    attempts.push(createEstadoMovimentosParamsHistorico(estado, false))
  }

  return attempts
}

/**
 * Histórico do operador: entregas e recolhas concluídas (mais recentes primeiro).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiOperadorMovimentosHistorico(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const operadorRefs = await ensureStoredStrapiUserRefs()
  if (operadorRefs.size === 0) return []

  const attempts = buildOperadorHistoricoFetchAttempts(operadorRefs)
  let hadSuccessfulFetch = false
  let lastProcessed = []

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      hadSuccessfulFetch = true
      const historico = processOperadorHistoricoRows(rows, fallbackRows, operadorRefs)
      if (historico.length > 0) return historico
      lastProcessed = historico
      if (rows.length === 0) return historico
    } catch {
      // Tentar próxima combinação de query
    }
  }

  if (hadSuccessfulFetch) return lastProcessed
  return []
}

/**
 * Dashboard operador: recolhas do dia, próximas recolhas e estatísticas parciais.
 * @param {Array<object>} [fallbackDay]
 * @param {Array<object>} [fallbackUpcoming]
 */
export async function fetchStrapiOperadorDashboardMovimentos(
  fallbackDay = [],
  fallbackUpcoming = [],
) {
  const fallbackRows = [...fallbackDay, ...fallbackUpcoming]
  const fallbackFromMock = collapseMovimentosPedidoCards(
    enrichMovimentosPedidoGroups(
      fallbackRows
        .map((row) => coerceMovimentoRow({}, row))
        .filter(Boolean)
        .sort((a, b) => a.dateSortValue - b.dateSortValue),
    ),
  )

  const base = strapiBaseUrl()
  if (!base) {
    return splitOperadorDashboardMovimentos(fallbackFromMock)
  }

  const [rows, servicosHoje, historico] = await Promise.all([
    fetchStrapiOperadorMovimentosAgendados(fallbackRows),
    fetchStrapiOperadorServicosHojeCount(),
    fetchStrapiOperadorMovimentosHistorico(),
  ])
  const collapsed = collapseMovimentosPedidoCards(rows)
  const result = splitOperadorDashboardMovimentos(collapsed)
  const operadorRefs = await ensureStoredStrapiUserRefs()
  const agendadosCount = rows.filter((item) =>
    movimentoBelongsToOperadorStrict(item, operadorRefs),
  ).length
  const concluidosCount = historico.filter((item) =>
    movimentoBelongsToOperadorStrict(item, operadorRefs),
  ).length

  return {
    ...result,
    stats: {
      ...result.stats,
      recolhasHoje: servicosHoje,
      recolhasAgendadas: agendadosCount,
      contentoresAtivos: concluidosCount,
    },
  }
}
