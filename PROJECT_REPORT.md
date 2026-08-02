# MT Club — Technical Report

## Overview
MT Club is a university club management web application with native mobile support (Android/iOS via Capacitor). It handles events, attendance tracking (QR-based), team management, gallery, achievements/points, and push notifications — all backed by Supabase and Express.js.

---

## Tech Stack

### Frontend
| Category | Technology |
|---|---|
| Framework | React 18.3 (ES Modules) |
| Build Tool | Vite 7.3 |
| Routing | React Router DOM 6.15 |
| Styling | Tailwind CSS 4.18 + PostCSS |
| Animation | Framer Motion 12.42 |
| HTTP Client | Axios 1.14 |
| QR Scanning | @zxing/browser + @zxing/library |
| QR Generation | qrcode.react + qrcode |
| Spreadsheet | xlsx + xlsx-js-style |
| Icons | Lucide React, React Icons, Boxicons |
| Push Notifications | react-onesignal 3.5.6 (OneSignal Web SDK v16) |
| 3D Graphics | @splinetool/react-spline |

### Backend
| Category | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js 4.18 |
| Database | Supabase (PostgreSQL) via @supabase/supabase-js 2.108 |
| Auth | JWT (jsonwebtoken 9.0) + bcryptjs |
| File Upload | Multer 1.4 |
| Push Notifications | OneSignal REST API v2 |
| Deploy | Vercel (serverless) |

### Mobile (Capacitor 8.4)
| Plugin | Purpose |
|---|---|
| @capacitor/android | Android wrapper |
| @capacitor/ios | iOS wrapper |
| @capacitor/camera | Camera access (QR scan) |
| @capacitor/device | Device info |
| @capacitor/network | Online/offline detection |
| @capacitor/local-notifications | Local push |
| @capacitor/preferences | Key-value storage |
| @capacitor/share | Native share sheet |
| @capacitor/splash-screen | Splash screen |
| @capacitor/status-bar | Status bar styling |
| @capacitor/keyboard | Keyboard handling |

### Testing
| Tool | Scope |
|---|---|
| Vitest 4.1 | Unit/Integration tests |
| @testing-library/react | Component tests |
| Playwright 1.61 | E2E tests |
| Supertest 7.2 | API tests |
| MSW 2.15 | API mocking |
| @vitest/coverage-v8 | Code coverage |

---

## Project Structure

```
mt-club1/
├── src/                          # Frontend (61 files)
│   ├── pages/                    # 12 pages (lazy-loaded)
│   │   ├── Home.jsx
│   │   ├── Events.jsx
│   │   ├── EventDetails.jsx
│   │   ├── Gallery.jsx
│   │   ├── Profile.jsx
│   │   ├── Team.jsx
│   │   ├── Achievements.jsx
│   │   ├── Attendance.jsx
│   │   ├── scanAttendance.jsx
│   │   ├── QRCode.jsx
│   │   ├── AdminPanel.jsx
│   │   └── AdminAccounts.jsx
│   ├── components/               # 16 components
│   │   ├── authmodal.jsx
│   │   ├── BottomNav.jsx
│   │   ├── Header.jsx
│   │   ├── Hero.jsx
│   │   ├── NotificationPermissionModal.jsx
│   │   ├── Toast.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── LoadingScreen.jsx
│   │   ├── ImageViewer.jsx
│   │   ├── SkeletonLoader.jsx
│   │   └── ...
│   ├── hooks/                    # 6 custom hooks
│   │   ├── useApi.js
│   │   ├── useCachedData.js
│   │   ├── useDebounce.js
│   │   ├── useNativeInit.js
│   │   ├── useNotificationPermission.js
│   │   └── useNotifications.js
│   ├── context/                  # 5 context providers
│   │   ├── AuthContext.jsx
│   │   ├── LanguageContext.jsx
│   │   ├── NetworkContext.jsx
│   │   ├── ThemeContext.jsx
│   │   └── UserContext.jsx
│   ├── services/                 # API services
│   │   ├── authService.js
│   │   ├── cache.js
│   │   ├── onesignal.js
│   │   ├── platform.js
│   │   └── native/              # 9 Capacitor wrappers
│   ├── utils/
│   │   ├── axios.js
│   │   └── notificationPermissionManager.js
│   ├── App.jsx
│   └── main.jsx
│
├── backend/                      # Express.js API
│   ├── routes/                   # 9 route files
│   │   ├── auth.js              # /api/auth
│   │   ├── events.js            # /api/events
│   │   ├── attendance.js        # /api/attendance
│   │   ├── admin.js             # /api/admin
│   │   ├── settings.js          # /api/settings
│   │   ├── posts.js             # /api/posts
│   │   ├── team.js              # /api/team
│   │   ├── gallery.js           # /api/gallery
│   │   └── notifications.js     # /api/notifications
│   ├── utils/
│   │   ├── onesignal.js         # OneSignal REST API wrapper
│   │   ├── points.js            # Points/achievements logic
│   │   ├── storage.js           # Supabase storage
│   │   └── hash.js              # Password hashing
│   ├── migrations/               # 13 SQL files
│   ├── server.js
│   ├── seed.js
│   └── config/
│
├── capacitor.config.json         # Mobile config (com.mtclub.app)
├── vite.config.mjs               # Build config with code splitting
├── index.html
└── package.json
```

