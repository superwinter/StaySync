const express = require('express');
const { executeQuery } = require('../config/database');
const { propertySchemas, querySchemas, validateSchema } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

/**
 * @route GET /api/v1/properties
 * @desc 獲取房源列表（支持搜索和過濾）
 */
router.get('/',
  validateSchema(Joi.object({
    // 分頁參數
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    // 房源搜索參數
    city: Joi.string().max(50).optional(),
    district: Joi.string().max(50).optional(),
    min_price: Joi.number().integer().min(0).optional(),
    max_price: Joi.number().integer().min(0).optional(),
    check_in: Joi.date().optional(),
    check_out: Joi.date().when('check_in', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('check_in')),
      otherwise: Joi.date()
    }).optional()
  }), 'query'),
  async (req, res) => {
    try {
      const { page, limit, city, district, min_price, max_price, check_in, check_out } = req.query;

      // 確保分頁參數是數字類型
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      // 構建搜索條件
      let whereClause = 'WHERE 1=1';
      let queryParams = [];

      if (city) {
        whereClause += ' AND p.city = ?';
        queryParams.push(city);
      }

      if (district) {
        whereClause += ' AND p.district = ?';
        queryParams.push(district);
      }

      if (min_price) {
        whereClause += ' AND p.base_price_twd >= ?';
        queryParams.push(min_price);
      }

      if (max_price) {
        whereClause += ' AND p.base_price_twd <= ?';
        queryParams.push(max_price);
      }

      // 如果指定入住和退房日期，排除已被預訂的房源
      if (check_in && check_out) {
        whereClause += ` AND p.property_id NOT IN (
          SELECT DISTINCT b.property_id
          FROM Bookings b
          WHERE b.status IN ('已預訂', '已入住')
          AND (
            (b.check_in <= ? AND b.check_out > ?)
            OR (b.check_in < ? AND b.check_out >= ?)
          )
        )`;
        queryParams.push(check_out, check_in, check_out, check_in);
      }

      // 獲取房源總數
      const [totalResult] = await executeQuery(
        `SELECT COUNT(*) as total
         FROM Properties p
         JOIN Users u ON p.owner_id = u.user_id
         ${whereClause}`,
        queryParams
      );
      const total = totalResult.total;

      // 獲取房源列表
      const properties = await executeQuery(
        `SELECT p.*,
                u.full_name as owner_name,
                u.email as owner_email,
                u.phone as owner_phone,
                COUNT(DISTINCT b.booking_id) as total_bookings,
                COALESCE(SUM(CASE WHEN b.status != '已取消' THEN b.total_amount ELSE 0 END), 0) as total_revenue,
                COALESCE(AVG(CASE WHEN b.status != '已取消' THEN b.total_amount END), 0) as avg_booking_value
         FROM Properties p
         JOIN Users u ON p.owner_id = u.user_id
         LEFT JOIN Bookings b ON p.property_id = b.property_id
         ${whereClause}
         GROUP BY p.property_id
         ORDER BY p.property_id DESC
         LIMIT ${limitNum} OFFSET ${offset}`,
        queryParams
      );

      // 處理數字格式
      properties.forEach(property => {
        property.total_revenue = parseInt(property.total_revenue);
        property.avg_booking_value = Math.round(property.avg_booking_value);
      });

      res.json({
        success: true,
        data: properties,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('獲取房源列表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取房源列表失敗',
        code: 'GET_PROPERTIES_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/properties/:id
 * @desc 獲取特定房源詳細資訊
 */
router.get('/:id', async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(400).json({
        success: false,
        error: '無效的房源ID',
        code: 'INVALID_PROPERTY_ID'
      });
    }

    // 獲取房源基本資訊
    const [property] = await executeQuery(
      `SELECT p.*,
              u.full_name as owner_name,
              u.email as owner_email,
              u.phone as owner_phone,
              u.company_tax_id as owner_tax_id
       FROM Properties p
       JOIN Users u ON p.owner_id = u.user_id
       WHERE p.property_id = ?`,
      [propertyId]
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的房源',
        code: 'PROPERTY_NOT_FOUND'
      });
    }

    // 獲取房源統計資訊
    const [stats] = await executeQuery(
      `SELECT COUNT(*) as total_bookings,
              COUNT(CASE WHEN status = '已預訂' THEN 1 END) as active_bookings,
              COUNT(CASE WHEN status = '已入住' THEN 1 END) as current_guests,
              COUNT(CASE WHEN status = '已退房' THEN 1 END) as completed_bookings,
              COUNT(CASE WHEN status = '已取消' THEN 1 END) as cancelled_bookings,
              COALESCE(SUM(CASE WHEN status != '已取消' THEN total_amount ELSE 0 END), 0) as total_revenue,
              COALESCE(AVG(CASE WHEN status != '已取消' THEN total_amount END), 0) as avg_booking_value
       FROM Bookings
       WHERE property_id = ?`,
      [propertyId]
    );

    // 獲取最近的訂房紀錄
    const recentBookings = await executeQuery(
      `SELECT booking_id, guest_name, check_in, check_out, total_amount, status, source_channel
       FROM Bookings
       WHERE property_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [propertyId]
    );

    // 獲取即將到來的訂房
    const upcomingBookings = await executeQuery(
      `SELECT booking_id, guest_name, check_in, check_out, total_amount, status, special_note
       FROM Bookings
       WHERE property_id = ? AND status IN ('已預訂', '已入住') AND check_in >= CURDATE()
       ORDER BY check_in ASC
       LIMIT 10`,
      [propertyId]
    );

    res.json({
      success: true,
      data: {
        ...property,
        statistics: {
          total_bookings: stats?.total_bookings || 0,
          active_bookings: stats?.active_bookings || 0,
          current_guests: stats?.current_guests || 0,
          completed_bookings: stats?.completed_bookings || 0,
          cancelled_bookings: stats?.cancelled_bookings || 0,
          total_revenue: parseInt(stats?.total_revenue || 0),
          avg_booking_value: Math.round(stats?.avg_booking_value || 0)
        },
        recent_bookings: recentBookings,
        upcoming_bookings: upcomingBookings
      }
    });
  } catch (error) {
    console.error('獲取房源詳細資訊錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取房源詳細資訊失敗',
      code: 'GET_PROPERTY_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/properties
 * @desc 創建新房源
 */
router.post('/',
  validateSchema(propertySchemas.create),
  async (req, res) => {
    try {
      const { owner_id, title, city, district, address, legal_license_no, base_price_twd } = req.body;

      // 檢查房主是否存在
      const [owner] = await executeQuery(
        'SELECT user_id, full_name FROM Users WHERE user_id = ?',
        [owner_id]
      );

      if (!owner) {
        return res.status(400).json({
          success: false,
          error: '指定的房主不存在',
          code: 'OWNER_NOT_FOUND'
        });
      }

      const result = await executeQuery(
        `INSERT INTO Properties (owner_id, title, city, district, address, legal_license_no, base_price_twd)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [owner_id, title, city, district, address, legal_license_no, base_price_twd]
      );

      // 獲取新創建的房源資訊
      const [newProperty] = await executeQuery(
        `SELECT p.*,
                u.full_name as owner_name
         FROM Properties p
         JOIN Users u ON p.owner_id = u.user_id
         WHERE p.property_id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: '房源創建成功',
        data: newProperty
      });
    } catch (error) {
      console.error('創建房源錯誤:', error);
      res.status(500).json({
        success: false,
        error: '創建房源失敗',
        code: 'CREATE_PROPERTY_FAILED'
      });
    }
  }
);

/**
 * @route PUT /api/v1/properties/:id
 * @desc 更新房源資訊
 */
router.put('/:id',
  validateSchema(propertySchemas.update),
  async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id);

      if (isNaN(propertyId)) {
        return res.status(400).json({
          success: false,
          error: '無效的房源ID',
          code: 'INVALID_PROPERTY_ID'
        });
      }

      // 檢查房源是否存在
      const [existingProperty] = await executeQuery(
        'SELECT property_id FROM Properties WHERE property_id = ?',
        [propertyId]
      );

      if (!existingProperty) {
        return res.status(404).json({
          success: false,
          error: '找不到指定的房源',
          code: 'PROPERTY_NOT_FOUND'
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

      values.push(propertyId);

      await executeQuery(
        `UPDATE Properties SET ${updates.join(', ')} WHERE property_id = ?`,
        values
      );

      // 獲取更新後的房源資訊
      const [updatedProperty] = await executeQuery(
        `SELECT p.*,
                u.full_name as owner_name
         FROM Properties p
         JOIN Users u ON p.owner_id = u.user_id
         WHERE p.property_id = ?`,
        [propertyId]
      );

      res.json({
        success: true,
        message: '房源資訊更新成功',
        data: updatedProperty
      });
    } catch (error) {
      console.error('更新房源錯誤:', error);
      res.status(500).json({
        success: false,
        error: '更新房源失敗',
        code: 'UPDATE_PROPERTY_FAILED'
      });
    }
  }
);

/**
 * @route DELETE /api/v1/properties/:id
 * @desc 刪除房源（檢查是否有相關訂單）
 */
router.delete('/:id', async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(400).json({
        success: false,
        error: '無效的房源ID',
        code: 'INVALID_PROPERTY_ID'
      });
    }

    // 檢查房源是否存在
    const [property] = await executeQuery(
      'SELECT property_id, title FROM Properties WHERE property_id = ?',
      [propertyId]
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的房源',
        code: 'PROPERTY_NOT_FOUND'
      });
    }

    // 檢查是否有相關訂單
    const [bookingCount] = await executeQuery(
      'SELECT COUNT(*) as count FROM Bookings WHERE property_id = ?',
      [propertyId]
    );

    if (bookingCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `無法刪除房源，該房源有 ${bookingCount.count} 筆相關訂單`,
        code: 'PROPERTY_HAS_BOOKINGS',
        details: {
          booking_count: bookingCount.count
        }
      });
    }

    // 刪除房源
    await executeQuery('DELETE FROM Properties WHERE property_id = ?', [propertyId]);

    res.json({
      success: true,
      message: `房源 "${property.title}" 已成功刪除`
    });
  } catch (error) {
    console.error('刪除房源錯誤:', error);
    res.status(500).json({
      success: false,
      error: '刪除房源失敗',
      code: 'DELETE_PROPERTY_FAILED'
    });
  }
});

/**
 * @route GET /api/v1/properties/:id/availability
 * @desc 檢查房源在特定日期範圍的可用性
 */
router.get('/:id/availability',
  validateSchema(Joi.object({
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional()
  }), 'query'),
  async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      const { start_date, end_date } = req.query;

      if (isNaN(propertyId)) {
        return res.status(400).json({
          success: false,
          error: '無效的房源ID',
          code: 'INVALID_PROPERTY_ID'
        });
      }

      // 檢查房源是否存在
      const [property] = await executeQuery(
        'SELECT property_id, title FROM Properties WHERE property_id = ?',
        [propertyId]
      );

      if (!property) {
        return res.status(404).json({
          success: false,
          error: '找不到指定的房源',
          code: 'PROPERTY_NOT_FOUND'
        });
      }

      let query = `
        SELECT booking_id, check_in, check_out, guest_name, status
        FROM Bookings
        WHERE property_id = ? AND status IN ('已預訂', '已入住')
      `;
      let params = [propertyId];

      if (start_date && end_date) {
        query += ` AND (
          (check_in <= ? AND check_out > ?)
          OR (check_in < ? AND check_out >= ?)
          OR (check_in >= ? AND check_out <= ?)
        )`;
        params.push(end_date, start_date, end_date, start_date, start_date, end_date);
      }

      query += ' ORDER BY check_in ASC';

      const conflictingBookings = await executeQuery(query, params);

      const isAvailable = conflictingBookings.length === 0;

      res.json({
        success: true,
        data: {
          property_id: propertyId,
          property_title: property.title,
          date_range: {
            start_date,
            end_date
          },
          is_available: isAvailable,
          conflicting_bookings: conflictingBookings
        }
      });
    } catch (error) {
      console.error('檢查房源可用性錯誤:', error);
      res.status(500).json({
        success: false,
        error: '檢查房源可用性失敗',
        code: 'CHECK_AVAILABILITY_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/properties/search/cities
 * @desc 獲取所有城市列表（用於搜索篩選）
 */
router.get('/search/cities', async (req, res) => {
  try {
    const cities = await executeQuery(
      `SELECT city, COUNT(*) as property_count
       FROM Properties
       GROUP BY city
       ORDER BY property_count DESC, city ASC`
    );

    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('獲取城市列表錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取城市列表失敗',
      code: 'GET_CITIES_FAILED'
    });
  }
});

/**
 * @route GET /api/v1/properties/search/districts
 * @desc 獲取指定城市的區域列表
 */
router.get('/search/districts', async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: '請提供城市參數',
        code: 'CITY_REQUIRED'
      });
    }

    const districts = await executeQuery(
      `SELECT district, COUNT(*) as property_count
       FROM Properties
       WHERE city = ?
       GROUP BY district
       ORDER BY property_count DESC, district ASC`,
      [city]
    );

    res.json({
      success: true,
      data: districts
    });
  } catch (error) {
    console.error('獲取區域列表錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取區域列表失敗',
      code: 'GET_DISTRICTS_FAILED'
    });
  }
});

module.exports = router;