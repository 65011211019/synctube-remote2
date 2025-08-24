#!/bin/bash

echo "🚀 Setting up SyncTube Remote..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "📋 Please create .env.local file with your Supabase configuration"
    echo ""
    echo "Copy .env.local.example to .env.local and fill in your values:"
    echo "cp .env.local.example .env.local"
    echo ""
    echo "🔗 Get your Supabase values from:"
    echo "https://supabase.com/dashboard → Your Project → Settings → API"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "📋 Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database setup
echo "🗄️ Setting up database..."
node scripts/setup-database.js

echo "✅ Setup complete!"
echo "🚀 Run 'npm run dev' to start the application"
