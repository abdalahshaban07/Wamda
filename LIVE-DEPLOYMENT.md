# Wamda portfolio live deployment

Live URL: https://wamda-portfolio-2026.web.app/
Project: wamda-portfolio-2026, isolated from Cofeed. Spark no-cost.
Deploy with firebase.private.json only. No billing, Cloudinary, Storage bucket or server functions needed.

Images: one per post, client re-encoded JPEG at maximum150000bytes, data URL rule cap210000characters, image field excluded from indexes. Image+post created atomically. Media document deleted with owner post deletion. This small-portfolio design is not a general image hosting service.

Private data: server rules require active membership. No public signup in the UI. Firebase Auth may still accept direct API signup, but an unapproved account has no access to content. Membership can only be set by project owner tooling, never a client. Static login and application bundles are viewable without signing in, not private assets.

Two logins: Abdullah and reviewer@wamda.example. Passwords exist only in the vault, not source. Reviewer identifier is not a mailbox, password recovery requires owner intervention. No automatic content screening. No private messages or follows.

Verification:30protected rules checks,19two-session browser checks, responsive AR/EN plus accessibility checks. Live owner image+post, reviewer read/like/comment; unauthenticated REST for data paths403. Synthetic test content removed, posts and images confirmed empty.

Login simplification: admin is an alias for the ordinary reviewer demo account, not an admin role. Its password was replaced using a secure submission and live sign-out/sign-in verified. The old generated reviewer password is obsolete. Owner account unchanged. A normal profile password-change form supports recent-auth updates.
