const { Client } = require('@elastic/elasticsearch');

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

const INDEX_NAME = 'application_logs';

const INDEX_MAPPINGS = {
  mappings: {
    properties: {
      level: { type: 'keyword' },
      message: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
      metadata: { type: 'object', enabled: true, dynamic: true },
      timestamp: { type: 'date' }
    }
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    index: {
      refresh_interval: '5s'
    }
  }
};

async function initIndex() {
  try {
    console.log(`Checking if index '${INDEX_NAME}' exists...`);
    
    const indexExists = await client.indices.exists({ index: INDEX_NAME });
    
    if (indexExists) {
      console.log(`Index '${INDEX_NAME}' already exists.`);
      console.log('Checking mappings...');
      
      const currentMapping = await client.indices.getMapping({ index: INDEX_NAME });
      const currentProps = currentMapping[INDEX_NAME].mappings.properties || {};
      const desiredProps = INDEX_MAPPINGS.mappings.properties;
      
      const needsUpdate = JSON.stringify(currentProps) !== JSON.stringify(desiredProps);
      
      if (needsUpdate) {
        console.log('Mappings differ, updating...');
        await client.indices.putMapping({
          index: INDEX_NAME,
          properties: desiredProps
        });
        console.log('Mappings updated successfully.');
      } else {
        console.log('Mappings are up to date.');
      }
    } else {
      console.log(`Creating index '${INDEX_NAME}'...`);
      await client.indices.create({
        index: INDEX_NAME,
        ...INDEX_MAPPINGS
      });
      console.log(`Index '${INDEX_NAME}' created successfully.`);
    }

    console.log('\nIndex configuration:');
    console.log(JSON.stringify(INDEX_MAPPINGS, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize index:', error.message);
    if (error.meta && error.meta.body) {
      console.error('Elasticsearch error:', JSON.stringify(error.meta.body, null, 2));
    }
    process.exit(1);
  }
}

console.log('Connecting to Elasticsearch:', process.env.ES_NODE || 'http://localhost:9200');
initIndex();
