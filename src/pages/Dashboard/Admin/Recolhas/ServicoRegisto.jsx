import { useEffect, useMemo, useState } from 'react'
import { faChevronDown } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MOVIMENTO_PERIODO_OPTIONS } from '../../../../lib/movimentoPeriodo.js'
import { fetchStrapiClientes, fetchStrapiClienteDetail } from '../../../../lib/strapiClientes.js'
import { fetchStrapiCapacidades } from '../../../../lib/strapiContentores.js'
import { fetchStrapiOperadores } from '../../../../lib/strapiOperadores.js'
import { createStrapiAdminServico, fetchStrapiClienteContentoresInstaladosPorCliente } from '../../../../lib/strapiMovimentos.js'
import { DIAS_SEMANA_OPTIONS } from '../../../../lib/strapiRecorrencias.js'
import '../Clientes/ClienteRegisto.css'
import './ServicoRegisto.css'

const TIPOS = [
  { value: 'recolha', label: 'Recolha' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'troca', label: 'Troca (recolha + entrega)' },
]

function emptyForm() {
  return {
    tipo: 'troca',
    clienteId: '',
    localizacaoId: '',
    contentorCid: '',
    capacidadeId: '',
    data: '',
    periodo: 'indiferente',
    operadorId: '',
    observacoes: '',
    repetirSemanalmente: false,
    diaSemana: '5',
  }
}

function weekdayFromIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '5'
  const [y, m, d] = iso.split('-').map(Number)
  return String(new Date(y, m - 1, d).getDay())
}

