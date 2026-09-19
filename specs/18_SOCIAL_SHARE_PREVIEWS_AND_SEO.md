# Milestone 18: Social Share Previews & SEO for Public Setup URLs

## 1. Objective
Make `/s/:slug` unfurl correctly in Discord, iMessage, Slack, and search crawlers. Today [frontend/index.html](../frontend/index.html) only sets title + viewport, and frontend nginx `try_files` serves the empty SPA shell for `/s/:slug`, so Open Graph scrapers see no setup title. This milestone adds crawler-visible HTML (no SPA JS required), default SPA meta, `robots.txt`, and a sitemap of public non-hidden short URLs.

**Product framing:** share previews advertise a setup sheet (title, chassis, FDR), not a social profile feed.

**Depends on:** Milestone 07 (`qr_slug`, `GET /qr/resolve/:slug`) and 12 (`/s/:slug` SPA overlay). Complements Milestone 17 copy-link (which copies the same URL).

---

## 2. Scope & Target Files
- `/backend/src/modules/qr/qr-html.util.ts` (new; HTML escape + document builder)
- `/backend/src/modules/qr/qr.service.ts` (HTML + sitemap queries)
- `/backend/src/modules/qr/qr.controller.ts` (`GET share/:slug`, `GET sitemap.xml` — names may live under existing `@Controller()`)
- `/backend/src/contracts/qr.contract.ts` (optional types for OG fields)
- `/frontend/docker/frontend-nginx.conf` (`location /s/`, `/robots.txt`, `/sitemap.xml`)
- `/docker/host-nginx.conf.example` (same locations so the public edge matches compose)
- `/frontend/index.html` (default description, `og:*`, twitter cards, canonical)
- `/frontend/public/robots.txt`
- `/frontend/public/og-default.png` **or** reuse generated QR PNG as `og:image` per slug (prefer per-slug QR PNG; default image only for non-slug routes)
- `/frontend/src/views/CommunityFeedWorkbench.tsx` (optional `document.title` while overlay open)
- `/backend/test/qr-share-html.spec.ts`
- `/tests/e2e/qr-share-html.spec.ts` (optional if backend unit hits the HTML route)

Do not introduce a second frontend framework or a full SSR React renderer. Nest returns a **small static HTML document**.

---

## 3. Detailed Technical Requirements

### 3.1 Why nginx must change
`frontend/docker/frontend-nginx.conf` currently:

```
location / {
    try_files $uri $uri/ /index.html;
}
```

OG crawlers do not execute the Vite bundle. Implementation **must** intercept `/s/:slug` **before** SPA fallback and proxy to Nest HTML.

Compose frontend nginx:

```
location = /robots.txt {
    root /usr/share/nginx/html;
}

location = /sitemap.xml {
    proxy_pass http://rc-backend:5742/api/garage/sitemap.xml;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Pit inspection share documents (Open Graph). Trailing-path slug is 10 chars.
location ~ ^/s/([A-Za-z0-9_-]{10})$ {
    proxy_pass http://rc-backend:5742/api/garage/share/$1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Accept $http_accept;
}
```

Host example nginx gets the same three locations, proxying to `http://127.0.0.1:5742`.

Human browsers still need the SPA overlay. Options (pick **one**, document in the spec implementation comment):

**Preferred:** If `Accept` contains `text/html` **and** User-Agent matches a conservative crawler list (facebookexternalhit, Facebot, Twitterbot, Slackbot, Discordbot, WhatsApp, LinkedInBot, Googlebot, bingbot), return Nest HTML. Otherwise `proxy_pass` is skipped… nginx cannot easily branch on UA without `map`. Therefore:

**Required approach:** Nest HTML document always includes:
1. Full OG/Twitter meta
2. A visible noscript title + link
3. An immediate script-free **meta refresh is forbidden** (bad for crawlers). Instead include:

```html
<link rel="canonical" href="{APP_BASE_URL}/s/{slug}" />
```

and a prominent link:

```html
<a href="/feed?inspect={setupId}">Open in Pit-Mat Workbench</a>
```

Plus a tiny inline script **at the end of body** that `location.replace('/feed?inspect=' + id)` for real browsers. Crawlers that do not run JS still see `og:title`. SPA users who hit `/s/:slug` today land on `CommunityFeedWorkbench`; changing nginx to always proxy `/s/` to Nest means **humans would leave the SPA** unless Nest HTML redirects via JS to `/feed?inspect=`.

