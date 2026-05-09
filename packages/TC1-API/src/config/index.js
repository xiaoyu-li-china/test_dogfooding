require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: isTest 
    ? 'mongodb://localhost:27017/tc1-auth-test'
    : (process.env.MONGODB_URI || 'mongodb://localhost:27017/tc1-auth'),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
};
