# Celesta Glow — PRD / State

## Product
Full-stack skincare e-commerce (React + FastAPI + MongoDB) cloned from the owner's GitHub
repo and branded "celestaglow". Public storefront + admin panel. Integrations: Razorpay,
Cloudinary, Delhivery, Gmail SMTP, Meta Pixel/CAPI, Google Maps, GA4/Ads/Clarity, Gemini
(direct `GEMINI_API_KEY` — NOT the Emergent universal key, which is blocked in prod).

## Core admin AI features
- **One-Click Product Generator** (`POST /api/admin/ai/one-click-product`): AI classify →
  copy → Gemini hero image → gallery/certificate/before-after → live product.
- **Generate Gallery & Certificate** (`POST /api/admin/products/{slug}/generate-images`).
- **24 Variations** (`POST /api/admin/products/{slug}/generate-variations`): 2 genders × 3
  skin types × 4 age groups from a source product.
- **AI Upscale** (`POST /api/admin/products/{slug}/upscale-images`).
- **30-Day Progress Tracker** (`/api/journey/*`, `/api/tracker/*`): sequential day unlock,
  Eat/Avoid/Do-Naturally guidance.

## Architecture notes
- Image pipeline: AI hero (Gemini `gemini-2.5-flash-image`) + Pillow-composed gallery cards
  (`services/gallery_composer.py`, `services/brand_bottles.py`).
- LLM text via `services/llm_helper.py` (`llm_text`, direct Gemini `gemini-flash-latest`).
- Fonts bundled in `/app/backend/fonts` (pods lack `/usr/share/fonts`).
- Generated artwork persisted to Cloudinary (`services/durable_images.py`) — survives redeploy.

## Changelog — 2026-10-05 (this session)
Fixed the 3 open image-generation issues:
1. **Sub-images now match the AI hero (P0, DONE).** One-click extracts the exact bottle from
   the Gemini hero (`brand_bottles._alpha_cutout` + `_trim`) and composites THAT into the
   Pillow gallery cards. `gallery_composer.generate_gallery_and_certificate/generate_and_persist`
   gained `bottle_override` + `hero_url` params. Verified: hero + tech cards are pixel-identical.
2. **AI Upscale no longer blurs label text (P0, DONE).** `upscale-images` dropped Cloudinary's
   destructive `e_upscale`; now applies only `q_auto:best,f_auto` (crisp). Also sharpens the
   `solution_image` ("how it works") card.
3. **24 Variations reliable + consistent (P1, DONE).** Endpoint now runs as a BACKGROUND job
   (`var_*` job id) with `GET /api/admin/products/variations-job/{job_id}` polling — fixes the
   intermittent 502/503 timeout failures. `variation_generator._compose_shared_gallery` now
   reuses the source product's ACTUAL hero image (`images[0]`) + extracts its bottle for the
   cards (0 extra AI credits). Frontend `AdminProducts.js` polls the job.

Verified via curl + image inspection on preview. Test QA product + variations cleaned up.

## Changelog — 2026-10-05 (combo live/TBL fix)
**Bug:** A combo set LIVE in admin still showed "to be launched / coming soon" on the user app.
**Root cause (frontend):** `kitIsTbl = ... || productsInKit.length === 0 || ...` — the combo was
forced TBL whenever its member products weren't present in the page's limited product fetch
(homepage loads only 20 skin-care products; slow loads; members outside the loaded niche).
**Fix:** Removed the `length === 0` term in all 3 render spots — `pages/Homepage.js` (~565),
`pages/ShopPage.js` (~441 completeKit, ~702 combo grid). A combo is now TBL only if the combo's
own `is_to_be_launched` flag is set, OR a RESOLVED member product is genuinely TBL. The cart-side
`isComboTbl()` helper was already correct. Verified on /shop: combos render "ADD KIT" (buyable);
the only TBL-text left is the filter chips.

## Backlog / future (P2)
- Let admin re-run generate-images on OLD existing products to bring their sub-images in sync
  with the new AI-hero-matching logic (one-off migration button could batch this).
- Optional: persist a progress % (done/total) inside the variation job for a live progress bar.

## Clone Setup — 2026-06 (this session)
Cloned https://github.com/shadnazar/Final-One.git into /app. This repo IS the full Celesta Glow source.
- Copied all backend/frontend source (preserved protected .env: MONGO_URL, DB_NAME, REACT_APP_BACKEND_URL).
- Installed backend requirements.txt (pip) + frontend deps (yarn).
- Backend boots: seeds 5 products, 3 combos, taxonomy, coupons. Frontend compiles clean.
- Verified: GET /api/ health, GET /api/products, POST /api/admin/login (pwd celestaglow2024), homepage renders identical to v.celestaglow.com.
- Integrations (Cloudinary, Razorpay, Gemini, SMTP, Delhivery, Meta) are UNCONFIGURED (no keys in .env) — storefront works; image-gen/payments/email need keys to activate.

