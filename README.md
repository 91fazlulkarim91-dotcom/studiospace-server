# StudioSpace API

Express and MongoDB API for StudioSpace. It provides password-based registration and login, JWT session cookies, studio CRUD, booking requests with confirmed-slot overlap checks, and a favorites collection.

## Setup

1. Install Node.js 20.19+ and run `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`, a long random `JWT_SECRET`, and `CLIENT_ORIGIN`.
3. Start MongoDB, then run `npm run dev`.
4. Check `GET http://localhost:4000/api/health`.

Never commit `.env`. In production, serve the client and API over HTTPS and configure `CLIENT_ORIGIN` to the exact client origin. The JWT is stored in an HTTP-only, SameSite=Lax cookie. Mutations require a valid session; studio changes are restricted to their owner.

## Routes

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Google OAuth: `GET /api/auth/google` and `GET /api/auth/google/callback` (requires the three Google OAuth values in `.env`).
- `GET /api/studios`, `GET /api/studios/:id`, `POST /api/studios`, `PATCH /api/studios/:id`, `DELETE /api/studios/:id`
- `GET /api/my/studios`, `POST /api/bookings`, `GET /api/my/bookings`, `PATCH /api/bookings/:id/cancel`
- `GET /api/my/favorites`, `PUT /api/my/favorites/:studioId`, `DELETE /api/my/favorites/:studioId`

Bookings are initially Pending. The API rejects a request when its time range overlaps a Confirmed booking for the same studio and date. A host confirmation workflow still needs to be added before this is ready for production.

## Current limits

Google OAuth works after configuring its Google client ID, client secret, and callback URL in `.env`. Host booking confirmation, image upload, payment processing, invoice PDFs, review moderation, and production deployment are not configured. The client currently uses the API for account registration, login, logout, and session restoration; studio, booking, and wishlist screens still use browser-local demo data.

For Google OAuth, create a Web application OAuth client in Google Cloud Console and add `https://spacestudio-clint.vercel.app/api/auth/google/callback` as an authorized redirect URI for local development. Copy its client ID and secret into `.env`. For production, add the deployed API callback URI as well.
