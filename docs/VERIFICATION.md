# Verification record

Verified locally on 28 September 2026 using Node.js 24.19.0.

## Passed

- Production build with Vite 7.3.6.
- Ten HTTP integration tests: authentication, registration validation, CRUD, input validation, user isolation, cross-origin protection, SQL-looking input, logout, independent demos and session expiry.
- Browser checks against the built app: sign-in screen, demo creation, application creation, searching, changing Applied to Interview, retaining the record after reload, empty search results, clearing filters, opening and cancelling a delete confirmation, and sign-out.
- Desktop visual review and phone-width responsive review. At the checked phone width, the document width matched the viewport; wide application tables scroll inside their own container.
- The screenshot in this folder uses fictional demo data, not personal application records.

## Not verified

- MySQL execution: no MySQL server or Docker runtime was available. The adapter, schema and Docker configuration are provided, but their successful operation against MySQL is not claimed.
- Internet hosting: the application has not been deployed to a public web server. The GitHub repository contains the source code.
- Vite's development dependency optimizer was blocked by this environment's Windows filesystem sandbox. The production build and the running built interface were tested successfully. Use `Start-ApplyTrack.cmd` for the build-and-serve path here; verify `pnpm dev` in a normal local terminal.

The tests use an in-memory SQLite database. The browser preview uses a separate local file database. Neither database is included in the source ZIP.
