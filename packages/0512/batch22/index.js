const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@elastic/elasticsearch');
const ClickHouse = require('clickhouse');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  }
});

const clickhouse = new ClickHouse({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  auth: {
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || ''
  },
  queryOptions: {
    database: process.env.CLICKHOUSE_DATABASE || 'default'
  }
});

const INDEX_NAME = 'documents';
const CLICKHOUSE_TABLE = 'user_clicks';

const escapeSpecialChars = (query) => {
  const specialChars = /[+\-=&|!(){}[\]^"~*?:\\/]/g;
  return query.replace(specialChars, '\\$&');
};

const recordClick = async (documentId, userId, sessionId, searchQuery = null) => {
  try {
    const clickId = uuidv4();
    const clickTime = new Date().toISOString();
    
    await clickhouse.insert({
      table: CLICKHOUSE_TABLE,
      values: [{
        click_id: clickId,
        document_id: documentId,
        user_id: userId || 'anonymous',
        session_id: sessionId || uuidv4(),
        search_query: searchQuery,
        click_time: clickTime,
        created_at: clickTime
      }],
      format: 'JSONEachRow'
    });
    
    return clickId;
  } catch (error) {
    console.error('Failed to record click:', error);
    return null;
  }
};

const setupClickHouseTable = async () => {
  try {
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_TABLE} (
        click_id String,
        document_id String,
        user_id String,
        session_id String,
        search_query Nullable(String),
        click_time DateTime,
        created_at DateTime
      ) ENGINE = MergeTree()
      ORDER BY (click_time, click_id)
      PARTITION BY toYYYYMM(click_time)
    `).toPromise();
    console.log('ClickHouse table setup completed');
  } catch (error) {
    console.error('Failed to setup ClickHouse table:', error);
  }
};

app.get('/documents/:id/similar', async (req, res) => {
  try {
    const { id } = req.params;
    const { size = 5, userId, sessionId, searchQuery } = req.query;

    await recordClick(id, userId, sessionId, searchQuery);

    const result = await client.search({
      index: INDEX_NAME,
      query: {
        more_like_this: {
          fields: ['title', 'content'],
          like: {
            _index: INDEX_NAME,
            _id: id
          },
          min_term_freq: 1,
          max_query_terms: 25,
          min_doc_freq: 1
        }
      },
      size: parseInt(size),
      highlight: {
        fields: {
          title: {
            type: 'plain',
            number_of_fragments: 1,
            fragment_size: 150
          },
          content: {
            type: 'plain',
            number_of_fragments: 2,
            fragment_size: 150
          }
        },
        pre_tags: ['<em>'],
        post_tags: ['</em>']
      }
    });

    const similarDocs = result.hits.hits.map(hit => ({
      id: hit._id,
      title: hit._source.title,
      titleHighlight: hit.highlight?.title || [],
      contentHighlight: hit.highlight?.content || [],
      score: hit._score
    }));

    res.json({
      total: result.hits.total.value,
      size: parseInt(size),
      data: similarDocs
    });
  } catch (error) {
    console.error('Similar documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/search', async (req, res) => {
  try {
    const { query, filters = {}, page = 1, size = 10 } = req.body;

    const esQuery = {
      bool: {
        must: [],
        filter: []
      }
    };

    if (query) {
      const escapedQuery = escapeSpecialChars(query);
      esQuery.bool.must.push({
        multi_match: {
          query: escapedQuery,
          fields: ['title^3', 'content'],
          analyzer: 'ik_max_word'
        }
      });
    }

    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        esQuery.bool.filter.push({
          term: { [key]: filters[key] }
        });
      }
    });

    const from = (page - 1) * size;

    const result = await client.search({
      index: INDEX_NAME,
      query: esQuery.bool.must.length > 0 || esQuery.bool.filter.length > 0 ? esQuery : { match_all: {} },
      from: from,
      size: size,
      highlight: {
        fields: {
          title: {
            type: 'plain',
            number_of_fragments: 1,
            fragment_size: 150
          },
          content: {
            type: 'plain',
            number_of_fragments: 3,
            fragment_size: 200
          }
        },
        pre_tags: ['<em>'],
        post_tags: ['</em>']
      }
    });

    const hits = result.hits.hits.map(hit => ({
      id: hit._id,
      title: hit._source.title,
      titleHighlight: hit.highlight?.title || [],
      contentHighlight: hit.highlight?.content || []
    }));

    res.json({
      total: result.hits.total.value,
      page: page,
      size: size,
      data: hits
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/documents', async (req, res) => {
  try {
    const { title, content, ...metadata } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const result = await client.index({
      index: INDEX_NAME,
      document: {
        title,
        content,
        ...metadata,
        createdAt: new Date().toISOString()
      }
    });

    res.json({ id: result._id, message: 'Document created' });
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/documents/:id', async (req, res) => {
  try {
    const result = await client.get({
      index: INDEX_NAME,
      id: req.params.id
    });

    res.json(result._source);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(404).json({ error: 'Document not found' });
  }
});

app.delete('/documents/:id', async (req, res) => {
  try {
    const result = await client.delete({
      index: INDEX_NAME,
      id: req.params.id
    });

    res.json({ id: req.params.id, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(404).json({ error: 'Document not found' });
  }
});

app.put('/documents/:id', async (req, res) => {
  try {
    const { title, content, ...metadata } = req.body;

    const result = await client.update({
      index: INDEX_NAME,
      id: req.params.id,
      doc: {
        ...(title && { title }),
        ...(content && { content }),
        ...metadata,
        updatedAt: new Date().toISOString()
      }
    });

    res.json({ id: req.params.id, message: 'Document updated' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(404).json({ error: 'Document not found' });
  }
});

const setupIndex = async () => {
  try {
    const exists = await client.indices.exists({ index: INDEX_NAME });
    
    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            title: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_smart'
            },
            content: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_smart'
            },
            createdAt: {
              type: 'date'
            },
            updatedAt: {
              type: 'date'
            }
          }
        }
      });
      console.log('Index created with IK analyzer');
    } else {
      console.log('Index already exists');
    }
  } catch (error) {
    console.error('Setup index error:', error);
  }
};

app.listen(port, async () => {
  await setupIndex();
  await setupClickHouseTable();
  console.log(`Server running on port ${port}`);
});
