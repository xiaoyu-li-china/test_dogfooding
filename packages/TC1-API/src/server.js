const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(config.port, () => {
      console.log(`服务器运行在端口 ${config.port}`);
      console.log(`访问地址: http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
