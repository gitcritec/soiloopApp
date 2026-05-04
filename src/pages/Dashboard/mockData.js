/** Dados estáticos apenas para layout do dashboard do operador; substituir por API / store. */

export const MOCK_OPERATOR_NAME = 'Luís Pedro'

export const MOCK_DAY_COLLECTIONS = [
  {
    id: 'COL-001',
    location: 'Revigrés Polo 4 - Aveiro',
    status: 'hoje',
    scheduledAt: '04/05/2026 09:00',
    binNumber: '02',
  },
  {
    id: 'COL-002',
    location: 'Ecoilhas - Vagos',
    status: 'amanha',
    scheduledAt: '05/05/2026 10:30',
    binNumber: '03',
  },
]

export const MOCK_UPCOMING_COLLECTIONS = [
  {
    id: 'COL-010',
    location: 'Lipor - Gondomar',
    status: 'agendada',
    scheduledAt: '08/05/2026 14:00',
    binNumber: '01',
  },
]
