const express = require('express');
const { Client } = require('@elastic/elasticsearch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ES_INDEX = 'application_logs';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const clientConfig = {
  node: process.env.ES_NODE || 'http://localhost:9200'
};

if (process.env.ES_USER && process.env.ES_PASSWORD) {
  clientConfig.auth = {
    username: process.env.ES_USER,
    password: process.env.ES_PASSWORD
  };
}

const client = new Client(clientConfig);

async function initES() {
  try {
    const indexExists = await client.indices.exists({ index: ES_INDEX });
    if (!indexExists) {
      await client.indices.create({
        index: ES_INDEX,
        mappings: {
          properties: {
            level: { type: 'keyword' },
            message: { type: 'text' },
            metadata: { type: 'object', enabled: true },
            timestamp: { type: 'date' }
          }
        }
      });
      console.log(`Index ${ES_INDEX} created`);
    }
    console.log('Elasticsearch connected successfully');
  } catch (error) {
    console.error('Elasticsearch connection error:', error.message);
  }
}

app.post('/log', async (req, res) => {
  try {
    const { level, message, metadata } = req.body;
    
    if (!level || !message) {
      return res.status(400).json({ error: 'level and message are required' });
    }

    const result = await client.index({
      index: ES_INDEX,
      document: {
        level: level.toLowerCase(),
        message,
        metadata: metadata || {},
        timestamp: new Date().toISOString()
      }
    });

    res.status(201).json({ 
      success: true, 
      id: result._id 
    });
  } catch (error) {
    console.error('Error writing log:', error);
    res.status(500).json({ error: 'Failed to write log' });
  }
});

app.get('/logs/search', async (req, res) => {
  try {
    const { level, time_range, size = 100 } = req.query;
    
    const must = [];
    
    if (level) {
      must.push({ term: { level: level.toLowerCase() } });
    }
    
    if (time_range) {
      const range = {};
      const unit = time_range.slice(-1);
      const value = parseInt(time_range.slice(0, -1));
      
      let gte;
      switch (unit) {
        case 'm':
          gte = `now-${value}m`;
          break;
        case 'h':
          gte = `now-${value}h`;
          break;
        case 'd':
          gte = `now-${value}d`;
          break;
        default:
          gte = `now-1h`;
      }
      
      must.push({ range: { timestamp: { gte } } });
    }

    const query = must.length > 0 
      ? { bool: { must } }
      : { match_all: {} };

    const result = await client.search({
      index: ES_INDEX,
      query,
      sort: [{ timestamp: { order: 'desc' } }],
      size: parseInt(size)
    });

    const logs = result.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source
    }));

    res.json({
      success: true,
      total: result.hits.total.value,
      logs
    });
  } catch (error) {
    console.error('Error searching logs:', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initES();
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, initES };
