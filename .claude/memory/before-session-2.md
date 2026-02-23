# What to do before Session 2

These are things that require your accounts or payment. None of them take more than 15 minutes each.

---

## 1. Create a Supabase project (10 min) — BLOCKS everything

Without this, Session 2 cannot run. Nothing in the app connects to a database until you do this.

**Steps:**
1. Go to supabase.com and log in (or create an account — it's free)
2. Click "New project"
3. Name it `playfunded`
4. Choose a region close to your users — pick **São Paulo (South America)** or **Frankfurt (Europe)** for LATAM coverage
5. Set a strong database password and save it somewhere safe
6. Wait about 2 minutes for the project to finish setting up
7. Go to **Project Settings → Database**
8. Under "Connection string", click **"URI"** tab
9. Copy the connection string — it looks like: `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
10. Open `.env.local` in the `playfunded` folder (create it by copying `.env.example`) and fill in:
    - `DATABASE_URL` = the connection string with `?pgbouncer=true` added at the end
    - `DIRECT_URL` = same connection string but port `5432` instead of `6543`, no `?pgbouncer=true`
    - `NEXT_PUBLIC_SUPABASE_URL` = from Project Settings → API → Project URL
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = from Project Settings → API → anon/public key
    - `SUPABASE_SERVICE_ROLE_KEY` = from Project Settings → API → service_role key (keep this secret)

---

## 2. Enable Google OAuth in Supabase (5 min)

1. In your Supabase project, go to **Authentication → Providers**
2. Click **Google** and toggle it on
3. You need a Google OAuth client ID and secret. To get them:
   - Go to console.cloud.google.com
   - Create a new project (or use an existing one)
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Under "Authorized redirect URIs", add: `https://[your-supabase-project-ref].supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret back into the Supabase Google provider settings
4. Save

---

## 3. Apply for payment provider accounts NOW (takes days to approve — start today)

These have approval processes that take time. If you wait until you reach Session 4 to apply, you'll be blocked for days.

### Stripe (for card payments)
- Go to stripe.com → Create account
- Fill in your business info. If you don't have a registered business yet, you can use individual/sole trader
- Once approved, get your test API keys from the Stripe dashboard
- Add to `.env.local`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- The webhook secret you'll get in Session 4 when you set up the endpoint

### Mercado Pago (for LATAM)
- Go to mercadopago.com.mx (or .com.ar, .com.co depending on your primary market)
- Create a seller account
- Go to **Your integrations → Credentials**
- Get your test Access Token
- Add to `.env.local`: `MERCADOPAGO_ACCESS_TOKEN`
- Note: full approval for live payments requires business verification (1-3 days)

### NOWPayments (for crypto)
- Go to nowpayments.io → Create account
- Complete their KYC process (requires photo ID — takes up to 24h)
- Once approved, go to the API section and generate an API key
- Set an IPN secret for webhook validation
- Add to `.env.local`: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`

---

## 4. Get your API keys ready — lower priority, can wait until Session 6

These are needed for Session 6 (odds feed) but don't require long approval:
- **The Odds API**: go to theoddsapi.com → sign up → free tier gives you 500 requests/month to test with. Copy your API key to `.env.local` as `ODDS_API_KEY`
- **API-Football**: go to api-football.com → sign up → free tier is 100 calls/day. Copy key to `.env.local` as `API_FOOTBALL_KEY`

---

## 5. After filling in .env.local, run the first migration

Open Terminal, go to the playfunded folder, and run:

```bash
cd ~/playfunded
npm run db:migrate
```

It will ask you to name the migration — type `init` and press Enter.

Then seed the database with the 4 challenge tiers:

```bash
npm run db:seed
```

You should see:
```
✓ Tier: Starter $1K — $20 entry → $1000 funded
✓ Tier: Pro $5K — $99 entry → $5000 funded
✓ Tier: Elite $10K — $199 entry → $10000 funded
✓ Tier: Champion $25K — $499 entry → $25000 funded
✅ Seed complete
```

Once you've done all of this, tell me and we'll start Session 2.
