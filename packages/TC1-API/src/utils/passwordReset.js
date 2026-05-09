const crypto = require('crypto');

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const verifyResetToken = (token, hashedToken) => {
  const inputHash = crypto.createHash('sha256').update(token).digest('hex');
  return inputHash === hashedToken;
};

module.exports = {
  generateResetToken,
  hashResetToken,
  verifyResetToken
};
