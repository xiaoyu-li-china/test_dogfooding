const DEFAULT_PREFERENCES = {
  theme: 'light',
  language: 'zh-CN',
  notifications: true
};

const CACHE_TTL = 300;

class PreferenceService {
  constructor(repository, redisClient) {
    this.repository = repository;
    this.redisClient = redisClient;
  }

  getCacheKey(userId) {
    return `preference:${userId}`;
  }

  async getByUserId(userId) {
    const cacheKey = this.getCacheKey(userId);
    
    try {
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        return { userId, preferences: JSON.parse(cached) };
      }
    } catch (cacheError) {
      console.error('Cache read error:', cacheError);
    }

    const result = await this.repository.findByUserId(userId);
    
    if (!result) {
      return null;
    }

    try {
      await this.redisClient.setEx(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(result.preferences)
      );
    } catch (cacheError) {
      console.error('Cache write error:', cacheError);
    }

    return { userId, preferences: result.preferences };
  }

  async getByUserIds(userIds) {
    const results = [];
    const userIdsToFetch = [];

    for (const userId of userIds) {
      const cacheKey = this.getCacheKey(userId);
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          results.push({ userId, preferences: JSON.parse(cached) });
        } else {
          userIdsToFetch.push(userId);
        }
      } catch (cacheError) {
        console.error('Cache read error:', cacheError);
        userIdsToFetch.push(userId);
      }
    }

    if (userIdsToFetch.length > 0) {
      const dbResults = await this.repository.findByUserIds(userIdsToFetch);
      const dbMap = {};
      
      for (const row of dbResults) {
        dbMap[row.user_id] = row.preferences;
        const cacheKey = this.getCacheKey(row.user_id);
        try {
          await this.redisClient.setEx(
            cacheKey,
            CACHE_TTL,
            JSON.stringify(row.preferences)
          );
        } catch (cacheError) {
          console.error('Cache write error:', cacheError);
        }
      }

      for (const userId of userIdsToFetch) {
        results.push({
          userId,
          preferences: dbMap[userId] || DEFAULT_PREFERENCES
        });
      }
    }

    return userIds.map(userId => 
      results.find(r => r.userId === userId)
    );
  }

  async update(userId, preferences) {
    const result = await this.repository.upsert(userId, preferences);
    const cacheKey = this.getCacheKey(userId);

    try {
      await this.redisClient.setEx(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(result.preferences)
      );
    } catch (cacheError) {
      console.error('Cache update error:', cacheError);
    }

    return { userId, preferences: result.preferences };
  }
}

module.exports = PreferenceService;
