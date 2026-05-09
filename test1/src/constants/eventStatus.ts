export const EventStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus];

export const ALL_EVENT_STATUSES: EventStatusType[] = Object.values(EventStatus);
