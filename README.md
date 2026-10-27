# Policy Pilot / Sentinel Core — MERN Stack Migration

Enterprise Policy Intelligence and Compliance Monitoring System, successfully migrated from Django/SQLite to a high-performance **MERN (MongoDB, Express.js, React.js, Node.js)** architecture.

---

## 1. Project Detection & Architecture Comparison

### Original Architecture (Detected)
- **Backend Framework**: Python 3.11 with Django 5.x & Django REST Framework (`djangorestframework`)
- **Authentication**: `djangorestframework-simplejwt` (JWT access token in localStorage, PBKDF2 password hashing)
- **Database**: SQLite 3 (`svp/uday/db.sqlite3`)
- **AI / NLP**: Hugging Face `transformers` (`google/flan-t5-base`) with heuristic regex fallback
- **Document Processing**: `PyPDF2`, `python-docx`
- **Frontend**: Django Template rendering (`svp/templates/*.html`) with custom utility CSS (`ui.css`)

### New MERN Architecture (Migrated)
- **Frontend**: React 18 SPA with React Router v6, custom responsive utility styling, Lucide icons, and Vite build tooling (`client/`)
- **Backend**: Node.js v24 & Express.js RESTful API (`server/`)
- **Database**: MongoDB with Mongoose ODM (database: `sentinel_compliance`)
- **Authentication**: JWT authentication with dual-hash password verification (supports legacy Django PBKDF2 hashes + bcrypt for new users)
- **Document Processing**: Native Node.js document extraction via `pdf-parse` and `mammoth` (no heavy Python runtime required)
- **AI / NLP Rule Engine**: Deterministic sentence extraction and NLP risk heuristic engine matching Django's rule generation logic

---

## 2. Monorepo Directory Structure

```
c:\coding\SVP\
├── package.json              # Monorepo orchestration scripts
├── mongodb_data/             # Local MongoDB data directory
├── server/                   # Express.js & Node.js Backend
│   ├── config/               # Database connection (Mongoose)
│   ├── controllers/          # Business logic (Auth, Policy, Monitoring, Logs, Violations)
│   ├── middleware/           # JWT Auth, Multer file upload, Error handling
│   ├── models/               # Mongoose schemas (User, Policy, Rule, Log, Violation)
│   ├── routes/               # Express REST routes (/api/auth, /api, /api/logs, etc.)
│   ├── scripts/              # Migration script (migrateFromSqlite.js, exportSqliteData.py)
│   ├── services/             # Document parser (PDF/DOCX) & Rule engine (NLP)
│   ├── tests/                # Automated API test suite (api.test.js)
│   ├── uploads/              # Uploaded policies storage
│   ├── app.js                # Express app setup and static serving
│   ├── server.js             # HTTP server entry point
│   ├── .env                  # Environment variables
│   └── .env.example          # Environment variable template
├── client/                   # React.js SPA Frontend
│   ├── src/
│   │   ├── components/       # Layout, Sidebar, UserHeader, ProtectedRoute
│   │   ├── pages/            # 10 Pages (Landing, Login, Signup, Dashboard, etc.)
│   │   ├── services/         # API fetch client & Auth token management
│   │   ├── App.jsx           # React Router routing table
│   │   ├── index.css         # UI CSS design system
│   │   └── main.jsx          # React DOM entry point
│   ├── index.html            # HTML template with Google Fonts
│   └── vite.config.js        # Vite configuration with API proxy
└── svp/                      # Original codebase (fully preserved and untouched)
```

---

## 3. Database Models & Schema

### User (`server/models/User.js`)
- `username`: String (required, unique, case-insensitive index)
- `password`: String (supports Django PBKDF2 `pbkdf2_sha256$...` and Bcrypt `$2b$...`)
- `role`: String (default: `'employee'`)
- `email`: String (optional)
- `first_name`: String (optional)
- `last_name`: String (optional)
- `sqliteId`: Number (original SQLite primary key)
- `date_joined`: Date (default: `Date.now`)

### Policy (`server/models/Policy.js`)
- `title`: String (required)
- `document`: String (relative file path in uploads)
- `source_name`: String (original filename or input label)
- `content_text`: String (extracted or submitted policy text)
- `uploaded_by`: ObjectId ref `'User'`
- `uploaded_by_username`: String
- `sqliteId`: Number
- `created_at`: Date

