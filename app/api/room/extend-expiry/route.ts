import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

const VALID_CODES = new Set(["NISIOGOD", "MYBROTHER", "GAYALLSTAR"]);

// Helper to add hours from a base time (Date or string)
function addHours(base: string | Date, hours: number) {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const { room_id, code } = await req.json();
    if (!room_id || typeof room_id !== "string") {
      return NextResponse.json({ error: "room_id is required" }, { status: 400 });
    }

    const supabase = createClient();

    // Load current room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("room_id, expires_at")
      .eq("room_id", room_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Code can be provided anytime. If code is present, must be valid.
    if (code && !VALID_CODES.has(String(code).trim())) {
      return NextResponse.json(
        {
          error: "Invalid code",
          hint: "กรุณาติดต่อ admin เพื่อขอรับโค้ด",
        },
        { status: 401 }
      );
    }

    // Extend logic: from max(now, current expires_at) + 2 hours
    const now = new Date();
    const currentExpiry = new Date(String(room.expires_at));
    const base = currentExpiry > now ? currentExpiry : now;
    const newExpiry = addHours(base, 2);

    const { error: updateError } = await supabase
      .from("rooms")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("room_id", room_id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update expires_at" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      room_id,
      expires_at: newExpiry.toISOString(),
    });
  } catch (err: any) {
    console.error("extend-expiry error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
