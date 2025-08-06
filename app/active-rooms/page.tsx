"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Lock, Music } from "lucide-react";
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
        .eq("active", 1)
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
        setPasswordError("รหัสผ่านไม่ถูกต้อง");
      }
    } catch (e) {
      setPasswordError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 px-2">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2 flex-wrap">
            <Users className="h-7 w-7 text-purple-600" />
            <span>Active Rooms</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            Join a room and listen to YouTube music together in real-time.
          </p>
        </div>
        <div className="px-2">
          {loading ? (
            <div className="text-center py-8">
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
      <Dialog open={passwordDialog.open} onOpenChange={open => setPasswordDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>ใส่รหัสผ่านเพื่อเข้าห้อง</DialogTitle>
            <DialogDescription>
              ห้อง <span className="font-bold">{passwordDialog.room?.room_name}</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="รหัสผ่าน"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && verifyPassword()}
            disabled={passwordLoading}
            className="mb-2"
          />
          {passwordError && <p className="text-red-600 text-xs mb-2">{passwordError}</p>}
          <Button onClick={verifyPassword} disabled={passwordLoading} className="w-full">
            เข้าห้อง
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
} 