# ومضة | Wamda

An Arabic/English creative-ideas portfolio built with Angular 22 and Firebase. Includes a shared feed, compressed image posts, comments, likes, private saved collections, visitor profiles, and light/dark pages.

Live demo: https://wamda-portfolio-2026.web.app/

## Current guest flow

No email or password is required. Firebase anonymous authentication gives each browser profile its own visitor identity. Posts, images, comments, likes and profile names are shared with other visitors. Saves and saved collections are private to that identity. Ownership does not transfer between devices. Clearing browser storage or using another browser can lose access to earlier ownership and saves. Do not post personal or sensitive data.

The older invited-account data paths are separate from the guest paths. This is a small portfolio demo, not a production social network. It has no automatic text/image screening, private messages or follows. Cloudinary moderation is not enabled in the live app.

## Run and build

Use Node.js 24.12 or later.

```sh
npm ci
npm start
npm run build
```

The checked-in browser configuration points to the live demo. Local development must replace it with an isolated emulator configuration before tests that create content. Never run write tests against the live project by accident.

See [LIVE-DEPLOYMENT.md](LIVE-DEPLOYMENT.md) for deployment and security boundaries. Files for earlier experiments remain for reference and are not the active deployment configuration.
