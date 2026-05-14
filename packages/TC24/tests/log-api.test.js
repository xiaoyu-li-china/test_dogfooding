const request = require('supertest');
const { Client } = require('@elastic/elasticsearch');
const { app, initES } = require('../server');

const esClient = new Client({ node: process.env.ES_NODE });

async function waitForIndexRefresh() {
  await esClient.indices.refresh({ index: 'application_logs' });
  await new Promise(r => setTimeout(r, 500));
}

describe('Log API Integration Tests', () => {
  beforeEach(async () => {
    await initES();
  });

  describe('1. Index Auto-creation', () => {
    test('should create index automatically when writing first log', async () => {
      const indexExistsBefore = await esClient.indices.exists({ index: 'application_logs' });
      expect(indexExistsBefore).toBe(false);

      const response = await request(app)
        .post('/log')
        .send({
          level: 'info',
          message: 'Test log message',
          metadata: { test: true }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBeDefined();

      const indexExistsAfter = await esClient.indices.exists({ index: 'application_logs' });
      expect(indexExistsAfter).toBe(true);
    });

    test('should create index with correct mappings', async () => {
      await request(app)
        .post('/log')
        .send({
          level: 'error',
          message: 'Mapping test',
          metadata: { foo: 'bar' }
        });

      await waitForIndexRefresh();

      const mapping = await esClient.indices.getMapping({ index: 'application_logs' });
      const properties = mapping.application_logs.mappings.properties;

      expect(properties.level.type).toBe('keyword');
      expect(properties.message.type).toBe('text');
      expect(properties.timestamp.type).toBe('date');
      expect(properties.metadata).toBeDefined();
    });
  });

  describe('2. Log Writing API', () => {
    test('should accept valid log with all fields', async () => {
      const response = await request(app)
        .post('/log')
        .send({
          level: 'warn',
          message: 'User authentication failed',
          metadata: {
            userId: 12345,
            ipAddress: '192.168.1.1',
            attempt: 3
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      await waitForIndexRefresh();

      const doc = await esClient.get({
        index: 'application_logs',
        id: response.body.id
      });

      expect(doc._source.level).toBe('warn');
      expect(doc._source.message).toBe('User authentication failed');
      expect(doc._source.metadata.userId).toBe(12345);
      expect(doc._source.timestamp).toBeDefined();
    });

    test('should accept log without metadata', async () => {
      const response = await request(app)
        .post('/log')
        .send({
          level: 'info',
          message: 'Simple log without metadata'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('should normalize level to lowercase', async () => {
      const response = await request(app)
        .post('/log')
        .send({
          level: 'ERROR',
          message: 'Uppercase level test'
        });

      expect(response.status).toBe(201);

      await waitForIndexRefresh();

      const doc = await esClient.get({
        index: 'application_logs',
        id: response.body.id
      });

      expect(doc._source.level).toBe('error');
    });

    test('should return 400 for missing level', async () => {
      const response = await request(app)
        .post('/log')
        .send({
          message: 'Missing level field'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should return 400 for missing message', async () => {
      const response = await request(app)
        .post('/log')
        .send({
          level: 'info'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('3. Query Conditions Combination', () => {
    const testLogs = [
      { level: 'error', message: 'Error 1', metadata: { service: 'api' } },
      { level: 'error', message: 'Error 2', metadata: { service: 'worker' } },
      { level: 'warn', message: 'Warning 1', metadata: { service: 'api' } },
      { level: 'info', message: 'Info 1', metadata: { service: 'api' } },
      { level: 'debug', message: 'Debug 1', metadata: { service: 'db' } },
      { level: 'error', message: 'Error 3', metadata: { service: 'api' } },
    ];

    beforeEach(async () => {
      for (const log of testLogs) {
        await request(app).post('/log').send(log);
      }
      await waitForIndexRefresh();
    });

    test('should filter by level=error', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'error' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toHaveLength(3);
      response.body.logs.forEach(log => {
        expect(log.level).toBe('error');
      });
    });

    test('should filter by level=warn', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'warn' });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].level).toBe('warn');
    });

    test('should filter by level=info', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'info' });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
    });

    test('should filter by level=debug', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'debug' });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
    });

    test('should return empty array for non-existent level', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'fatal' });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(0);
    });

    test('should handle case-insensitive level query', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'ERROR' });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(3);
    });

    test('should return all logs when no filters', async () => {
      const response = await request(app)
        .get('/logs/search');

      expect(response.status).toBe(200);
      expect(response.body.logs.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('4. Pagination Parameters', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 25; i++) {
        await request(app).post('/log').send({
          level: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warn' : 'info',
          message: `Log message ${i}`,
          metadata: { index: i }
        });
      }
      await waitForIndexRefresh();
    });

    test('should respect size parameter', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ size: 5 });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(5);
    });

    test('should return default size when not specified', async () => {
      const response = await request(app)
        .get('/logs/search');

      expect(response.status).toBe(200);
      expect(response.body.logs.length).toBeLessThanOrEqual(100);
    });

    test('should handle size=10', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ size: 10 });

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(10);
    });

    test('should handle size=20 with level filter', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'error', size: 20 });

      expect(response.status).toBe(200);
      expect(response.body.logs.length).toBe(8);
    });

    test('should sort logs by timestamp descending', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ size: 5 });

      expect(response.status).toBe(200);
      const logs = response.body.logs;
      
      for (let i = 0; i < logs.length - 1; i++) {
        const currentTime = new Date(logs[i].timestamp).getTime();
        const nextTime = new Date(logs[i + 1].timestamp).getTime();
        expect(currentTime).toBeGreaterThanOrEqual(nextTime);
      }
    });

    test('should return correct total count in response', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ size: 5 });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(25);
    });

    test('should return filtered total count', async () => {
      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'error', size: 5 });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(8);
    });
  });

  describe('5. Edge Cases', () => {
    test('should handle empty database', async () => {
      const response = await request(app)
        .get('/logs/search');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    test('should handle time_range parameter', async () => {
      await request(app).post('/log').send({
        level: 'info',
        message: 'Time range test'
      });
      await waitForIndexRefresh();

      const response = await request(app)
        .get('/logs/search')
        .query({ time_range: '1h' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    test('should handle multiple time_range formats', async () => {
      await request(app).post('/log').send({
        level: 'info',
        message: 'Time range format test'
      });
      await waitForIndexRefresh();

      const timeRanges = ['15m', '1h', '6h', '24h', '7d'];
      
      for (const range of timeRanges) {
        const response = await request(app)
          .get('/logs/search')
          .query({ time_range: range });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should handle invalid time_range gracefully', async () => {
      await request(app).post('/log').send({
        level: 'info',
        message: 'Invalid time range test'
      });
      await waitForIndexRefresh();

      const response = await request(app)
        .get('/logs/search')
        .query({ time_range: 'invalid' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle combined level and time_range filters', async () => {
      await request(app).post('/log').send({
        level: 'error',
        message: 'Combined filter test'
      });
      await waitForIndexRefresh();

      const response = await request(app)
        .get('/logs/search')
        .query({ level: 'error', time_range: '1h' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.logs.forEach(log => {
        expect(log.level).toBe('error');
      });
    });
  });
});
