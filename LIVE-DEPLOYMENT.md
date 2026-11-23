# Wamda deployment and access boundaries

Current live demo: https://wamda-portfolio-2026.web.app/

## Active configuration

- Isolated Firebase project: `wamda-portfolio-2026`, Spark no-cost plan.
- Build: `npm ci` then `npm run build`, using Node.js 24.12 or later.
- Hosting output: `dist/cofeed`. The old internal Angular target name does not change the app's Wamda branding.
- Deployment configuration: `firebase.private.json`, with `firestore.private.rules` and `firestore.private.indexes.json`.
- The `private` filenames are historical. They do not mean the current guest feed or static assets are private.
- Do not deploy the earlier `firebase.json`/`firestore.rules` experiments or target the legacy Cofeed project.
- No Storage bucket, Cloudinary, server function or billing upgrade is needed for the current image design.

## Guests and data

The app automatically signs visitors in with Firebase anonymous authentication. No login form is required. Shared content uses the `visitorPosts`, `visitorImages`, `visitorProfiles` and related guest paths. Browser-specific saves and collections are under that anonymous user's private paths. Another browser receives a different identity. Clearing browser storage can lose ownership and saved collections; there is no password recovery for a guest identity.

Legacy invited-account data paths remain separate. Guest security tests cover denial of legacy/private paths, other visitors' saves and profile impersonation. The old invitation/password functions are not the active user flow.

One image per post is re-encoded to JPEG, at most 150,000 bytes. Rules cap the data URL at 210,000 characters and require atomic post/image creation. Image fields are excluded from indexes. Deleting an owned post marks it deleted and removes its image. This is a small-demo design, not general-purpose image hosting.

No automatic content screening or guaranteed moderation is enabled. Rate and ownership rules do not detect harmful content. Cloudinary integration experiments remain inactive. No private messages or follows are implemented.

## Safe checks

Run rule/browser write tests only with isolated emulators and an emulator browser config. `tests/social/guest-browser.mjs` can target the live project through the default browser config or `WAMDA_LIVE_URL`, so do not run it as a routine production check. It creates, comments on and deletes synthetic posts.

Firebase browser configuration identifiers are client-visible by design; access is controlled by security rules. Never commit passwords, refresh tokens, service-account keys, provider credentials, CLI login files or real user data. Deployment credentials are not included.

Updating this repository does not itself change the running Firebase deployment.
