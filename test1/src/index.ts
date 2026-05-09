import Fastify, { FastifyInstance } from 'fastify';
import prisma from './lib/prisma';
import webhookRoutes from './routes/webhook';
import eventsRoutes from './routes/events';
import simulateRoutes, { setProcessor } from './routes/simulate';
import { startRetryQueue } from './services/queueService';
import { getEventByEventId } from './services/webhookService';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function processEvent(eventId: string): Promise<void> {
  const event = await getEventByEventId(eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }
  console.log(`Processing event: ${eventId}, status: ${event.status}, retry: ${event.retryCount}`);
}

async function main() {
  const fastify: FastifyInstance = Fastify({
    logger: true,
  });

  setProcessor(processEvent);

  await fastify.register(webhookRoutes);
  await fastify.register(eventsRoutes);
  await fastify.register(simulateRoutes);

  fastify.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  try {
    await prisma.$connect();
    console.log('Database connected');

    const queueInterval = startRetryQueue(processEvent);
    console.log('Retry queue started');

    process.on('SIGTERM', () => {
      console.log('Shutting down...');
      clearInterval(queueInterval);
      prisma.$disconnect().finally(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      console.log('Shutting down...');
      clearInterval(queueInterval);
      prisma.$disconnect().finally(() => process.exit(0));
    });

    const address = await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
