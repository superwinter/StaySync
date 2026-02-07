#!/usr/bin/env node

/**
 * StaySync API 快速測試腳本
 * 用於驗證 API 服務是否正常運作
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// 測試結果統計
let testResults = {
  total: 0,
  passed: 0,
  failed: 0
};

// 顏色輸出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 請求封裝
function makeRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            data: parsedBody
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 測試函數
async function runTest(testName, testFn) {
  testResults.total++;
  try {
    log('blue', `🧪 測試: ${testName}`);
    await testFn();
    testResults.passed++;
    log('green', `✅ ${testName} - 通過`);
  } catch (error) {
    testResults.failed++;
    log('red', `❌ ${testName} - 失敗: ${error.message}`);
  }
  console.log('');
}

// 斷言函數
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// 測試用例
async function testHealthCheck() {
  const response = await makeRequest('GET', `${BASE_URL}/health`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.status === 'OK', '健康檢查應該返回 OK');
}

async function testApiRoot() {
  const response = await makeRequest('GET', BASE_URL);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.name === 'StaySync API', 'API 名稱不正確');
}

async function testGetUsers() {
  const response = await makeRequest('GET', `${API_BASE}/users`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  assert(Array.isArray(response.data.data), '用戶數據應該是數組');
  log('yellow', `   📊 找到 ${response.data.data.length} 位用戶`);
}

async function testGetProperties() {
  const response = await makeRequest('GET', `${API_BASE}/properties`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  assert(Array.isArray(response.data.data), '房源數據應該是數組');
  log('yellow', `   🏠 找到 ${response.data.data.length} 間房源`);
}

async function testGetBookings() {
  const response = await makeRequest('GET', `${API_BASE}/bookings`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  assert(Array.isArray(response.data.data), '訂房數據應該是數組');
  log('yellow', `   📅 找到 ${response.data.data.length} 筆訂房`);
}

async function testPropertySearch() {
  const response = await makeRequest('GET', `${API_BASE}/properties?city=宜蘭縣`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  const yilanProperties = response.data.data.filter(p => p.city === '宜蘭縣');
  assert(yilanProperties.length > 0, '應該找到宜蘭縣的房源');
  log('yellow', `   🔍 宜蘭縣搜索結果: ${yilanProperties.length} 間房源`);
}

async function testBookingDashboard() {
  const response = await makeRequest('GET', `${API_BASE}/bookings/dashboard/summary`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  assert(typeof response.data.data.overview === 'object', '儀表板數據格式不正確');
  log('yellow', `   📊 總訂房數: ${response.data.data.overview.total_bookings}`);
}

async function testRevenueReport() {
  const response = await makeRequest('GET', `${API_BASE}/reports/revenue?group_by=month`);
  assert(response.statusCode === 200, `期望狀態碼 200，實際 ${response.statusCode}`);
  assert(response.data.success === true, '回應格式不正確');
  assert(Array.isArray(response.data.data.periods), '營收報表數據格式不正確');
  log('yellow', `   💰 總營收: NT$ ${response.data.data.summary.total_revenue || 0}`);
}

async function testCreateBooking() {
  // 首先獲取可用的房源
  const propertiesResponse = await makeRequest('GET', `${API_BASE}/properties`);
  assert(propertiesResponse.data.data.length > 0, '需要至少一個房源來測試');

  const propertyId = propertiesResponse.data.data[0].property_id;

  const bookingData = {
    property_id: propertyId,
    source_channel: '官網直訂',
    guest_name: '測試客戶',
    guest_id_no: 'T123456789',
    check_in: '2026-05-01',
    check_out: '2026-05-03',
    total_amount: 6000,
    breakfast_included: true,
    special_note: 'API 測試訂房'
  };

  const response = await makeRequest('POST', `${API_BASE}/bookings`, bookingData);

  if (response.statusCode === 409) {
    log('yellow', '   ⚠️  日期衝突，這是正常的（表示衝突檢查正常運作）');
    return; // 日期衝突不算測試失敗
  }

  assert(response.statusCode === 201, `期望狀態碼 201，實際 ${response.statusCode}`);
  assert(response.data.success === true, '創建訂房回應格式不正確');
  assert(response.data.data.guest_name === '測試客戶', '客人姓名不符');

  // 清理測試資料
  const bookingId = response.data.data.booking_id;
  await makeRequest('PATCH', `${API_BASE}/bookings/${bookingId}/status`, { status: '已取消' });
  await makeRequest('DELETE', `${API_BASE}/bookings/${bookingId}`);

  log('yellow', `   📝 成功創建並清理測試訂房 ID: ${bookingId}`);
}

async function testErrorHandling() {
  // 測試 404 錯誤
  const response = await makeRequest('GET', `${API_BASE}/nonexistent`);
  assert(response.statusCode === 404, '應該返回 404 錯誤');

  // 測試無效的用戶 ID
  const userResponse = await makeRequest('GET', `${API_BASE}/users/99999`);
  assert(userResponse.statusCode === 404, '無效用戶 ID 應該返回 404');
}

// 主測試函數
async function runAllTests() {
  log('blue', '🚀 StaySync API 測試開始');
  log('blue', '================================\n');

  await runTest('健康檢查', testHealthCheck);
  await runTest('API 根目錄', testApiRoot);
  await runTest('獲取用戶列表', testGetUsers);
  await runTest('獲取房源列表', testGetProperties);
  await runTest('獲取訂房列表', testGetBookings);
  await runTest('房源搜索功能', testPropertySearch);
  await runTest('訂房儀表板', testBookingDashboard);
  await runTest('營收報表', testRevenueReport);
  await runTest('創建訂房（含清理）', testCreateBooking);
  await runTest('錯誤處理', testErrorHandling);

  // 測試結果摘要
  log('blue', '================================');
  log('blue', '📋 測試結果摘要:');
  log('green', `✅ 通過: ${testResults.passed}/${testResults.total}`);

  if (testResults.failed > 0) {
    log('red', `❌ 失敗: ${testResults.failed}/${testResults.total}`);
    log('red', '\n⚠️  發現問題，請檢查服務器狀態和資料庫連接');
    process.exit(1);
  } else {
    log('green', '\n🎉 所有測試通過！StaySync API 運行正常');
    log('yellow', '\n💡 提示:');
    log('yellow', '   • API 首頁: http://localhost:3000');
    log('yellow', '   • 健康檢查: http://localhost:3000/health');
    log('yellow', '   • 查看 API_DOCUMENTATION.md 了解更多端點');
  }
}

// 檢查服務器是否運行
async function checkServerStatus() {
  try {
    await makeRequest('GET', `${BASE_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

// 程式入口
(async () => {
  log('blue', '🔍 檢查服務器狀態...');

  const isServerRunning = await checkServerStatus();
  if (!isServerRunning) {
    log('red', '❌ 服務器未運行！');
    log('yellow', '請先執行以下命令啟動服務器:');
    log('yellow', '   npm run dev   # 開發模式');
    log('yellow', '   # 或');
    log('yellow', '   npm start     # 生產模式');
    process.exit(1);
  }

  log('green', '✅ 服務器運行中\n');
  await runAllTests();
})();

module.exports = {
  makeRequest,
  runTest,
  assert
};