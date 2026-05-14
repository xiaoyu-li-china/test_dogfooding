const { ElasticsearchContainer } = require('@testcontainers/elasticsearch');
const { Client } = require('@elastic/elasticsearch');

let esContainer;
let esClient;

beforeAll(async () => {
  console.log('Starting Elasticsearch container...');
  esContainer = await new ElasticsearchContainer('docker.elastic.co/elasticsearch/elasticsearch:8.15.0')
    .withEnvironment({
      'xpack.security.enabled': 'false',
      'discovery.type': 'single-node'
    })
    .withExposedPorts(9200)
    .start();

  const esUrl = `http://${esContainer.getHost()}:${esContainer.getMappedPort(9200)}`;
  console.log('Elasticsearch running at:', esUrl);

  process.env.ES_NODE = esUrl;
  
  esClient = new Client({ node: esUrl });
  
  const waitForEs = async () => {
    for (let i = 0; i < 30; i++) {
      try {
        await esClient.cluster.health();
        return;
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw new Error('Elasticsearch failed to start');
  };
  await waitForEs();
}, 180000);

afterAll(async () => {
  if (esClient) {
    await esClient.close();
  }
  if (esContainer) {
    await esContainer.stop();
  }
});

beforeEach(async () => {
  try {
    await esClient.indices.delete({ index: 'application_logs' });
  } catch (e) {
  }
  await new Promise(r => setTimeout(r, 100));
});

module.exports = { esClient };
