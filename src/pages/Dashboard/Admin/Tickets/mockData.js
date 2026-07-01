/** Dados estáticos — listagem e detalhe de tickets (admin). */

export { TICKET_STATUS_LABEL } from '../../../lib/ticketStatus.js'

/** @typedef {{ id: string, author: 'cliente'|'admin', text: string, at: string }} TicketReply */

/** @type {Array<{
 *   id: string,
 *   ref: string,
 *   title: string,
 *   clientName: string,
 *   location: string,
 *   date: string,
 *   time: string,
 *   status: keyof typeof TICKET_STATUS_LABEL,
 *   priority: string,
 *   message: string,
 *   replies: TicketReply[],
 * }>} */
export const MOCK_TICKETS = [
  {
    id: 't1',
    ref: 'SL1234',
    title: 'Contentor Danificado',
    clientName: 'Revigrés',
    location: 'Polo 4, Aveiro',
    date: '06/06/2026',
    time: '10:00',
    status: 'aberto-hoje',
    priority: 'Alta',
    message:
      'O contentor na entrada principal apresenta danos na tampa e não fecha corretamente. Solicitamos verificação urgente.',
    replies: [],
  },
  {
    id: 't2',
    ref: 'SL1235',
    title: 'Contentor Danificado',
    clientName: 'Cliente',
    location: 'Localização',
    date: '06/06/2026',
    time: '10:00',
    status: 'aberto-amanha',
    priority: 'Média',
    message: 'Contentor com avaria no mecanismo de abertura. A recolha de ontem não foi possível.',
    replies: [],
  },
  {
    id: 't3',
    ref: 'SL1236',
    title: 'Contentor Danificado',
    clientName: 'Cliente',
    location: 'Localização',
    date: '06/06/2026',
    time: '10:00',
    status: 'respondido',
    priority: 'Baixa',
    message: 'Pedido de substituição do contentor verde por desgaste.',
    replies: [
      {
        id: 'r1',
        author: 'admin',
        text: 'Bom dia. Agendámos a substituição para a próxima recolha. Obrigado.',
        at: '07/06/2026 09:15',
      },
    ],
  },
  {
    id: 't4',
    ref: 'SL1237',
    title: 'Contentor Danificado',
    clientName: 'Cliente',
    location: 'Localização',
    date: '06/06/2026',
    time: '10:00',
    status: 'fechado',
    priority: 'N/A',
    message: 'Contentor extra solicitado para evento temporário.',
    replies: [
      {
        id: 'r2',
        author: 'admin',
        text: 'Contentor entregue conforme combinado.',
        at: '05/06/2026 14:30',
      },
    ],
  },
]
