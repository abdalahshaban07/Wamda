# ومضة | Wamda private portfolio

Live: https://wamda-portfolio-2026.web.app/

Use invited email/password accounts. Data is shared live, not stored only on this device. Posts, compressed images, comments, likes, private saved collections and profiles work. See LIVE-DEPLOYMENT.md for access boundary, image limits, test evidence and deployment instructions. No automatic content screening. Cloudinary remains paused.

This release uses firebase.private.json, firestore.private.rules and firestore.private.indexes.json. The earlier emulator-only checkpoint files remain for reference and must not be deployed accidentally.

Build: npm ci, npm run build. Deploy only to isolated wamda-portfolio-2026 using firebase.private.json. No billing upgrades. Passwords and deployment sign-in credentials are not included in this archive.