---

## Features

### 1. Authentication
- JWT-based auth with Bearer tokens
- Login/Register via email + password
- Role-based access: `member`, `leader`, `admin`
- Protected routes via `ProtectedRoute` component
- Session persistence via localStorage

### 2. Events
- Create/edit/delete events (admin/leader)
- Event details with location, date, description
- Event images upload
- Attendance tracking per event
- Location-based check-in with inside/outside zone detection

### 3. Attendance System
- QR code generation per event
- QR code scanning via device camera (@zxing)
- Real-time attendance marking
- Manual attendance (admin panel)
- Attendance history and statistics
- Export attendance to Excel (xlsx)

### 4. Gallery
- Image upload and display
- Image viewer with zoom
- Gallery management (admin)

### 5. Team Management
- Team members listing with roles and committees
- Leader designation
- Member profiles with points

### 6. Achievements & Points System
- Points awarded for attendance, events, contributions
- Achievement badges
- Points leaderboard
- Configurable points per action

### 7. Push Notifications (OneSignal v16)
- OneSignal Web SDK integration
- Custom permission modal (not browser default)
- localStorage-based cooldown (4-hour dismiss tracking)
- Permission states: default → show popup, granted → verify subscription, denied → show instructions
- Targets: all users, specific users, committee, role, tag, segment, external ID
- Notification history with delivery/opened/clicked tracking
- Retry failed notifications
- Role & tag targeting for granular delivery
- Silent/rich notifications with buttons, deep links, images
- Admin diagnostics tab

### 8. Admin Panel
- User management (edit roles, points, ban)
- Event management
- Attendance management with export
- Notification management with targeting
- Settings management
- Real-time analytics cards (9 metrics)
- Diagnostics for push notification system

### 9. Mobile (Capacitor)
- Android + iOS native wrappers
- Camera integration for QR scanning
- Splash screen, status bar, keyboard handling
- Offline detection with banner
- Native share functionality
- Local notifications support

### 10. UI/UX
- Dark theme (default)
- Responsive design (mobile-first)
- Page transitions (Framer Motion)
- Loading skeletons
- Toast notifications
- Offline banner
- Bottom navigation
- Glassmorphism effects
- Error boundary for crash isolation

---

## Database Schema (Supabase)

### Core Tables
| Table | Purpose |
|---|---|
| `members` | User accounts (id, name, email, password, role, points, committee, etc.) |
| `events` | Club events (title, description, date, location, image, etc.) |
| `attendance` | Attendance records (member_id, event_id, attended, timestamp) |
| `team` | Team members info |
| `posts` | Club posts/announcements |
| `gallery` | Gallery images |
| `settings` | App settings |
| `notification_history` | Sent notifications log |
| `notification_analytics` | Notification performance metrics |

