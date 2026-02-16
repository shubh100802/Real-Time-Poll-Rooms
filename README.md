# Real-Time Poll Rooms

A full-stack polling app where users can create polls, share a link, vote once, and see results update live.

## Requirements Coverage

- Poll creation
- Shareable poll link
- Join by link and vote
- Real-time result updates (Socket.io)
- Fairness / anti-abuse controls (2 mechanisms)
- Persistence with MongoDB

## Tech Stack

- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Real-time: Socket.io
- Frontend: Server-rendered HTML + vanilla JavaScript

## URL Structure

- `GET /` -> Create poll page
- `POST /poll` -> Create poll
- `GET /poll/:id` -> View poll
- `POST /poll/:id/vote` -> Submit vote

## Project Structure

- `src/server.js` -> App bootstrap, DB connect, HTTP server, Socket.io setup
- `src/app.js` -> Express app config, middleware, routes, error handlers
- `src/config/db.js` -> MongoDB connection logic
- `src/models/Poll.js` -> Poll schema/model
- `src/routes/pollRoutes.js` -> Poll APIs + poll page renderer
- `views/createPoll.html` -> Create poll UI

## Local Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create `.env` from `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/realtime-poll-rooms
BASE_URL=http://localhost:3000
```

### 3) Run

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## Fairness / Anti-Abuse Mechanisms

### 1) IP-based restriction

- On vote, server extracts client IP.
- Vote is accepted only if this IP has not voted on that poll.
- IP is stored in `voterIps`.

What it prevents:

- Multiple votes from the same network endpoint.

### 2) Browser token restriction

- Client generates a stable browser token (`localStorage`) and sends it with vote.
- Vote is accepted only if token has not voted on that poll.
- Token is stored in `voterTokens`.

What it prevents:

- Quick repeat voting from same browser/session.
- Refresh/reload-based repeat submissions.

### Enforcement details

- Vote write is atomic (`findOneAndUpdate`) with duplicate checks + vote increment in one DB operation.
- This reduces race-condition duplicate votes from rapid repeated requests.

## Edge Cases Handled

- Invalid poll id format (`400`)
- Poll not found (`404`)
- Empty question (`400`)
- Question too long (`400`)
- Fewer than 2 options (`400`)
- Duplicate options (case-insensitive dedupe)
- Too many options (`400`, max 10)
- Option text too long (`400`)
- Invalid `optionIndex` type/range (`400`)
- Missing or oversized voter token (`400`)
- Duplicate vote blocked (`409`)
- Malformed JSON payload (`400`)
- Large payload protection (`10kb` request limit)
- Rapid repeat button clicks on UI (submit lock)
- Real-time results update for all viewers in poll room

## Known Limitations

- Shared IP environments (office, hostel, public Wi-Fi) can block legitimate second voters.
- Browser-token control can be bypassed by using another browser/device/incognito profile.
- Poll creator controls (edit/delete/close/expiry) are not implemented.
- No authentication/authorization layer.
- No automated test suite included in this submission.

## Deployment Notes

- Use any Node.js hosting platform and set the same environment variables used locally.
- Keep `BASE_URL` aligned with your deployed app URL.
- Use a persistent MongoDB instance so poll data survives restarts.

## Future Improvements

- Add poll close/expiry support
- Add auth for poll ownership and moderation
- Add hashed IP/token storage for better privacy posture
- Add comprehensive tests (API + integration)
- Add rate-limit middleware for extra abuse resistance
