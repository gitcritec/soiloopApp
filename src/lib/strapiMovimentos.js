import { STRAPI_JWT_STORAGE_KEY, fetchStrapiCurrentUser, ensureStoredStrapiUserRefs, getStoredStrapiUserId, getStoredStrapiUserRefs } from './strapiAuth.js'
import {
  applyStrapiContentorAfterEntrega,
  applyStrapiContentorAfterRecolha,
  CONTENTOR_SITUACAO_ARMAZEM,
  CONTENTOR_SITUACAO_CLIENTE,
  fetchStrapiContentorByCid,
  fetchStrapiClienteContentores,
  fetchStrapiContentores,
  fetchStrapiContentoresByClienteAtual,
  mapContentorItemToInstalledCard,
  mapContentorToClienteCard,
  reserveStrapiContentorParaEntrega,
  updateStrapiContentorSituacao,
} from './strapiContentores.js'
import { normalizePeriodoForStrapi } from './movimentoPeriodo.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'
const MOVIMENTO_ESTADO_PEDIDO = 'pedido'
const MOVIMENTO_ESTADO_CONCLUIDO = 'concluido'
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

function buildClienteLocalizacaoLabels(cliente) {
  const labels = new Set()
  for (const loc of cliente?.localizacoes ?? []) {
    for (const value of [loc?.nome, loc?.morada]) {
      const label = pickString(value)
      if (label) labels.add(label.toLowerCase())
    }
  }
  const morada = pickString(cliente?.morada)
  if (morada) labels.add(morada.toLowerCase())
  return labels
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

function isEstadoPedidoVisivel(value) {
  return isEstadoAgendado(value) || isEstadoPedido(value)
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
  if (item.estadoKey === MOVIMENTO_ESTADO_PEDIDO) return true
  return isMovimentoDateAfterToday(item.dateSortValue)
}

export function canEditMovimentoCliente(item) {
  if (!item) return false
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
    estadoContentor: pickString(attrs.estadoContentor) ?? fallback.estadoContentor ?? '',
    estadoContentorLabel:
      formatEstadoContentorLabel(attrs.estadoContentor) ||
      fallback.estadoContentorLabel ||
      '',
    observacaoOperador:
      pickString(attrs.observacaoOperador) ?? fallback.observacaoOperador ?? '',
    observacoesCliente:
      pickString(attrs.observacoesCliente) ?? fallback.observacoesCliente ?? '',
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
  params.set('pagination[pageSize]', '100')
  return params
}

function addMovimentoRelationsPopulate(params) {
  params.set('populate[cliente]', 'true')
  params.set('populate[operador]', 'true')
  params.set('populate[localizacao]', 'true')
  params.set('populate[contentor][populate][clienteAtual]', 'true')
  params.set('populate[contentor][populate][localizacaoAtual]', 'true')
}

function createEstadoMovimentosParams(estado, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (withPopulate) addMovimentoRelationsPopulate(params)
  return addMovimentosCommonParams(params)
}

function addMovimentosDeepPopulateParams(params) {
  params.set('populate[contentor][populate][capacidade]', 'true')
  params.set('populate[capacidade]', 'true')
  params.set('populate[localizacao][populate][user]', 'true')
  params.set('populate[localizacao]', 'true')
  params.set('populate[cliente]', 'true')
  params.set('populate[operador]', 'true')
  params.set('populate[fotografias]', 'true')
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
  return `${n} kg`
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
 * Lista movimentos nos estados "agendado" e "pedido".
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosAgendados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createAllMovimentosParams(true),
    createAllMovimentosParams(false),
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Agendado', true),
    createEstadoMovimentosParams('agendada', true),
    createEstadoMovimentosParams('Agendada', true),
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('agendado', false),
    createEstadoMovimentosParams('Agendado', false),
    createEstadoMovimentosParams('agendada', false),
    createEstadoMovimentosParams('Agendada', false),
    createEstadoMovimentosParams('pedido', false),
    createEstadoMovimentosParams('Pedido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      if (rows.length > 0) {
        const pedidos = enrichMovimentosPedidoGroups(
          rows
            .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
            .filter((item) => item && isEstadoPedidoVisivel(item.estado))
            .sort((a, b) => a.dateSortValue - b.dateSortValue),
        )
        if (pedidos.length > 0 || !params.toString().includes('filters%5Bestado%5D')) {
          return pedidos
        }
      }
    } catch (err) {
      lastError = err
    }
  }

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
 * Lista movimentos concluídos, ordenados por data (mais recentes primeiro).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosHistorico(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createEstadoMovimentosParamsHistorico('concluido', true),
    createEstadoMovimentosParamsHistorico('Concluido', true),
    createEstadoMovimentosParamsHistorico('concluído', true),
    createEstadoMovimentosParamsHistorico('Concluído', true),
    createEstadoMovimentosParamsHistorico('concluido', false),
    createEstadoMovimentosParamsHistorico('Concluido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const historico = enrichMovimentosPedidoGroups(
        rows
          .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
          .filter((item) => item && isEstadoConcluido(item.estado))
          .sort((a, b) => b.dateSortValue - a.dateSortValue),
      )
      if (historico.length > 0) return historico
    } catch (err) {
      lastError = err
    }
  }

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
        return items
          .map((item) => mapContentorItemToInstalledCard(item))
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
 * Número de contentores instalados por cliente (user id).
 * @param {Array<import('./strapiClientes.js').ClienteItem>} [clientes]
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchStrapiContentorCountsByClienteId(clientes = []) {
  const [cards, allContentores] = await Promise.all([
    fetchStrapiContentoresInstaladosCards(),
    fetchStrapiContentores(),
  ])
  const counts = new Map()

  for (const cliente of clientes) {
    const clientRef = pickString(cliente?.id)
    if (!clientRef) continue

    const movimentoCards = cards.filter((card) => movimentoCardBelongsToCliente(card, cliente))
    const labels = buildClienteLocalizacaoLabels(cliente)
    const localizacaoCards =
      labels.size > 0
        ? allContentores.filter((item) => {
            const loc = pickString(item.localizacaoAtualMorada ?? item.localizacao)
            return loc && labels.has(loc.toLowerCase())
          })
        : []

    const uniqueCids = new Set([
      ...movimentoCards.map((card) => String(card.id)),
      ...localizacaoCards.map((item) => String(item.cid)),
    ])

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
    const cliente = buildContentRelationConnect(clienteRef)
    if (cliente) payload.cliente = cliente
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
  for (const field of ['localizacao', 'contentor', 'cliente']) {
    const value = next[field]
    if (value && typeof value === 'object' && Array.isArray(value.connect) && value.connect.length > 0) {
      next[field] = value.connect[0]
    }
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
 * @property {string} contentorId CID do contentor (ex.: CNT-001)
 * @property {string} [localizacaoId] ID/documentId da relação Localização
 * @property {string} localizacao
 * @property {string} data Data no formato YYYY-MM-DD
 * @property {string} periodo
 * @property {string} [observacoes]
 * @property {string} trocarContentor Sim/Não
 */

/**
 * Regista pedido(s) no Strapi (estado `pedido`).
 * Sempre cria `tipoMovimento: recolha` com contentor; se Trocar Contentor = Sim,
 * cria também `tipoMovimento: entrega` sem contentor associado.
 * @param {CreateClienteSolicitacaoRecolhaPayload} payload
 */
export async function createStrapiClienteSolicitacaoRecolha(payload) {
  const contentorCid = pickString(payload.contentorId)
  if (!contentorCid) throw new Error('Contentor em falta.')

  const data = pickString(payload.data)
  if (!data) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const localizacaoId = pickString(payload.localizacaoId)
  const observacoes = pickString(payload.observacoes)

  const contentor = await fetchStrapiContentorByCid(contentorCid)
  if (!contentor?.id) throw new Error('Contentor não encontrado.')

  if (!localizacaoId) {
    throw new Error('Localização do contentor em falta. Não foi possível associar o pedido.')
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

  if (isTrocarContentorSim(payload.trocarContentor)) {
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
 * @param {string} movimentoKey documentId ou id do movimento
 * @param {{ data?: string, periodo?: string, estado?: string, operadorId?: string, ordemOperador?: number, contentorId?: string }} payload
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
 * Conclui recolha do operador e devolve o contentor ao armazém.
 * @param {{ movimentoKey?: string, contentorId: string, observacoes?: string, estado?: string, peso?: string, numeroEgar?: string, fotografias?: File[] }} payload
 */
export async function completeStrapiOperadorRecolha(payload) {
  const contentorId = pickString(payload.contentorId)
  if (!contentorId) throw new Error('ID do contentor em falta.')

  const movimentoKey = await resolveStrapiOperadorRecolhaMovimentoKey({
    movimentoKey: payload.movimentoKey,
    contentorId,
  })
  if (!movimentoKey) throw new Error('Movimento de recolha em falta.')

  const contentor = await fetchStrapiContentorByCid(contentorId)
  if (!contentor) throw new Error('Contentor não encontrado.')

  const observacaoParts = [
    pickString(payload.observacoes),
    pickString(payload.peso) ? `Peso: ${pickString(payload.peso)}` : null,
    pickString(payload.numeroEgar) ? `EGAR: ${pickString(payload.numeroEgar)}` : null,
  ].filter(Boolean)

  const fotoRefs = await uploadStrapiMovimentoFiles(payload.fotografias ?? [])

  /** @type {Record<string, unknown>} */
  const base = {
    estado: MOVIMENTO_ESTADO_CONCLUIDO,
    observacaoOperador: observacaoParts.join('\n'),
    contentor: buildContentRelationConnect(contentor.id),
  }

  const fotoVariants = buildFotografiasWriteVariants(fotoRefs)
  const attempts = fotoVariants.length > 0 ? fotoVariants.map((fotos) => ({ ...base, ...fotos })) : [base]

  let lastError = null
  for (const data of attempts) {
    try {
      const updated = await putStrapiMovimentoUpdate(movimentoKey, data)
      await applyStrapiContentorAfterRecolha(contentor.id, {
        estado: pickString(payload.estado) ?? undefined,
        localizacao: contentor.localizacao ?? undefined,
      })
      return updated
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Não foi possível concluir a recolha.')
    }
  }

  throw lastError ?? new Error('Não foi possível concluir a recolha.')
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
  return {
    id: item.movimentoKey ?? item.id,
    collectionId: item.contentorId ?? item.id,
    clienteLabel: item.clienteLabel ?? '',
    locationDetail: item.locationDetail ?? item.location ?? '',
    status: item.status,
    scheduledAt: item.scheduledAt,
    taskLines: buildOperadorCardTaskLines(item),
    dateSortValue: item.dateSortValue,
    movimentoKey: item.movimentoKey,
    contentorId: item.contentorId,
    qrCode: item.qrCode,
    taskType: item.taskType,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
  }
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
      recolhasAgendadas: upcomingCollections.length,
    },
  }
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
  const build = (opts) =>
    enrichMovimentosPedidoGroups(
      rows
        .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
        .filter((item) => item && isEstadoAgendado(item.estado))
        .filter((item) => movimentoBelongsToOperador(item, operadorRefs, opts))
        .sort(sortOperadorMovimentos),
    )

  const pedidos = build(options)
  if (pedidos.length > 0 || options.trustApiScope || rows.length === 0) return pedidos
  return build({ trustApiScope: true })
}

function buildOperadorAgendadoFetchAttempts(operadorRefs) {
  const refs = [...operadorRefs]
  /** @type {Array<{ params: URLSearchParams, trustApiScope: boolean }>} */
  const attempts = []

  attempts.push({ params: createAllMovimentosParams(true), trustApiScope: true })
  attempts.push({ params: createAllMovimentosParams(false), trustApiScope: true })
  attempts.push({ params: createEstadoMovimentosParams('agendado', true), trustApiScope: true })
  attempts.push({ params: createEstadoMovimentosParams('agendado', false), trustApiScope: true })

  for (const ref of refs) {
    for (const refKey of ['id', 'documentId']) {
      attempts.push({
        params: createOperadorAgendadoParams(ref, refKey, 'agendado', true),
        trustApiScope: true,
      })
      attempts.push({
        params: createOperadorAgendadoParams(ref, refKey, 'agendado', false),
        trustApiScope: true,
      })
    }
  }

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

  for (const { params, trustApiScope } of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      hadSuccessfulFetch = true
      const pedidos = processOperadorMovimentosRows(rows, fallbackRows, operadorRefs, {
        trustApiScope,
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

  const rows = await fetchStrapiOperadorMovimentosAgendados(fallbackRows)
  const collapsed = collapseMovimentosPedidoCards(rows)
  return splitOperadorDashboardMovimentos(collapsed)
}