### Key Member Columns (added via migrations)
- `onesignal_id` — OneSignal subscription ID
- `onesignal_user_id` — OneSignal internal user ID
- `push_browser`, `push_platform`, `push_language`, `push_timezone`, `push_user_agent`, `push_last_seen` — Device metadata
- `points`, `attendance_count` — Gamification
- `committee` — Department/team assignment
- `role` — member | leader | admin

---

## API Endpoints Summary

### Auth (`/api/auth`)
- `POST /register` — Create account
- `POST /login` — Authenticate
- `GET /profile` — Get current user profile
- `PUT /profile` — Update profile

### Events (`/api/events`)
- `GET /` — List events
- `GET /:id` — Event details
- `POST /` — Create event (admin/leader)
- `PUT /:id` — Update event
- `DELETE /:id` — Delete event

### Attendance (`/api/attendance`)
- `POST /mark` — Mark attendance
- `GET /:eventId` — Get event attendance
- `GET /history/:memberId` — Member attendance history
- `GET /export/:eventId` — Export to Excel

### Notifications (`/api/notifications`)
- `POST /register` — Register subscription
- `DELETE /unregister` — Unregister
- `POST /save-oneSignal-id` — Sync device info
- `POST /send` — Send notification (all/user/users/committee/role/tag/segment)
- `POST /retry/:onesignalId` — Retry failed
- `GET /history` — Notification history
- `DELETE /history` — Clear history
- `GET /stats` — Analytics
- `GET /diagnostics` — System health

### Admin (`/api/admin`)
- User management, role changes, points adjustment

### Team (`/api/team`)
- Team member CRUD

### Gallery (`/api/gallery`)
- Image upload/delete

### Settings (`/api/settings`)
- App configuration

---

## Build & Deployment

| Item | Detail |
|---|---|
| Frontend Deploy | Vercel (static) |
| Backend Deploy | Vercel (serverless) |
| Database | Supabase (PostgreSQL) |
| Build | `vite build` → `dist/` |
| Code Splitting | Manual chunks: vendor-react, vendor-ui, vendor-xlsx, vendor-qr, vendor-scanner |
| Chunk Size Warning | 800 KB |
| Total Source Files | ~61 frontend + ~30 backend |
| Tests | 68 backend tests (all passing) |

---

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=              # Backend API URL (empty = same origin)
VITE_ONESIGNAL_APP_ID=     # OneSignal App ID
```

### Backend (.env)
```
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
JWT_SECRET, JWT_EXPIRES=24h
PORT=5001
ALLOWED_ORIGINS=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

---

## Testing

| Command | Description |
|---|---|
| `npm test` | Frontend unit tests (Vitest) |
| `npm run test:backend` | Backend API tests |
| `npm run test:all` | All tests (frontend + backend + E2e) |
| `npm run test:frontend:coverage` | Frontend with coverage |
| `npm run test:backend:coverage` | Backend with coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run lint` | ESLint check |

**Current Status:** 68/68 backend tests passing.

---

## Key Technical Decisions

1. **Supabase over raw PostgreSQL** — Managed database with built-in auth, storage, and real-time
2. **OneSignal over FCM** — Cross-platform push without managing Firebase config; better web push support
3. **Custom permission modal over browser default** — Branded UX, dismiss cooldown, better conversion
4. **Capacitor over React Native** — Single codebase for web + mobile, lower maintenance
5. **Vite over CRA** — Faster builds, better DX, native ESM
6. **Serverless (Vercel)** — Zero infrastructure management, auto-scaling
7. **Lazy loading all pages** — Smaller initial bundle, faster first paint
8. **Manual chunk splitting** — Controlled bundle sizes for vendor libraries

---

*Report generated: July 2026*