/** Formulário admin — criar recolha / entrega / troca (com série semanal). */
export default function ServicoRegisto({ onCancel, onSuccess }) {
  const [form, setForm] = useState(() => emptyForm())
  const [clientes, setClientes] = useState([])
  const [clienteDetail, setClienteDetail] = useState(null)
  const [contentores, setContentores] = useState([])
  const [capacidades, setCapacidades] = useState([])
  const [operadores, setOperadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchStrapiClientes().catch(() => []),
      fetchStrapiCapacidades().catch(() => []),
      fetchStrapiOperadores().catch(() => []),
    ])
      .then(([cli, caps, ops]) => {
        if (cancelled) return
        setClientes(cli)
        setCapacidades(caps)
        setOperadores(ops)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const clienteId = form.clienteId.trim()
    if (!clienteId) {
      setClienteDetail(null)
      setContentores([])
      return undefined
    }

    let cancelled = false
    setLoadingCliente(true)
    fetchStrapiClienteDetail(clienteId)
      .then(async (detail) => {
        if (cancelled) return
        setClienteDetail(detail)
        if (!detail) {
          setContentores([])
          return
        }
        const rows = await fetchStrapiClienteContentoresInstaladosPorCliente(detail)
        if (!cancelled) setContentores(rows)
      })
      .catch(() => {
        if (!cancelled) {
          setClienteDetail(null)
          setContentores([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCliente(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.clienteId])

  const localizacoes = clienteDetail?.localizacoes ?? []

  const needsContentor = form.tipo === 'recolha' || form.tipo === 'troca'
  const needsCapacidade = form.tipo === 'entrega'

  const canSubmit = useMemo(() => {
    if (submitting || loading) return false
    if (!form.tipo || !form.clienteId || !form.localizacaoId || !form.data || !form.periodo) return false
    if (needsContentor && !form.contentorCid) return false
    if (needsCapacidade && !form.capacidadeId) return false
    return true
  }, [submitting, loading, form, needsContentor, needsCapacidade])

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'clienteId') {
        next.localizacaoId = ''
        next.contentorCid = ''
      }
      if (field === 'tipo') {
        if (value === 'entrega') next.contentorCid = ''
        if (value === 'recolha') next.capacidadeId = ''
      }
      if (field === 'data' && prev.repetirSemanalmente) {
        next.diaSemana = weekdayFromIso(value)
      }
      if (field === 'repetirSemanalmente' && value && prev.data) {
        next.diaSemana = weekdayFromIso(prev.data)
      }
      return next
    })
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      const selectedCap = capacidades.find((cap) => String(cap.id) === String(form.capacidadeId))
      const result = await createStrapiAdminServico({
        tipo: form.tipo,
        clienteId: form.clienteId.trim(),
        localizacaoId: form.localizacaoId.trim(),
        contentorCid: form.contentorCid.trim(),
        capacidadeId: form.capacidadeId.trim(),
        capacidadeLabel: selectedCap?.label ?? '',
        data: form.data.trim(),
        periodo: form.periodo.trim(),
        operadorId: form.operadorId.trim() || undefined,
        observacoes: form.observacoes.trim(),
        repetirSemanalmente: form.repetirSemanalmente,
        diaSemana: form.repetirSemanalmente ? Number(form.diaSemana) : undefined,
      })
      onSuccess?.(result)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar o serviço.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="cliente-registo__loading">A carregar…</p>
  }

  return (
    <div className="cliente-registo">
      <form className="cliente-registo__form" onSubmit={handleSubmit} noValidate>
        <div className="cliente-registo__card">
          <div className="cliente-registo__scroll">
            <h1 className="cliente-registo__title">Novo serviço</h1>
            <p className="servico-registo__help">
              Cria uma recolha, entrega ou troca para um cliente. Podes repetir semanalmente (como no
              calendário).
            </p>

            {formError ? (
              <p className="cliente-registo__error" role="alert">
                {formError}
              </p>
            ) : null}

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Tipo*</span>
              <span className="cliente-registo__select-wrap">
                <select
                  className="cliente-registo__select"
                  value={form.tipo}
                  onChange={(e) => updateField('tipo', e.target.value)}
                >
                  {TIPOS.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Cliente*</span>
              <span className="cliente-registo__select-wrap">
                <select
                  className="cliente-registo__select"
                  value={form.clienteId}
                  onChange={(e) => updateField('clienteId', e.target.value)}
                >
                  <option value="">Selecionar</option>
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.nome || cli.username || cli.email || cli.id}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Localização*</span>
              <span className="cliente-registo__select-wrap">
                <select
                  className="cliente-registo__select"
                  value={form.localizacaoId}
                  onChange={(e) => updateField('localizacaoId', e.target.value)}
                  disabled={!form.clienteId || loadingCliente}
                >
                  <option value="">
                    {loadingCliente ? 'A carregar…' : 'Selecionar'}
                  </option>
                  {localizacoes.map((loc) => (
                    <option key={loc.strapiId ?? loc.morada} value={loc.strapiId}>
                      {loc.nome || loc.morada || loc.strapiId}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
              </span>
            </label>

            {needsContentor ? (
              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Contentor a recolher*</span>
                <span className="cliente-registo__select-wrap">
                  <select
                    className="cliente-registo__select"
                    value={form.contentorCid}
                    onChange={(e) => updateField('contentorCid', e.target.value)}
                    disabled={!form.clienteId || loadingCliente}
                  >
                    <option value="">Selecionar</option>
                    {contentores.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                        {item.locationDetail ? ` — ${item.locationDetail}` : ''}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
                </span>
              </label>
            ) : null}

            {needsCapacidade ? (
              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Capacidade*</span>
                <span className="cliente-registo__select-wrap">
                  <select
                    className="cliente-registo__select"
                    value={form.capacidadeId}
                    onChange={(e) => updateField('capacidadeId', e.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {capacidades.map((cap) => (
                      <option key={cap.id} value={cap.id}>
                        {cap.label}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
                </span>
              </label>
            ) : null}

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Data*</span>
              <input
                type="date"
                className="cliente-registo__input"
                value={form.data}
                onChange={(e) => updateField('data', e.target.value)}
                required
              />
            </label>

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Período*</span>
              <span className="cliente-registo__select-wrap">
                <select
                  className="cliente-registo__select"
                  value={form.periodo}
                  onChange={(e) => updateField('periodo', e.target.value)}
                >
                  {MOVIMENTO_PERIODO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Operador</span>
              <span className="cliente-registo__select-wrap">
                <select
                  className="cliente-registo__select"
                  value={form.operadorId}
                  onChange={(e) => updateField('operadorId', e.target.value)}
                >
                  <option value="">Sem operador (atribuir depois)</option>
                  {operadores.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome || op.username || op.email || op.id}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="servico-registo__check">
              <input
                type="checkbox"
                checked={form.repetirSemanalmente}
                onChange={(e) => updateField('repetirSemanalmente', e.target.checked)}
              />
              <span>Repetir semanalmente</span>
            </label>

            {form.repetirSemanalmente ? (
              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Dia da semana*</span>
                <span className="cliente-registo__select-wrap">
                  <select
                    className="cliente-registo__select"
                    value={form.diaSemana}
                    onChange={(e) => updateField('diaSemana', e.target.value)}
                  >
                    {DIAS_SEMANA_OPTIONS.map((dia) => (
                      <option key={dia.value} value={String(dia.value)}>
                        {dia.label}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="cliente-registo__select-icon" aria-hidden />
                </span>
                <span className="servico-registo__hint">
                  Cria as próximas semanas e renova automaticamente (como no calendário).
                </span>
              </label>
            ) : null}

            <label className="cliente-registo__field">
              <span className="cliente-registo__label">Observações</span>
              <input
                type="text"
                className="cliente-registo__input"
                value={form.observacoes}
                onChange={(e) => updateField('observacoes', e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="cliente-registo__actions">
            <button type="button" className="cliente-registo__cancel" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="cliente-registo__submit" disabled={!canSubmit}>
              {submitting ? 'A criar…' : form.repetirSemanalmente ? 'Criar série' : 'Criar serviço'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
