const express = require('express');
const { executeQuery } = require('../config/database');
const { querySchemas, validateSchema } = require('../middleware/validation');
const moment = require('moment');
const Joi = require('joi');

const router = express.Router();

/**
 * @route GET /api/v1/reports/revenue
 * @desc 營收報表 - 按時間範圍統計
 */
router.get('/revenue',
  validateSchema(Joi.object({
    // 日期範圍參數
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional(),
    // 其他參數
    group_by: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
    property_id: Joi.number().integer().positive().optional(),
    source_channel: Joi.string().valid('官網直訂', 'Airbnb', 'Booking.com', 'Agoda').optional()
  }), 'query'),
  async (req, res) => {
    try {
      const { start_date, end_date, group_by, property_id, source_channel } = req.query;

      // 根據 group_by 設定日期格式
      const dateFormats = {
        day: '%Y-%m-%d',
        week: '%Y-%u',
        month: '%Y-%m',
        year: '%Y'
      };

      let whereClause = "WHERE b.status != '已取消'";
      let queryParams = [];

      if (start_date) {
        whereClause += ' AND b.check_in >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND b.check_out <= ?';
        queryParams.push(end_date);
      }

      if (property_id) {
        whereClause += ' AND b.property_id = ?';
        queryParams.push(property_id);
      }

      if (source_channel) {
        whereClause += ' AND b.source_channel = ?';
        queryParams.push(source_channel);
      }

      const revenueData = await executeQuery(`
        SELECT
          DATE_FORMAT(b.check_in, '${dateFormats[group_by]}') as period,
          COUNT(*) as booking_count,
          SUM(b.total_amount) as total_revenue,
          AVG(b.total_amount) as avg_booking_value,
          SUM(DATEDIFF(b.check_out, b.check_in)) as total_nights,
          COUNT(DISTINCT b.property_id) as unique_properties,
          COUNT(DISTINCT b.guest_name) as unique_guests
        FROM Bookings b
        JOIN Properties p ON b.property_id = p.property_id
        ${whereClause}
        GROUP BY DATE_FORMAT(b.check_in, '${dateFormats[group_by]}')
        ORDER BY period DESC
        LIMIT 12
      `, queryParams);

      // 計算總計
      const [totalStats] = await executeQuery(`
        SELECT
          COUNT(*) as total_bookings,
          SUM(b.total_amount) as total_revenue,
          AVG(b.total_amount) as avg_booking_value
        FROM Bookings b
        JOIN Properties p ON b.property_id = p.property_id
        ${whereClause}
      `, queryParams);

      res.json({
        success: true,
        data: {
          period_type: group_by,
          date_range: {
            start_date,
            end_date
          },
          periods: revenueData.map(row => ({
            ...row,
            total_revenue: parseInt(row.total_revenue),
            avg_booking_value: Math.round(row.avg_booking_value)
          })),
          summary: {
            total_bookings: totalStats?.total_bookings || 0,
            total_revenue: parseInt(totalStats?.total_revenue || 0),
            avg_booking_value: Math.round(totalStats?.avg_booking_value || 0)
          }
        }
      });
    } catch (error) {
      console.error('獲取營收報表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取營收報表失敗',
        code: 'GET_REVENUE_REPORT_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/reports/property-performance
 * @desc 房源績效報表
 */
router.get('/property-performance',
  validateSchema(Joi.object({
    // 日期範圍參數
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional(),
    // 分頁參數
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    // 排序參數
    sort_by: Joi.string().valid('revenue', 'bookings', 'occupancy', 'rating').default('revenue'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  }), 'query'),
  async (req, res) => {
    try {
      const { start_date, end_date, page, limit, sort_by, sort_order } = req.query;

      // 確保分頁參數是數字類型
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      let dateFilter = '';
      let queryParams = [];

      if (start_date || end_date) {
        if (start_date) {
          dateFilter += ' AND b.check_in >= ?';
          queryParams.push(start_date);
        }
        if (end_date) {
          dateFilter += ' AND b.check_out <= ?';
          queryParams.push(end_date);
        }
      }

      // 排序欄位對應
      const sortFields = {
        revenue: 'total_revenue',
        bookings: 'total_bookings',
        occupancy: 'occupancy_rate',
        rating: 'avg_booking_value'
      };

      const properties = await executeQuery(`
        SELECT
          p.property_id,
          p.title,
          p.city,
          p.district,
          p.base_price_twd,
          u.full_name as owner_name,
          COUNT(b.booking_id) as total_bookings,
          COUNT(CASE WHEN b.status = '已預訂' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN b.status = '已入住' THEN 1 END) as current_guests,
          COUNT(CASE WHEN b.status = '已退房' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN b.status = '已取消' THEN 1 END) as cancelled_bookings,
          COALESCE(SUM(CASE WHEN b.status != '已取消' THEN b.total_amount ELSE 0 END), 0) as total_revenue,
          COALESCE(AVG(CASE WHEN b.status != '已取消' THEN b.total_amount END), 0) as avg_booking_value,
          COALESCE(SUM(CASE WHEN b.status != '已取消' THEN DATEDIFF(b.check_out, b.check_in) END), 0) as total_nights,
          ROUND(
            CASE
              WHEN COUNT(b.booking_id) > 0
              THEN (COUNT(CASE WHEN b.status != '已取消' THEN 1 END) * 100.0 / COUNT(b.booking_id))
              ELSE 0
            END, 2
          ) as occupancy_rate
        FROM Properties p
        JOIN Users u ON p.owner_id = u.user_id
        LEFT JOIN Bookings b ON p.property_id = b.property_id ${dateFilter ? 'AND 1=1' + dateFilter : ''}
        GROUP BY p.property_id
        ORDER BY ${sortFields[sort_by]} ${sort_order.toUpperCase()}
        LIMIT ${limitNum} OFFSET ${offset}
      `, queryParams);

      // 獲取總數
      const [totalResult] = await executeQuery(`
        SELECT COUNT(DISTINCT p.property_id) as total
        FROM Properties p
        LEFT JOIN Bookings b ON p.property_id = b.property_id ${dateFilter ? 'WHERE 1=1' + dateFilter : ''}
      `, queryParams);

      res.json({
        success: true,
        data: {
          properties: properties.map(property => ({
            ...property,
            total_revenue: parseInt(property.total_revenue),
            avg_booking_value: Math.round(property.avg_booking_value)
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalResult.total,
            pages: Math.ceil(totalResult.total / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('獲取房源績效報表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取房源績效報表失敗',
        code: 'GET_PROPERTY_PERFORMANCE_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/reports/booking-channels
 * @desc 訂房管道分析報表
 */
router.get('/booking-channels',
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
      const { start_date, end_date } = req.query;

      let whereClause = "WHERE b.status != '已取消'";
      let queryParams = [];

      if (start_date) {
        whereClause += ' AND b.check_in >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND b.check_out <= ?';
        queryParams.push(end_date);
      }

      // 訂房管道統計
      const channelStats = await executeQuery(`
        SELECT
          b.source_channel,
          COUNT(*) as booking_count,
          ROUND(COUNT(*) * 100.0 / (
            SELECT COUNT(*) FROM Bookings b2 ${whereClause.replace('b.', 'b2.')}
          ), 2) as percentage,
          SUM(b.total_amount) as total_revenue,
          AVG(b.total_amount) as avg_booking_value,
          AVG(DATEDIFF(b.check_out, b.check_in)) as avg_stay_nights,
          COUNT(CASE WHEN b.status = '已退房' THEN 1 END) as completed_bookings,
          ROUND(
            COUNT(CASE WHEN b.status = '已退房' THEN 1 END) * 100.0 / COUNT(*), 2
          ) as completion_rate
        FROM Bookings b
        ${whereClause}
        GROUP BY b.source_channel
        ORDER BY total_revenue DESC
      `, [...queryParams, ...queryParams]);

      // 管道趨勢（按月）
      const channelTrends = await executeQuery(`
        SELECT
          DATE_FORMAT(b.check_in, '%Y-%m') as month,
          b.source_channel,
          COUNT(*) as booking_count,
          SUM(b.total_amount) as revenue
        FROM Bookings b
        ${whereClause}
        GROUP BY DATE_FORMAT(b.check_in, '%Y-%m'), b.source_channel
        ORDER BY month DESC, revenue DESC
        LIMIT 48
      `, queryParams);

      // 管道表現對比
      const [totalStats] = await executeQuery(`
        SELECT
          COUNT(*) as total_bookings,
          SUM(b.total_amount) as total_revenue
        FROM Bookings b
        ${whereClause}
      `, queryParams);

      res.json({
        success: true,
        data: {
          date_range: {
            start_date,
            end_date
          },
          channel_summary: channelStats.map(channel => ({
            ...channel,
            total_revenue: parseInt(channel.total_revenue),
            avg_booking_value: Math.round(channel.avg_booking_value),
            avg_stay_nights: Math.round(channel.avg_stay_nights * 10) / 10
          })),
          channel_trends: channelTrends.reduce((acc, row) => {
            if (!acc[row.month]) {
              acc[row.month] = {};
            }
            acc[row.month][row.source_channel] = {
              booking_count: row.booking_count,
              revenue: parseInt(row.revenue)
            };
            return acc;
          }, {}),
          total_statistics: {
            total_bookings: totalStats?.total_bookings || 0,
            total_revenue: parseInt(totalStats?.total_revenue || 0)
          }
        }
      });
    } catch (error) {
      console.error('獲取訂房管道報表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取訂房管道報表失敗',
        code: 'GET_CHANNEL_REPORT_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/reports/guest-analysis
 * @desc 客戶分析報表
 */
router.get('/guest-analysis',
  validateSchema(Joi.object({
    // 日期範圍參數
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional(),
    // 分頁參數
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    // 其他參數
    min_bookings: Joi.number().integer().min(1).default(1),
    sort_by: Joi.string().valid('bookings', 'revenue', 'avg_stay', 'last_visit').default('revenue')
  }), 'query'),
  async (req, res) => {
    try {
      const { start_date, end_date, page, limit, min_bookings, sort_by } = req.query;

      // 確保分頁參數是數字類型
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      let whereClause = "WHERE b.status != '已取消'";
      let queryParams = [];

      if (start_date) {
        whereClause += ' AND b.check_in >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND b.check_out <= ?';
        queryParams.push(end_date);
      }

      const sortFields = {
        bookings: 'total_bookings',
        revenue: 'total_spent',
        avg_stay: 'avg_stay_nights',
        last_visit: 'last_check_out'
      };

      const guestAnalysis = await executeQuery(`
        SELECT
          b.guest_name,
          b.guest_id_no,
          COUNT(*) as total_bookings,
          SUM(b.total_amount) as total_spent,
          AVG(b.total_amount) as avg_booking_value,
          SUM(DATEDIFF(b.check_out, b.check_in)) as total_nights,
          AVG(DATEDIFF(b.check_out, b.check_in)) as avg_stay_nights,
          MIN(b.check_in) as first_check_in,
          MAX(b.check_out) as last_check_out,
          COUNT(DISTINCT b.property_id) as properties_visited,
          GROUP_CONCAT(DISTINCT b.source_channel) as channels_used,
          COUNT(CASE WHEN b.breakfast_included = TRUE THEN 1 END) as bookings_with_breakfast
        FROM Bookings b
        ${whereClause}
        GROUP BY b.guest_name, b.guest_id_no
        HAVING total_bookings >= ?
        ORDER BY ${sortFields[sort_by]} DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `, [...queryParams, min_bookings]);

      // 獲取客戶統計總覽
      const [guestOverview] = await executeQuery(`
        SELECT
          COUNT(DISTINCT CONCAT(guest_name, guest_id_no)) as total_unique_guests,
          COUNT(DISTINCT CONCAT(guest_name, guest_id_no)) as repeat_customers,
          AVG(guest_bookings.booking_count) as avg_bookings_per_guest,
          AVG(guest_bookings.total_spent) as avg_spent_per_guest
        FROM (
          SELECT
            guest_name,
            guest_id_no,
            COUNT(*) as booking_count,
            SUM(total_amount) as total_spent
          FROM Bookings b
          ${whereClause}
          GROUP BY guest_name, guest_id_no
        ) as guest_bookings
      `, queryParams);

      const [totalGuests] = await executeQuery(`
        SELECT COUNT(DISTINCT CONCAT(guest_name, guest_id_no)) as total
        FROM Bookings b
        ${whereClause}
        GROUP BY guest_name, guest_id_no
        HAVING COUNT(*) >= ?
      `, [...queryParams, min_bookings]);

      res.json({
        success: true,
        data: {
          guests: guestAnalysis.map(guest => ({
            ...guest,
            total_spent: parseInt(guest.total_spent),
            avg_booking_value: Math.round(guest.avg_booking_value),
            avg_stay_nights: Math.round(guest.avg_stay_nights * 10) / 10,
            channels_used: guest.channels_used ? guest.channels_used.split(',') : []
          })),
          overview: {
            total_unique_guests: guestOverview?.total_unique_guests || 0,
            avg_bookings_per_guest: Math.round((guestOverview?.avg_bookings_per_guest || 0) * 10) / 10,
            avg_spent_per_guest: Math.round(guestOverview?.avg_spent_per_guest || 0)
          },
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalGuests?.total || 0,
            pages: Math.ceil((totalGuests?.total || 0) / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('獲取客戶分析報表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取客戶分析報表失敗',
        code: 'GET_GUEST_ANALYSIS_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/reports/occupancy
 * @desc 入住率分析報表
 */
router.get('/occupancy',
  validateSchema(Joi.object({
    // 日期範圍參數
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional(),
    // 其他參數
    group_by: Joi.string().valid('day', 'week', 'month').default('month'),
    property_id: Joi.number().integer().positive().optional()
  }), 'query'),
  async (req, res) => {
    try {
      const { start_date, end_date, group_by, property_id } = req.query;

      const dateFormats = {
        day: '%Y-%m-%d',
        week: '%Y-%u',
        month: '%Y-%m'
      };

      let whereClause = "WHERE b.status IN ('已預訂', '已入住', '已退房')";
      let queryParams = [];

      if (start_date) {
        whereClause += ' AND b.check_in >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND b.check_out <= ?';
        queryParams.push(end_date);
      }

      if (property_id) {
        whereClause += ' AND b.property_id = ?';
        queryParams.push(property_id);
      }

      // 計算每個時間段的入住率
      const occupancyData = await executeQuery(`
        SELECT
          DATE_FORMAT(b.check_in, '${dateFormats[group_by]}') as period,
          COUNT(DISTINCT b.property_id) as properties_with_bookings,
          COUNT(*) as total_bookings,
          SUM(DATEDIFF(b.check_out, b.check_in)) as total_occupied_nights,
          COUNT(DISTINCT b.property_id) *
          CASE
            WHEN '${group_by}' = 'day' THEN 1
            WHEN '${group_by}' = 'week' THEN 7
            WHEN '${group_by}' = 'month' THEN 30
          END as total_available_nights,
          ROUND(
            SUM(DATEDIFF(b.check_out, b.check_in)) * 100.0 /
            (COUNT(DISTINCT b.property_id) *
              CASE
                WHEN '${group_by}' = 'day' THEN 1
                WHEN '${group_by}' = 'week' THEN 7
                WHEN '${group_by}' = 'month' THEN 30
              END
            ), 2
          ) as occupancy_rate,
          AVG(DATEDIFF(b.check_out, b.check_in)) as avg_stay_length
        FROM Bookings b
        ${whereClause}
        GROUP BY DATE_FORMAT(b.check_in, '${dateFormats[group_by]}')
        ORDER BY period DESC
        LIMIT 12
      `, queryParams);

      // 整體入住率統計
      const [overallStats] = await executeQuery(`
        SELECT
          COUNT(DISTINCT p.property_id) as total_properties,
          COUNT(DISTINCT b.property_id) as properties_with_bookings,
          COUNT(b.booking_id) as total_bookings,
          AVG(DATEDIFF(b.check_out, b.check_in)) as avg_stay_length,
          SUM(DATEDIFF(b.check_out, b.check_in)) as total_occupied_nights
        FROM Properties p
        LEFT JOIN Bookings b ON p.property_id = b.property_id ${whereClause.replace('WHERE ', 'AND ')}
        ${property_id ? 'WHERE p.property_id = ?' : ''}
      `, property_id ? [...queryParams, property_id] : queryParams);

      res.json({
        success: true,
        data: {
          period_type: group_by,
          date_range: {
            start_date,
            end_date
          },
          occupancy_by_period: occupancyData.map(row => ({
            ...row,
            avg_stay_length: Math.round(row.avg_stay_length * 10) / 10
          })),
          overall_statistics: {
            total_properties: overallStats?.total_properties || 0,
            properties_with_bookings: overallStats?.properties_with_bookings || 0,
            total_bookings: overallStats?.total_bookings || 0,
            avg_stay_length: Math.round((overallStats?.avg_stay_length || 0) * 10) / 10,
            total_occupied_nights: overallStats?.total_occupied_nights || 0
          }
        }
      });
    } catch (error) {
      console.error('獲取入住率報表錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取入住率報表失敗',
        code: 'GET_OCCUPANCY_REPORT_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/v1/reports/financial-summary
 * @desc 財務摘要報表（適用於台灣稅務申報）
 */
router.get('/financial-summary',
  validateSchema({
    year: Joi.number().integer().min(2020).max(2030).default(new Date().getFullYear()),
    month: Joi.number().integer().min(1).max(12).optional(),
    include_tax_details: Joi.boolean().default(true)
  }, 'query'),
  async (req, res) => {
    try {
      const { year, month, include_tax_details } = req.query;

      let whereClause = "WHERE YEAR(b.check_in) = ? AND b.status != '已取消'";
      let queryParams = [year];

      if (month) {
        whereClause += ' AND MONTH(b.check_in) = ?';
        queryParams.push(month);
      }

      // 財務摘要
      const [financialSummary] = await executeQuery(`
        SELECT
          COUNT(*) as total_transactions,
          SUM(b.total_amount) as gross_revenue,
          SUM(CASE WHEN b.is_tax_included = TRUE THEN b.total_amount * 0.05 ELSE 0 END) as included_tax_amount,
          SUM(CASE WHEN b.is_tax_included = FALSE THEN b.total_amount * 0.05 ELSE 0 END) as additional_tax_amount,
          AVG(b.total_amount) as avg_transaction_value
        FROM Bookings b
        ${whereClause}
      `, queryParams);

      // 按管道分組的收入
      const revenueByChannel = await executeQuery(`
        SELECT
          b.source_channel,
          COUNT(*) as transaction_count,
          SUM(b.total_amount) as revenue,
          ROUND(SUM(b.total_amount) * 100.0 / (
            SELECT SUM(total_amount) FROM Bookings b2 ${whereClause.replace('b.', 'b2.')}
          ), 2) as percentage
        FROM Bookings b
        ${whereClause}
        GROUP BY b.source_channel
        ORDER BY revenue DESC
      `, [...queryParams, ...queryParams]);

      // 按房主分組的收入（用於報稅）
      let ownerRevenue = [];
      if (include_tax_details) {
        ownerRevenue = await executeQuery(`
          SELECT
            u.user_id,
            u.full_name,
            u.company_tax_id,
            u.bank_code,
            u.bank_account,
            COUNT(*) as booking_count,
            SUM(b.total_amount) as total_revenue,
            SUM(CASE WHEN b.is_tax_included = TRUE THEN b.total_amount * 0.05 ELSE 0 END) as tax_included_amount,
            GROUP_CONCAT(DISTINCT p.legal_license_no) as license_numbers
          FROM Bookings b
          JOIN Properties p ON b.property_id = p.property_id
          JOIN Users u ON p.owner_id = u.user_id
          ${whereClause}
          GROUP BY u.user_id
          ORDER BY total_revenue DESC
        `, queryParams);
      }

      // 月度趨勢（如果查詢整年）
      let monthlyTrend = [];
      if (!month) {
        monthlyTrend = await executeQuery(`
          SELECT
            MONTH(b.check_in) as month,
            COUNT(*) as booking_count,
            SUM(b.total_amount) as revenue,
            AVG(b.total_amount) as avg_booking_value
          FROM Bookings b
          WHERE YEAR(b.check_in) = ? AND b.status != '已取消'
          GROUP BY MONTH(b.check_in)
          ORDER BY month
        `, [year]);
      }

      res.json({
        success: true,
        data: {
          period: {
            year,
            month: month || null,
            is_monthly: !!month
          },
          financial_summary: {
            total_transactions: financialSummary?.total_transactions || 0,
            gross_revenue: parseInt(financialSummary?.gross_revenue || 0),
            included_tax_amount: Math.round(financialSummary?.included_tax_amount || 0),
            additional_tax_amount: Math.round(financialSummary?.additional_tax_amount || 0),
            total_tax_amount: Math.round((financialSummary?.included_tax_amount || 0) + (financialSummary?.additional_tax_amount || 0)),
            net_revenue: parseInt((financialSummary?.gross_revenue || 0) - ((financialSummary?.included_tax_amount || 0) + (financialSummary?.additional_tax_amount || 0))),
            avg_transaction_value: Math.round(financialSummary?.avg_transaction_value || 0)
          },
          revenue_by_channel: revenueByChannel.map(channel => ({
            ...channel,
            revenue: parseInt(channel.revenue)
          })),
          owner_revenue: ownerRevenue.map(owner => ({
            ...owner,
            total_revenue: parseInt(owner.total_revenue),
            tax_included_amount: Math.round(owner.tax_included_amount),
            license_numbers: owner.license_numbers ? owner.license_numbers.split(',') : []
          })),
          monthly_trend: monthlyTrend.map(trend => ({
            ...trend,
            revenue: parseInt(trend.revenue),
            avg_booking_value: Math.round(trend.avg_booking_value)
          }))
        }
      });
    } catch (error) {
      console.error('獲取財務摘要錯誤:', error);
      res.status(500).json({
        success: false,
        error: '獲取財務摘要失敗',
        code: 'GET_FINANCIAL_SUMMARY_FAILED'
      });
    }
  }
);

module.exports = router;