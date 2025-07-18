import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST() {
  const supabase = createClient();
  const now = new Date().toISOString();

  // Find expired rooms
  const { data: expiredRooms, error: findError } = await supabase
    .from("rooms")
    .select("room_id")
    .lt("expires_at", now);

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!expiredRooms || expiredRooms.length === 0) {
    return NextResponse.json({ message: "No expired rooms found" });
  }

  for (const room of expiredRooms) {
    const { room_id } = room as { room_id: string };
    await supabase.from("queue").delete().eq("room_id", room_id);
    await supabase.from("votes").delete().eq("room_id", room_id);
    await supabase.from("room_presence").delete().eq("room_id", room_id);
    await supabase.from("rooms").delete().eq("room_id", room_id);
  }

  return NextResponse.json({ message: `Deleted ${expiredRooms.length} expired rooms` });
} 