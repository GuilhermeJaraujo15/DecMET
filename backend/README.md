# DecMET Backend - Airport Search API

This is the backend API server for the DecMET (Decodificador Meteorológico Aeronáutico) system. It provides endpoints for searching airports and airport codes from a local MySQL database.

## Overview

The DecMET backend is a Node.js/Express application that:
- Serves airport search APIs from a MySQL database
- Provides autocomplete/suggestions for airport searches
- Implements secure database access with prepared statements
- Uses environment variables for credentials (no hardcoded secrets)
- Supports CORS for local development with the frontend

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm
- MySQL server running locally or accessible
- DecMET MySQL database already created and populated with OurAirports data
- Database user with appropriate permissions

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a local `.env` file by copying the example:
```bash
cp .env.example .env
```

4. Edit `.env` with your local MySQL credentials:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=decmet_user
DB_PASSWORD=your_actual_password_here
DB_NAME=decmet_airports
PORT=3000
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

**Important:** Never commit the real `.env` file. Only `.env.example` should be in version control.

### Starting the Server

Run the server in development mode:
```bash
npm run dev
```

Or start it normally:
```bash
npm start
```

You should see output like:
```
🚀 DecMET Backend running on http://localhost:3000
📡 CORS enabled for: http://127.0.0.1:5500
✓ API endpoints available at http://localhost:3000/api/aeroportos
```

## API Endpoints

### Full Airport Search

**GET** `/api/aeroportos?search=<query>`

Returns complete airport search results based on a search query.

**Query Parameters:**
- `search` (required): Search term (1-100 characters)

**Example Requests:**
```
GET http://localhost:3000/api/aeroportos?search=SBGR
GET http://localhost:3000/api/aeroportos?search=guarulhos
GET http://localhost:3000/api/aeroportos?search=GRU
```

**Response (Success):**
```json
{
  "success": true,
  "count": 1,
  "results": [
    {
      "id": 12345,
      "ident": "SBGR",
      "icao_code": "SBGR",
      "gps_code": "SBGR",
      "iata_code": "GRU",
      "name": "São Paulo/Guarulhos International Airport",
      "municipality": "Guarulhos",
      "iso_region": "SP",
      "iso_country": "BR",
      "type": "large_airport",
      "latitude_deg": -23.435556,
      "longitude_deg": -46.473056,
      "elevation_ft": 2459,
      "display_icao": "SBGR"
    }
  ]
}
```

**Response (No Results):**
```json
{
  "success": true,
  "count": 0,
  "results": [],
  "message": "No airports found for this search"
}
```

**Response (Error):**
```json
{
  "error": "Invalid search query",
  "message": "Search term must be 1-100 characters"
}
```

### Autocomplete Suggestions

**GET** `/api/aeroportos/sugestoes?search=<query>`

Returns lightweight autocomplete suggestions while the user is typing.

**Query Parameters:**
- `search` (required): Search term (minimum 2 characters for codes, 3 for text)

**Example Requests:**
```
GET http://localhost:3000/api/aeroportos/sugestoes?search=SB
GET http://localhost:3000/api/aeroportos/sugestoes?search=gua
GET http://localhost:3000/api/aeroportos/sugestoes?search=BR
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "suggestions": [
    {
      "id": 12345,
      "ident": "SBGR",
      "icao_code": "SBGR",
      "gps_code": "SBGR",
      "iata_code": "GRU",
      "name": "São Paulo/Guarulhos International Airport",
      "municipality": "Guarulhos",
      "iso_country": "BR",
      "type": "large_airport",
      "display_icao": "SBGR"
    },
    {
      "id": 12346,
      "ident": "SBSP",
      "icao_code": "SBSP",
      "gps_code": "SBSP",
      "iata_code": "CGH",
      "name": "Congonhas Airport",
      "municipality": "São Paulo",
      "iso_country": "BR",
      "type": "large_airport",
      "display_icao": "SBSP"
    }
  ]
}
```

### Health Check

**GET** `/health`

Simple endpoint to verify the backend is running.

**Response:**
```json
{
  "status": "ok",
  "message": "DecMET backend is running"
}
```

## Search Algorithm

The search endpoints use a multi-field search strategy:

