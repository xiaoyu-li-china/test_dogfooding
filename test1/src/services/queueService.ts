import prisma from '../lib/prisma';
import { EventStatus } from '../constants/eventStatus';
import { QUEUE_CONFIG, calculateNextRetryDelay } from '../config/queue';
import {
  markEventSuccess,
  markEventFailed,
  markEventDeadLetter,
  getEventByEventId,
} from './webhookService';

interface EventProcessor {
  (eventId: string): Promise<void>;
}

const processingEvents = new Set<string>();

async function getPendingEvents(): Promise<string[]> {
  const now = new Date();
  const events = await prisma.webhookEvent.findMany({
    where: {
      OR: [
        { status: EventStatus.PENDING },
        {
          status: EventStatus.FAILED,
          nextRetryAt: { lte: now },
          retryCount: { lt: QUEUE_CONFIG.MAX_RETRY_COUNT },
        },
      ],
    },
    select: { eventId: true },
    orderBy: { receivedAt: 'asc' },
  });
  return events.map(e => e.eventId);
}

async function tryClaimEvent(eventId: string): Promise<boolean> {
  if (processingEvents.has(eventId)) return false;
  
  const event = await getEventByEventId(eventId);
  if (!event) return false;
  
  if (
    event.status !== EventStatus.PENDING &&
    (event.status !== EventStatus.FAILED || event.retryCount >= QUEUE_CONFIG.MAX_RETRY_COUNT)
  ) {
    return false;
  }
  
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: EventStatus.PROCESSING,
      retryCount: event.retryCount + 1,
      lastRetryAt: new Date(),
    },
  });
  
  processingEvents.add(eventId);
  return true;
}

async function processEventWithProcessor(
  eventId: string,
  processor: EventProcessor
): Promise<void> {
  try {
    await processor(eventId);
    await markEventSuccess(eventId);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const event = await getEventByEventId(eventId);
    
    if (!event) return;
    
    const nextRetryCount = event.retryCount;
    
    if (nextRetryCount >= QUEUE_CONFIG.MAX_RETRY_COUNT) {
      await markEventDeadLetter(eventId, errorMessage);
    } else {
      const delayMs = calculateNextRetryDelay(nextRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);
      
      await prisma.webhookEvent.update({
        where: { eventId },
        data: {
          status: EventStatus.FAILED,
          nextRetryAt,
          errorMessage,
        },
      });
    }
  } finally {
    processingEvents.delete(eventId);
  }
}

async function runQueueTick(processor: EventProcessor): Promise<void> {
  const eventIds = await getPendingEvents();
  
  for (const eventId of eventIds) {
    if (await tryClaimEvent(eventId)) {
      processEventWithProcessor(eventId, processor).catch(console.error);
    }
  }
}

export function startRetryQueue(processor: EventProcessor): NodeJS.Timeout {
  return setInterval(() => {
    runQueueTick(processor).catch(console.error);
  }, QUEUE_CONFIG.POLL_INTERVAL_MS);
}

export async function replayEvent(eventId: string, processor: EventProcessor): Promise<void> {
  const event = await getEventByEventId(eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: EventStatus.PENDING,
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
    },
  });
  
  if (await tryClaimEvent(eventId)) {
    await processEventWithProcessor(eventId, processor);
  }
}
