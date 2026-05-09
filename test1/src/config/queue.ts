export const QUEUE_CONFIG = {
  MAX_RETRY_COUNT: 5,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 60000,
  BACKOFF_FACTOR: 2,
  POLL_INTERVAL_MS: 5000,
  JITTER_MS: 1000,
};

export function calculateNextRetryDelay(retryCount: number): number {
  const baseDelay = QUEUE_CONFIG.INITIAL_DELAY_MS * Math.pow(QUEUE_CONFIG.BACKOFF_FACTOR, retryCount);
  const delay = Math.min(baseDelay, QUEUE_CONFIG.MAX_DELAY_MS);
  const jitter = Math.random() * QUEUE_CONFIG.JITTER_MS;
  return Math.floor(delay + jitter);
}
