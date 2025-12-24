"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Lock, Music, Radio, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Room {
  room_id: string;
  room_name: string;
  password_hash: string | null;
  expires_at: string;
  active: boolean;
  user_count: number;
  current_video: string | null;
}

interface RawRoomData {
  room_id: string;
  room_name: string;
  password_hash: string | null;
  expires_at: string;
  active: boolean;
  current_video: string | null;
  created_at: string;
  host_user_id: string | null;
}

export default function ActiveRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    loadRooms();
    // Subscribe to room changes
    const subscription = supabase
      .channel("rooms_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => loadRooms())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_presence" }, () => loadRooms())
      .subscribe();
    // Refresh rooms every 30 seconds
    const interval = setInterval(loadRooms, 30000);
    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, []);

  const loadRooms = async () => {
    if (!isSupabaseConfigured) {
      setRooms([]);
      setLoading(false);
      return;
    }
    try {
      const { data: roomsData, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rawRooms: RawRoomData[] = (roomsData || []) as unknown as RawRoomData[];
      const now = new Date();
      const filteredRooms = rawRooms.filter(room => new Date(room.expires_at).getTime() > now.getTime());
      const roomsWithCounts: Room[] = await Promise.all(
        filteredRooms.map(async (room) => {
          const { count } = await supabase
            .from("room_presence")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.room_id)
            .gte("last_seen", new Date(Date.now() - 30000).toISOString());
          return { ...room, user_count: count || 0 } as Room;
        })
      );
      setRooms(roomsWithCounts);
    } catch (err) {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleJoinRoom = (room: Room) => {
    if (room.password_hash) {
      setPasswordDialog({ open: true, room });
      setPasswordInput("");
      setPasswordError("");
    } else {
      router.push(`/room/${room.room_id}`);
    }
  };

  const verifyPassword = async () => {
    if (!passwordDialog.room) return;
    setPasswordLoading(true);
    setPasswordError("");
    try {
      // เรียก API verify password (POST ไปที่ /api/verify-password)
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput, hash: passwordDialog.room.password_hash }),
      });
      const data = await res.json();
      if (data.success || data.valid) {
        setPasswordDialog({ open: false, room: null });
        router.push(`/room/${passwordDialog.room.room_id}`);
      } else {
        setPasswordError("Incorrect password");
      }
    } catch (e) {
      setPasswordError("An error occurred. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Radio className="h-4 w-4" />
            <span>Live Rooms</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight">
            <span className="gradient-text">Active Rooms</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Join a room and listen to YouTube music together in real-time
          </p>
        </div>

        {/* Content */}
        <div className="animate-slide-up">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-lg">Loading rooms...</span>
              </div>
            </div>
          ) : rooms.length === 0 || !isSupabaseConfigured ? (
            <Card className="max-w-md mx-auto border-2 border-dashed">
              <CardContent className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Music className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Rooms</h3>
                <p className="text-muted-foreground mb-6">Create a new room to get started!</p>
                <Button
                  onClick={() => router.push("/")}
                  className="btn-gradient rounded-xl h-11 px-6"
                >
                  Create Room
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {rooms.map((room, index) => (
                <Card
                  key={room.room_id}
                  className="group card-hover border-2 overflow-hidden animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                          {room.room_name}
                        </CardTitle>
                        <CardDescription className="font-mono text-base font-bold text-primary mt-1">
                          {room.room_id}
                        </CardDescription>
                      </div>
                      {room.password_hash && (
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{room.user_count}</span> active users
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="text-muted-foreground">
                          Expires in <span className="font-semibold text-foreground">{formatTimeRemaining(room.expires_at)}</span>
                        </span>
                      </div>

                      {room.current_video && (
                        <div className="status-badge status-badge-live">
                          <Music className="h-3 w-3" />
                          <span>Playing music</span>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full font-semibold rounded-xl h-11 transition-all group-hover:btn-gradient"
                      variant="outline"
                      onClick={() => handleJoinRoom(room)}
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

      {/* Password Dialog */}
      <Dialog open={passwordDialog.open} onOpenChange={open => setPasswordDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-sm mx-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Enter Password</DialogTitle>
            <DialogDescription>
              Room: <span className="font-bold text-foreground">{passwordDialog.room?.room_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder="Enter room password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPassword()}
              disabled={passwordLoading}
              className="h-12 text-center font-medium"
            />
            {passwordError && (
              <p className="text-destructive text-sm text-center font-medium">{passwordError}</p>
            )}
            <Button
              onClick={verifyPassword}
              disabled={passwordLoading || !passwordInput}
              className="w-full h-12 font-semibold btn-gradient rounded-xl"
            >
              {passwordLoading ? "Verifying..." : "Join Room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}