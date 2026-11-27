# Image screening integration status

Account-side Rekognition Free activation is verified. The app is not deployed.

The server core now requests `aws_rek` moderation and only returns images with an explicit approved result. Missing, pending or rejected results fail closed and trigger provider cleanup. This conservative synchronous path may reject a safe image whose result is still pending; there is no webhook approval implementation yet.

`media/cloudinary-local.mjs` is an opt-in loopback adapter for one approved synthetic-image test. It uses demo Firebase emulators only and stores its one-attempt cap in a private SQLite file outside the project. It never resets the cap on restart. A failed upload also consumes this local attempt. No production Firebase changes are made. The credential must be an approved private external file containing the Cloudinary connection URL. It is read on the server only, never returned to the browser.

Start only after secure credential collection and sandbox-use approval. Both demo emulators must already be running. Set `WAMDA_CLOUDINARY_CREDENTIAL_FILE` to the private credential file and `WAMDA_PRIVATE_STATE_DIR` to a private directory outside this project, then start this adapter instead of the local-only media adapter. The existing emulator-mode UI sends to loopback8788.

Current evidence:17 synthetic core tests and4mock loopback-adapter tests pass. Existing22browser/42rules/11local-media HTTP regression tests still pass. No live Cloudinary image test ran: securely collected values were not valid API credentials, and the console image/moderation pages returned account permission errors. Installed Rekognition usage was rechecked at0/50. No harmful-image detection claim is established. Browser testing against the real-provider adapter remains outstanding. Cloudinary account activation is not proof of application integration.

## User decision

External integration paused. Retain existing Root key, do not create a new Master Admin key, no new account/environment/role changes or credential forms. Resume only under a new scoped instruction. Current private portfolio work remains local.
