import { FastifyInstance } from 'fastify';
import { EventStatus, ALL_EVENT_STATUSES } from '../constants/eventStatus';
import type { EventStatusType } from '../constants/eventStatus';
import { getEventsPaginated } from '../services/webhookService';

interface EventsQuery {
  page?: number;
  limit?: number;
  status?: EventStatusType;
}

export default async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/events', async (request, reply) => {
    const query = request.query as EventsQuery;
    const page = Math.max(1, query.page ? Number(query.page) : 1);
    const limit = Math.min(100, Math.max(1, query.limit ? Number(query.limit) : 20));
    const status = query.status;
    
    if (status && !ALL_EVENT_STATUSES.includes(status)) {
      return reply.status(400).send({ 
        error: 'Invalid status',
        validStatuses: ALL_EVENT_STATUSES 
      });
    }
    
    const result = await getEventsPaginated(page, limit, status);
    return reply.send(result);
  });
}
