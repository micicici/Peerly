# P2P Learn — Design spec

Date: 2026-09-25  
Status: approved  
Stack: Angular (RxJS, NgRx Store + entity + effects) + NestJS + PostgreSQL

## Problem

People want to learn and teach in a peer network without money. The unit of exchange is **one hour of a person’s time**.

## Product

P2P Learn is a web app where **1 taught hour = 1 credit hour**. Every account both learns and teaches. Signup is incomplete until the user publishes **at least one custom offering**. New accounts receive **3 starter hours** once that first offering exists.

There is no chat, community, or shared course catalog in this version. The mockup’s Home / Subjects / Teach / profile shell is in scope; Messages and Community are out.

## Goals

- Book a 1-hour lesson against an open slot using time credits.
- Earn credits by teaching; spend credits by learning.
- Join a hosted WebRTC room (Jitsi) for that booking.

## Non-goals (v1)

- In-app chat, forums, or social feed
- Shared subject catalog or “learning paths” as first-class data (home may show popular *offerings*, not a taxonomy)
- Raw WebRTC / SFU / TURN of our own
- Google Calendar sync, WebSockets, notifications
- Learner-initiated cancellation
- Reopening a cancelled slot (teacher creates a new slot)
- Payments, admin CMS, mobile apps

## Roles

There is one account type. Every user must maintain ≥ 1 offering. A user is a **teacher** on slots they created and a **learner** on bookings they make. You cannot book your own slot.

## Time currency

| Event | Learner | Teacher |
|---|---|---|
| First offering published | — | `starter` **+3** (once per user) |
| Slot booked | `spend` **-1** | `earn` **+1** |
| Teacher cancels before start | `refund` **+1** | `reversal` **-1** |

Hours move **in the same database transaction as the booking (or cancel)**. The client never submits a new balance. Source of truth is `SUM(ledger.amount)` per user. `/me` may include a computed `balance` for convenience; it is not a writable column.

A slot is always **60 minutes**, start aligned to the hour, stored in **UTC**, displayed in the user’s timezone.

## User-facing surfaces

1. **Landing / home** — hero, signup/login, popular offerings (most confirmed bookings, then newest), featured mentors (up to three users with the most *open* slots).
2. **Onboarding** — create the first offering; then starter hours apply and the rest of the app unlocks.
3. **Subjects / browse** — other people’s offerings; text and level filters; offering detail with open slots and Book.
4. **Teach** — CRUD offerings; create/delete **open** 1-hour slots; upcoming sessions you teach.
5. **Bookings** — upcoming as learner and as teacher; Join; teacher Cancel before start.
6. **Profile** — name, avatar, bio, offerings, balance, ledger history.
7. **Nav** — Home, Subjects, Teach, profile. No Messages/Community.

Join is shown to both participants from **10 minutes before start** until **start + 60 minutes**, only if the booking is not cancelled.

## Architecture

```
Angular SPA  --REST/JWT-->  NestJS API  -->  PostgreSQL
                                  |
                                  +--> Meetings (Jitsi URL factory)
```

### NestJS modules

| Module | Owns |
|---|---|
| Auth | Register, login, JWT |
| Users | Profile, timezone |
| Offerings | Custom courses; gate until count ≥ 1 |
| Slots | 1h windows; `open \| booked \| cancelled` |
| Ledger | Append-only entries; balance queries |
| Bookings | Book/cancel transactions |
| Meetings | Create join URL; no media servers |

### Angular / NgRx

Feature states mirror modules: `auth`, `offerings`, `slots`, `catalog` (others’ offerings), `bookings`, `ledger`. Use `EntityAdapter` for collections, Effects for HTTP, selectors for `balance`, `myOpenSlots`, `bookableSlotsForOffering`. Update the store **only after** a successful API response. No optimistic ledger writes.

Route guards: JWT required; `OFFERING_REQUIRED` until offerings ≥ 1 (except onboarding and `/me`).

## Data model

**users:** id, email (unique), passwordHash, name, bio, avatarUrl (optional string; no file upload in v1), timezone, createdAt

**offerings:** id, teacherId, title, description, level (`beginner \| intermediate \| advanced`), createdAt

**slots:** id, offeringId, teacherId, startAt, endAt, status (`open \| booked \| cancelled`)

**bookings:** id, slotId (unique), learnerId, teacherId, offeringId, joinUrl, status (`confirmed \| cancelled`), createdAt

**ledger_entries:** id, userId, amount (`+1` or `-1`), type (`starter \| spend \| earn \| refund \| reversal`), bookingId (null for starter), createdAt

