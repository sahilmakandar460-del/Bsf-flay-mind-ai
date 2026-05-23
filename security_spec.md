# FlyMind AI Security Specification

## Data Invariants
1. A user can only read and write their own profile document in `/users/{userId}`.
2. A user can only read and write logs in `/users/{userId}/logs/{logId}`.
3. System alerts (global) are readable by all authenticated users but writable only by admins. (Note: Admin role is checked via `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`).
4. Timestamps (`createdAt`, `updatedAt`) must be server-generated.

## The Dirty Dozen Payloads (Targeting Rejection)

### Identity & Spoofing
1. **The Identity Thief**: User A attempts to write to `/users/userB`.
2. **The Field Hijacker**: User A attempts to change `email` in their own profile (which should be immutable once set by auth).
3. **The Role Escalator**: User A attempts to set `role: 'admin'` in their own user document.

### Integrity & Validation
4. **The Ghost Field**: User A adds `isVerified: true` to a login log or profile.
5. **The Resource Poisoner**: User A sends a 2MB string as a `tray` ID in a log.
6. **The Type Shifter**: User A sends `date: 12345` (number) instead of a timestamp/string.

### State & Logic
7. **The Time Traveler**: User A sends `createdAt: "2000-01-01"` instead of `request.time`.
8. **The Orphan Maker**: User A creates a log without a valid `type`.

### Query & Scraping
9. **The Scraper**: User A tries to list ALL users in `/users` collection.
10. **The PII Blanket**: User A tries to `get` User B's PII via a wildcard path if misconfigured.

### Resource Exhaustion
11. **The ID Spammer**: User A uses a 1.5KB string as a document ID.
12. **The Array Bomber**: User A sends a 10,000 item list in a field.

## Test Runner (firestore.rules.test.ts)
(Implementation would go here if using a test environment, but for now we focus on the rules logic)
