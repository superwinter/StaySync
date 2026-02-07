const express = require('express');
const { executeQuery, executeTransaction } = require('../config/database');
const { bookingSchemas, querySchemas, validateSchema } = require('../middleware/validation');
const moment = require('moment');
const Joi = require('joi');

const router = express.Router();

/**
 * @route GET /api/v1/bookings
 * @desc 獲取訂房列表（支持過濾和分頁）
 */
router.get('/',
  validateSchema(Joi.object({
    // 分頁參數
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    // 訂房過濾參數
    status: Joi.string().valid('已預訂', '已入住', '已退房', '已取消').optional(),
    source_channel: Joi.string().valid('官網直訂', 'Airbnb', 'Booking.com', 'Agoda').optional(),
    property_id: Joi.number().integer().positive().optional(),
    guest_name: Joi.string().optional(),
    // 日期範圍參數
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional()
  }), 'query'),
  async (req, res) => {
    try {
      const { page, limit, status, source_channel, property_id, guest_name, start_date, end_date } = req.query;

      // 確保分頁參數是數字類型
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      // 構建搜索條件
      let whereClause = 'WHERE 1=1';
      let queryParams = [];

      if (status) {
        whereClause += ' AND b.status = ?';
        queryParams.push(status);
      }

      if (source_channel) {
        whereClause += ' AND b.source_channel = ?';
        queryParams.push(source_channel);
      }

      if (property_id) {
        whereClause += ' AND b.property_id = ?';
        queryParams.push(property_id);
      }

      if (guest_name) {
        whereClause += ' AND b.guest_name LIKE ?';
        queryParams.push(`%${guest_name}%`);
      }

      if (start_date) {
        whereClause += ' AND b.check_in >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND b.check_out <= ?';
        queryParams.push(end_date);
      }

      // 獲取訂房總數
      const [totalResult] = await executeQuery(
        `SELECT COUNT(*) as total
         FROM Bookings b
         JOIN Properties p ON b.property_id = p.property_id
         JOIN Users u ON p.owner_id = u.user_id
         ${whereClause}`,
        queryParams
      );
      const total = totalResult.total;

      // 獲取訂房列表
      const bookings = await executeQuery(
        `SELECT b.*,
                p.title as property_title,
                p.city as property_city,
                p.district as property_district,
                u.full_name as owner_name,
                u.email as owner_email,
                u.phone as owner_phone,
                DATEDIFF(b.check_out, b.check_in) as stay_nights
         FROM Bookings b
         JOIN Properties p ON b.property_id = p.property_id
         JOIN Users u ON p.owner_id = u.user_id
         ${whereClause}
         ORDER BY b.booking_id DESC
         LIMIT ${limitNum} OFFSET ${offset}`,
        queryParams
      );

      res.json({
        success: true,
        data: bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('獲取訂房列表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取訂房列表失敗',
        code: 'GET_BOOKINGS_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/bookings/:id
 * @desc 獲取特定訂房詳細資訊
 */
router.get('/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        error: '無效的訂房ID',
        code: 'INVALID_BOOKING_ID'
      });
    }

    const [booking] = await executeQuery(
      `SELECT b.*,
              p.title as property_title,
              p.city as property_city,
              p.district as property_district,
              p.address as property_address,
              p.base_price_twd,
              u.full_name as owner_name,
              u.email as owner_email,
              u.phone as owner_phone,
              u.company_tax_id as owner_tax_id,
              DATEDIFF(b.check_out, b.check_in) as stay_nights,
              CASE
                WHEN b.check_in > CURDATE() THEN '未入住'
                WHEN b.check_out < CURDATE() THEN '已結束'
                WHEN CURDATE() BETWEEN b.check_in AND b.check_out THEN '住宿中'
                ELSE '未知'
              END as current_status
       FROM Bookings b
       JOIN Properties p ON b.property_id = p.property_id
       JOIN Users u ON p.owner_id = u.user_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的訂房',
        code: 'BOOKING_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('獲取訂房詳細資訊錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取訂房詳細資訊失敗',
      code: 'GET_BOOKING_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/bookings
 * @desc 創建新訂房（包含衝突檢查）
 */
router.post('/',
  validateSchema(bookingSchemas.create),
  async (req, res) => {
    try {
      const {
        property_id, source_channel, guest_name, guest_id_no,
        check_in, check_out, total_amount, is_tax_included,
        breakfast_included, special_note, status
      } = req.body;

      // 檢查房源是否存在
      const [property] = await executeQuery(
        'SELECT property_id, title, base_price_twd FROM Properties WHERE property_id = ?',
        [property_id]
      );

      if (!property) {
        return res.status(400).json({
          success: false,
          error: '指定的房源不存在',
          code: 'PROPERTY_NOT_FOUND'
        });
      }

      // 檢查日期衝突
      const conflictingBookings = await executeQuery(
        `SELECT booking_id, guest_name, check_in, check_out
         FROM Bookings
         WHERE property_id = ? AND status IN ('已預訂', '已入住')
         AND (
           (check_in <= ? AND check_out > ?)
           OR (check_in < ? AND check_out >= ?)
         )`,
        [property_id, check_out, check_in, check_out, check_in]
      );

      if (conflictingBookings.length > 0) {
        return res.status(409).json({
          success: false,
          error: '指定日期已有其他訂房，無法預訂',
          code: 'DATE_CONFLICT',
          details: {
            conflicting_bookings: conflictingBookings
          }
        });
      }

      // 計算住宿天數和建議金額
      const stayNights = moment(check_out).diff(moment(check_in), 'days');
      const suggestedAmount = property.base_price_twd * stayNights;

      // 如果沒有提供金額，使用建議金額
      const finalAmount = total_amount || suggestedAmount;

      const result = await executeQuery(
        `INSERT INTO Bookings
         (property_id, source_channel, guest_name, guest_id_no, check_in, check_out,
          total_amount, is_tax_included, breakfast_included, special_note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [property_id, source_channel, guest_name, guest_id_no, check_in, check_out,
         finalAmount, is_tax_included, breakfast_included, special_note, status]
      );

      // 獲取新創建的訂房資訊
      const [newBooking] = await executeQuery(
        `SELECT b.*,
                p.title as property_title,
                p.city as property_city,
                p.district as property_district,
                DATEDIFF(b.check_out, b.check_in) as stay_nights
         FROM Bookings b
         JOIN Properties p ON b.property_id = p.property_id
         WHERE b.booking_id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: '訂房創建成功',
        data: {
          ...newBooking,
          suggested_amount: suggestedAmount,
          amount_used: finalAmount
        }
      });
    } catch (error) {
      console.error('創建訂房錯誤:', error);
      res.status(500).json({
        success: false,
        error: '創建訂房失敗',
        code: 'CREATE_BOOKING_FAILED'
      });
    }
  }
);

/**
 * @route PUT /api/v1/bookings/:id
 * @desc 更新訂房資訊
 */
router.put('/:id',
  validateSchema(bookingSchemas.update),
  async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);

      if (isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          error: '無效的訂房ID',
          code: 'INVALID_BOOKING_ID'
        });
      }

      // 檢查訂房是否存在
      const [existingBooking] = await executeQuery(
        'SELECT * FROM Bookings WHERE booking_id = ?',
        [bookingId]
      );

      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          error: '找不到指定的訂房',
          code: 'BOOKING_NOT_FOUND'
        });
      }

      // 如果更新入住或退房日期，檢查衝突
      if (req.body.check_in || req.body.check_out) {
        const newCheckIn = req.body.check_in || existingBooking.check_in;
        const newCheckOut = req.body.check_out || existingBooking.check_out;

        const conflictingBookings = await executeQuery(
          `SELECT booking_id, guest_name
           FROM Bookings
           WHERE property_id = ? AND status IN ('已預訂', '已入住')
           AND booking_id != ?
           AND (
             (check_in <= ? AND check_out > ?)
             OR (check_in < ? AND check_out >= ?)
           )`,
          [existingBooking.property_id, bookingId, newCheckOut, newCheckIn, newCheckOut, newCheckIn]
        );

        if (conflictingBookings.length > 0) {
          return res.status(409).json({
            success: false,
            error: '更新後的日期與其他訂房衝突',
            code: 'DATE_CONFLICT',
            details: {
              conflicting_bookings: conflictingBookings
            }
          });
        }
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

      values.push(bookingId);

      await executeQuery(
        `UPDATE Bookings SET ${updates.join(', ')} WHERE booking_id = ?`,
        values
      );

      // 獲取更新後的訂房資訊
      const [updatedBooking] = await executeQuery(
        `SELECT b.*,
                p.title as property_title,
                p.city as property_city,
                p.district as property_district,
                DATEDIFF(b.check_out, b.check_in) as stay_nights
         FROM Bookings b
         JOIN Properties p ON b.property_id = p.property_id
         WHERE b.booking_id = ?`,
        [bookingId]
      );

      res.json({
        success: true,
        message: '訂房資訊更新成功',
        data: updatedBooking
      });
    } catch (error) {
      console.error('更新訂房錯誤:', error);
      res.status(500).json({
        success: false,
        error: '更新訂房失敗',
        code: 'UPDATE_BOOKING_FAILED'
      });
    }
  }
);

/**
 * @route PATCH /api/v1/bookings/:id/status
 * @desc 更新訂房狀態
 */
router.patch('/:id/status',
  validateSchema(bookingSchemas.statusUpdate),
  async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          error: '無效的訂房ID',
          code: 'INVALID_BOOKING_ID'
        });
      }

      // 檢查訂房是否存在
      const [existingBooking] = await executeQuery(
        'SELECT booking_id, status, guest_name FROM Bookings WHERE booking_id = ?',
        [bookingId]
      );

      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          error: '找不到指定的訂房',
          code: 'BOOKING_NOT_FOUND'
        });
      }

      // 檢查狀態轉換是否合理
      const currentStatus = existingBooking.status;
      const validTransitions = {
        '已預訂': ['已入住', '已取消'],
        '已入住': ['已退房'],
        '已退房': [], // 已退房不能再變更
        '已取消': [] // 已取消不能再變更
      };

      if (!validTransitions[currentStatus].includes(status)) {
        return res.status(400).json({
          success: false,
          error: `無法從 "${currentStatus}" 變更為 "${status}"`,
          code: 'INVALID_STATUS_TRANSITION',
          details: {
            current_status: currentStatus,
            valid_transitions: validTransitions[currentStatus]
          }
        });
      }

      await executeQuery(
        'UPDATE Bookings SET status = ? WHERE booking_id = ?',
        [status, bookingId]
      );

      res.json({
        success: true,
        message: `訂房狀態已從 "${currentStatus}" 更新為 "${status}"`,
        data: {
          booking_id: bookingId,
          guest_name: existingBooking.guest_name,
          old_status: currentStatus,
          new_status: status
        }
      });
    } catch (error) {
      console.error('更新訂房狀態錯誤:', error);
      res.status(500).json({
        success: false,
        error: '更新訂房狀態失敗',
        code: 'UPDATE_STATUS_FAILED'
      });
    }
  }
);

/**
 * @route DELETE /api/v1/bookings/:id
 * @desc 刪除訂房（僅限已取消狀態）
 */
router.delete('/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        error: '無效的訂房ID',
        code: 'INVALID_BOOKING_ID'
      });
    }

    // 檢查訂房是否存在
    const [booking] = await executeQuery(
      'SELECT booking_id, guest_name, status FROM Bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的訂房',
        code: 'BOOKING_NOT_FOUND'
      });
    }

    // 只允許刪除已取消的訂房
    if (booking.status !== '已取消') {
      return res.status(400).json({
        success: false,
        error: '只能刪除已取消的訂房',
        code: 'CANNOT_DELETE_ACTIVE_BOOKING',
        details: {
          current_status: booking.status
        }
      });
    }

    await executeQuery('DELETE FROM Bookings WHERE booking_id = ?', [bookingId]);

    res.json({
      success: true,
      message: `訂房 "${booking.guest_name}" 已成功刪除`
    });
  } catch (error) {
    console.error('刪除訂房錯誤:', error);
    res.status(500).json({
      success: false,
      error: '刪除訂房失敗',
      code: 'DELETE_BOOKING_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/bookings/check-availability
 * @desc 批次檢查多個房源的可用性
 */
router.post('/check-availability',
  validateSchema({
    property_ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(20).required(),
    check_in: Joi.date().min('now').required(),
    check_out: Joi.date().greater(Joi.ref('check_in')).required()
  }),
  async (req, res) => {
    try {
      const { property_ids, check_in, check_out } = req.body;

      // 檢查所有房源是否存在
      const properties = await executeQuery(
        `SELECT property_id, title, base_price_twd
         FROM Properties
         WHERE property_id IN (${property_ids.map(() => '?').join(',')})`,
        property_ids
      );

      if (properties.length !== property_ids.length) {
        const foundIds = properties.map(p => p.property_id);
        const missingIds = property_ids.filter(id => !foundIds.includes(id));

        return res.status(400).json({
          success: false,
          error: '部分房源不存在',
          code: 'SOME_PROPERTIES_NOT_FOUND',
          details: {
            missing_property_ids: missingIds
          }
        });
      }

      // 檢查每個房源的可用性
      const availability = await Promise.all(
        property_ids.map(async (propertyId) => {
          const conflicting = await executeQuery(
            `SELECT booking_id, guest_name, check_in, check_out
             FROM Bookings
             WHERE property_id = ? AND status IN ('已預訂', '已入住')
             AND (
               (check_in <= ? AND check_out > ?)
               OR (check_in < ? AND check_out >= ?)
             )`,
            [propertyId, check_out, check_in, check_out, check_in]
          );

          const property = properties.find(p => p.property_id === propertyId);
          const stayNights = moment(check_out).diff(moment(check_in), 'days');

          return {
            property_id: propertyId,
            property_title: property.title,
            base_price_twd: property.base_price_twd,
            stay_nights: stayNights,
            estimated_total: property.base_price_twd * stayNights,
            is_available: conflicting.length === 0,
            conflicting_bookings: conflicting
          };
        })
      );

      res.json({
        success: true,
        data: {
          check_in,
          check_out,
          properties: availability,
          available_count: availability.filter(p => p.is_available).length,
          total_checked: property_ids.length
        }
      });
    } catch (error) {
      console.error('批次檢查可用性錯誤:', error);
      res.status(500).json({
        success: false,
        error: '批次檢查可用性失敗',
        code: 'CHECK_AVAILABILITY_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/bookings/dashboard/summary
 * @desc 獲取訂房儀表板摘要
 */
router.get('/dashboard/summary', async (req, res) => {
  try {
    // 總體統計
    const [totalStats] = await executeQuery(`
      SELECT
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = '已預訂' THEN 1 END) as pending_bookings,
        COUNT(CASE WHEN status = '已入住' THEN 1 END) as current_guests,
        COUNT(CASE WHEN status = '已退房' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN status = '已取消' THEN 1 END) as cancelled_bookings,
        COALESCE(SUM(CASE WHEN status != '已取消' THEN total_amount ELSE 0 END), 0) as total_revenue
      FROM Bookings
    `);

    // 今日統計
    const [todayStats] = await executeQuery(`
      SELECT
        COUNT(CASE WHEN check_in = CURDATE() THEN 1 END) as checking_in_today,
        COUNT(CASE WHEN check_out = CURDATE() THEN 1 END) as checking_out_today,
        0 as new_bookings_today
      FROM Bookings
    `);

    // 本月統計
    const [monthlyStats] = await executeQuery(`
      SELECT
        COUNT(*) as monthly_bookings,
        COALESCE(SUM(CASE WHEN status != '已取消' THEN total_amount ELSE 0 END), 0) as monthly_revenue
      FROM Bookings
      WHERE YEAR(check_in) = YEAR(CURDATE()) AND MONTH(check_in) = MONTH(CURDATE())
    `);

    // 訂房管道統計
    const channelStats = await executeQuery(`
      SELECT
        source_channel,
        COUNT(*) as booking_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Bookings), 2) as percentage,
        COALESCE(SUM(CASE WHEN status != '已取消' THEN total_amount ELSE 0 END), 0) as revenue
      FROM Bookings
      GROUP BY source_channel
      ORDER BY booking_count DESC
    `);

    res.json({
      success: true,
      data: {
        overview: {
          ...totalStats,
          total_revenue: parseInt(totalStats.total_revenue)
        },
        today: todayStats,
        monthly: {
          ...monthlyStats,
          monthly_revenue: parseInt(monthlyStats.monthly_revenue)
        },
        channels: channelStats.map(channel => ({
          ...channel,
          revenue: parseInt(channel.revenue)
        }))
      }
    });
  } catch (error) {
    console.error('獲取訂房儀表板錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取訂房儀表板失敗',
      code: 'GET_DASHBOARD_FAILED'
    });
  }
});

module.exports = router;