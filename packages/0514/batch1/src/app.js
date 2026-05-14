const express = require('express');
const pool = require('./config/db');
const redisClient = require('./config/redis');
const PreferenceRepository = require('./repositories/PreferenceRepository');
const PreferenceService = require('./services/PreferenceService');
const createPreferenceRoutes = require('./routes/preferences');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const preferenceRepository = new PreferenceRepository(pool);
const preferenceService = new PreferenceService(preferenceRepository, redisClient);
const preferenceRoutes = createPreferenceRoutes(preferenceService);

app.use('/preferences', preferenceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'User Preferences API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
