const mysql = require('mysql2/promise');

// 資料庫連接設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'staysync',
  port: parseInt(process.env.DB_PORT) || 3306,
  connectionLimit: 10,
  charset: 'utf8mb4',
  typeCast: true
};

// 創建連接池
const pool = mysql.createPool(dbConfig);

// 測試資料庫連接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ 資料庫連接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error.message);
    return false;
  }
}

// 執行查詢的通用函數
async function executeQuery(query, params = []) {
  try {
    // 確保參數類型正確，特別是數字類型
    const processedParams = params.map(param => {
      if (typeof param === 'string' && /^\d+$/.test(param)) {
        return parseInt(param);
      }
      return param;
    });

    const [results] = await pool.execute(query, processedParams);
    return results;
  } catch (error) {
    console.error('資料庫查詢錯誤:', error);
    throw error;
  }
}

// 執行事務
async function executeTransaction(queries) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params || []);
      results.push(result);
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 關閉資料庫連接池
async function closePool() {
  try {
    await pool.end();
    console.log('資料庫連接池已關閉');
  } catch (error) {
    console.error('關閉資料庫連接池時發生錯誤:', error);
  }
}

module.exports = {
  pool,
  executeQuery,
  executeTransaction,
  testConnection,
  closePool
};