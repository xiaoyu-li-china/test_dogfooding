import prisma from '../lib/prisma';
import { EventStatus } from '../constants/eventStatus';
import type { EventStatusType } from '../constants/eventStatus';
import { hashPayload } from '../utils/hash';

interface CreateEventInput {
  eventId: string;
  payload: object;
}

export async function createWebhookEvent(input: CreateEventInput) {
  const payloadHash = hashPayload(input.payload);
  const eventId = input.eventId;
  
  console.log(`[Webhook] Processing event: eventId=${eventId}, payloadHash=${payloadHash.substring(0, 16)}...`);
  
  try {
    const result = await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        payloadHash,
        status: EventStatus.PENDING,
      },
      update: {},
    });
    
    const isNew = result.receivedAt.getTime() > Date.now() - 1000;
    
    if (isNew) {
      console.log(`[Webhook] Event created: eventId=${eventId}, id=${result.id}`);
    } else {
      console.log(`[Webhook] Event already exists (idempotent): eventId=${eventId}, existingId=${result.id}`);
    }
    
    return {
      ...result,
      isNew,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Webhook] Failed to create event: eventId=${eventId}, error=${errorMessage}`, err);
    throw err;
  }
}

export async function getEventsPaginated(
  page: number = 1,
  limit: number = 20,
  status?: EventStatusType
) {
  const skip = (page - 1) * limit;
  
  const where = status ? { status } : {};
  
  const [total, events] = await Promise.all([
    prisma.webhookEvent.count({ where }),
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  
  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEventByEventId(eventId: string) {
  return prisma.webhookEvent.findUnique({
    where: { eventId },
  });
}

export async function markEventSuccess(eventId: string) {
  return prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: EventStatus.SUCCESS,
      lastRetryAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function markEventFailed(eventId: string, errorMessage: string) {
  const event = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (!event) return null;
  
  return prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: EventStatus.FAILED,
      lastRetryAt: new Date(),
      errorMessage,
    },
  });
}

export async function markEventDeadLetter(eventId: string, errorMessage: string) {
  return prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: EventStatus.DEAD_LETTER,
      lastRetryAt: new Date(),
      errorMessage,
    },
  });
}
