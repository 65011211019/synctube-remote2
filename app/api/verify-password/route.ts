import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { password, hash } = await request.json()

    if (!password || !hash) {
      return NextResponse.json({ error: "Password and hash are required" }, { status: 400 })
    }

    const valid = await bcrypt.compare(password, hash)
    return NextResponse.json({ valid })
  } catch (error) {
    console.error("Password verification error:", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
