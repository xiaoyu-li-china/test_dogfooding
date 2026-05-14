const request = require('supertest');
const { Client } = require('@elastic/elasticsearch');
const { test: tcTest, after } = require('@elastic/elasticsearch/lib/test');

describe('Search API Integration Tests', () => {
  let server;
  let client;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    
    await tcTest.startElasticsearch();
    
    process.env.ELASTICSEARCH_URL = tcTest.getUrl();
    process.env.ELASTICSEARCH_USER = 'elastic';
    process.env.ELASTICSEARCH_PASSWORD = tcTest.getPassword();
    process.env.CLICKHOUSE_URL = 'http://localhost:8123';
    process.env.CLICKHOUSE_USER = 'default';
    process.env.CLICKHOUSE_PASSWORD = '';
    
    const app = require('../index');
    server = app.listen(0);
    
    client = new Client({
      node: tcTest.getUrl(),
      auth: {
        username: 'elastic',
        password: tcTest.getPassword()
      }
    });
  });

  afterAll(async () => {
    await server.close();
    await tcTest.stopElasticsearch();
    process.env = originalEnv;
  });

  beforeEach(async () => {
    const exists = await client.indices.exists({ index: 'documents' });
    if (exists) {
      await client.indices.delete({ index: 'documents' });
    }
  });

  test('should create index with IK analyzer', async () => {
    const response = await request(server)
      .post('/documents')
      .send({
        title: '测试文档标题',
        content: '这是测试文档的内容'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.message).toBe('Document created');

    const mapping = await client.indices.getMapping({ index: 'documents' });
    expect(mapping.documents.mappings.properties.title.analyzer).toBe('ik_max_word');
    expect(mapping.documents.mappings.properties.content.analyzer).toBe('ik_max_word');
  });

  test('should index document and return id', async () => {
    const response = await request(server)
      .post('/documents')
      .send({
        title: '人工智能入门指南',
        content: '人工智能是计算机科学的一个分支，致力于研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。',
        category: '技术'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.message).toBe('Document created');

    const doc = await client.get({ index: 'documents', id: response.body.id });
    expect(doc._source.title).toBe('人工智能入门指南');
    expect(doc._source.content).toContain('人工智能');
    expect(doc._source.category).toBe('技术');
  });

  test('should search documents with query', async () => {
    await request(server)
      .post('/documents')
      .send({
        title: '人工智能入门指南',
        content: '人工智能是计算机科学的一个分支'
      });

    await request(server)
      .post('/documents')
      .send({
        title: '机器学习实战',
        content: '机器学习是人工智能的核心技术之一'
      });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(server)
      .post('/search')
      .send({
        query: '人工智能',
        page: 1,
        size: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('should return highlight fragments in search results', async () => {
    await request(server)
      .post('/documents')
      .send({
        title: 'Elasticsearch 中文搜索教程',
        content: 'Elasticsearch 是一个分布式、RESTful 风格的搜索和数据分析引擎'
      });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(server)
      .post('/search')
      .send({
        query: 'Elasticsearch',
        page: 1,
        size: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0].titleHighlight).toBeInstanceOf(Array);
    expect(response.body.data[0].titleHighlight[0]).toContain('<em>');
    expect(response.body.data[0].contentHighlight).toBeInstanceOf(Array);
    expect(response.body.data[0].contentHighlight[0]).toContain('<em>');
  });

  test('should support filters in search', async () => {
    await request(server)
      .post('/documents')
      .send({
        title: '技术文档A',
        content: '技术内容A',
        category: '技术'
      });

    await request(server)
      .post('/documents')
      .send({
        title: '娱乐文档B',
        content: '娱乐内容B',
        category: '娱乐'
      });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(server)
      .post('/search')
      .send({
        query: '文档',
        filters: { category: '技术' },
        page: 1,
        size: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0].title).toBe('技术文档A');
  });

  test('should escape special characters in query', async () => {
    await request(server)
      .post('/documents')
      .send({
        title: 'C++ 编程指南',
        content: 'C++ 是一种强大的编程语言'
      });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(server)
      .post('/search')
      .send({
        query: 'C++',
        page: 1,
        size: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0].title).toBe('C++ 编程指南');
  });

  test('should return similar documents using more_like_this', async () => {
    const doc1 = await request(server)
      .post('/documents')
      .send({
        title: '人工智能入门',
        content: '人工智能基础概念和应用'
      });

    await request(server)
      .post('/documents')
      .send({
        title: '人工智能进阶',
        content: '深入学习人工智能技术'
      });

    await request(server)
      .post('/documents')
      .send({
        title: '烹饪教程',
        content: '各种美食制作方法'
      });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(server)
      .get(`/documents/${doc1.body.id}/similar`)
      .query({ size: 2 });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data[0].title).toBe('人工智能进阶');
  });

  test('should get document by id', async () => {
    const createResponse = await request(server)
      .post('/documents')
      .send({
        title: '测试文档',
        content: '测试内容'
      });

    const getResponse = await request(server)
      .get(`/documents/${createResponse.body.id}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.title).toBe('测试文档');
    expect(getResponse.body.content).toBe('测试内容');
  });

  test('should update document', async () => {
    const createResponse = await request(server)
      .post('/documents')
      .send({
        title: '原始标题',
        content: '原始内容'
      });

    const updateResponse = await request(server)
      .put(`/documents/${createResponse.body.id}`)
      .send({
        title: '更新后的标题',
        content: '更新后的内容'
      });

    expect(updateResponse.status).toBe(200);

    const getResponse = await request(server)
      .get(`/documents/${createResponse.body.id}`);

    expect(getResponse.body.title).toBe('更新后的标题');
    expect(getResponse.body.content).toBe('更新后的内容');
  });

  test('should delete document', async () => {
    const createResponse = await request(server)
      .post('/documents')
      .send({
        title: '要删除的文档',
        content: '内容'
      });

    const deleteResponse = await request(server)
      .delete(`/documents/${createResponse.body.id}`);

    expect(deleteResponse.status).toBe(200);

    const getResponse = await request(server)
      .get(`/documents/${createResponse.body.id}`);

    expect(getResponse.status).toBe(404);
  });
});