/** Dados estáticos para layout do dashboard do cliente. */

export const MOCK_CLIENT_NAME = 'Cliente'

export const MOCK_CLIENT_STATS = {
  recolhasHoje: 3,
  recolhasAgendadas: 7,
  contentoresRecolhidos: 32,
  kmPercorridos: '01',
}

export const MOCK_CLIENT_REQUESTS = [
  {
    id: 'PED-001',
    locationPrefix: 'Revigrés',
    locationDetail: 'Polo 4 - Aveiro',
    status: 'hoje',
    scheduledAt: '04/05/2026 09:00',
    binNumber: '02',
    taskType: 'recolher',
  },
  {
    id: 'PED-002',
    locationPrefix: 'Revigrés',
    locationDetail: 'Sede - Águeda',
    status: 'amanha',
    scheduledAt: '05/05/2026 09:30',
    binNumber: '03',
    taskType: 'entregar',
  },
  {
    id: 'PED-003',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'R. 5 de Outubro',
    status: 'agendada',
    scheduledAt: '06/05/2026 10:30',
    binNumber: '01',
    taskType: 'recolher',
  },
]

export const MOCK_CLIENT_CONTAINERS = [
  {
    id: 'CNT-001',
    locationPrefix: 'Revigrés',
    locationDetail: 'Polo 4 - Aveiro',
    qrCode: 'QR001',
    litrosLabel: '800L',
    estadoLabel: 'Reutilizável',
    status: 'hoje',
    scheduledAt: '04/05/2026 09:00',
    binNumber: '01',
    taskType: 'recolher',
  },
  {
    id: 'CNT-002',
    locationPrefix: 'Revigrés',
    locationDetail: 'Sede - Águeda',
    qrCode: 'QR002',
    litrosLabel: '800L',
    estadoLabel: 'Reutilizável',
    status: 'amanha',
    scheduledAt: '05/05/2026 09:30',
    binNumber: '02',
    taskType: 'entregar',
  },
  {
    id: 'CNT-003',
    locationPrefix: 'C.M Águeda',
    locationDetail: 'R. 5 de Outubro',
    qrCode: 'QR003',
    litrosLabel: '800L',
    estadoLabel: 'Reutilizável',
    emRecolha: true,
    status: 'agendada',
    scheduledAt: '06/05/2026 10:30',
    binNumber: '03',
    taskType: 'recolher',
  },
]

export const MOCK_CLIENT_HISTORICO = [
  {
    id: 'REQ-999',
    locationPrefix: 'Sede',
    locationDetail: 'Águeda',
    status: 'finalizado',
    historicoScheduledAt: '30/04/2026 10:20',
    scheduledAt: '30/04/2026 10:20',
    binNumber: '04',
    taskType: 'recolher',
    estado: 'concluido',
    estadoKey: 'concluido',
    dataIso: '2026-04-30',
    dateSortValue: new Date('2026-04-30').getTime(),
  },
  {
    id: 'REQ-998',
    locationPrefix: 'Polo 4',
    locationDetail: 'Aveiro',
    status: 'finalizado',
    historicoScheduledAt: '30/04/2026 10:20',
    scheduledAt: '30/04/2026 10:20',
    binNumber: '02',
    taskType: 'entregar',
    estado: 'concluido',
    estadoKey: 'concluido',
    dataIso: '2026-04-30',
    dateSortValue: new Date('2026-04-30').getTime(),
  },
]
