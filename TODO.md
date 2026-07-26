# MT Club React Website Implementation TODO

## Setup and Dependencies
- [x] Set up React project with create-react-app
- [x] Install additional dependencies: react-router-dom, firebase, qrcode, html5-qrcode, react-webcam, react-icons
- [ ] Configure Firebase (auth, Firestore, storage)

## Project Structure
- [ ] Create src/components/: Header, Footer, Home, Achievements, Events, Gallery, Registration, AdminDashboard, Login, QRScanner, EventCard, AchievementCard, GalleryItem
- [ ] Create src/styles/: CSS files for each component
- [ ] Create src/context/: AuthContext for authentication
- [ ] Create src/utils/: QR generation helpers

## Routing and Authentication
- [ ] Implement routing with React Router: /, /achievements, /events, /gallery, /registration, /admin, /login
- [ ] Implement Firebase Auth for single admin login
- [ ] Protect admin routes

## Core Features
- [ ] Home: Welcome page with overview
- [ ] Achievements: Display achievements with images/descriptions from Firestore/Storage
- [ ] Events: List events, allow Going/Not Going responses, admin create/close events
- [ ] Gallery: Display photos from past events (from Storage)
- [ ] Registration: Form for new members (name, email, photo), admin enable/disable
- [ ] Admin Dashboard: Manage all features, toggle settings, view logs, manage content
- [ ] QR Attendance: Generate QR for events, scan to log attendance with time/date/location

## UI/UX
- [ ] Ensure responsive design (mobile, tablet, desktop)
- [ ] Clean, modern design for MT Club branding
- [ ] Navigation bar with links

## Additional Features
- [ ] Browser notifications for upcoming events
- [ ] Admin documentation

## Testing and Deployment
- [ ] Test all features locally
- [ ] Deploy to Firebase Hosting (optional)
