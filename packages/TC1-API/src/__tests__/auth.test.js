const request = require('supertest');
const app = require('../app');

describe('Auth API - 注册接口测试', () => {
  const validUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123'
  };

  describe('POST /register', () => {
    it('应该注册成功并返回 201 状态码', async () => {
      const response = await request(app)
        .post('/register')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('注册成功');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe(validUser.username);
      expect(response.body.data.user.email).toBe(validUser.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('重复邮箱注册应该返回 409 状态码', async () => {
      await request(app).post('/register').send(validUser);

      const response = await request(app)
        .post('/register')
        .send({
          username: 'anotheruser',
          email: validUser.email,
          password: 'anotherpassword'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('邮箱已被注册');
    });

    it('密码不足 6 位应该返回 400 状态码', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          username: 'shortpassuser',
          email: 'shortpass@example.com',
          password: '12345'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('Auth API - 登录接口测试', () => {
  const testUser = {
    username: 'loginuser',
    email: 'login@example.com',
    password: 'password123'
  };

  beforeEach(async () => {
    await request(app).post('/register').send(testUser);
  });

  describe('POST /login', () => {
    it('登录成功应该返回 accessToken 和 refreshToken', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(typeof response.body.data.refreshToken).toBe('string');
      expect(response.body.data.accessToken.length).toBeGreaterThan(0);
      expect(response.body.data.refreshToken.length).toBeGreaterThan(0);
    });

    it('错误密码应该返回 401 状态码', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('邮箱或密码错误');
    });

    it('不存在的邮箱应该返回 401 状态码', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('Auth API - 认证中间件测试', () => {
  describe('GET /me', () => {
    it('未携带 token 访问 /me 应该返回 401 状态码', async () => {
      const response = await request(app).get('/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('未提供认证令牌');
    });

    it('携带无效 token 访问 /me 应该返回 401 状态码', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalidtoken123456789');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('携带有效 token 访问 /me 应该返回用户信息', async () => {
      const user = {
        username: 'meuser',
        email: 'me@example.com',
        password: 'password123'
      };

      await request(app).post('/register').send(user);

      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: user.email,
          password: user.password
        });

      const accessToken = loginResponse.body.data.accessToken;

      const meResponse = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.user.username).toBe(user.username);
      expect(meResponse.body.data.user.email).toBe(user.email);
      expect(meResponse.body.data.user.password).toBeUndefined();
    });
  });
});