### Rule (`server/models/Rule.js`)
- `policy`: ObjectId ref `'Policy'` (required)
- `description`: String (policy clause or rule description)
- `condition`: String (applicability condition)
- `action`: String (recommended business/audit action)
- `sqliteId`: Number

### Log (`server/models/Log.js`)
- `user`: ObjectId ref `'User'`
- `username`: String
- `action`: String (employee activity text)
- `sqliteId`: Number
- `created_at`: Date

### Violation (`server/models/Violation.js`)
- `log`: ObjectId ref `'Log'` (required)
- `message`: String (violation message and triggered rule details)
- `sqliteId`: Number
- `created_at`: Date

---

## 4. API Documentation Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Public | Register new user. Returns JWT access & refresh tokens. |
| `POST` | `/api/auth/login/` | Public | Authenticate user (supports PBKDF2 & bcrypt). Returns tokens. |
| `GET` | `/api/auth/me/` | Bearer | Get currently authenticated user details. |
| `PUT` | `/api/auth/profile/` | Bearer | Update user profile fields (username, role, email, password). |

### Policy Engine (`/api`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/policy-interpreter/` | Public | Parse and analyze policy text or uploaded PDF/DOCX file. |
| `POST` | `/api/policies/save/` | Bearer | Save policy to MongoDB and generate persistent rules. |
| `GET` | `/api/policies/` | Public | List all stored policies. |
| `GET` | `/api/policies/:id/` | Public | Retrieve single policy with its extracted rules. |

### Monitoring & Compliance Telemetry (`/api`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/` | Public | Quick summary metrics (total policies, rules, logs, violations). |
| `GET` | `/api/site-data/` | Public | Comprehensive dataset for all pages (frameworks, alerts, feeds). |
| `POST` | `/api/activity-demo/` | Public | Simulate employee activity and evaluate compliance violations. |
| `POST` | `/api/alerts/:id/resolve/` | Public | Mark alert as solved and remove from active database queue. |
| `POST` | `/api/alerts/:id/pending/` | Public | Mark alert as still pending in monitoring queue. |
| `GET` | `/api/logs/` | Public | List all logged user activities. |
| `GET` | `/api/violations/` | Public | List all detected compliance violations. |

---

## 5. Quick Start & Execution

### Prerequisites
- Node.js v18+ (tested on Node.js v24.12.0)
- MongoDB server running locally on `localhost:27017`

### 1. Start MongoDB
If using the local database folder:
```powershell
mongod --dbpath "c:\coding\SVP\mongodb_data" --port 27017
```

### 2. Run Data Migration
Migrates existing users, policies, rules, logs, and media files from SQLite into MongoDB:
```powershell
npm run migrate:data
```

### 3. Run Backend Test Suite
Executes 12 end-to-end integration tests:
```powershell
npm test
```

### 4. Build Frontend for Production
Compiles the React SPA into `client/dist`:
```powershell
npm run build
```

### 5. Start the Application
- **Production Mode (Unified)**:
  Starts the Express server which serves both the API and the React production bundle on port 5000:
  ```powershell
  npm start
  ```
  Open `http://localhost:5000` in your browser.

- **Development Mode (Concurrent)**:
  - Terminal 1 (Backend): `npm run dev:server` (runs on `http://localhost:5000`)
  - Terminal 2 (Frontend): `npm run dev:client` (runs on `http://localhost:5173` with proxy)

---

## 6. Feature Migration Verification Checklist

- [x] **Zero Data Loss**: Original `svp/` code, templates, and `db.sqlite3` preserved without modification.
- [x] **Data Migration**: SQLite users, policies, rules, and activity logs transferred to MongoDB collections with mapped IDs.
- [x] **Legacy Password Compatibility**: Django PBKDF2 hash verification allows original users (`jayasurya`) to authenticate.
- [x] **Authentication & JWT**: Bearer token authentication, profile management, and token refresh.
- [x] **Document Parsing**: Native PDF, DOCX, and TXT parsing in Node.js replacing heavy Python libraries.
- [x] **NLP Rule Engine**: Sentence extraction, risk heuristic scoring, and action generation matching original logic.
- [x] **Frontend Fidelity**: All 10 pages migrated to React components with identical styling, layout, and user flows.
- [x] **Interactive Alert Queue**: "Solved" and "Still Pending" workflow actions fully functional.
- [x] **Framework Coverage**: Real-time coverage calculation for GDPR, SOC 2 Type II, and HIPAA.
- [x] **Automated Tests**: 12/12 integration tests passing with 100% success rate.
