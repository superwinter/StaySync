# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StaySync is a Taiwan B&B booking management system built with Node.js/Express and MySQL. The system handles Taiwan-specific business requirements including tax ID validation, Traditional Chinese localization, and integration with multiple booking channels (官網直訂, Airbnb, Booking.com, Agoda).

## Common Development Commands

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start

# Run comprehensive API tests
node test-api.js

# Database debugging
node debug-test.js

# Database initialization (after MySQL setup)
npm run init-db

# Automated setup (macOS/Linux)
./setup.sh

# Automated setup (Windows)
setup.bat
```

## Architecture Overview

### Core Structure
- **Entry point**: `server.js` - Express app with security middleware stack
- **Database layer**: `config/database.js` - MySQL connection pool with prepared statements
- **Validation layer**: `middleware/validation.js` - Joi schemas for Taiwan-specific validation
- **API routes**: `routes/` directory with RESTful endpoints for users, properties, bookings, reports

### Database Schema
Three main tables designed for Taiwan B&B operations:
- **Users**: Property owners with `company_tax_id` (統一編號) and Taiwan bank details
- **Properties**: B&B listings with `legal_license_no` and Taiwan location data
- **Bookings**: Reservations with Taiwan ID requirements and status workflow

### Key Taiwan-Specific Features
- **ID validation**: Taiwan ID format `[A-Z][12]\d{8}` and tax ID `\d{8}`
- **Phone validation**: Taiwan mobile format `09xx-xxx-xxx`
- **Currency**: All amounts in TWD integers with tax inclusion flags
- **Booking channels**: Multi-channel support with Traditional Chinese labels
- **Status workflow**: `已預訂 → 已入住 → 已退房` with validated transitions

## Database Connection Patterns

Uses MySQL2 with connection pooling (10 connections max):
```javascript
// Main query function
executeQuery(query, params) // Single query with prepared statements
executeTransaction(queries) // Multiple queries with rollback
testConnection() // Health check
```

**Important**: All LIMIT/OFFSET parameters must be integers. Use `parseInt()` for query parameters:
```javascript
const pageNum = parseInt(page) || 1;
const limitNum = parseInt(limit) || 10;
```

## API Response Format

All endpoints return standardized JSON:
```json
{
  "success": true/false,
  "data": { /* response data */ },
  "error": "Error message", // on failure
  "code": "ERROR_CODE", // on failure
  "pagination": { /* for paginated responses */ }
}
```

## Validation Schema Patterns

Located in `middleware/validation.js`. Key schemas:
- `userSchemas.create/update` - Taiwan tax ID and bank validation
- `propertySchemas.create/update` - Legal license and location validation
- `bookingSchemas.create/update` - Date validation with `.min('now')` for future dates
- `bookingSchemas.statusUpdate` - Validates status transitions

## Testing Infrastructure

### Test Data
- 7 property owners across Taiwan
- 12 properties in major tourist areas (Yilan, Hualien, Taitung, Nantou, Pingtung)
- 16 bookings with various statuses for comprehensive testing

### Test Execution
`test-api.js` runs 10 comprehensive tests including:
- CRUD operations for all entities
- Date conflict detection
- Status transition validation
- Revenue reporting
- Property search and availability

## Key Business Logic

### Booking Status Workflow
```
已預訂 (Booked) → [已入住 (Checked In) | 已取消 (Cancelled)]
已入住 (Checked In) → 已退房 (Checked Out)
已退房/已取消 → Final states (no further transitions)
```

### Date Conflict Detection
Properties cannot be double-booked. The system checks for overlapping date ranges:
```sql
WHERE (check_in <= ? AND check_out > ?) OR (check_in < ? AND check_out >= ?)
```

### Revenue Calculations
- Supports tax-included/excluded pricing
- 5% Taiwan sales tax handling
- Multiple currency reporting formats (integers only for TWD)

## Environment Configuration

Required `.env` variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
- `PORT` - Server port (default 3000)
- `NODE_ENV` - development/production
- Rate limiting and security settings

## Common Development Patterns

### Adding New Endpoints
1. Add validation schema to `middleware/validation.js`
2. Add route handler to appropriate file in `routes/`
3. Update `test-api.js` with test cases
4. Test with existing Taiwan test data

### Database Operations
- Always use `executeQuery()` with prepared statements
- Use `executeTransaction()` for multi-step operations
- Handle MySQL errors with appropriate HTTP status codes
- Cast integer parameters for LIMIT/OFFSET operations

### Taiwan Localization
- All user-facing strings in Traditional Chinese
- Date formats should support Taiwan business calendar
- Address formats follow Taiwan postal conventions
- Phone and ID validation must use Taiwan-specific patterns

## Documentation Files

- `API_DOCUMENTATION.md` - Complete endpoint reference
- `booking_test_scenarios.md` - Test scenarios and edge cases
- `QUICK_START.md` - Setup instructions for all platforms
- `README.md` - Project overview in Traditional Chinese