Keep SPA `/s/:slug` working:
- Nginx `location ~ ^/s/` proxies to Nest.
- Nest HTML JS redirect goes to `/feed?inspect={uuid}` (already supported) **or** `/s/{slug}` would loop — **must redirect to `/feed?inspect=`**, not back to `/s/`.
- Update `CommunityFeedWorkbench` if needed so `?inspect=` remains the human inspect entry. Existing `/s/:slug` route can remain as a fallback for Vite dev server (Vite has no nginx); in **Vite dev**, `index.html` is fine and OG is not required.

Update `ToolboxDrawerNavigation` `inspectingPublicSlug` if `/s/` is no longer an SPA route in production; drawer should still highlight Feed.

### 3.2 Nest HTML endpoint
`GET /api/garage/share/:slug` (`QrSlugParamSchema`).
- Reuse the same visibility rules as `GET /qr/resolve/:slug`: `is_public = TRUE AND is_hidden = FALSE`, else `404` HTML (`text/html`, not JSON) with `noindex`.
- `Content-Type: text/html; charset=utf-8`
- Escape all interpolated strings (title, callsign, make, model) to prevent HTML injection.

Document fields:
- `<title>{title} — @{callsign} | RC Garage</title>`
- `meta name="description"`: `{make} {model} · FDR {fdr} · Front CoG {bias}%`
- `og:type` = `article`
- `og:title`, `og:description` (same)
- `og:url` = `{APP_BASE_URL}/s/{slug}`
- `og:image` = `{APP_BASE_URL}/api/garage/setups/{id}/qr?format=png&size=512` (absolute URL; 1.5" sticker PNG is high-contrast and legal to hotlink)
- `twitter:card` = `summary_large_image`
- Canonical as above

Hidden/private slugs: `404` with `<meta name="robots" content="noindex">`.

### 3.3 SPA shell defaults
`frontend/index.html` `<head>` additions:
- `<meta name="description" content="Pit-mat workbench for RC setup sheets, community forks, and chassis QR stickers." />`
- `og:title` = `RC Garage — Pit-Mat Workbench`
- `og:description` = same description
- `og:image` = `{absolute}/favicon.svg` is weak for OG; add a static `frontend/public/og-default.png` (1200×630 Pit-Mat card) **or** point `og:image` at `/favicon.svg` only if png exists. **Require** `frontend/public/og-default.png` so non-slug URLs unfurl.
- `twitter:card` = `summary`
- `<link rel="canonical" href="/">` is wrong for all routes; omit canonical on the SPA shell (slug pages set it in Nest HTML).

Optional: overlay sets `document.title` to the setup title while open and restores on close.

### 3.4 robots.txt
`frontend/public/robots.txt`:

```
User-agent: *
Allow: /
Allow: /s/
Allow: /u/
Allow: /feed
Allow: /legal/
Disallow: /admin
Disallow: /clipboard
Disallow: /garage
Sitemap: /sitemap.xml
```

### 3.5 sitemap.xml
`GET /api/garage/sitemap.xml` returns `application/xml`.
- Include `{APP_BASE_URL}/`, `/feed`, `/legal/terms`, `/legal/privacy`, `/legal/guidelines`.
- Include every public non-hidden setup `{APP_BASE_URL}/s/{qrSlug}` (`<loc>`), `<lastmod>` from `updated_at`.
- If the public set exceeds a single sitemap comfort size, still return one file for v1 with a hard cap of 10,000 URLs (document; typical hobby volume is far below).
- Do not include `/u/:callsign` unless cheap (optional extra query). Prefer setups only plus static routes.

---

## 4. Verification & Acceptance Criteria
1. `GET /api/garage/share/{publicSlug}` with no JS-capable client (curl) returns `200 text/html` whose body contains `<meta property="og:title"` and the setup **title** as the content value.
2. The same curl for a hidden or private slug returns `404` HTML and does not leak the title.
3. `og:image` is an absolute `http(s)` URL pointing at the QR PNG route.
4. All user-controlled strings in the HTML are escaped (`<` in a title cannot break out of the tag).
5. `GET /api/garage/sitemap.xml` lists the public slug and omits hidden/private sheets.
6. `frontend/public/robots.txt` disallows `/admin` and references `/sitemap.xml`.
7. Frontend nginx config contains a `/s/` proxy to Nest `share` (compose file reviewed in PR).
8. Human path: after production nginx proxy, a browser executing JS ends on the inspect overlay via `/feed?inspect=` (e2e or documented manual check). Vite `npm run dev` still serves the SPA `/s/:slug` route without nginx.
9. `frontend/index.html` includes a non-empty meta description.
10. No React SSR framework is added.
