# Understand and explain ApplyTrack

## What problem does it solve?

People applying for several jobs can lose track of which company they applied to, what stage they are at, and what they need to prepare. ApplyTrack puts those records into one personal workspace.

## Follow one action through the code

1. Open `src/main.jsx` and find `ApplicationForm`. The form collects the company, role, status, date, location, link and notes.
2. The `save` function sends a POST or PUT request through the `api` helper.
3. In `server/app.js`, `authenticate` reads the session cookie, hashes the token and finds the associated user.
4. `applicationInput` checks lengths, required values, allowed statuses, dates and link protocols.
5. The endpoint writes with placeholders (`?`) and includes the user's ID.
6. The server returns the saved record. React updates its state and recalculates the summary cards.

Try it yourself: add one application, watch the total increase, change its status to Interview, and watch both status counts change. Reload to confirm that the database retained the change.

## Key concepts for an interview

**React state:** `useState` stores UI state and the applications. `useEffect` loads the user's records and clears notifications. Forms send changes to the API before the UI confirms success.

**REST API:** GET reads records, POST creates them, PUT updates editable fields, and DELETE removes them. Validation errors return 400; missing authentication returns 401; records not owned by a user return 404.

**Database relationships:** One user has many applications and sessions. Foreign keys link these records. The email field is unique. MySQL uses its foreign-key indexes; SQLite gets explicit indexes for user lookups.

**Authentication:** Passwords are hashed with scrypt and a unique salt. A successful login creates a random session token. The browser receives the token in an HTTP-only cookie; the database stores only its SHA-256 hash. A session has an expiry timestamp.

**Authorization:** Authentication identifies the user. Authorization restricts which records they can access. Each application read, update and delete is scoped to that user's ID.

**Injection protection:** User text is passed as parameters instead of concatenated into SQL. React escapes text when rendering it. Job links are restricted to HTTP and HTTPS.

**Browser request protection:** Cookies are SameSite=Lax. Write requests must be JSON, and browser Origin headers are checked against an explicit configured origin. Production cookies are HTTPS-only.

**Testing:** The tests start an actual HTTP server and send requests to it. The ownership test creates two accounts and attempts to access the first account's application from the second account.

## A short project explanation

“ApplyTrack is a job application tracker I developed using React and a Node.js/Express API. Users can sign in, add applications, update their status and view a summary dashboard. The database layer supports MySQL, with SQLite available for a simple local demo. I used parameterized SQL, password hashing and user-specific queries, and added integration tests for authentication and record ownership.”

Use this only after you have read the code, run it yourself, and can explain your own changes. Don't claim a live deployment, production users, performance figures or verified MySQL testing unless you have actually completed them.

## Resume wording after reviewing and running it

**ApplyTrack — Job Application Tracker | React, Node.js, Express, MySQL**

- Built a job application tracker with registration, login, application CRUD, search, status filters and a summary dashboard.
- Implemented session-based authentication, parameterized database queries and per-user access controls; added API integration tests.

Use the MySQL stack line after running the MySQL configuration. Until then, use “React, Node.js, Express, SQLite” and mention MySQL adapter support separately if needed. Add your actual GitHub repository URL once it exists.

## Suggested practice

1. Run the app and record a two-minute walkthrough.
2. Explain why storing a password directly would be unsafe.
3. Find every query that checks `user_id` and explain what would happen without that condition.
4. Set up MySQL and repeat registration, add, edit, reload, delete and logout.
5. Make one small change yourself, such as adding a Withdrawn status consistently to validation, the dashboard and tests.
