const express = require('express');
const { executeQuery } = require('../config/database');
const { userSchemas, querySchemas, validateSchema } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

/**
 * @route GET /api/v1/users
 * @desc 獲取所有用戶列表（支持分頁）
 */
router.get('/',
  validateSchema(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }), 'query'),
  async (req, res) => {
    try {
      const { page, limit } = req.query;

      // 確保分頁參數是數字類型
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      // 獲取用戶總數
      const [totalResult] = await executeQuery('SELECT COUNT(*) as total FROM Users');
      const total = totalResult.total;

      // 獲取用戶列表
      const users = await executeQuery(
        `SELECT user_id, full_name, email, company_tax_id, phone,
                bank_code, bank_account, created_at
         FROM Users
         ORDER BY created_at DESC
         LIMIT ${limitNum} OFFSET ${offset}`
      );

      res.json({
        success: true,
        data: users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('獲取用戶列表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取用戶列表失敗',
        code: 'GET_USERS_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/users/:id
 * @desc 獲取特定用戶資訊
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: '無效的用戶ID',
        code: 'INVALID_USER_ID'
      });
    }

    const users = await executeQuery(
      `SELECT user_id, full_name, email, company_tax_id, phone,
              bank_code, bank_account, created_at
       FROM Users
       WHERE user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的用戶',
        code: 'USER_NOT_FOUND'
      });
    }

    // 獲取用戶的房源統計
    const [propertyStats] = await executeQuery(
      `SELECT COUNT(*) as property_count,
              COALESCE(AVG(base_price_twd), 0) as avg_price
       FROM Properties
       WHERE owner_id = ?`,
      [userId]
    );

    // 獲取用戶的訂房統計
    const [bookingStats] = await executeQuery(
      `SELECT COUNT(*) as total_bookings,
              COALESCE(SUM(total_amount), 0) as total_revenue,
              COUNT(CASE WHEN status = '已預訂' THEN 1 END) as active_bookings
       FROM Bookings b
       JOIN Properties p ON b.property_id = p.property_id
       WHERE p.owner_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        ...users[0],
        statistics: {
          properties: propertyStats?.property_count || 0,
          avg_price: Math.round(propertyStats?.avg_price || 0),
          total_bookings: bookingStats?.total_bookings || 0,
          total_revenue: bookingStats?.total_revenue || 0,
          active_bookings: bookingStats?.active_bookings || 0
        }
      }
    });
  } catch (error) {
    console.error('獲取用戶資訊錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取用戶資訊失敗',
      code: 'GET_USER_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/users
 * @desc 創建新用戶
 */
router.post('/',
  validateSchema(userSchemas.create),
  async (req, res) => {
    try {
      const { full_name, email, company_tax_id, phone, bank_code, bank_account } = req.body;

      const result = await executeQuery(
        `INSERT INTO Users (full_name, email, company_tax_id, phone, bank_code, bank_account)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [full_name, email, company_tax_id, phone, bank_code, bank_account]
      );

      // 獲取新創建的用戶資訊
      const [newUser] = await executeQuery(
        `SELECT user_id, full_name, email, company_tax_id, phone,
                bank_code, bank_account, created_at
         FROM Users
         WHERE user_id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: '用戶創建成功',
        data: newUser
      });
    } catch (error) {
      console.error('創建用戶錯誤:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: '電子郵件已被使用',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: '創建用戶失敗',
        code: 'CREATE_USER_FAILED'
      });
    }
  }
);

/**
 * @route PUT /api/v1/users/:id
 * @desc 更新用戶資訊
 */
router.put('/:id',
  validateSchema(userSchemas.update),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: '無效的用戶ID',
          code: 'INVALID_USER_ID'
        });
      }

      // 檢查用戶是否存在
      const [existingUser] = await executeQuery(
        'SELECT user_id FROM Users WHERE user_id = ?',
        [userId]
      );

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: '找不到指定的用戶',
          code: 'USER_NOT_FOUND'
        });
      }

      // 動態構建更新查詢
      const updates = [];
      const values = [];

      Object.entries(req.body).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: '沒有提供要更新的資料',
          code: 'NO_UPDATE_DATA'
        });
      }

      values.push(userId);

      await executeQuery(
        `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`,
        values
      );

      // 獲取更新後的用戶資訊
      const [updatedUser] = await executeQuery(
        `SELECT user_id, full_name, email, company_tax_id, phone,
                bank_code, bank_account, created_at
         FROM Users
         WHERE user_id = ?`,
        [userId]
      );

      res.json({
        success: true,
        message: '用戶資訊更新成功',
        data: updatedUser
      });
    } catch (error) {
      console.error('更新用戶錯誤:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: '電子郵件已被使用',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: '更新用戶失敗',
        code: 'UPDATE_USER_FAILED'
      });
    }
  }
);

/**
 * @route DELETE /api/v1/users/:id
 * @desc 刪除用戶（軟刪除，檢查是否有相關房源和訂單）
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: '無效的用戶ID',
        code: 'INVALID_USER_ID'
      });
    }

    // 檢查用戶是否存在
    const [user] = await executeQuery(
      'SELECT user_id, full_name FROM Users WHERE user_id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的用戶',
        code: 'USER_NOT_FOUND'
      });
    }

    // 檢查是否有相關房源
    const [propertyCount] = await executeQuery(
      'SELECT COUNT(*) as count FROM Properties WHERE owner_id = ?',
      [userId]
    );

    if (propertyCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `無法刪除用戶，該用戶擁有 ${propertyCount.count} 個房源`,
        code: 'USER_HAS_PROPERTIES'
      });
    }

    // 刪除用戶
    await executeQuery('DELETE FROM Users WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      message: `用戶 "${user.full_name}" 已成功刪除`
    });
  } catch (error) {
    console.error('刪除用戶錯誤:', error);
    res.status(500).json({
      success: false,
      error: '刪除用戶失敗',
      code: 'DELETE_USER_FAILED'
    });
  }
});

/**
 * @route GET /api/v1/users/:id/properties
 * @desc 獲取用戶擁有的所有房源
 */
router.get('/:id/properties', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: '無效的用戶ID',
        code: 'INVALID_USER_ID'
      });
    }

    const properties = await executeQuery(
      `SELECT p.*,
              COUNT(b.booking_id) as total_bookings,
              COALESCE(SUM(CASE WHEN b.status != '已取消' THEN b.total_amount ELSE 0 END), 0) as total_revenue
       FROM Properties p
       LEFT JOIN Bookings b ON p.property_id = b.property_id
       WHERE p.owner_id = ?
       GROUP BY p.property_id
       ORDER BY p.property_id DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('獲取用戶房源錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取用戶房源失敗',
      code: 'GET_USER_PROPERTIES_FAILED'
    });
  }
});

module.exports = router;