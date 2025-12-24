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
import { Users, Clock, Lock, Music, Plus, LogIn, RefreshCw, Sparkles, Zap, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { generateUserId, getUserId } from "@/lib/user"
import { generateRoomId } from "@/lib/room"
import { generateQRCode } from "@/lib/qr"
import { hashPassword } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import Footer from "@/components/Footer";

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
            .eq("active", true)
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
        .eq("active", true)
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

      // Filter out expired rooms (expires_at <= now)
      const now = new Date();
      const filteredRooms = rawRooms.filter(room => new Date(room.expires_at).getTime() > now.getTime());

      const roomsWithCounts: Room[] = await Promise.all(
        filteredRooms.map(async (room) => {
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
      if (!userId) {
        toast({
          title: "Error",
          description: "User ID not found. Please refresh the page.",
          variant: "destructive",
        })
        return
      }
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
        .eq("active", true)
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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Real-time Music Sharing</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black mb-6 tracking-tight">
            <span className="gradient-text">SyncTube</span>
            <br />
            <span className="text-foreground">Remote</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Share and listen to YouTube music with friends in real-time.
            Create private rooms, manage queues, vote to skip, and more.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="btn-gradient h-14 px-8 text-lg rounded-2xl w-full sm:w-auto"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Room
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md mx-auto animate-scale-in">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Create New Room</DialogTitle>
                  <DialogDescription>
                    Set up a new music room for you and your friends
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div>
                    <Label htmlFor="roomId" className="text-sm font-semibold">
                      Room ID
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="roomId"
                        value={roomId}
                        readOnly
                        className="font-mono text-lg font-bold text-center bg-muted/50 border-2"
                        placeholder="Generating..."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={generateNewRoomId}
                        disabled={generatingRoomId}
                        className="shrink-0 h-11 w-11"
                      >
                        <RefreshCw className={`h-4 w-4 ${generatingRoomId ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Auto-generated 5-character room ID</p>
                  </div>
                  <div>
                    <Label htmlFor="roomName" className="text-sm font-semibold">
                      Room Name *
                    </Label>
                    <Input
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="mt-2 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-sm font-semibold">
                      Password (Optional)
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave empty for no password"
                      className="mt-2 h-11"
                    />
                  </div>
                  <Button
                    onClick={createRoom}
                    className="w-full h-12 text-base font-semibold btn-gradient rounded-xl"
                    disabled={!roomName.trim()}
                  >
                    Create Room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={joinRoomOpen} onOpenChange={setJoinRoomOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-2xl w-full sm:w-auto border-2 hover:bg-accent/50 transition-all"
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  Join Room
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md mx-auto animate-scale-in">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Join Room</DialogTitle>
                  <DialogDescription>Enter room ID to join an existing music room</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div>
                    <Label htmlFor="joinRoomId" className="text-sm font-semibold">
                      Room ID
                    </Label>
                    <Input
                      id="joinRoomId"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                      placeholder="Enter 5-character room ID"
                      maxLength={5}
                      className="font-mono text-lg text-center mt-2 h-12 border-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="joinPassword" className="text-sm font-semibold">
                      Password (if required)
                    </Label>
                    <Input
                      id="joinPassword"
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinJoinPassword(e.target.value)}
                      placeholder="Enter password"
                      className="mt-2 h-11"
                    />
                  </div>
                  <Button
                    onClick={() => joinRoom()}
                    className="w-full h-12 text-base font-semibold btn-gradient rounded-xl"
                    disabled={joinRoomId.length !== 5}
                  >
                    Join Room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                icon: Music,
                title: "Real-Time Sync",
                description: "Listen together with friends anywhere in the world"
              },
              {
                icon: Users,
                title: "Queue System",
                description: "Add, remove, and reorder songs collaboratively"
              },
              {
                icon: Shield,
                title: "Private Rooms",
                description: "Password-protect your sessions for privacy"
              },
              {
                icon: Zap,
                title: "Vote Skip",
                description: "Democratic control over what plays next"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="feature-card card-hover animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
          <DialogContent className="w-[95vw] max-w-md mx-auto animate-scale-in">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center">Room Created! 🎉</DialogTitle>
              <DialogDescription className="text-center">Share this QR code or room ID with your friends</DialogDescription>
            </DialogHeader>
            <div className="text-center space-y-6 py-4">
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-lg">
                    <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
                  </div>
                </div>
              )}
              <div className="bg-muted/50 p-6 rounded-2xl">
                <p className="text-sm text-muted-foreground mb-2">Room ID</p>
                <p className="text-3xl sm:text-4xl font-mono font-black text-primary tracking-wider">{createdRoomId}</p>
              </div>
              <Button
                onClick={() => router.push(`/room/${createdRoomId}`)}
                className="w-full h-12 text-base font-semibold btn-gradient rounded-xl"
              >
                Enter Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Footer />
    </div>
  )
}