## Integration Keys Wired — 2026-06 (this session)
Populated backend/.env with all live keys: GEMINI_API_KEY (+GEMINI_TEXT_MODEL), Razorpay LIVE, Cloudinary (primary dcvuqcqjn), Delhivery (+pkg dims), Gmail SMTP + business emails, Meta Pixel/CAPI (+test code TEST21447), Google Maps, PUBLIC_SITE_URL, PUBLIC_APP_URL. Frontend analytics (GA4 G-QYDN365M5N, Google Ads AW-16928253164, Clarity wwzgn2zlj7, Meta Pixel 690863659974240, Pinterest verify, PostHog) already hardcoded in public/index.html.
Verified live: Cloudinary upload OK, Gemini llm_text -> PONG, Razorpay order.all auth OK. Backend boots clean, cloudinary "ready for uploads".
NOTE: SendGrid key was truncated in the message so SENDGRID_API_KEY was NOT set — email runs via Gmail SMTP. Meta CAPI still has TEST21447 test-event code (clear for true production).

## Image Quality Pipeline — 2026-06 (this session)
Goal: NO visible compression, crisp AI images, still fast. All changes delivery-side (masters untouched).
- cloudinary_service.upload_image: deliver q_95,f_auto (was q_auto:best).
- durable_images._upload_sync: explicit quality=95 + f_auto; URL q_95,f_auto (was auto:best).
- image_optimizer: grid/list transform now f_auto,q_95,w_<w> (was q_auto).
- routes/products.py: grid width 600->900, detail width 1200->1400.
- ImageCropperModal (admin): crop output now lossless PNG (was JPEG 0.92).
Net: AI art stays q95 master, uploads keep full-res, delivery is near-lossless q_95 + webp/avif + right-size (900/1400) via CDN. Speed from format+CDN, not compression.

## Gemini Image Gen + Load-Speed Fix — 2026-06 (this session)
1. **Gemini verified as image AI**: gemini-2.5-flash-image works with user GEMINI_API_KEY (direct test returned 855KB PNG). One-click product flow already Gemini-first. Reordered routes/image_ai.py generate-banner: Gemini PRIMARY -> Emergent fallback -> Pollinations last resort (was Pollinations-first).
2. **Slow-image root cause fixed**: generated art persisted with q_95,f_auto but NO width; image_optimizer skipped pre-transformed URLs -> user app downloaded full 2048px masters. Optimizer now strips q_/f_/w_ params and rebuilds f_auto,q_95,w_<width> (grid 900 / detail 1400). Measured: 1.18MB master -> 69KB delivered, 0.4s.
3. **Admin crop tool** outputs lossless PNG (was JPEG 0.92).
4. **7 dead Unsplash seed URLs replaced** (dryness, sunscreen, night-cream, kajal, spot-treatment, mascara, setting-powder) in concerns_seed.py + image_service.py + live MongoDB (8 docs). All 36 DB image URLs now return 200.
Smoke test (testing_agent iteration_3): PASS - homepage/shop/product-detail/admin-login all render, no 4xx/5xx, 100moke flows.

## Gemini-everywhere + async one-click — 2026-06 (this session)
1. **Bug fixed**: "EMERGENT_LLM_KEY not configured" on One-Click generator (and all AI features). Created services/gemini_llm.py — GeminiChat, drop-in LlmChat replacement calling Google Gemini directly via GEMINI_API_KEY (delegates to emergentintegrations only for sk-emergent-* keys). Switched every AI call site to prefer GEMINI_API_KEY: gift_cards_and_ai, image_ai, progress_tracker, reviews, admin_shades, auto_blog_generator, ai_content_generator, faq_generator, trend_product_generator, trending_news_generator, ai_categorizer, bulk_import_service (fixed double-prefix + missing os import), product_scraper, ai_skin_analyzer, fast_bulk_import. Emergent key remains optional fallback only.
2. **Edge-timeout fix**: one-click with image gen (~51s) exceeded Cloudflare ~55s → 502 in browser. Converted POST /api/admin/ai/one-click-product to background job: returns job_id instantly; poll GET /api/admin/ai/one-click-product-job/{job_id} (steps: classifying → writing copy → generating image → saving → gallery). AdminProducts.js polls every 3s with live step shown on the button.
3. Also fixed double-stacked Cloudinary transforms (_cld_hq guard q_auto->q_, _upscale_url strips all transform segments, both now q_95,f_auto).
Verified: async one-click done in ~45s, clean q_95,f_auto URLs, product deleted after. testing_agent iteration_4 confirmed the EMERGENT_LLM_KEY error is resolved.

