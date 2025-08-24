import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupExpiredRooms() {
  try {
    console.log("Starting cleanup of expired rooms...")

    const now = new Date().toISOString()

    // Find expired rooms
    const { data: expiredRooms, error: findError } = await supabase
      .from("rooms")
      .select("room_id")
      .lt("expires_at", now)

    if (findError) {
      throw findError
    }

    if (!expiredRooms || expiredRooms.length === 0) {
      console.log("No expired rooms found")
      return
    }

    console.log(`Found ${expiredRooms.length} expired rooms`)

    // Delete expired rooms and related data
    for (const room of expiredRooms) {
      // Delete queue items
      await supabase.from("queue").delete().eq("room_id", room.room_id)

      // Delete votes
      await supabase.from("votes").delete().eq("room_id", room.room_id)

      // Delete presence records
      await supabase.from("room_presence").delete().eq("room_id", room.room_id)

      // Delete the room itself
      await supabase.from("rooms").delete().eq("room_id", room.room_id)
    }

    console.log(`Successfully deleted ${expiredRooms.length} expired rooms`)
  } catch (error) {
    console.error("Error cleaning up expired rooms:", error)
  }
}

// Run cleanup
cleanupExpiredRooms()
