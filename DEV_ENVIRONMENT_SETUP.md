# Dev Environment Setup Guide

## Current Setup

- **Branch**: `dev`
- **Status**: Active development branch
- **GitHub**: `origin/dev` (pushed)

## Vercel Preview Deployment

Every push to the `dev` branch automatically creates a preview deployment on Vercel.

### How to Find Your Preview URL

1. **Vercel Dashboard**:
   - Go to https://vercel.com/dashboard
   - Click your project
   - Go to "Deployments" tab
   - Look for deployments with "dev" branch badge
   - Preview URL format: `adops-dashboard-git-dev-[username].vercel.app`

2. **GitHub**:
   - Go to your repository
   - Switch to `dev` branch
   - Check the commit status (green checkmark)
   - Click "Details" on Vercel check

### Environment Variables for Dev

Make sure your dev preview has the correct backend URL:

```
VITE_API_BASE_URL=https://your-render-dev-backend.onrender.com
```

Set this in: Vercel Project → Settings → Environment Variables → Preview

## Render Dev Environment

For backend dev environment:

1. Create new Web Service on Render
2. Name: `adops-dashboard-backend-dev`
3. Branch: `dev`
4. Root Directory: `backend`
5. Build Command: `npm install`
6. Start Command: `node server.js`

## Workflow

```
Local → Test → Commit → Push to dev → Auto-deploy to preview → Test preview → Merge to main → Production
```

---

**Created**: 2026-04-07
**Branch**: dev
**Status**: Ready for preview deployments
