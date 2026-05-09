const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TC1 API - 用户认证系统',
    endpoints: {
      register: 'POST /register',
      login: 'POST /login',
      forgotPassword: 'POST /forgot-password',
      resetPassword: 'POST /reset-password',
      refreshToken: 'POST /refresh-token',
      getCurrentUser: 'GET /me (需要认证)',
      logout: 'POST /logout (需要认证)'
    }
  });
});

app.use('/', authRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

module.exports = app;
