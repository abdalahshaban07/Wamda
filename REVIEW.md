# Wamda current private checkpoint,23November2026

## Active source, tested after policy rollback

-22browser checks pass: cross-session posts/images, likes/comments, reports, private collections, reload persistence, profile propagation, both-language feed/compose/profile automated accessibility checks, safe markup rendering, owner delete and durable cleanup retry, moderator report queue, independent saved hydration outside the first40posts, and Load more.
-42Firestore permission checks,11local media HTTP checks and17synthetic media-core and4mock Cloudinary-adapter checks pass.
- No production writes, billing activation, deployment or real public audience. Existing Cloudinary access was recovered and the Rekognition Free add-on installed with approval; no live image upload/test or API key creation occurred. Image bytes use local memory. Auth/Firestore project is demo-wamda only.
- Earlier pixel checks covered320/390/1280feeds, both-language forms, cleanup retry and populated image posts. Load more screenshots were inspected on mobile. No full visual signoff of every pagination boundary.

## Not active or not verified

Mandatory prereview was implemented in a separate candidate after the user's initial approval, then paused and withdrawn from active source when he reconsidered publication delay. Candidate includes pending post privacy and protected pending image bytes. It lacks final moderator UI acceptance. Comments/profile prereview was never authorized or implemented.

The provisional1second per-user atomic rate counters, one report per user/post and expanding live feed capped200posts were extracted from the separate candidate and independently reintegrated/tested. They are active local code, not a settled production policy or complete anti-abuse system. No automatic text/image screening. Existing length/type/ownership restrictions remain.

The active expanding query avoids separate page-cursor overlap and is capped200posts. Saved hydration is per-post listeners and can create high read volume. Public profiles load as a collection. Abandoned upload sweeping, production durable gate/registry bindings, reset/verification flows and provider/runtime validation remain work.

The proposed Firebase Spark/Cloudinary Free/Cloudflare path is not operating. User confirmed private portfolio scope and paused external integration rather than grant a new Master Admin key. Existing Root key is unchanged. No further forms or account/environment changes authorized. Cloudflare10msFree CPU fit is unverified. The undeployed Cloudinary core has synthetic tests only. No hard zero-cost constraint was relaxed.

## Content-screening feasibility

A separate local benchmark tested16synthetic text probes using a quantized multilingual DistilBERT toxicity model. It produced both benign Egyptian-language false positives and obfuscation false negatives. Those probes are not an accuracy estimate, and no publication thresholds were selected. The model is not recommended as an autonomous publish/block gate. NSFWJS lacks violence classes and browser-only classification is bypassable; no claim of a complete free automatic text/image filter is supported.

## Build/dependencies

Build succeeds under unchanged500KBwarning/1MBerror and2KBwarning/4KBerror budgets, with warning-level app/style overruns. Latest initial total903.43KBraw/232.09KBestimated transfer, component CSS3.80KB. Production audit previously0findings, full development tree14moderate transitive advisories. No full security/accessibility certification.

## Sources

https://firebase.google.com/pricing
https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
https://cloudinary.com/documentation/authentication_signatures
https://cloudinary.com/documentation/aws_rekognition_ai_moderation_addon
https://cloudinary.com/documentation/cloudinary_add_ons
https://developers.cloudflare.com/workers-ai/platform/pricing/
https://developers.cloudflare.com/workers-ai/platform/data-usage/
https://huggingface.co/onnx-community/distilbert-multilingual-toxicity-classifier-ONNX?library=transformers.js
https://github.com/infinitered/nsfwjs/

API/policy references are not evidence of account-specific quota or a deployed integration.
