import { FastifyInstance } from 'fastify';
import { createWebhookEvent } from '../services/webhookService';

interface WebhookRequest {
  event_id: string;
  data?: object;
  [key: string]: unknown;
}

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhook', async (request, reply) => {
    const requestId = request.id;
    const body = request.body as WebhookRequest;
    
    fastify.log.info(`[Webhook] Received request: requestId=${requestId}`);
    
    if (!body.event_id) {
      fastify.log.warn(`[Webhook] Missing event_id: requestId=${requestId}`);
      return reply.status(400).send({ 
        error: 'Missing required field: event_id',
        requestId 
      });
    }
    
    const eventId = body.event_id;
    
    try {
      const event = await createWebhookEvent({
        eventId,
        payload: body,
      });
      
      const statusCode = event.isNew ? 201 : 202;
      const message = event.isNew ? 'Webhook accepted and event created' : 'Webhook accepted (event already exists)';
      
      fastify.log.info(`[Webhook] Request processed: requestId=${requestId}, eventId=${eventId}, isNew=${event.isNew}`);
      
      return reply.status(statusCode).send({
        message,
        eventId: event.eventId,
        status: event.status,
        isNew: event.isNew,
        requestId,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`[Webhook] Request failed: requestId=${requestId}, eventId=${eventId}, error=${errorMessage}`, err);
      
      return reply.status(500).send({ 
        error: 'Failed to process webhook',
        details: errorMessage,
        eventId,
        requestId,
      });
    }
  });
}
