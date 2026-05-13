/** Dados estáticos para layout do dashboard do operador (Figma Operador - Dashboard, nó 52-4168). */

export const MOCK_OPERATOR_NAME = 'Luís Pedro'

export const MOCK_OPERATOR_STATS = {
  recolhasHoje: 3,
  recolhasAgendadas: 7,
  contentoresRecolhidos: 32,
  kmPercorridos: '01',
}

export const MOCK_DAY_COLLECTIONS = [
  {
    id: 'COL-001',
    locationPrefix: 'Revigrés',
    locationDetail: 'Polo 4 - Aveiro',
    status: 'hoje',
    scheduledAt: '04/05/2026 09:00',
    binNumber: '02',
  },
  {
    id: 'COL-002',
    locationPrefix: 'Revigrés',
    locationDetail: 'Sede - Águeda',
    status: 'hoje',
    scheduledAt: '04/05/2026 09:30',
    binNumber: '03',
  },
  {
    id: 'COL-003',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'R. 5 de Outubro',
    status: 'hoje',
    scheduledAt: '04/05/2026 10:30',
    binNumber: '01',
  },
]

export const MOCK_UPCOMING_COLLECTIONS = [
  {
    id: 'COL-004',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'Praça do Municí…',
    status: 'amanha',
    scheduledAt: '05/05/2026 09:00',
    binNumber: '02',
  },
  {
    id: 'COL-005',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'Largo Dr. João…',
    status: 'amanha',
    scheduledAt: '05/05/2026 09:45',
    binNumber: '06',
  },
  {
    id: 'COL-006',
    locationPrefix: 'Ramalhos',
    locationDetail: 'Sede - Águeda',
    status: 'agendada',
    scheduledAt: '06/05/2026 09:00',
    binNumber: '01',
  },
  {
    id: 'COL-007',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'Rua Luís de Ca…',
    status: 'agendada',
    scheduledAt: '06/05/2026 09:30',
    binNumber: '03',
  },
  {
    id: 'COL-008',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'Z.I. Barrô - Águ…',
    status: 'agendada',
    scheduledAt: '06/05/2026 10:15',
    binNumber: '02',
  },
  {
    id: 'COL-009',
    locationPrefix: 'J.F Valongo do Vouga',
    locationDetail: 'Junta…',
    status: 'agendada',
    scheduledAt: '07/05/2026 09:00',
    binNumber: '03',
  },
  {
    id: 'COL-010',
    locationPrefix: 'E.S Castilho',
    locationDetail: 'E.S Castilho - Á…',
    status: 'agendada',
    scheduledAt: '07/05/2026 09:45',
    binNumber: '04',
  },
]
