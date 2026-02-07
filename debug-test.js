// 簡單的資料庫測試腳本
const { executeQuery, testConnection } = require('./config/database');

async function testDatabaseOperations() {
  console.log('🔍 測試資料庫操作...');

  try {
    // 測試連接
    const isConnected = await testConnection();
    console.log('✅ 資料庫連接:', isConnected ? '成功' : '失敗');

    if (!isConnected) {
      return;
    }

    // 測試基本查詢
    console.log('\n📊 測試基本查詢...');
    const users = await executeQuery('SELECT COUNT(*) as count FROM Users');
    console.log('用戶數量:', users[0]?.count);

    const properties = await executeQuery('SELECT COUNT(*) as count FROM Properties');
    console.log('房源數量:', properties[0]?.count);

    const bookings = await executeQuery('SELECT COUNT(*) as count FROM Bookings');
    console.log('訂房數量:', bookings[0]?.count);

    // 測試分頁查詢（Users）
    console.log('\n📋 測試用戶分頁查詢...');
    const userList = await executeQuery(
      'SELECT user_id, full_name, email FROM Users ORDER BY created_at DESC LIMIT 10 OFFSET 0'
    );
    console.log('用戶列表結果:', userList.length, '筆記錄');
    console.log('第一個用戶:', userList[0]);

    // 測試房源查詢
    console.log('\n🏠 測試房源查詢...');
    const propertyList = await executeQuery(`
      SELECT p.*, u.full_name as owner_name
      FROM Properties p
      JOIN Users u ON p.owner_id = u.user_id
      LIMIT 10 OFFSET 0
    `);
    console.log('房源列表結果:', propertyList.length, '筆記錄');
    console.log('第一個房源:', propertyList[0]);

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    console.error('錯誤詳情:', error.message);
    console.error('錯誤代碼:', error.code);
  }
}

// 執行測試
testDatabaseOperations().then(() => {
  console.log('\n✅ 測試完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});