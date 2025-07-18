# SyncTube Remote 🎵

A real-time YouTube music sharing platform where users can create rooms, sync playback, and enjoy music together.

## Quick Setup

### 1. Environment Variables

First, create your environment configuration:

\`\`\`bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your actual values
\`\`\`

Get your Supabase values from:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the URL and keys

Get your YouTube API key from:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create credentials (API Key)

### 2. Database Setup

**Option A: Automatic Setup**
\`\`\`bash
npm install --legacy-peer-deps
npm run setup
\`\`\`

**Option B: Manual Setup**
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `scripts/create-tables.sql`
4. Click **Run** to execute the script

**Option C: Setup Helper**
\`\`\`bash
npm run setup:manual
\`\`\`

### 3. Run the Application

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000/setup](http://localhost:3000/setup) to check your configuration status.

## Troubleshooting

### "relation 'public.rooms' does not exist"

This means the database tables haven't been created yet. Follow these steps:

1. **Check your Supabase connection:**
   - Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Make sure your Supabase project is active

2. **Run the database setup:**
   \`\`\`bash
   npm run setup
   \`\`\`

3. **Manual setup if automatic fails:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents of `scripts/create-tables.sql`
   - Execute the script

4. **Verify setup:**
   - Refresh your application
   - Check the browser console for any remaining errors

### YouTube API Issues

1. **Get a YouTube Data API v3 key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable YouTube Data API v3
   - Create credentials (API Key)
   - Add the key to your `.env.local`

2. **API quota limits:**
   - Free tier has daily limits
   - Consider implementing caching for production

## Features

- ✅ Real-time room synchronization
- ✅ YouTube search and playback
- ✅ Queue management
- ✅ Host controls (play/pause/skip)
- ✅ Anonymous user tracking
- ✅ QR code room sharing
- ✅ Auto-expiring rooms (2 hours)
- ✅ Vote skip system
- ✅ Mobile responsive

## Architecture

- **Frontend:** Next.js 14 with TypeScript
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Realtime
- **Authentication:** Anonymous (UUID-based)
- **Media:** YouTube IFrame API

## Scripts

- `npm run dev` - Start development server
- `npm run setup` - Setup database tables
- `npm run cleanup` - Clean expired rooms
- `npm run build` - Build for production
