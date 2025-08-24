import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to load environment variables from .env.local
const envPath = path.join(__dirname, "..", ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=")
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase configuration")
  console.log("\n📋 Please set the following environment variables:")
  console.log("Create a .env.local file in your project root with:")
  console.log("")
  console.log("NEXT_PUBLIC_SUPABASE_URL=your_supabase_url")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key")
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
  console.log("YOUTUBE_API_KEY=your_youtube_api_key")
  console.log("")
  console.log("🔗 Get these values from your Supabase dashboard:")
  console.log("1. Go to https://supabase.com/dashboard")
  console.log("2. Select your project")
  console.log("3. Go to Settings → API")
  console.log("4. Copy the URL and keys")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  try {
    console.log("🚀 Setting up SyncTube Remote database...")

    // Read the SQL file
    const sqlPath = path.join(__dirname, "create-tables.sql")

    if (!fs.existsSync(sqlPath)) {
      console.error("❌ SQL file not found:", sqlPath)
      console.log("Please make sure create-tables.sql exists in the scripts folder")
      process.exit(1)
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8")

    // Execute the SQL directly
    console.log("📝 Executing database setup script...")

    const { data, error } = await supabase.rpc("exec_sql", {
      sql: sqlContent,
    })

    if (error) {
      // If RPC doesn't work, try executing commands separately
      console.log("⚠️  RPC failed, trying alternative method...")

      // Split and execute commands one by one
      const commands = sqlContent
        .split(";")
        .map((cmd) => cmd.trim())
        .filter((cmd) => cmd.length > 0 && !cmd.startsWith("--"))

      for (let i = 0; i < commands.length; i++) {
        const command = commands[i]
        if (command.trim()) {
          try {
            // Try executing via SQL editor endpoint
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
              },
              body: JSON.stringify({ sql: command }),
            })

            if (!response.ok) {
              console.warn(`⚠️  Command ${i + 1} may have failed`)
            } else {
              console.log(`✅ Command ${i + 1}/${commands.length} executed`)
            }
          } catch (cmdError) {
            console.warn(`⚠️  Command ${i + 1} warning:`, cmdError.message)
          }
        }
      }
    } else {
      console.log("✅ SQL script executed successfully!")
    }

    // Test the setup by querying the rooms table
    console.log("🧪 Testing database setup...")
    const { data: testData, error: testError } = await supabase.from("rooms").select("*").limit(1)

    if (testError) {
      console.error("❌ Database test failed:", testError.message)
      console.log("\n📋 Manual setup required:")
      console.log("1. Go to your Supabase dashboard")
      console.log("2. Navigate to SQL Editor")
      console.log("3. Copy and paste the contents of scripts/create-tables.sql")
      console.log("4. Click 'Run' to execute the script")
      console.log("5. Run this setup script again")
    } else {
      console.log("✅ Database setup completed successfully!")
      console.log("🎵 SyncTube Remote is ready to use!")
      console.log("\n🚀 Next steps:")
      console.log("1. Run: npm run dev")
      console.log("2. Open: http://localhost:3000")
      console.log("3. Create your first room!")
    }
  } catch (error) {
    console.error("❌ Setup failed:", error.message)
    console.log("\n📋 Manual setup instructions:")
    console.log("1. Go to your Supabase dashboard")
    console.log("2. Navigate to SQL Editor")
    console.log("3. Copy and paste the contents of scripts/create-tables.sql")
    console.log("4. Click 'Run' to execute the script")
  }
}

// Run setup
setupDatabase()
