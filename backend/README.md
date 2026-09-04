# 🏥 Care N Cure - Backend Deployment Guide (Render & Supabase)

This backend is built using Node.js & Express, integrated with **Supabase PostgreSQL** as the database layer, and designed for deployment on **Render**.

---

## 🚀 Quick Setup Instructions

### 1. Database Setup on Supabase

1. Sign in to your [Supabase Console](https://supabase.com/).
2. Create a new project (e.g., `care-n-cure-db`).
3. Open **SQL Editor** from the left sidebar.
4. Copy the entire contents of `backend/schema.sql` and run it in the SQL Editor.
5. Go to **Project Settings** -> **API**:
   - Copy `Project URL` (used as `SUPABASE_URL`)
   - Copy `anon` `public` key (used as `SUPABASE_ANON_KEY`)

---

### 2. Deploy Backend on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`Care-N-Cure`).
4. Configure the Web Service settings:
   - **Name**: `care-n-cure-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add the following keys:
   | Key | Value | Description |
   |---|---|---|
   | `SUPABASE_URL` | `https://xyz.supabase.co` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | `eyJhb...` | Your Supabase anon API key |
   | `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel frontend URL (or `*`) |
   | `PORT` | `10000` | Render port (auto-set by Render) |

6. Click **Deploy Web Service**.
7. Once deployed, copy your Render Service URL (e.g., `https://care-n-cure-backend.onrender.com`).

---

### 3. Verification & Health Check

After deployment, test your live Render backend service:
- **Health Check**: `https://your-render-app.onrender.com/api/health`
- **Data Endpoint**: `https://your-render-app.onrender.com/api/data`

---

### 4. Connect Vercel Frontend to Render Backend

In your Vercel project environment settings, add:
- `NEXT_PUBLIC_BACKEND_URL`: `https://care-n-cure-backend.onrender.com/api/data`

Or update `window.CARE_N_CURE_BACKEND_URL` in `js/data.js`.