1. **Exact code matches** (highest priority):
   - `ident` (OurAirports identifier)
   - `gps_code`
   - `icao_code`
   - `iata_code`

2. **Text-based matches**:
   - Airport `name` (LIKE queries)
   - `municipality` (LIKE queries)
   - `keywords` field

3. **Result sorting**:
   - Exact matches first
   - Large airports before medium/small
   - Alphabetically by name

4. **Display code priority** (display_icao field):
   - Prefers `icao_code` if available
   - Falls back to `gps_code`
   - Falls back to 4-letter `ident`
   - Uses `null` otherwise

## Database Schema

The backend queries the following table structure:

- `airports` - Main table with airport/aerodrome data
  - `id` - Unique identifier
  - `ident` - OurAirports identifier
  - `name` - Airport name
  - `icao_code` - ICAO code (may be null or empty)
  - `gps_code` - GPS code
  - `iata_code` - IATA code
  - `type` - Airport type (large_airport, medium_airport, small_airport, heliport, etc.)
  - `municipality` - City/municipality
  - `iso_region` - Region code
  - `iso_country` - Country code (2-letter ISO)
  - `latitude_deg`, `longitude_deg` - Coordinates
  - `elevation_ft` - Elevation in feet
  - `keywords` - Additional search keywords

## Frontend Integration

The frontend (`aerodromo.js`) connects to this backend with:

- API base URL: `http://localhost:3000`
- Autocomplete debounce: 300ms
- Min characters for code search: 2
- Min characters for text search: 3
- Suggestions limit: 10
- Full results limit: 25

The frontend implements:
- Real-time autocomplete as the user types
- Keyboard navigation (Arrow up/down, Enter, Escape)
- Abort requests to cancel outdated suggestions
- Error handling and user-friendly messages

## Security Considerations

✓ **Credentials Protection:**
- Database credentials stored in `.env` (excluded from version control)
- No credentials in frontend code
- No credentials in `.env.example`

✓ **SQL Injection Prevention:**
- Uses prepared statements with parameterized queries
- Never uses string interpolation for SQL
- Validates query length and format

✓ **CORS Configuration:**
- Restricted to frontend origin in development
- Can be adjusted for production

✓ **Error Handling:**
- Graceful error messages
- Stack traces hidden in production
- Logs errors server-side

## Troubleshooting

### "Error: connect ECONNREFUSED 127.0.0.1:3306"
- Check if MySQL is running
- Verify DB_HOST and DB_PORT in `.env`
- Check database user/password

### "Error: Access denied for user 'decmet_user'@'localhost'"
- Verify credentials in `.env`
- Check if database user exists
- Verify user permissions for `decmet_airports` database

### "No airports found" when searching
- Verify data was imported into the `airports` table
- Check if the search query is valid
- Try searching by ICAO code (e.g., SBGR)

### CORS errors in browser
- Verify `FRONTEND_ORIGIN` matches frontend URL
- Check frontend is running on correct port
- Verify backend is accessible from frontend

## Performance Notes

- Autocomplete limited to 10 results (lightweight)
- Full search limited to 25 results
- Uses database indexes for fast queries
- Connection pool: 10 concurrent connections
- Consider adding full-text search indexes for very large datasets

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| DB_HOST | 127.0.0.1 | MySQL host address |
| DB_PORT | 3306 | MySQL port |
| DB_USER | - | MySQL username |
| DB_PASSWORD | - | MySQL password |
| DB_NAME | decmet_airports | Database name |
| PORT | 3000 | Backend server port |
| FRONTEND_ORIGIN | http://127.0.0.1:5500 | Frontend URL for CORS |
| NODE_ENV | development | Environment (development/production) |

## Future Enhancements

- [ ] Authentication/API keys for production
- [ ] Rate limiting
- [ ] Request caching
- [ ] Full-text search optimization
- [ ] Additional airport metadata endpoints
- [ ] METAR data integration
- [ ] Airport runway information
- [ ] Frequency data (ATIS, Ground, Tower)

## Support

For issues or questions about the DecMET backend, check:
1. The error message in the browser console
2. Backend logs in the terminal
3. `.env` configuration
4. MySQL database connection
