import { useEffect, useState } from 'react'
import { faPlus } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot as faLocationDotSharp } from '@fortawesome/sharp-light-svg-icons'
import LocationPickerModal from '../../../../components/LocationPickerModal/LocationPickerModal.jsx'
import {
  createStrapiCliente,
  fetchStrapiClienteDetail,
  updateStrapiCliente,
} from '../../../../lib/strapiClientes.js'
import './ClienteRegisto.css'

let localizacaoKeySeq = 0

function nextLocalizacaoKey() {
  localizacaoKeySeq += 1
  return `loc-${localizacaoKeySeq}`
}

/** @returns {{ key: string, strapiId: string|null, nome: string, lat: number|null, lng: number|null }} */
function emptyLocalizacao() {
  return { key: nextLocalizacaoKey(), strapiId: null, nome: '', lat: null, lng: null }
}

function emptyForm() {
  return {
    username: '',
    nif: '',
    telefone: '',
    email: '',
    password: '',
    pessoaContacto: '',
    morada: '',
    localizacoes: [emptyLocalizacao()],
  }
}

/** @param {import('../../../../lib/strapiClientes.js').ClienteItem} cliente */
function formFromCliente(cliente) {
  const locs =
    cliente.localizacoes?.length > 0
      ? cliente.localizacoes.map((loc) => ({
          key: nextLocalizacaoKey(),
          strapiId: loc.strapiId ?? null,
          nome: loc.nome ?? loc.morada ?? '',
          lat: loc.lat ?? null,
          lng: loc.lng ?? null,
        }))
      : [emptyLocalizacao()]

  return {
    username: cliente.username && cliente.username !== 'Cliente' ? cliente.username : '',
    nif: cliente.nif != null ? String(cliente.nif) : '',
    telefone: cliente.telefoneNum != null ? String(cliente.telefoneNum) : '',
    email: cliente.email ?? '',
    password: '',
    pessoaContacto: cliente.pessoaContacto ?? '',
    morada: cliente.morada ?? '',
    localizacoes: locs,
  }
}

/**
 * Registo / edição de cliente (Figma). Localizações com picker de mapa (visual).
 * @param {import('../../../../lib/strapiClientes.js').ClienteItem} [clienteToEdit]
 * @param {string} [clienteId] ID para carregar dados completos (edição)
 */