## Rich product UX + bulk generator — 2026-06 (this session)
**ProductDetailPage.js**: (a) replaced static trust strip with 4 rich gradient badges — Fast Delivery, Clinically Tested, FDA·GMP Certified, 100% Authentic + a cert strip (Cruelty-Free/Paraben-Free/Dermatologically Tested/Made in India). (b) Instant GLOW15 coupon chip: tap applies extra 15% OFF, effective price (data-testid pdp-effective-price) updates live to 0.85x; on Add/Buy sets localStorage.discountClaimed=GLOW15 so cart auto-applies it. Created GLOW15 coupon in DB (percentage 15, show_on_cart). Verified validate-coupon returns 15% (POST).
**Bulk AI Generator** (NEW): POST /api/admin/ai/bulk-generate {items:[{name,key_ingredients,price_min,price_max,extra_specs}]} -> background job, generates each product ONE AT A TIME via existing _one_click_impl (1s pacing), poll GET /api/admin/ai/bulk-generate-job/{job_id} (done/failed/current). Wired into AdminProducts.js "Bulk AI Generate" button (indigo) next to One-Click; paste "Name | ingredients | price" per line. Verified: 2 products generated, 0 errors, cleaned up.
**Combo progress bar** (cart): already admin-driven via admin_settings.combo_bonus.tiers (2/3/4 items -> OFF amounts) — no change needed, confirmed working.
**Order free products**: OrderSuccessPage already renders order.free_gift — confirmed.
**Perf/images**: all Cloudinary delivery already f_auto,q_95 + right-sized; generated images right-sized by optimizer.
DEFERRED: AI-generated "ingredient molecule bubbles" infographic (2nd attached style) — the Formula-Technology card style (1st attachment) is already produced by gallery_composer PIL layouts A/B/C/D.

## Clone + Live Data Import — 2026-10-09
Original request: "Clone this git https://github.com/dragon16t/Celesta-final-updated.git the out will be exactly like v.celestaglow.com, also copy 5 products and sub images certificate and banners of home page from celestaglow.com also."
- Cloned dragon16t/Celesta-final-updated into /app (protected .env preserved), deps installed.
- `backend/scripts/import_live_celestaglow.py`: pulls 4 anti-aging products + Complete Anti-Aging Kit combo, certificates (test_report_image), site-settings (hero/banner carousel), top banner, niche-mode, before-after from celestaglow.com public API; downloads all images into `backend/uploads/live/` (served at /api/uploads/live/*).
- Fixed startup seed that forced products out of the anti-aging niche every boot (concerns_seed.py).
- Integration keys (Razorpay, Cloudinary, Gemini, SMTP, Delhivery, Meta) are NOT in .env — payments/AI image gen/email inactive until added.
Backlog: add integration keys; resync more products if needed by re-running import script.

## Keys + Gemini-only AI + Icons + Speed — 2026-10-09
- All keys in backend/.env (Gemini AQ.* key, Razorpay LIVE, Cloudinary dcvuqcqjn, Delhivery, Gmail SMTP, Meta CAPI, Google Maps); frontend .env has REACT_APP_GOOGLE_MAPS_API_KEY + REACT_APP_RAZORPAY_KEY_ID. Verified: Razorpay auth, SMTP login, Delhivery pincode, Maps geocode, Meta CAPI test event, Cloudinary upload.
- Emergent LLM key disabled: server.py pops EMERGENT_LLM_KEY at boot; Emergent + Pollinations fallbacks removed from image_ai.generate_banner, gift_cards_and_ai image gen. All AI = direct Gemini.
- Live images moved to Cloudinary (celesta-glow/live-import). services/live_seed.py applies seed_data/celestaglow_live.json + taxonomy_images.json at startup → production gets same products/banners/certs/icons.
- scripts/generate_taxonomy_icons.py: Gemini icons in style of seed_data/icon_style_ref.jpg. Done: 14 concerns, 109 categories, 61/75 subcategories. 14 subcategories FAILED — Gemini prepaid credits depleted (402). Re-run script after top-up (resumable).
- Speed: q_95→q_auto:good, widths 700/1200, top banner + hero optimized via <picture>, removed 3 unused ~165KB hero preloads in index.html.
- Gemini one-click generator NOT re-verified (credits depleted).

## No-compression images — 2026-10-09
- Regenerate image: POST /api/admin/products/{slug}/regenerate-image (multipart prompt + up to 4 references) → job, poll /admin/products/regenerate-image-job/{id}; apply via POST /admin/products/{slug}/set-main-image (replaces images[0] only). UI: sparkle button per product row → RegenerateImageModal (current vs new, prompt, refs, Try again / Use this image). Gemini image failures now surface the real reason.
- Background jobs (one-click, bulk generate, bulk AI fill, 24 variations) mirrored to Mongo `ai_jobs` via services/job_store.py → no more "Job not found" across workers/restarts. Verified one-click via admin UI end-to-end (Gemini credits restored). All 14 missing subcategory icons generated; taxonomy_images.json rebuilt from DB, TAXO_VERSION v2.
- Admin upload stores original bytes untouched (no resize/re-encode); Cloudinary upload has no incoming quality transform. Generated art (durable_images, brand_bottles, AI hi-res) saved as lossless PNG.
- Delivery everywhere: f_auto,q_100 (+ w_ c_limit, never upscales). Product detail 1600, grid 800, top banner 1600/1200. Verified: uploaded 2400px PNG returned pixel-identical.

