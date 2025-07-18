"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users, Clock, Lock, Music, Plus, LogIn, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { generateUserId, getUserId } from "@/lib/user"
import { generateRoomId } from "@/lib/room"
import { generateQRCode } from "@/lib/qr"
import { hashPassword } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"

// Interface for the Room object displayed in the UI, including calculated fields
interface Room {
  room_id: string
  room_name: string
  password_hash: string | null
  expires_at: string
  active: boolean
  user_count: number // This is a calculated field
  current_video: string | null
}

// Interface for the raw data coming directly from the 'rooms' table in Supabase
// (Assuming these are the columns selected by `select("*")`)
interface RawRoomData {
  room_id: string;
  room_name: string;
  password_hash: string | null;
  expires_at: string;
  active: boolean;
  current_video: string | null;
  created_at: string; // Assuming 'created_at' is a column
  host_user_id: string | null; // Assuming 'host_user_id' is a column
  // Add any other columns returned by `select("*")` from your 'rooms' table
}

// Interface to better type Supabase/PostgREST errors in catch blocks
interface PostgrestErrorExtended extends Error {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
}


export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [joinRoomOpen, setJoinRoomOpen] = useState(false)
  const [qrCodeOpen, setQrCodeOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [createdRoomId, setCreatedRoomId] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Create room form state
  const [roomId, setRoomId] = useState("")
  const [roomName, setRoomName] = useState("")
  const [password, setPassword] = useState("")
  const [generatingRoomId, setGeneratingRoomId] = useState(false)

  // Join room form state
  const [joinRoomId, setJoinRoomId] = useState("")
  const [joinPassword, setJoinJoinPassword] = useState("")

  useEffect(() => {
    // Generate user ID if not exists
    if (!getUserId()) {
      generateUserId()
    }

    // Generate initial room ID
    generateNewRoomId()

    loadRooms()

    // Subscribe to room changes
    const subscription = supabase
      .channel("rooms_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => loadRooms())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_presence" }, () => loadRooms())
      .subscribe()

    // Refresh rooms every 30 seconds
    const interval = setInterval(loadRooms, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const generateNewRoomId = async () => {
    setGeneratingRoomId(true)
    let newRoomId = generateRoomId()

    // Check if room ID already exists (only if Supabase is configured)
    if (isSupabaseConfigured) {
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        try {
          const { data: existingRoom } = await supabase
            .from("rooms")
            .select("room_id")
            .eq("room_id", newRoomId)
            .eq("active", 1)
            .single()

          if (!existingRoom) {
            break // Room ID is unique
          }

          // Generate new ID if exists
          newRoomId = generateRoomId()
          attempts++
        } catch (error: unknown) {
          // If error is "not found", that's good - room ID is unique
          // Supabase/PostgREST "No rows found" error for .single() is PGRST116
          if (
            typeof error === 'object' && error !== null &&
            'code' in error && (error as PostgrestErrorExtended).code === "PGRST116"
          ) {
            break // Room ID is unique (no active room found with this ID)
          }
          // For other errors, just log and use the generated ID, or rethrow for critical errors
          console.error("Error checking room ID existence:", error)
          break // Exit loop, use the current newRoomId
        }
      }
    }

    setRoomId(newRoomId)
    setGeneratingRoomId(false)
  }

  const loadRooms = async () => {
    // Skip if Supabase credentials are missing (e.g. first-time preview)
    if (!isSupabaseConfigured) {
      console.warn("Supabase isn't configured – skipping room fetch.")
      setRooms([])
      setLoading(false)
      return
    }

    try {
      const { data: roomsData, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("active", 1)
        .order("created_at", { ascending: false })

      // PostgREST returns 42P01 when the relation/table doesn't exist
      if (error && (error.message.includes("does not exist") || error.code === "42P01" || error.code === "PGRST116")) {
        console.warn("Rooms table not found – showing empty state instead of throwing.")
        setRooms([])
        setLoading(false)
        return
      }

      if (error) throw error

      // FIX 1: Use double assertion: roomsData is initially unknown to TS, cast to unknown then to RawRoomData[]
      const rawRooms: RawRoomData[] = (roomsData || []) as unknown as RawRoomData[];

      const roomsWithCounts: Room[] = await Promise.all(
        rawRooms.map(async (room) => {
          const { count } = await supabase
            .from("room_presence")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.room_id)
            .gte("last_seen", new Date(Date.now() - 30000).toISOString())

          return { ...room, user_count: count || 0 } as Room;
        }),
      )

      setRooms(roomsWithCounts)
    } catch (err: unknown) {
      console.error("Database error while loading rooms:", err)
      toast({
        title: "Database not ready",
        description:
          "It looks like your database hasn't been initialised yet. Run `npm run setup` or create the tables in Supabase.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const createRoom = async () => {
    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive",
      })
      return
    }

    try {
      const userId = getUserId()
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      const passwordHash = password ? await hashPassword(password) : null

      const { error } = await supabase.from("rooms").insert({
        room_id: roomId,
        room_name: roomName.trim(),
        password_hash: passwordHash,
        expires_at: expiresAt.toISOString(),
        host_user_id: userId,
      })

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          toast({
            title: "Error",
            description: "Room ID already exists. Generating a new one...",
            variant: "destructive",
          })
          await generateNewRoomId()
          return
        }
        throw error
      }

      // Generate QR code
      const roomUrl = `${window.location.origin}/room/${roomId}`
      const qrCodeResult = await generateQRCode(roomUrl); // Get the result from the async function
      
      // FIX 2: Check if qrCodeResult is actually a string before setting the state
      if (typeof qrCodeResult === 'string') {
        setQrCodeUrl(qrCodeResult);
        setCreatedRoomId(roomId)
        setQrCodeOpen(true)
        setCreateRoomOpen(false)

        // Reset form and generate new room ID for next time
        setRoomName("")
        setPassword("")
        await generateNewRoomId()

        toast({
          title: "Success",
          description: `Room ${roomId} created successfully!`,
        })

        loadRooms()
      } else {
        console.error("generateQRCode did not return a string:", qrCodeResult);
        toast({
          title: "Error",
          description: "Failed to generate QR code. Please try again.",
          variant: "destructive",
        });
        // Keep the create room dialog open or handle as appropriate
      }

    } catch (error) {
      console.error("Error creating room:", error)
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      })
    }
  }

  const joinRoom = async (targetRoomId?: string, targetPassword?: string) => {
    const roomIdToJoin = (targetRoomId || joinRoomId.trim()).toUpperCase()
    const passwordToJoin = targetPassword || joinPassword

    if (!roomIdToJoin) {
      toast({
        title: "Error",
        description: "Please enter a room ID",
        variant: "destructive",
      })
      return
    }

    try {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_id", roomIdToJoin)
        .eq("active", 1)
        .single()

      if (error || !room) {
        toast({
          title: "Error",
          description: "Room not found or has expired",
          variant: "destructive",
        })
        return
      }

      // Check password if required
      if (room.password_hash && !passwordToJoin) {
        toast({
          title: "Password Required",
          description: "This room requires a password",
          variant: "destructive",
        })
        return
      }

      if (room.password_hash) {
        if (!passwordToJoin || typeof passwordToJoin !== "string") {
          toast({
            title: "Error",
            description: "Password is required",
            variant: "destructive",
          })
          return
        }
        const isValidPassword = await verifyPassword(
          typeof passwordToJoin === "string" ? passwordToJoin : "",
          typeof room.password_hash === "string" ? room.password_hash : ""
        )
        if (!isValidPassword) {
          toast({
            title: "Error",
            description: "Incorrect password",
            variant: "destructive",
          })
          return
        }
      }

      // Join the room
      router.push(`/room/${roomIdToJoin}`)
    } catch (error) {
      console.error("Error joining room:", error)
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      })
    }
  }

  const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, hash }),
      })
      const { valid } = await response.json()
      return valid
    } catch {
      return false
    }
  }

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 px-2">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 mb-3 flex items-center justify-center gap-2 flex-wrap drop-shadow-lg">
            <Music className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600" />
            <span>SyncTube Remote</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-700 max-w-2xl mx-auto font-medium">
            Share and listen to YouTube music with friends in real-time. Create private rooms, manage queues, vote to skip, and more.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3 bg-white/90 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow border border-purple-100">
              <Music className="h-7 w-7 text-purple-600 mt-1" />
              <div>
                <div className="font-bold text-lg text-gray-900 mb-1">Listen Together in Real-Time</div>
                <div className="text-sm text-gray-600">Create a room, share a link or QR code, and enjoy YouTube music with friends anywhere.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/90 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow border border-purple-100">
              <Users className="h-7 w-7 text-purple-600 mt-1" />
              <div>
                <div className="font-bold text-lg text-gray-900 mb-1">Queue Management & Skip Voting</div>
                <div className="text-sm text-gray-600">Add, remove, and reorder songs in the queue. Vote to skip songs you don't want to hear.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/90 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow border border-purple-100">
              <Lock className="h-7 w-7 text-purple-600 mt-1" />
              <div>
                <div className="font-bold text-lg text-gray-900 mb-1">Private Rooms</div>
                <div className="text-sm text-gray-600">Set a room password to keep your session private and secure.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/90 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow border border-purple-100">
              <Clock className="h-7 w-7 text-purple-600 mt-1" />
              <div>
                <div className="font-bold text-lg text-gray-900 mb-1">Auto-Expiring Rooms</div>
                <div className="text-sm text-gray-600">Rooms are automatically deleted after expiration for privacy and resource efficiency.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10 justify-center px-2">
          <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg w-full sm:w-auto transition-all">
                <Plus className="h-5 w-5 mr-2" />
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Create New Room</DialogTitle>
                <DialogDescription className="text-sm">
                  Set up a new music room for you and your friends
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomId" className="text-sm font-medium">
                    Room ID
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="roomId"
                      value={roomId}
                      readOnly
                      className="font-mono text-base sm:text-lg font-bold text-center bg-gray-50"
                      placeholder="Generating..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={generateNewRoomId}
                      disabled={generatingRoomId}
                      className="shrink-0 bg-transparent"
                    >
                      <RefreshCw className={`h-4 w-4 ${generatingRoomId ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Auto-generated 5-character room ID</p>
                </div>
                <div>
                  <Label htmlFor="roomName" className="text-sm font-medium">
                    Room Name *
                  </Label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password (Optional)
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty for no password"
                    className="mt-1"
                  />
                </div>
                <Button onClick={createRoom} className="w-full" disabled={!roomName.trim()}>
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={joinRoomOpen} onOpenChange={setJoinRoomOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white border-2 border-purple-200 hover:border-purple-400 text-purple-700 font-bold shadow-sm transition-all">
                <LogIn className="h-5 w-5 mr-2" />
                Join Room
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Join Room</DialogTitle>
                <DialogDescription className="text-sm">Enter room ID to join an existing music room</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="joinRoomId" className="text-sm font-medium">
                    Room ID
                  </Label>
                  <Input
                    id="joinRoomId"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter 5-character room ID"
                    maxLength={5}
                    className="font-mono text-base sm:text-lg text-center mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="joinPassword" className="text-sm font-medium">
                    Password (if required)
                  </Label>
                  <Input
                    id="joinPassword"
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinJoinPassword(e.target.value)} // Corrected typo here
                    placeholder="Enter password"
                    className="mt-1"
                  />
                </div>
                <Button onClick={() => joinRoom()} className="w-full" disabled={joinRoomId.length !== 5}>
                  Join Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Room Created Successfully!</DialogTitle>
              <DialogDescription className="text-sm">Share this QR code or room ID with your friends</DialogDescription>
            </DialogHeader>
            <div className="text-center space-y-4">
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Room ID</p>
                <p className="text-2xl sm:text-3xl font-mono font-bold text-purple-600">{createdRoomId}</p>
              </div>
              <Button onClick={() => router.push(`/room/${createdRoomId}`)} className="w-full">
                Enter Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Active Rooms */}
        <div className="px-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 text-center sm:text-left">Active Rooms</h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">Loading rooms...</p>
            </div>
          ) : rooms.length === 0 || !isSupabaseConfigured ? (
            <Card>
              <CardContent className="text-center py-8">
                <Music className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No active rooms found</p>
                <p className="text-xs sm:text-sm text-gray-500">Create a new room to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {rooms.map((room) => (
                <Card key={room.room_id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">{room.room_name}</CardTitle>
                        <CardDescription className="font-mono text-sm sm:text-lg font-bold text-purple-600">
                          {room.room_id}
                        </CardDescription>
                      </div>
                      {room.password_hash && <Lock className="h-4 w-4 text-gray-500 shrink-0 ml-2" />}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span>{room.user_count} active users</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span>Expires in {formatTimeRemaining(room.expires_at)}</span>
                      </div>
                      {room.current_video && (
                        <Badge variant="secondary" className="text-xs">
                          <Music className="h-3 w-3 mr-1" />
                          Playing music
                        </Badge>
                      )}
                    </div>
                    <Button
                      className="w-full mt-4 bg-transparent text-sm"
                      variant="outline"
                      onClick={() => {
                        if (room.password_hash) {
                          setJoinRoomId(room.room_id)
                          setJoinRoomOpen(true)
                        } else {
                          joinRoom(room.room_id, "")
                        }
                      }}
                    >
                      Join Room
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}