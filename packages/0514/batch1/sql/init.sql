CREATE DATABASE IF NOT EXISTS user_preferences;

\c user_preferences;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_preferences ON user_preferences USING GIN (preferences);

INSERT INTO user_preferences (user_id, preferences) VALUES
  ('user1', '{"theme": "dark", "language": "zh-CN", "notifications": true}'::JSONB),
  ('user2', '{"theme": "light", "language": "en-US", "notifications": false}'::JSONB)
ON CONFLICT (user_id) DO NOTHING;
