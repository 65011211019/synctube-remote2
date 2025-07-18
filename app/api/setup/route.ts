import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function POST() {
  try {
    const supabase = createClient()

    // Test if tables exist by trying to query rooms
    const { data, error } = await supabase.from("rooms").select("room_id").limit(1)

    if (error && error.message.includes("does not exist")) {
      return NextResponse.json({
        success: false,
        message: "Database tables not found",
        instructions: [
          "Go to your Supabase dashboard",
          "Navigate to SQL Editor",
          "Run the SQL script from scripts/create-tables.sql",
          "Refresh this page",
        ],
      })
    }

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Database is properly configured",
    })
  } catch (error) {
    console.error("Setup check error:", error)
    return NextResponse.json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    })
  }
}
