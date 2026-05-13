/** Dados estáticos — layout do painel admin (pedidos + tickets). */

export const MOCK_ADMIN_PEDIDOS = [
  {
    id: 'COL-001',
    location: 'Cliente Localização',
    status: 'hoje',
    scheduledAt: '06/06/2026 10:00',
    binNumber: '20',
  },
  {
    id: 'COL-002',
    location: 'Cliente Localização',
    status: 'hoje',
    scheduledAt: '06/06/2026 10:00',
    binNumber: '20',
  },
  {
    id: 'COL-003',
    location: 'Cliente Localização',
    status: 'amanha',
    scheduledAt: '06/06/2026 10:00',
    binNumber: '20',
  },
  {
    id: 'COL-004',
    location: 'Cliente Localização',
    status: 'amanha',
    scheduledAt: '06/06/2026 10:00',
    binNumber: '20',
  },
]

export const MOCK_ADMIN_TICKETS = [
  {
    id: 't1',
    title: 'Contentor Danificado',
    clientLine: 'Cliente Localização',
    refLine: '#SL1234 06/06/2026 10:00',
    status: 'aberto-hoje',
  },
  {
    id: 't2',
    title: 'Contentor Danificado',
    clientLine: 'Cliente Localização',
    refLine: '#SL1234 06/06/2026 10:00',
    status: 'aberto-amanha',
  },
  {
    id: 't3',
    title: 'Contentor Danificado',
    clientLine: 'Cliente Localização',
    refLine: '#SL1234 06/06/2026 10:00',
    status: 'respondido',
  },
]
