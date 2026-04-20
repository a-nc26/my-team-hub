# My Team Hub

A personal team management dashboard for team leads. Track your analysts, log meetings with AI digest, manage projects, todos, and tools — all in one place.

Built with Next.js 14, Prisma, PostgreSQL (Neon), and Claude AI.

---

## Quick Setup (~15 min)

### 1. Fork & clone

Click **Fork** on GitHub, then:

```bash
git clone https://github.com/YOUR-USERNAME/my-team-hub.git
cd my-team-hub/app
npm install
```

### 2. Create a database (free)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Copy the **connection string** — looks like:
   `postgresql://user:password@host/dbname?sslmode=require`

### 3. Get an Anthropic API key (for AI features)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 4. Add environment variables

Create a file called `.env.local` inside the `app/` folder:

```
DATABASE_URL=your_neon_connection_string
DIRECT_URL=your_neon_connection_string
ANTHROPIC_API_KEY=your_anthropic_key
```

### 5. Set up the database

```bash
npx prisma db push
```

This creates all the tables — no data, completely fresh.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (free)

1. Push your fork to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Set the **root directory** to `app`
4. Add environment variables from step 4 above under **Settings → Environment Variables**
5. Deploy — your app will be live at `https://your-project.vercel.app`

---

## Features

- **Team** — analyst cards with mood tracking, notes history, sparkline trend
- **Projects** — assign analysts with custom fields (harm area, amount etc.), start/end dates
- **Meetings** — log 1:1s and team meetings, AI digest saves suggestions for your review
- **My To-Dos** — grouped todos, link items to analysts
- **Tools** — track tools your team builds (with status, category, builder)
- **AI Coach** — chat with full context of your team state, conversation persists
- **n8n integration** — `/api/n8n/digest` and `/api/n8n/weekly-summary` endpoints ready to use

---

## First steps after setup

1. Open the app and click **Set your name** in the top right
2. Go to **Team** → add your analysts
3. Log your first meeting and try **Save + AI digest**
