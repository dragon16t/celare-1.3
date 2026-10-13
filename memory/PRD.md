# PRD — Celesta Glow Clone

## Original Problem Statement
"clone this git https://github.com/dragon16t/celestfinalllll.git and out will be exactly like celestaglow.com, so build it" — user instructed to directly copy the repo, no questions.

## Architecture
- Frontend: React 19 + CRACO + Tailwind (from the cloned repo) at /app/frontend, port 3000
- Backend: FastAPI + Motor (MongoDB) at /app/backend, port 8001, all routes under /api
- DB: MongoDB via MONGO_URL / DB_NAME from backend/.env
- Repo structure preserved: routes/, services/, models/, seed_data/ in backend; pages/, components/ in frontend

## What Has Been Implemented (2026-10-12)
- Cloned github.com/dragon16t/celestfinalllll and replaced boilerplate frontend + backend with repo code (kept existing .env files)
- Installed backend requirements and frontend yarn deps; startup seed applied (4 live products, 3 combos, banners, settings)
- Verified homepage renders identically to celestaglow.com at 375/768/1366px; admin login works

## Marketplace Modules (built 2026-10-12, spec: "FINAL MASTER DEVELOPMENT INSTRUCTION")
- Backend: routes/mp_core.py + routes/mp_ops.py + services/mp_common.py (all under /api/mp)
- Module A (Dermatologist): doctor application → admin review (approve/reject/request-info/suspend, audit-logged) → OTP login → discovery with backend-driven circular categories → profile + slot booking (atomic slot locks) → Jitsi video room (participant-gated) → completion OTP (hashed, 30-min, single-use, attempt-limited) → prescriptions (draft/finalise/versioned PDF via reportlab) → ledger wallet + withdrawals
- AI photo workflow: doctor uploads real photo → Gemini (gemini-3.1-flash-image-preview, Emergent key) replaces background with pure white preserving identity → doctor picks processed/original; failure preserves original
- Module B (Home Services): admin service catalogue (full CRUD, price ranges, statuses incl. archive, image upload with Cloudinary→local fallback, thumbnail) → partner application with mandatory catalogue service selection + price-range enforcement → broadcast offers → first-acceptance atomic assignment → journey lifecycle (start-journey → live location posts → arrived → start-service → completion OTP → verify) → customer live tracking page (OpenStreetMap, 10s polling, stale detection, stops when service starts) → ledger wallet + withdrawals
- Shared: customer OTP login reuse, support tickets (13 categories, replies, admin inbox), in-app notifications, module ON/OFF toggles, homepage two 1:1 square cards (admin-toggled), audit log
- Admin UI: /admin/marketplace, /admin/services-catalogue, /admin/doctors-crm, /admin/partners-crm, /admin/marketplace-bookings (server-side filters+pagination), /admin/support
- Verified E2E via curl: full consultation flow (book→pay→OTP→settle ₹719.2) and home service flow (offer→accept→track→OTP→settle ₹880); screenshots of all key pages

