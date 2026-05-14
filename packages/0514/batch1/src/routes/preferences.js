const express = require('express');
const router = express.Router();

const VALID_KEYS = ['theme', 'language', 'notifications'];

const createPreferenceRoutes = (preferenceService) => {
  router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await preferenceService.getByUserId(userId);

      if (!result) {
        return res.status(404).json({
          error: 'User preferences not found'
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences data' });
    }

    const invalidKeys = Object.keys(preferences).filter(key => !VALID_KEYS.includes(key));

    if (invalidKeys.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid preference keys', 
        invalidKeys 
      });
    }

    try {
      const result = await preferenceService.update(userId, preferences);

      res.json({
        ...result,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/batch', async (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }

    if (userIds.length === 0) {
      return res.json({ users: [] });
    }

    if (userIds.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 users allowed per request',
        requested: userIds.length,
        maximum: 100
      });
    }

    try {
      const results = await preferenceService.getByUserIds(userIds);
      res.json({ users: results });
    } catch (error) {
      console.error('Error fetching batch preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

module.exports = createPreferenceRoutes;
