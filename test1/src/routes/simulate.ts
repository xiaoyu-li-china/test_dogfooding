import { FastifyInstance } from 'fastify';

export type EventProcessor = (eventId: string) => Promise<void>;

interface SimulateParams {
  id: string;
}

interface SimulateBody {
  simulateFailure?: boolean;
  errorMessage?: string;
}

let processor: EventProcessor;

export function setProcessor(proc: EventProcessor) {
  processor = proc;
}

export default async function simulateRoutes(fastify: FastifyInstance) {
  fastify.post('/simulate/:id/replay', async (request, reply) => {
    const { id: eventId } = request.params as SimulateParams;
    const { simulateFailure, errorMessage } = request.body as SimulateBody || {};

    let eventProcessor = processor;

    if (simulateFailure) {
      const errorMsg = errorMessage || 'Simulated failure for replay demonstration';
      eventProcessor = async (_id: string) => {
        throw new Error(errorMsg);
      };
    }

    const { replayEvent } = await import('../services/queueService');

    try {
      await replayEvent(eventId, eventProcessor);
      return reply.send({ message: 'Replay initiated', eventId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(404).send({ error: message });
    }
  });
}
