class PreferenceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUserId(userId) {
    const result = await this.pool.query(
      'SELECT preferences FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async findByUserIds(userIds) {
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `SELECT user_id, preferences FROM user_preferences WHERE user_id IN (${placeholders})`;
    const result = await this.pool.query(query, userIds);
    return result.rows;
  }

  async upsert(userId, preferences) {
    const result = await this.pool.query(
      `INSERT INTO user_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         preferences = user_preferences.preferences || $2::JSONB,
         updated_at = CURRENT_TIMESTAMP
       RETURNING preferences`,
      [userId, JSON.stringify(preferences)]
    );
    return result.rows[0];
  }
}

module.exports = PreferenceRepository;