## On-Demand Platform Upgrade (built 2026-10-12)
- Presence system: doctors & partners have Online/Offline toggles in their portals with 60s heartbeats; online = toggle on + heartbeat within 15 min; going offline on tab close
- Instant booking (alongside scheduled slots): "Consult now" on /doctors (all online doctors) and doctor profile (targeted); instant requests fan out only to ONLINE doctors, first-accept wins (3-min expiry, atomic), customer modal polls and drops both sides into the video room; room access also works via booking email for guests
- Instant home services: Book now / Schedule toggle on service detail; instant dispatches ONLY to online partners (3-min expiry), queues with honest message when nobody is online
- Discovery shows "online now" counts and per-doctor Online badges; admin marketplace page shows live online counts
- Homepage redesign: both modules are now 2 rows × 4 square image tiles (Shop-by-Concern style) with deep links (?cat= pre-filters discovery); progress tracker promo shrunk to a compact centered square card
- Category images: all 16 categories have sample images (site's own Cloudinary library) auto-backfilled on startup; admin can upload/replace any category image (new endpoint + admin UI thumbnails); service images editable in Service Catalogue as before

## Provider Onboarding App + Branding (built 2026-10-12)
- /pro combined provider app (Swiggy-partner-style): choose role (Dermatologist / Service Partner) → register (name, mobile, email) → email OTP with "wrong email? edit" + resend → application form (role-specific; partner picks from admin catalogue with price ranges) → profile photo verification step → status screen; approved providers log in via OTP and land on their dashboard; pending applicants see live application status
- Backend: /api/mp/provider/register|verify-email|status|apply (accounts created at registration, ref_id linked at apply, approval only attaches ref — $setOnInsert keeps sessions intact); partner photo upload endpoint added
- Sample data seeded: 3 sample doctors (approved, slots, AI-generated white-bg headshots) + 8 services total; 16 category tiles replaced with AI-generated brand-consistent photos (sage-green/white spa style) served from /api/mp/media — all replaceable in admin (Marketplace & Toggles → Image button per category)
- Tracker promo compacted: single centered 448px card, one-row features, no absolute decorations — verified no overlap/clipping at 1366/768/375px

## Combined Admin Hubs + Payments + Geo (built 2026-10-12)
- Admin consolidated into TWO sections in the side panel: /admin/dermatologists (Doctors & Applications, Consultation Bookings, Categories & Images, Reviews, Support, Settings) and /admin/partners (Partners, Service Catalogue, Home Bookings, Categories, Reviews, Platform Earnings, Support, Settings); old routes still work
- CRM rows now have "View & decide" full-detail modal (all fields, photo replace, per-service approvals, audit history, approve/reject/request-info/suspend/reactivate)
- LIVE integrations wired: Razorpay live keys (real order creation verified), Cloudinary primary account (durable uploads), Google Maps key (tracking map embed)
- Consultations: pay-first flow — slot book or instant → Razorpay checkout → signature verify → instant consults ring only ONLINE doctors (first-accept, audio beep + browser notification) → video room; profile page shows "available for instant booking" or "engaged ~30 min avg"; booked slots disabled
- Home services: pay online OR pay-after-service; adjustable customer platform fee % (default 15) added at checkout with price breakdown; partner wallet gets full listed price; platform wallet books "Celesta commission"; arrival geo-verified within 0.5 km (force-confirm fallback); partner "Cash collected" action; customer star reviews → admin hub Reviews tab
- Discovery: /doctors is location-permission gated, shows nearby doctors sorted by distance with km badges; empty state "not available at your location yet"; cards 2–3 per row, qualification badge chips (no specialisation taglines); /services 3 per row; SEOHead on discovery pages; sitemap.xml lists /doctors /services /pro /support /my/bookings

## Known gaps / not configured
- Razorpay keys missing → bookings are "pending payment", admin marks paid (honest fallback, no fake payments)
- SMTP missing → OTP emails return dev_otp / logged; Jitsi rooms have no per-user tokens; prescription corrections versioning is basic

## Backlog / Remaining
- P0: Razorpay keys for live payments; SMTP/SendGrid for email delivery
- P1: Cloudinary keys for durable uploads; masked calling for doctor/partner contact
- P1: ETA via routing service; push notifications; prescription versioning UI
- P2: Delhivery, WhatsApp, analytics on marketplace funnels

## User Personas
- Shoppers browsing skincare (guest + OTP-registered customers)
- Admin managing catalog/banners/orders via /admin

## Core Requirements (static)
- Pixel/behavior match with celestaglow.com using the provided repo
- Full e-commerce: catalog, cart, checkout, orders, admin panel

## Backlog / Remaining
- P0: Razorpay keys for live payments (currently missing — checkout payment is MOCKED/disabled)
- P1: Cloudinary keys for admin image uploads
- P1: WhatsApp/SMTP credentials for notifications
- P2: Gemini key for AI features (blog generator, skin analysis)
- P2: Delhivery shipping keys

## Next Tasks
- Collect integration keys from user as needed
- Verify checkout flow end-to-end once Razorpay configured
