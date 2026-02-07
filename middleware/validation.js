const Joi = require('joi');

// 台灣身分證字號驗證
const taiwanIdPattern = /^[A-Z][12]\d{8}$/;

// 台灣統一編號驗證
const taiwanTaxIdPattern = /^\d{8}$/;

// 台灣手機號碼驗證
const taiwanPhonePattern = /^09\d{2}-?\d{3}-?\d{3}$/;

// 用戶相關驗證規則
const userSchemas = {
  create: Joi.object({
    full_name: Joi.string().min(2).max(100).required().messages({
      'string.min': '姓名長度至少需要2個字元',
      'string.max': '姓名長度不能超過100個字元',
      'any.required': '姓名為必填欄位'
    }),
    email: Joi.string().email().max(150).required().messages({
      'string.email': '請輸入有效的電子郵件地址',
      'any.required': '電子郵件為必填欄位'
    }),
    company_tax_id: Joi.string().pattern(taiwanTaxIdPattern).optional().messages({
      'string.pattern.base': '統一編號格式不正確，應為8位數字'
    }),
    phone: Joi.string().pattern(taiwanPhonePattern).optional().messages({
      'string.pattern.base': '手機號碼格式不正確，應為09xx-xxx-xxx格式'
    }),
    bank_code: Joi.string().length(3).optional(),
    bank_account: Joi.string().min(10).max(20).optional()
  }),

  update: Joi.object({
    full_name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().max(150).optional(),
    company_tax_id: Joi.string().pattern(taiwanTaxIdPattern).optional(),
    phone: Joi.string().pattern(taiwanPhonePattern).optional(),
    bank_code: Joi.string().length(3).optional(),
    bank_account: Joi.string().min(10).max(20).optional()
  })
};

// 房源相關驗證規則
const propertySchemas = {
  create: Joi.object({
    owner_id: Joi.number().integer().positive().required(),
    title: Joi.string().min(5).max(255).required().messages({
      'string.min': '房源標題至少需要5個字元',
      'any.required': '房源標題為必填欄位'
    }),
    city: Joi.string().max(50).required().messages({
      'any.required': '縣市為必填欄位'
    }),
    district: Joi.string().max(50).required().messages({
      'any.required': '鄉鎮市區為必填欄位'
    }),
    address: Joi.string().max(255).required().messages({
      'any.required': '地址為必填欄位'
    }),
    legal_license_no: Joi.string().max(100).optional(),
    base_price_twd: Joi.number().integer().min(500).max(50000).required().messages({
      'number.min': '房價不能低於500元',
      'number.max': '房價不能超過50000元',
      'any.required': '基本房價為必填欄位'
    })
  }),

  update: Joi.object({
    title: Joi.string().min(5).max(255).optional(),
    city: Joi.string().max(50).optional(),
    district: Joi.string().max(50).optional(),
    address: Joi.string().max(255).optional(),
    legal_license_no: Joi.string().max(100).optional(),
    base_price_twd: Joi.number().integer().min(500).max(50000).optional()
  })
};

// 訂房相關驗證規則
const bookingSchemas = {
  create: Joi.object({
    property_id: Joi.number().integer().positive().required(),
    source_channel: Joi.string().valid('官網直訂', 'Airbnb', 'Booking.com', 'Agoda').default('官網直訂'),
    guest_name: Joi.string().min(2).max(100).required().messages({
      'any.required': '客人姓名為必填欄位'
    }),
    guest_id_no: Joi.string().min(8).max(20).required().messages({
      'any.required': '身分證字號/護照號碼為必填欄位'
    }),
    check_in: Joi.date().min('now').required().messages({
      'date.min': '入住日期不能是過去的日期',
      'any.required': '入住日期為必填欄位'
    }),
    check_out: Joi.date().greater(Joi.ref('check_in')).required().messages({
      'date.greater': '退房日期必須晚於入住日期',
      'any.required': '退房日期為必填欄位'
    }),
    total_amount: Joi.number().integer().min(0).required(),
    is_tax_included: Joi.boolean().default(true),
    breakfast_included: Joi.boolean().default(true),
    special_note: Joi.string().max(1000).optional(),
    status: Joi.string().valid('已預訂', '已入住', '已退房', '已取消').default('已預訂')
  }),

  update: Joi.object({
    source_channel: Joi.string().valid('官網直訂', 'Airbnb', 'Booking.com', 'Agoda').optional(),
    guest_name: Joi.string().min(2).max(100).optional(),
    guest_id_no: Joi.string().min(8).max(20).optional(),
    check_in: Joi.date().optional(),
    check_out: Joi.date().when('check_in', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('check_in')),
      otherwise: Joi.date()
    }).optional(),
    total_amount: Joi.number().integer().min(0).optional(),
    is_tax_included: Joi.boolean().optional(),
    breakfast_included: Joi.boolean().optional(),
    special_note: Joi.string().max(1000).optional(),
    status: Joi.string().valid('已預訂', '已入住', '已退房', '已取消').optional()
  }),

  statusUpdate: Joi.object({
    status: Joi.string().valid('已預訂', '已入住', '已退房', '已取消').required()
  })
};

// 查詢參數驗證
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  dateRange: Joi.object({
    start_date: Joi.date().optional(),
    end_date: Joi.date().when('start_date', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('start_date')),
      otherwise: Joi.date()
    }).optional()
  }),

  propertySearch: Joi.object({
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
  }),

  bookingFilter: Joi.object({
    status: Joi.string().valid('已預訂', '已入住', '已退房', '已取消').optional(),
    source_channel: Joi.string().valid('官網直訂', 'Airbnb', 'Booking.com', 'Agoda').optional(),
    property_id: Joi.number().integer().positive().optional(),
    guest_name: Joi.string().optional()
  })
};

// 驗證中間件生成函數
function validateSchema(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'query' ? req.query :
                 source === 'params' ? req.params : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        error: '輸入資料驗證失敗',
        code: 'VALIDATION_ERROR',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    if (source === 'query') {
      req.query = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = {
  userSchemas,
  propertySchemas,
  bookingSchemas,
  querySchemas,
  validateSchema
};