export default function ClienteRegisto({ clienteToEdit, clienteId, onCancel, onSuccess }) {
  const resolvedId = clienteId ?? clienteToEdit?.id ?? null
  const isEdit = Boolean(resolvedId)
  const [form, setForm] = useState(() =>
    clienteToEdit ? formFromCliente(clienteToEdit) : emptyForm(),
  )
  const [loadingDetail, setLoadingDetail] = useState(Boolean(resolvedId && !clienteToEdit))
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [picker, setPicker] = useState(null)

  useEffect(() => {
    if (!resolvedId) {
      setLoadingDetail(false)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    setFormError('')
    fetchStrapiClienteDetail(resolvedId, clienteToEdit ?? null)
      .then((detail) => {
        if (cancelled) return
        if (detail) {
          setForm(formFromCliente(detail))
          setFormError('')
        } else if (!clienteToEdit) {
          setFormError('Não foi possível carregar os dados do cliente.')
        }
      })
      .catch(() => {
        if (!cancelled && !clienteToEdit) {
          setFormError('Não foi possível carregar os dados do cliente.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [resolvedId, clienteToEdit])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  function updateLocalizacao(index, patch) {
    setForm((prev) => ({
      ...prev,
      localizacoes: prev.localizacoes.map((loc, i) => (i === index ? { ...loc, ...patch } : loc)),
    }))
    setFormError('')
  }

  function addLocalizacao() {
    setForm((prev) => ({
      ...prev,
      localizacoes: [...prev.localizacoes, emptyLocalizacao()],
    }))
  }

  function removeLocalizacao(index) {
    setForm((prev) => {
      if (prev.localizacoes.length <= 1) return prev
      return {
        ...prev,
        localizacoes: prev.localizacoes.filter((_, i) => i !== index),
      }
    })
  }

  function openPicker(index) {
    const loc = form.localizacoes[index]
    setPicker({
      index,
      value: {
        lat: loc.lat,
        lng: loc.lng,
        label: loc.nome.trim() || `Localização ${index + 1}`,
      },
    })
  }

  function handlePickerConfirm({ lat, lng }) {
    if (picker == null) return
    updateLocalizacao(picker.index, { lat, lng })
    setPicker(null)
  }

  function handleDiscard() {
    if (isEdit && resolvedId) {
      fetchStrapiClienteDetail(resolvedId)
        .then((detail) => {
          if (detail) setForm(formFromCliente(detail))
        })
        .catch(() => {})
    } else {
      setForm(emptyForm())
    }
    setFormError('')
    onCancel?.()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const username = form.username.trim()
    const nif = form.nif.trim()
    const telefone = form.telefone.trim()
    const email = form.email.trim()
    const password = form.password.trim()
    const pessoaContacto = form.pessoaContacto.trim()
    const morada = form.morada.trim()

    if (!username) {
      setFormError('O nome de utilizador é obrigatório.')
      return
    }
    if (!isEdit && (!password || password.length < 6)) {
      setFormError('A palavra-passe deve ter pelo menos 6 caracteres.')
      return
    }
    if (!nif) {
      setFormError('O NIF é obrigatório.')
      return
    }
    if (!telefone) {
      setFormError('O telefone é obrigatório.')
      return
    }
    if (!email) {
      setFormError('O e-mail é obrigatório.')
      return
    }
    if (!pessoaContacto) {
      setFormError('A pessoa de contacto é obrigatória.')
      return
    }
    if (!morada) {
      setFormError('A morada é obrigatória.')
      return
    }

    const locs = form.localizacoes.map((l) => ({
      strapiId: l.strapiId ?? undefined,
      nome: l.nome.trim(),
      lat: l.lat,
      lng: l.lng,
    }))

    if (locs.some((l) => !l.nome)) {
      setFormError('Cada localização precisa de um nome (ex.: Polo Norte).')
      return
    }

    const apiPayload = {
      username,
      email,
      nif,
      telefone,
      pessoaContacto,
      morada,
      password: password || undefined,
      localizacoes: locs,
    }

    setSubmitting(true)
    try {
      const saved = isEdit
        ? await updateStrapiCliente(resolvedId, apiPayload)
        : await createStrapiCliente(apiPayload)
      onSuccess?.(saved)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível guardar o cliente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingDetail) {
    return (
      <p className="cliente-registo__loading" role="status">
        A carregar dados do cliente…
      </p>
    )
  }

  return (
    <>
      <section className="cliente-registo" aria-labelledby="cliente-registo-title">
        <form className="cliente-registo__form" onSubmit={handleSubmit} noValidate>
          <div className="cliente-registo__card">
            <div className="cliente-registo__scroll">
              <h2 id="cliente-registo-title" className="cliente-registo__title">
                {isEdit ? 'Editar Cliente' : 'Registar Novo Cliente'}
              </h2>

              {formError ? (
                <p className="cliente-registo__error" role="alert">
                  {formError}
                </p>
              ) : null}

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Nome*</span>
                <input
                  type="text"
                  className="cliente-registo__input"
                  value={form.username}
                  placeholder="Nome*"
                  onChange={(e) => updateField('username', e.target.value)}
                  autoComplete="organization"
                  required
                />
              </label>

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">NIF*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cliente-registo__input"
                  value={form.nif}
                  placeholder="NIF*"
                  onChange={(e) => updateField('nif', e.target.value)}
                  required
                />
              </label>

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Telefone*</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="cliente-registo__input"
                  value={form.telefone}
                  placeholder="Telefone*"
                  onChange={(e) => updateField('telefone', e.target.value)}
                  required
                />
              </label>

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">e-mail*</span>
                <input
                  type="email"
                  className="cliente-registo__input"
                  value={form.email}
                  placeholder="e-mail*"
                  onChange={(e) => updateField('email', e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              {!isEdit ? (
                <label className="cliente-registo__field">
                  <span className="cliente-registo__label">Palavra-passe*</span>
                  <input
                    type="password"
                    className="cliente-registo__input"
                    value={form.password}
                    placeholder="Palavra-passe*"
                    onChange={(e) => updateField('password', e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </label>
              ) : (
                <label className="cliente-registo__field">
                  <span className="cliente-registo__label">Nova palavra-passe</span>
                  <input
                    type="password"
                    className="cliente-registo__input"
                    value={form.password}
                    placeholder="Nova palavra-passe"
                    onChange={(e) => updateField('password', e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              )}

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Pessoa de Contacto*</span>
                <input
                  type="text"
                  className="cliente-registo__input"
                  value={form.pessoaContacto}
                  placeholder="Pessoa de Contacto*"
                  onChange={(e) => updateField('pessoaContacto', e.target.value)}
                  required
                />
              </label>

              <label className="cliente-registo__field">
                <span className="cliente-registo__label">Morada*</span>
                <input
                  type="text"
                  className="cliente-registo__input"
                  value={form.morada}
                  placeholder="Morada*"
                  onChange={(e) => updateField('morada', e.target.value)}
                  required
                />
              </label>

              <div className="cliente-registo__section">
                <h3 className="cliente-registo__section-title">Localizações</h3>

                {form.localizacoes.map((loc, index) => (
                  <div key={loc.key} className="cliente-registo__loc-block">
                    <label className="cliente-registo__field cliente-registo__field--loc">
                      <span className="cliente-registo__label">Localização*</span>
                      <span className="cliente-registo__loc-row">
                        <input
                          type="text"
                          className="cliente-registo__input cliente-registo__input--loc"
                          value={loc.nome}
                          placeholder="Localização*"
                          onChange={(e) => updateLocalizacao(index, { nome: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="cliente-registo__pin-btn"
                          aria-label={`Definir coordenadas de ${loc.nome.trim() || `localização ${index + 1}`}`}
                          onClick={() => openPicker(index)}
                        >
                          <FontAwesomeIcon
                            icon={faLocationDotSharp}
                            className="cliente-registo__pin-icon"
                            aria-hidden
                          />
                        </button>
                      </span>
                    </label>
                    {loc.lat != null && loc.lng != null ? (
                      <p className="cliente-registo__coords-set">
                        Coordenadas: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      </p>
                    ) : (
                      <p className="cliente-registo__coords-missing">
                        Coordenadas por definir (o mapa fica disponível quando o modelo tiver latitude e
                        longitude)
                      </p>
                    )}
                    {form.localizacoes.length > 1 ? (
                      <button
                        type="button"
                        className="cliente-registo__remove-loc"
                        onClick={() => removeLocalizacao(index)}
                      >
                        Remover localização
                      </button>
                    ) : null}
                  </div>
                ))}

                <button type="button" className="cliente-registo__add-loc" onClick={addLocalizacao}>
                  <FontAwesomeIcon icon={faPlus} className="cliente-registo__add-loc-icon" aria-hidden />
                  Adicionar localização
                </button>
              </div>
            </div>

            <div className="cliente-registo__actions">
              <button type="submit" className="cliente-registo__submit" disabled={submitting}>
                {submitting ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Confirmar Registo'}
              </button>
              <button
                type="button"
                className="cliente-registo__discard"
                disabled={submitting}
                onClick={handleDiscard}
              >
                Descartar Alterações
              </button>
            </div>
          </div>
        </form>
      </section>

      <LocationPickerModal
        isOpen={picker != null}
        value={picker?.value}
        onClose={() => setPicker(null)}
        onConfirm={handlePickerConfirm}
      />
    </>
  )
}