Constraints:

- Partial unique index: one `starter` row per user.
- Unique `bookings.slotId`.
- Slot overlap: no two non-cancelled slots for the same teacher with overlapping `[startAt, endAt)`.
- Ledger rows are never updated or deleted.

## API (REST)

- `POST /auth/register` `{ email, password, name, timezone }` → JWT
- `POST /auth/login` → JWT
- `GET /me` → profile + computed `balance` + offering count
- `PATCH /me` profile fields
- `POST /offerings` — first offering also inserts `starter +3`
- `GET /offerings/mine`, `PATCH /offerings/:id`, `DELETE /offerings/:id` (blocked if the user would drop below 1 offering, or if the offering has future confirmed bookings)
- `GET /offerings` browse (exclude mine); `GET /offerings/:id` detail
- `POST /slots` `{ offeringId, startAt }` — endAt = startAt + 60m; reject past, not-on-the-hour, overlap
- `DELETE /slots/:id` — only `open`
- `GET /slots?offeringId=` open slots for an offering
- `POST /bookings` `{ slotId }`
- `GET /bookings` mine (as learner or teacher)
- `POST /bookings/:id/cancel` — teacher only, before start

Write endpoints return `{ code, message }` on error (see below) plus HTTP 4xx.

## Booking transaction

`POST /bookings` in one Postgres transaction:

1. Lock the slot row.
2. Abort if not `open`, start in the past, or learner === teacher.
3. Abort if learner `SUM(ledger) < 1`.
4. Insert booking `confirmed`.
5. Insert learner `spend -1` and teacher `earn +1`.
6. Set slot `booked`.
7. Create meeting URL; save on booking. If this step fails, **roll back the entire transaction**.

Teacher cancel, same style, only if `now < startAt` and status `confirmed`:

1. Booking → `cancelled`.
2. Slot → `cancelled` (not `open`).
3. Learner `refund +1`, teacher `reversal -1`.
4. Meeting URL may remain; Join is hidden.

No realtime: the other party sees changes on refetch/navigation.

## Meetings

`MeetingsService` generates a unique room id and join URL.

v1 implementation: `https://meet.jit.si/p2plearn-{uuid}` (Jitsi Meet). That is WebRTC without running signaling or an SFU. The interface allows swapping to Daily.co later. An empty/failed URL is treated as provider failure and aborts the book.

Join opens the URL (new tab). No in-app video chrome required in v1.

## Error codes

| Code | When |
|---|---|
| `UNAUTHENTICATED` | Missing/expired JWT |
| `OFFERING_REQUIRED` | Authenticated but zero offerings |
| `SLOT_GONE` | Slot not `open` |
| `SLOT_IN_PAST` | Start already passed |
| `SLOT_OVERLAP` | Teacher already has a non-cancelled slot in that hour |
| `SLOT_INVALID` | Not on the hour or duration ≠ 60m |
| `INSUFFICIENT_HOURS` | Balance < 1 |
| `SELF_BOOK` | Booking own slot |
| `FORBIDDEN` | e.g. non-teacher cancel |
| `CANCEL_NOT_ALLOWED` | Already started or already cancelled |

Any of these during a write rolls back. 5xx: client keeps previous entities and toasts “Try again.”

## Error handling (client)

Effects map `code` to a toast. `SLOT_GONE` refetches that offering’s slots. `INSUFFICIENT_HOURS` blocks Book and points at Teach. Own slots never show Book.

## Testing

API:

- Ledger: starter once; book spend+earn; cancel refund+reversal; `SUM` after each.
- Concurrent books on one slot: one 201, one `SLOT_GONE`; loser balance unchanged.
- Guards: `INSUFFICIENT_HOURS`, `SELF_BOOK`, `SLOT_IN_PAST`, `OFFERING_REQUIRED`, teacher-only cancel, `CANCEL_NOT_ALLOWED`.
- Slot overlap includes booked hours; cannot delete booked slots.
- Meetings mock: failure → no booking, no ledger; success → `joinUrl` stored.

Angular:

- Selectors for balance, onboarding, Join window.
- Effects ignore store updates on error codes.
- Route guards.

Thin e2e: A publishes offering + slot; B (with starter hours) books; balances 4 and 2; Join URL present; A cancels; hours reverse.

No load tests or WebRTC media tests in v1.

## Out of scope follow-ups (explicit)

- Messages, community, learning-path taxonomy
- Learner cancel, waitlists, slot reuse after cancel
- Native Daily/WebRTC, recording, attendance
- Push/email reminders
