const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./config/database');

// 路由模組
const userRoutes = require('./routes/users');
const propertyRoutes = require('./routes/properties');
const bookingRoutes = require('./routes/bookings');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件設定
app.use(helmet()); // 安全標頭
app.use(compression()); // Gzip 壓縮
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 請求限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15分鐘
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 限制每個IP最多100個請求
  message: {
    error: '請求過於頻繁，請稍後再試',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use(limiter);

// 解析請求體
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日誌記錄
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// 健康檢查端點
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'StaySync API 服務正常運行',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API 路由
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/properties`, propertyRoutes);
app.use(`${API_PREFIX}/bookings`, bookingRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);

// 根路由 - API 資訊
app.get('/', (req, res) => {
  res.json({
    name: 'StaySync API',
    version: '1.0.0',
    description: '台灣民宿訂房系統 API 服務',
    endpoints: {
      health: '/health',
      users: `${API_PREFIX}/users`,
      properties: `${API_PREFIX}/properties`,
      bookings: `${API_PREFIX}/bookings`,
      reports: `${API_PREFIX}/reports`
    },
    documentation: '/api/docs'
  });
});

// 404 錯誤處理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '找不到請求的資源',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl
  });
});

// 全局錯誤處理中間件
app.use((error, req, res, next) => {
  console.error('服務器錯誤:', error);

  // 資料庫錯誤
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: '資料重複，請檢查輸入的資訊',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      error: '參考的資料不存在',
      code: 'INVALID_REFERENCE'
    });
  }

  // Joi 驗證錯誤
  if (error.isJoi) {
    return res.status(400).json({
      error: '輸入資料格式錯誤',
      code: 'VALIDATION_ERROR',
      details: error.details.map(detail => detail.message)
    });
  }

  // 預設錯誤回應
  res.status(error.status || 500).json({
    error: error.message || '伺服器內部錯誤',
    code: error.code || 'INTERNAL_SERVER_ERROR'
  });
});

// 優雅關閉處理
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉伺服器...');
  server.close(() => {
    console.log('HTTP 伺服器已關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信號，正在關閉伺服器...');
  server.close(() => {
    console.log('HTTP 伺服器已關閉');
    process.exit(0);
  });
});

// 啟動伺服器
async function startServer() {
  try {
    // 測試資料庫連接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ 無法連接到資料庫，伺服器啟動失敗');
      process.exit(1);
    }

    // 啟動 HTTP 伺服器
    const server = app.listen(PORT, () => {
      console.log(`🚀 StaySync API 伺服器已啟動`);
      console.log(`📍 伺服器地址: http://localhost:${PORT}`);
      console.log(`📚 API 文件: http://localhost:${PORT}/api/docs`);
      console.log(`💾 環境: ${process.env.NODE_ENV || 'development'}`);
    });

    return server;
  } catch (error) {
    console.error('啟動伺服器時發生錯誤:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案則啟動伺服器
if (require.main === module) {
  startServer();
}

module.exports = app;