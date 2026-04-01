# My Team Hub

A team management dashboard built with Next.js, Prisma, and PostgreSQL — hosted on Vercel.

---

## First-time setup

### 1. Set up your database (Neon — free)

1. Go to https://neon.tech and create a free account
2. Create a new project called "my-team-hub"
3. On the dashboard, click **Connection Details**
4. Copy the **Connection string** (looks like `postgresql://user:pass@host/db`)

### 2. Configure environment variables

Create a file at `app/.env.local`:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> Both DATABASE_URL and DIRECT_URL get the same Neon connection string for now.
> (DIRECT_URL is used by Prisma Migrate to bypass connection pooling)

### 3. Install dependencies & push schema

```bash
cd "/Users/avilurie/Desktop/My Team/app"
npm install
npm run db:push
```

`db:push` creates all the tables in your Neon database automatically.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
cd "/Users/avilurie/Desktop/My Team/app"
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/my-team-hub.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Vercel auto-detects Next.js — no config needed
3. Before deploying, add environment variables in Vercel:
   - **Settings → Environment Variables**
   - Add `DATABASE_URL`, `DIRECT_URL`, and `ANTHROPIC_API_KEY`
4. Click **Deploy**

Your app will be live at `https://your-project.vercel.app`

---

## Seed initial team members

After running `npm run db:push`, open http://localhost:3000 and add your analysts
through the app, **or** run the seed script:

```bash
node prisma/seed.js
```

---

## Stack

- **Next.js 14** (App Router)
- **Prisma** ORM
- **Neon** PostgreSQL
- **Anthropic Claude** API (server-side only)
