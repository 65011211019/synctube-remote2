import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST() {
  const supabase = createClient();
  const now = new Date().toISOString();

  // หา room ที่หมดอายุ
  const { data: expiredRooms, error: findError } = await supabase
    .from("rooms")
    .select("room_id")
    .lt("expires_at", now);

  if (findError) {
    return NextResponse.json({ success: false, error: findError.message }, { status: 500 });
  }

  if (!expiredRooms || expiredRooms.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  let deleted = 0;
  for (const room of expiredRooms) {
    const { room_id } = room as { room_id: string };
    await supabase.from("queue").delete().eq("room_id", room_id);
    await supabase.from("votes").delete().eq("room_id", room_id);
    await supabase.from("room_presence").delete().eq("room_id", room_id);
    await supabase.from("rooms").delete().eq("room_id", room_id);
    deleted++;
  }

  return NextResponse.json({ success: true, deleted });
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
} 