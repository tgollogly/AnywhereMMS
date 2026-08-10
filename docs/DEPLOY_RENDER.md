# Deploy AnywhereMMS on Render (Free)

Get a live link you can share with anyone — no terminal needed for your users.

## One-click deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tgollogly/AnywhereMMS)

### Steps

1. Click **Deploy to Render** above (or go to [render.com](https://render.com) → New → Blueprint → connect this repo).
2. Sign up / log in to Render (free account is fine).
3. Render reads `render.yaml` and creates the web service automatically.
4. After deploy (~2–3 min), open your URL: `https://anywheremms-xxxx.onrender.com`
5. **Optional:** In Render dashboard → Environment → set `BASE_URL` to your exact URL (usually auto-detected via `RENDER_EXTERNAL_URL`).
6. Share that link with friends, family, or customers.

Link sharing works immediately. SMS auto-send is off by default (`SMS_PROVIDER=console`).

---

## Is Render free?

**Yes, for small personal use** — with important limits:

| Free tier | What it means for you |
|-----------|------------------------|
| **$0/month** | Good for testing, family, small groups |
| **750 hours/month** | Enough for one service running 24/7 |
| **Spins down after ~15 min idle** | First visitor after idle waits ~30–60 sec (cold start) |
| **512 MB RAM** | Fine for light photo sharing |
| **Ephemeral disk** | Uploaded photos are **lost if the server restarts or redeploys** |
| **100 GB bandwidth/month** | Plenty for casual use; not for heavy traffic |

For a **bookmarkable link for a few dozen users**, free tier is usually fine.

---

## What if lots of people use it commercially?

The **free tier is not meant for commercial scale**. Here's what happens:

### Traffic & performance

| Scenario | What happens |
|----------|--------------|
| **10–50 users/day** | Usually OK on free tier |
| **Hundreds of uploads/day** | Rate limit kicks in (5 uploads/hour **per IP** by default) |
| **Thousands of users** | Free tier will struggle — slow cold starts, bandwidth limits, restarts |
| **Heavy commercial use** | You need a **paid Render plan** ($7+/month Starter) |

### Data & images

- Photos live on the server's **temporary disk** — not a permanent cloud archive.
- Server **restart or redeploy = uploaded images gone** (links break).
- For a real business, add **S3 / Cloudflare R2** storage (future upgrade) or accept 72-hour temporary hosting only.

### Costs you may pay (even if Render is "free")

| Item | Who pays |
|------|----------|
| Render hosting | You — free tier or ~$7+/mo paid |
| SMS (if enabled) | You — TextBelt/Twilio charges |
| Abuse / spam | Your problem — rate limits help but aren't foolproof |
| Legal compliance | You — consent, content moderation, privacy laws |

### Commercial use of the **code**

The MIT license **allows commercial use** of the software itself — you can run a business with it. But:

- **You** are responsible for hosting costs, uptime, and legal compliance.
- The author (tgollogly) provides **no SLA or support guarantee**.
- You should update Terms of Use for your deployment and consider paid hosting before selling access.

### Recommended tiers

| Use case | Plan | Est. cost |
|----------|------|-----------|
| Personal / family | Render Free | $0 |
| Small club / team (~100 users) | Render Starter | ~$7/mo |
| Business / public product | Render Standard + S3 + CDN | $25+/mo |
| High volume | Dedicated server or AWS/GCP | Variable |

---

## Environment variables (Render dashboard)

| Variable | Recommended | Notes |
|----------|-------------|-------|
| `BASE_URL` | `https://your-app.onrender.com` | Auto-set if you use `RENDER_EXTERNAL_URL`; set manually if using custom domain |
| `SMS_PROVIDER` | `console` | Keep `console` unless you configured TextBelt/Twilio |
| `MAX_SENDS_PER_HOUR` | `5` | Lower = less abuse; raise carefully on paid plans |
| `IMAGE_TTL_HOURS` | `72` | Shorter = less disk use |
| `NODE_ENV` | `production` | Set by render.yaml |

---

## Custom domain (optional)

1. Render dashboard → your service → **Settings** → **Custom Domains**
2. Add e.g. `photos.yourdomain.com`
3. Update DNS as Render instructs
4. Set `BASE_URL=https://photos.yourdomain.com`

---

## Troubleshooting

**Site is slow first time after a while**  
→ Free tier cold start. Upgrade to Starter ($7/mo) to avoid spin-down.

**"Too many uploads" error**  
→ Rate limit. Wait an hour or raise `MAX_SENDS_PER_HOUR` on a paid plan.

**Link worked yesterday, image gone today**  
→ Server restarted (free tier) or image expired (72h default). Expected for ephemeral hosting.

**WhatsApp preview not showing**  
→ Ensure `BASE_URL` matches your public HTTPS URL exactly.

---

## Share with non-technical users

Once deployed, send them:

1. Your live URL (e.g. `https://anywheremms.onrender.com`)
2. Link to the guide: `https://your-url/how-to.html`

They never touch Render or GitHub — they just use the website.
