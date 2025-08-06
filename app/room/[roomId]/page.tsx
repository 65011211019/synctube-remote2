"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  Pause,
  SkipForward,
  Plus,
  Trash2,
  Users,
  Clock,
  Search,
  ThumbsDown,
  Crown,
  Music,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  Share2,
  Copy,
  QrCode,
  Check,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { getUserId } from "@/lib/user"
import { searchYouTube, type YouTubeVideo, getRandomYouTubeVideo } from "@/lib/youtube"
import { toast } from "@/hooks/use-toast"
import { generateQRCode } from "@/lib/qr"

interface Room {
  room_id: string
  room_name: string
  host_user_id: string
  current_video: string | null
  current_order: number
  is_playing: boolean
  current_position: number
  override_video_id: string | null
  expires_at: string
}

interface QueueItem {
  queue_id: string
  youtube_id: string
  title: string
  thumbnail: string
  duration: string
  added_by: string
  order_index: number
}

interface Vote {
  vote_id: string
  youtube_id: string
  voted_by: string
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const userId = getUserId()
  const supabase = createClient()

  // State
  const [room, setRoom] = useState<Room | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<(YouTubeVideo & { fromPlaylist?: boolean; playlistTitle?: string })[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [playlistMode, setPlaylistMode] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareQrCode, setShareQrCode] = useState("")
  const [generatingQr, setGeneratingQr] = useState(false)
  const [currentVideo, setCurrentVideo] = useState<QueueItem | null>(null)
  const [expired, setExpired] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);

  // Extend session dialog
  const [showExtend, setShowExtend] = useState(false)
  const [extendCode, setExtendCode] = useState("")
  const [extending, setExtending] = useState(false)

  // YouTube Player
  const playerRef = useRef<any>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [initAttempts, setInitAttempts] = useState(0)
  const [lastVideoId, setLastVideoId] = useState<string | null>(null)

  // Refs for latest state to avoid stale closures
  const roomRef = useRef<Room | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const isHostRef = useRef(false) // Also track isHost in ref

  // Heartbeat
  const heartbeatRef = useRef<NodeJS.Timeout>()
  const subscriptionRef = useRef<any>(null)

  // Update refs whenever state changes
  useEffect(() => {
    roomRef.current = room
  }, [room])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

  useEffect(() => {
    if (!userId) {
      router.push("/")
      return
    }

    loadRoomData()
    startHeartbeat()
    setupRealtimeSubscriptions()

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [roomId, userId])

  // Initialize player when room data is loaded and container exists
  useEffect(() => {
    if (!room || playerReady || playerError) return

    const containerExists = typeof window !== "undefined" && document.getElementById("youtube-player")
    if (containerExists) {
      initializeYouTubePlayer()
    }
  }, [room, playerReady, playerError, initAttempts])

  // Handle room updates and sync player
  useEffect(() => {
    if (!room || !playerReady) return

    const videoToPlay = room.override_video_id || room.current_video
    console.log("Room updated - Video to play:", videoToPlay, "Last video:", lastVideoId)

    // Only update if video changed
    if (videoToPlay && videoToPlay !== lastVideoId) {
      console.log("Loading new video:", videoToPlay)
      setLastVideoId(videoToPlay)
      loadVideoInPlayer(videoToPlay, room.current_position || 0, room.is_playing)
    } else if (videoToPlay === lastVideoId && playerRef.current) {
      // Same video, just sync play/pause state
      console.log("Syncing play state:", room.is_playing)
      if (room.is_playing) {
        playerRef.current.playVideo()
      } else {
        playerRef.current.pauseVideo()
      }
    }

    // Update current video display
    const current = queue.find((item) => item.order_index === room.current_order)
    setCurrentVideo(current || null)
  }, [room, playerReady, queue])

  // Host-only: auto skip when votes > half of active users
  useEffect(() => {
    // must be host, have room, and a current video
    if (!isHost || !room || !currentVideo) return

    // votes for the current video
    const votesForCurrent = votes.filter(v => v.youtube_id === currentVideo.youtube_id)
    const threshold = Math.ceil(userCount / 2)

    if (threshold > 0 && votesForCurrent.length >= threshold) {
      console.log(`Skip vote reached: ${votesForCurrent.length}/${threshold}. Skipping...`)
      ;(async () => {
        try {
          // clear votes for this video in this room to avoid re-trigger loops
          await supabase.from("votes")
            .delete()
            .eq("room_id", roomId)
            .eq("youtube_id", currentVideo.youtube_id)

          // skip to next song
          await playNextSong()
          toast({
            title: "Skipped by Vote",
            description: `Reached ${votesForCurrent.length}/${threshold} votes`,
          })
        } catch (e) {
          console.error("Auto-skip by vote error:", e)
        }
      })()
    }
  }, [isHost, room, currentVideo, votes, userCount])

  // Auto-fill queue if empty or no new song for 2+ minutes (host only)
  useEffect(() => {
    if (!isHost || !roomId || expired || !autoFillEnabled) return;
    const interval = setInterval(async () => {
      if (!isHostRef.current || expired || !autoFillEnabled) return;
      const q = queueRef.current;
      const currentRoom = roomRef.current;
      
      // จำกัด queue auto-fill สูงสุด 5 เพลง
      if (q.length >= 5) return;
      
      let shouldAdd = false;
      if (q.length === 0) {
        shouldAdd = true;
      } else {
        // เช็คเพลงล่าสุดในคิว
        const lastSong = q[q.length - 1];
        // ถ้าไม่มี created_at ให้ข้าม
        if (!('created_at' in lastSong)) return;
        const lastAdded = new Date((lastSong as any).created_at).getTime();
        // เพิ่มเวลาเป็น 3 นาที เพื่อลดการเพิ่มเพลงบ่อยเกินไป
        if (Date.now() - lastAdded > 3 * 60 * 1000) {
          shouldAdd = true;
        }
      }
      
      if (shouldAdd) {
        // ห้ามซ้ำเพลงเดิมในคิวและเพลงที่กำลังเล่นอยู่
        const existingIds = new Set(q.map(item => item.youtube_id));
        if (currentRoom?.current_video) {
          existingIds.add(currentRoom.current_video);
        }
        if (currentRoom?.override_video_id) {
          existingIds.add(currentRoom.override_video_id);
        }
        
        let randomVideo = null;
        let tries = 0;
        // เพิ่มจำนวนการพยายามเป็น 10 ครั้ง
        while (tries < 10) {
          const candidate = await getRandomYouTubeVideo();
          if (candidate && !existingIds.has(candidate.id)) {
            randomVideo = candidate;
            break;
          }
          tries++;
        }
        
        if (randomVideo) {
          console.log(`Auto-adding song: ${randomVideo.title} (ID: ${randomVideo.id})`);
          await supabase.from("queue").insert({
            room_id: roomId,
            youtube_id: randomVideo.id,
            title: randomVideo.title,
            thumbnail: randomVideo.thumbnail,
            duration: randomVideo.duration,
            added_by: "auto",
            order_index: q.length,
          });
        } else {
          console.log("Failed to find unique random video after 10 attempts");
        }
      }
    }, 30000); // เพิ่มเวลาเป็น 30 วินาที
    return () => clearInterval(interval);
  }, [isHost, roomId, expired, autoFillEnabled]);

  const loadRoomData = async () => {
    try {
      // Load room
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_id", roomId)
        .eq("active", 1)
        .single()

      if (roomError) {
        console.error("Room loading error:", roomError)

        if (roomError.message.includes("does not exist")) {
          toast({
            title: "Database Setup Required",
            description: "Database tables not found. Please run the setup script.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        if (roomError.code === "PGRST116") {
          toast({
            title: "Room Not Found",
            description: "This room doesn't exist or has expired",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        throw roomError
      }

      if (!roomData) {
        toast({
          title: "Error",
          description: "Room not found or has expired",
        })
        router.push("/")
        return
      }

      // เช็คหมดอายุ
      if (new Date(String(roomData.expires_at)) < new Date()) {
        setExpired(true);
        // ไม่ return เพื่อให้กดต่ออายุได้บนจอ expired
      } else {
        setExpired(false);
      }

      setRoom(roomData as unknown as Room)
      setIsHost((roomData as unknown as Room).host_user_id === userId)

      // Load queue
      const { data: queueData, error: queueError } = await supabase
        .from("queue")
        .select("*")
        .eq("room_id", roomId)
        .order("order_index", { ascending: true })

      if (queueError) {
        console.warn("Queue loading error:", queueError)
      } else if (queueData) {
        setQueue(queueData as unknown as QueueItem[])
        // ถ้ามีเพลงในคิว, ยังไม่มี current_video, และ user เป็น host ให้เล่นเพลงแรกเลย
        if (
          (queueData as unknown as QueueItem[]).length > 0 &&
          !(roomData as unknown as Room).current_video &&
          (roomData as unknown as Room).host_user_id === userId
        ) {
          const first = (queueData as unknown as QueueItem[])[0];
          await updateRoomState({
            current_video: first.youtube_id,
            current_order: first.order_index,
            is_playing: true,
            current_position: 0,
          });
        }
      }

      // Load votes
      const { data: votesData, error: votesError } = await supabase.from("votes").select("*").eq("room_id", roomId)

      if (votesError) {
        console.warn("Votes loading error:", votesError)
      } else if (votesData) {
        setVotes(votesData as unknown as Vote[])
      }

      // Load user count
      const { count, error: countError } = await supabase
        .from("room_presence")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gte("last_seen", new Date(Date.now() - 30000).toISOString())

      if (countError) {
        console.warn("User count loading error:", countError)
      } else {
        setUserCount(count || 0)
      }
    } catch (error) {
      console.error("Error loading room data:", error)
      toast({
        title: "Error",
        description: "Failed to load room data. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const startHeartbeat = () => {
    // Send initial heartbeat
    sendHeartbeat()

    // Send heartbeat every 15 seconds
    heartbeatRef.current = setInterval(sendHeartbeat, 15000)
  }

  const sendHeartbeat = async () => {
    try {
      await supabase.from("room_presence").upsert({
        room_id: roomId,
        user_id: userId,
        last_seen: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error sending heartbeat:", error)
    }
  }

  const setupRealtimeSubscriptions = () => {
    console.log("Setting up realtime subscriptions...")

    // Unsubscribe from existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
    }

    // Subscribe to room changes
    subscriptionRef.current = supabase
      .channel(`room_${roomId}_${Date.now()}`) // Unique channel name
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log("Room change received:", payload)
          if (payload.eventType === "UPDATE") {
            const newRoom = payload.new as Room
            setRoom(newRoom)
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue", filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log("Queue change received:", payload)
          loadRoomData()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log("Vote change received:", payload)
          loadRoomData()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_presence", filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log("Presence change received:", payload)
          loadRoomData()
        },
      )
      .subscribe((status) => {
        console.log("Subscription status:", status)
      })
  }

  const loadVideoInPlayer = (videoId: string, startTime = 0, autoplay = false) => {
    if (!playerRef.current) {
      console.warn("Player not ready, cannot load video")
      return
    }

    try {
      console.log(`Loading video ${videoId} at ${startTime}s, autoplay: ${autoplay}`)

      if (typeof playerRef.current.loadVideoById === "function") {
        // YouTube API method
        playerRef.current.loadVideoById(videoId, startTime)
        setTimeout(() => {
          if (autoplay) {
            playerRef.current.playVideo()
          } else {
            playerRef.current.pauseVideo()
          }
        }, 1000)
      } else {
        // Iframe method - reload the iframe
        const container = document.getElementById("youtube-player")
        if (container) {
          const autoplayParam = autoplay ? 1 : 0
          container.innerHTML = `
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${autoplayParam}&controls=1&modestbranding=1&rel=0&start=${Math.floor(startTime)}&origin=${encodeURIComponent(window.location.origin)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          `
        }
      }
    } catch (error) {
      console.error("Error loading video:", error)
      toast({
        title: "Video Error",
        description: "Failed to load video",
        variant: "destructive",
      })
    }
  }

  const initializeYouTubePlayer = () => {
    console.log("Starting YouTube player initialization...")
    setPlayerError(null)

    const container = document.getElementById("youtube-player")
    if (!container) {
      console.warn("YouTube player container not found – retrying shortly")
      setTimeout(() => setInitAttempts((a) => a + 1), 500)
      return
    }

    // Clear any existing content
    container.innerHTML = ""

    // Try YouTube API first
    loadYouTubeAPI()
  }

  const loadYouTubeAPI = () => {
    if (typeof window === "undefined") return

    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      console.log("YouTube API already loaded, creating player...")
      createYouTubePlayer()
      return
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
    if (existingScript) {
      console.log("YouTube API script already exists, waiting...")
      const checkAPI = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkAPI)
          createYouTubePlayer()
        }
      }, 500)

      setTimeout(() => {
        clearInterval(checkAPI)
        if (!window.YT || !window.YT.Player) {
          console.error("YouTube API failed to load, falling back to iframe")
          createIframePlayer()
        }
      }, 10000)
      return
    }

    console.log("Loading YouTube API script...")
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onload = () => console.log("YouTube API script loaded")
    script.onerror = () => {
      console.error("Failed to load YouTube API script, falling back to iframe")
      createIframePlayer()
    }
    document.head.appendChild(script)

    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API ready callback triggered")
      createYouTubePlayer()
    }

    // Fallback timeout
    setTimeout(() => {
      if (!window.YT || !window.YT.Player) {
        console.error("YouTube API timeout, falling back to iframe")
        createIframePlayer()
      }
    }, 15000)
  }

  const createYouTubePlayer = () => {
    if (!window.YT || !window.YT.Player) {
      console.error("YouTube API not available")
      createIframePlayer()
      return
    }

    if (playerRef.current) {
      console.log("Player already exists, destroying first...")
      try {
        playerRef.current.destroy()
      } catch (e) {
        console.warn("Error destroying existing player:", e)
      }
      playerRef.current = null
    }

    const videoId = roomRef.current?.override_video_id || roomRef.current?.current_video || "dQw4w9WgXcQ"
    console.log("Creating YouTube player with video:", videoId)

    try {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            console.log("YouTube player ready (API method)")
            setPlayerReady(true)
            setPlayerError(null)
            setLastVideoId(videoId)

            // Set initial state
            if (roomRef.current?.current_position) {
              event.target.seekTo(roomRef.current.current_position, true)
            }

            if (roomRef.current?.is_playing) {
              setTimeout(() => event.target.playVideo(), 500)
            }
          },
          onStateChange: (event: any) => {
            handlePlayerStateChange(event)
          },
          onError: (event: any) => {
            console.error("YouTube player error:", event.data)
            setPlayerError(`Video error: ${event.data}`)
            toast({
              title: "Video Error",
              description: "Failed to load video. Trying next song...",
              variant: "destructive",
            })

            if (isHostRef.current) {
              setTimeout(() => {
                playNextSong()
              }, 2000)
            }
          },
        },
      })
    } catch (error) {
      console.error("Error creating YouTube player:", error)
      createIframePlayer()
    }
  }

  const createIframePlayer = () => {
    console.log("Creating iframe player as fallback...")
    const container = document.getElementById("youtube-player")
    if (!container) return

    const videoId = roomRef.current?.override_video_id || roomRef.current?.current_video || "dQw4w9WgXcQ"
    const autoplay = roomRef.current?.is_playing ? 1 : 0
    const startTime = Math.floor(roomRef.current?.current_position || 0)

    container.innerHTML = `
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${autoplay}&controls=1&modestbranding=1&rel=0&start=${startTime}&origin=${encodeURIComponent(window.location.origin)}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    `

    setPlayerReady(true)
    setPlayerError(null)
    setLastVideoId(videoId)

    // Create a mock player object for iframe
    playerRef.current = {
      loadVideoById: (id: string, startTime = 0) => {
        loadVideoInPlayer(id, startTime, roomRef.current?.is_playing || false)
      },
      playVideo: () => {
        // For iframe, we need to reload with autoplay
        if (roomRef.current?.current_video || roomRef.current?.override_video_id) {
          loadVideoInPlayer(
            roomRef.current.override_video_id || roomRef.current.current_video!,
            roomRef.current.current_position || 0,
            true,
          )
        }
      },
      pauseVideo: () => {
        // For iframe, we need to reload without autoplay
        if (roomRef.current?.current_video || roomRef.current?.override_video_id) {
          loadVideoInPlayer(
            roomRef.current.override_video_id || roomRef.current.current_video!,
            roomRef.current.current_position || 0,
            false,
          )
        }
      },
      getCurrentTime: () => roomRef.current?.current_position || 0,
      seekTo: (time: number) => {
        if (roomRef.current?.current_video || roomRef.current?.override_video_id) {
          loadVideoInPlayer(
            roomRef.current.override_video_id || roomRef.current.current_video!,
            time,
            roomRef.current?.is_playing || false,
          )
        }
      },
    }
  }

  const retryPlayerInit = () => {
    console.log("Retrying player initialization...")
    setInitAttempts((prev) => prev + 1)
    setPlayerReady(false)
    setPlayerError(null)
    setLastVideoId(null)

    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy()
        }
      } catch (e) {
        console.warn("Error destroying player:", e)
      }
      playerRef.current = null
    }

    const container = document.getElementById("youtube-player")
    if (container) {
      container.innerHTML = ""
    }

    setTimeout(() => {
      initializeYouTubePlayer()
    }, 1000)
  }

  const getCurrentTimeSafe = () => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
      try {
        return playerRef.current.getCurrentTime()
      } catch (error) {
        console.warn("Error getting current time:", error)
        return roomRef.current?.current_position || 0
      }
    }
    return roomRef.current?.current_position || 0
  }

  const handlePlayerStateChange = useCallback(async (event: any) => {
    const currentRoom = roomRef.current
    if (!isHostRef.current || !currentRoom) return

    const state = event.data
    const currentPosition = getCurrentTimeSafe()

    console.log("🎮 Player state change:", state, "Position:", currentPosition)

    if (state === window.YT.PlayerState.ENDED) {
      console.log("🏁 Song ended - triggering playNextSong")
      setTimeout(() => {
        playNextSong()
      }, 1000)
    } else if (state === window.YT.PlayerState.PLAYING) {
      await updateRoomState({ is_playing: true, current_position: currentPosition })
    } else if (state === window.YT.PlayerState.PAUSED) {
      await updateRoomState({ is_playing: false, current_position: currentPosition })
    }
  }, [])

  const updateRoomState = async (updates: Partial<Room>) => {
    try {
      console.log("Updating room state:", updates)
      const { error } = await supabase.from("rooms").update(updates).eq("room_id", roomId)
      if (error) throw error
    } catch (error) {
      console.error("Error updating room state:", error)
    }
  }

  const playNextSong = useCallback(async () => {
    const currentRoom = roomRef.current
    const currentQueue = queueRef.current

    if (!currentRoom || !isHostRef.current) return

    console.log("🎵 Playing next song...")
    console.log("📊 Current queue length:", currentQueue.length)
    console.log("🎯 Current order:", currentRoom.current_order)

    let songJustRemovedId: string | null = null

    try {
      // First, get the current playing song
      const currentSong = currentQueue.find((item) => item.order_index === currentRoom.current_order)
      console.log("🎵 Current song to remove:", currentSong?.title || "None")

      // Store the ID of the song that is about to be removed
      if (currentSong) {
        songJustRemovedId = currentSong.youtube_id
        console.log("🆔 ID of song to be removed:", songJustRemovedId)
      }

      // Remove the current song if it exists
      if (currentSong) {
        console.log("🗑️ Removing song with queue_id:", currentSong.queue_id)
        const { error: deleteError } = await supabase.from("queue").delete().eq("queue_id", currentSong.queue_id)

        if (deleteError) {
          console.error("❌ Error deleting song:", deleteError)
          throw deleteError
        }

        console.log("✅ Song removed successfully")

        // Wait for deletion to propagate
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Reload fresh queue data
      console.log("🔄 Reloading fresh queue data...")
      const { data: freshQueue, error: queueError } = await supabase
        .from("queue")
        .select("*")
        .eq("room_id", roomId)
        .order("order_index", { ascending: true })

      if (queueError) {
        console.error("❌ Error loading fresh queue:", queueError)
        throw queueError
      }

      console.log("📊 Fresh queue length:", freshQueue?.length || 0)
      console.log(
        "📋 Fresh queue items:",
        freshQueue?.map((q) => ({ title: q.title, order: q.order_index, id: q.youtube_id })) || [],
      )

      const updates: Partial<Room> = {}

      // Clear override if exists
      if (currentRoom.override_video_id) {
        updates.override_video_id = null
        console.log("🔄 Clearing override video")
      }

      // Find next song from fresh queue data
      if (freshQueue && freshQueue.length > 0) {
        // Sort by order_index and get the first one
        const sortedQueue = (freshQueue as unknown as QueueItem[]).sort((a, b) => a.order_index - b.order_index)
        let nextSong: QueueItem | undefined = undefined;
        if (sortedQueue[0] && typeof sortedQueue[0] === 'object' && 'youtube_id' in sortedQueue[0] && 'order_index' in sortedQueue[0]) {
          nextSong = sortedQueue[0] as QueueItem;
        }

        console.log("🔍 All songs in fresh queue:")
        freshQueue.forEach((song, index) => {
          console.log(`  ${index + 1}. "${song.title}" (ID: ${song.youtube_id}, Order: ${song.order_index})`)
        })

        // Validate that we're not playing the same video as the one that *just finished*
        if (songJustRemovedId && nextSong?.youtube_id === songJustRemovedId) {
          console.log("⚠️ WARNING: Next song has same video ID as the song that just finished!")
          console.log("Video that just finished ID:", songJustRemovedId)
          console.log("Next song video ID:", nextSong.youtube_id)

          // Try to find a different song
          const differentSong = (freshQueue as unknown as QueueItem[]).find(
            (song) =>
              typeof song === "object" &&
              song !== null &&
              "youtube_id" in song &&
              (song as QueueItem).youtube_id !== songJustRemovedId
          );
          if (differentSong) {
            console.log("🔄 Found different song:", (differentSong as QueueItem).title);
            nextSong = differentSong as QueueItem;
          } else {
            console.log(
              "❌ All remaining songs have the same video ID as the one that just finished - queue might be stuck.",
            )
            // If all remaining songs are the same, stop playback to prevent infinite loop
            updates.current_video = null
            updates.is_playing = false
            updates.current_position = 0
            updates.current_order = 0
            toast({
              title: "Queue Stuck",
              description: "All remaining songs are duplicates of the last played. Clearing playback.",
              variant: "destructive",
            })
            setPlayerReady(false);
            setPlayerError("Queue is stuck on the same song.");
            await updateRoomState(updates)
            return // Exit early
          }
        }

        console.log("🎵 Next song found:", nextSong?.title || "None")
        console.log("🎯 Next song order:", nextSong?.order_index || 0)
        console.log("🆔 Next song video ID:", nextSong?.youtube_id || "None")

        if (nextSong) {
          updates.current_video = nextSong.youtube_id
          updates.current_order = nextSong.order_index
          updates.current_position = 0; // เริ่มต้นที่วินาทีแรกเสมอ
        }
      } else {
        // No songs left in queue
        console.log("📭 No more songs in queue")
        updates.current_video = null
        updates.is_playing = false
        updates.current_position = 0
        updates.current_order = 0
      }

      console.log("🔄 Updating room state:", updates)
      await updateRoomState(updates)
      console.log("✅ Room state updated successfully")
    } catch (error) {
      console.error("❌ Error in playNextSong:", error)
      toast({
        title: "Playback Error",
        description: "Failed to play next song",
        variant: "destructive",
      })
    }
  }, [roomId, supabase])

  const togglePlayPause = async () => {
    if (!playerReady) {
      toast({
        title: "Player Not Ready",
        description: "Please wait for the player to load",
        variant: "destructive",
      })
      return
    }

    const currentPosition = getCurrentTimeSafe()
    const currentRoom = roomRef.current

    try {
      if (currentRoom?.is_playing) {
        if (playerRef.current?.pauseVideo) {
          playerRef.current.pauseVideo()
        }
        await updateRoomState({ is_playing: false, current_position: currentPosition })
      } else {
        if (playerRef.current?.playVideo) {
          playerRef.current.playVideo()
        }
        await updateRoomState({ is_playing: true, current_position: currentPosition })
      }
    } catch (error) {
      console.error("Error toggling play/pause:", error)
      toast({
        title: "Playback Error",
        description: "Failed to control playback",
        variant: "destructive",
      })
    }
  }

  const skipSong = async () => {
    if (!isHost) return
    console.log("Skip button clicked")
    await playNextSong()
  }

  const playOverride = async (videoId: string) => {
    if (!isHost) return

    console.log("Playing override video:", videoId)

    // ตั้งค่า override video และเล่นเพลง
    await updateRoomState({
      override_video_id: videoId,
      is_playing: true,
      current_position: 0,
    })
  }

  const searchVideos = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      // Check if query is a YouTube playlist URL
      const isPlaylistUrl = /(?:youtube\.com\/playlist\?list=|youtu\.be\/|youtube\.com\/watch\?v=)[^&]*&list=|youtube\.com\/playlist\?list=([^&&]+)/.test(searchQuery) ||
                          searchQuery.startsWith("PL") && searchQuery.length === 34
      
      const type = isPlaylistUrl ? "playlist" : "search"
      const results = await searchYouTube(searchQuery, type)
      setSearchResults(results)
      
      if (isPlaylistUrl && results.length > 0) {
        toast({
          title: "Playlist Loaded",
          description: `Added ${results.length} songs from playlist`,
        })
      }
    } catch (error) {
      console.error("Error searching videos:", error)
      toast({
        title: "Error",
        description: "Failed to search videos",
        variant: "destructive",
      })
    } finally {
      setSearching(false)
    }
  }

  const [addedSongs, setAddedSongs] = useState<Set<string>>(new Set())

  const addToQueue = async (video: YouTubeVideo) => {
    try {
      const maxOrder = queue.length > 0 ? Math.max(...queue.map((q) => q.order_index)) : -1

      await supabase.from("queue").insert({
        room_id: roomId,
        youtube_id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        added_by: userId,
        order_index: maxOrder + 1,
      })

      // Mark as added temporarily
      setAddedSongs(prev => new Set(prev).add(video.id))

      // Show success toast
      toast({
        title: "Success",
        description: "Song added to queue",
      })

      // Remove the added state after 2 seconds
      setTimeout(() => {
        setAddedSongs(prev => {
          const newSet = new Set(prev)
          newSet.delete(video.id)
          return newSet
        })
      }, 2000)

      // ไม่ปิด dialog และไม่ล้างคำค้นหา ให้ผู้ใช้สามารถเพิ่มเพลงเพิ่มเติมได้ทันที
      // ไม่ต้อง setSearchQuery("") และ setSearchResults([])

      // If this is the first song and no video is playing, start playing it
      if (queue.length === 0 && !room?.current_video && isHost) {
        setTimeout(async () => {
          await updateRoomState({
            current_video: video.id,
            current_order: maxOrder + 1,
            is_playing: true,
            current_position: 0,
          })
        }, 1000)
      }
    } catch (error) {
      console.error("Error adding to queue:", error)
      toast({
        title: "Error",
        description: "Failed to add song to queue",
        variant: "destructive",
      })
    }
  }

  const removeFromQueue = async (queueId: string, addedBy: string) => {
    if (addedBy !== userId && !isHost) {
      toast({
        title: "Error",
        description: "You can only remove songs you added",
        variant: "destructive",
      })
      return
    }

    try {
      await supabase.from("queue").delete().eq("queue_id", queueId)

      toast({
        title: "Success",
        description: "Song removed from queue",
      })
    } catch (error) {
      console.error("Error removing from queue:", error)
      toast({
        title: "Error",
        description: "Failed to remove song from queue",
        variant: "destructive",
      })
    }
  }

  const voteSkip = async (videoId: string) => {
    try {
      await supabase.from("votes").insert({
        room_id: roomId,
        youtube_id: videoId,
        voted_by: userId,
      })

      toast({
        title: "Vote Recorded",
        description: "Your skip vote has been recorded",
      })
    } catch (error) {
      console.error("Error voting to skip:", error)
      toast({
        title: "Error",
        description: "Failed to record vote",
        variant: "destructive",
      })
    }
  }

  const extendRoom = async (code?: string) => {
    try {
      setExtending(true)
      const res = await fetch("/api/room/extend-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, code: (code ?? (extendCode || null)) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "Extend Failed",
          description: data?.hint || data?.error || "ต่อเวลาไม่สำเร็จ",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Extended",
        description: "ขยายเวลาเพิ่มอีก 2 ชั่วโมงแล้ว",
      })
      setExtendCode("")
      setShowExtend(false)
      // Reload room data to reflect new expiry
      await loadRoomData()
    } catch (e) {
      console.error("extendRoom error:", e)
      toast({
        title: "Error",
        description: "ไม่สามารถต่อเวลาได้",
        variant: "destructive",
      })
    } finally {
      setExtending(false)
    }
  }

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }

  const generateShareQR = async () => {
    setGeneratingQr(true)
    try {
      const roomUrl = `${window.location.origin}/room/${roomId}`
      const qrCode = await generateQRCode(roomUrl)
      setShareQrCode(qrCode)
    } catch (error) {
      console.error("Error generating QR code:", error)
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      })
    } finally {
      setGeneratingQr(false)
    }
  }

  const copyRoomLink = () => {
    const roomUrl = `${window.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(roomUrl)
    toast({
      title: "Copied!",
      description: "Room link copied to clipboard",
    })
  }

  const openShareDialog = () => {
    setShowShare(true)
    if (!shareQrCode) {
      generateShareQR()
    }
  }

  const moveQueueItem = async (queueId: string, direction: "up" | "down") => {
    if (!isHost) return

    try {
      const currentItem = queue.find((item) => item.queue_id === queueId)
      if (!currentItem) return

      const sortedQueue = [...queue].sort((a, b) => a.order_index - b.order_index)
      const currentIndex = sortedQueue.findIndex((item) => item.queue_id === queueId)

      if (direction === "up" && currentIndex === 0) return // Already at top
      if (direction === "down" && currentIndex === sortedQueue.length - 1) return // Already at bottom

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      const targetItem = sortedQueue[targetIndex]

      // Swap order_index values
      await supabase
        .from("queue")
        .update({
          order_index: targetItem.order_index,
        })
        .eq("queue_id", currentItem.queue_id)

      await supabase
        .from("queue")
        .update({
          order_index: currentItem.order_index,
        })
        .eq("queue_id", targetItem.queue_id)

      toast({
        title: "Success",
        description: `Song moved ${direction}`,
      })
    } catch (error) {
      console.error("Error moving queue item:", error)
      toast({
        title: "Error",
        description: "Failed to move song",
        variant: "destructive",
      })
    }
  }

  const clearQueue = async () => {
    if (!isHost) return

    try {
      await supabase.from("queue").delete().eq("room_id", roomId)

      // Stop current playback
      await updateRoomState({
        current_video: null,
        is_playing: false,
        current_position: 0,
        current_order: 0,
      })

      toast({
        title: "Success",
        description: "Queue cleared",
      })
    } catch (error) {
      console.error("Error clearing queue:", error)
      toast({
        title: "Error",
        description: "Failed to clear queue",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm sm:text-base">Loading room...</p>
        </div>
      </div>
    )
  }

  if (expired && room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow text-center">
          <h2 className="text-xl font-bold mb-2">Room Expired</h2>
          <p className="mb-4 text-sm">ห้องนี้หมดเวลาแล้ว กรุณาต่อเวลาเพื่อใช้งานต่อ</p>

          <div className="space-y-3 text-left">
            <label className="text-xs text-gray-600">กรอกโค้ดเพื่อขยายเวลา (+2 ชั่วโมง)</label>
            <Input
              value={extendCode}
              onChange={(e) => setExtendCode(e.target.value)}
              placeholder='กรอกโค้ด'
            />
            <Button onClick={() => extendRoom()} disabled={extending || !extendCode.trim()} className="w-full">
              {extending ? "Extending..." : "Extend +2 hours"}
            </Button>
            <p className="text-[11px] text-gray-500">
              โปรดกรอกโค้ดเพื่อขยายเวลาใช้งาน หากไม่มีโค้ดให้ติดต่อผู้ดูแลระบบ
            </p>
          </div>

          <div className="mt-6">
            <Button variant="outline" onClick={() => router.push("/")} className="w-full">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-gray-600 font-mono text-sm sm:text-base">Room not found</p>
            <Button onClick={() => router.push("/")} className="mt-4">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Room Header */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-2xl flex items-center gap-2 flex-wrap">
                  <Music className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 shrink-0" />
                  <span className="truncate">{room.room_name}</span>
                  {isHost && <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 shrink-0" />}
                </CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 font-mono mt-1">Room ID: {room.room_id}</p>
                {isHost && (
                  <div className="flex gap-2 mt-2 sm:mt-0 sm:ml-2">
                    <Button
                      onClick={() => setShowExtend(true)}
                      size="sm"
                      variant="default"
                      className="text-xs sm:text-sm"
                    >
                      + Extend 2h
                    </Button>
                    <Button
                      onClick={openShareDialog}
                      size="sm"
                      variant="outline"
                      className="bg-transparent text-xs sm:text-sm"
                    >
                      <Share2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Share Room
                    </Button>
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-card-foreground">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span>{userCount} active users</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Expires in {formatTimeRemaining(room.expires_at)}</span>
                </div>
                {isHost && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs sm:text-sm text-gray-600">Auto-fill:</span>
                    <Button
                      onClick={() => setAutoFillEnabled(!autoFillEnabled)}
                      size="sm"
                      variant={autoFillEnabled ? "default" : "outline"}
                      className="text-xs"
                    >
                      {autoFillEnabled ? "ON" : "OFF"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* YouTube Player */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Now Playing</CardTitle>
                {currentVideo && <p className="text-xs sm:text-sm text-gray-600 truncate">{currentVideo.title}</p>}
                {!playerReady && !playerError && (
                  <p className="text-xs sm:text-sm text-yellow-600">Loading player...</p>
                )}
                {playerError && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="text-xs sm:text-sm text-red-600">{playerError}</p>
                    <Button onClick={retryPlayerInit} size="sm" variant="outline" className="w-fit bg-transparent">
                      <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Retry
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="aspect-video bg-black rounded-lg mb-4 relative">
                  <div id="youtube-player" className="w-full h-full rounded-lg"></div>
                  {!playerReady && !playerError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                      <div className="text-white text-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-sm sm:text-base">Loading YouTube Player...</p>
                        <p className="text-xs opacity-75">Attempt {initAttempts + 1}</p>
                      </div>
                    </div>
                  )}
                  {playerError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-50 rounded-lg">
                      <div className="text-white text-center p-4">
                        <p className="mb-2 text-sm sm:text-base">Player Error</p>
                        <Button onClick={retryPlayerInit} size="sm" variant="outline">
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {isHost && (
                    <>
                      <Button onClick={togglePlayPause} variant="outline" size="sm" disabled={!playerReady}>
                        {room.is_playing ? (
                          <Pause className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                        <span className="ml-1 sm:ml-2 hidden sm:inline">{room.is_playing ? "Pause" : "Play"}</span>
                      </Button>
                      <Button onClick={skipSong} variant="outline" size="sm" disabled={!playerReady}>
                        <SkipForward className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="ml-1 sm:ml-2 hidden sm:inline">Skip</span>
                      </Button>
                      <Button onClick={() => setShowSearch(true)} variant="outline" size="sm">
                        <Search className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Play Now
                      </Button>
                    </>
                  )}

                  {!isHost && currentVideo && (
                    <Button
                      onClick={() => voteSkip(currentVideo.youtube_id)}
                      variant="outline"
                      size="sm"
                      disabled={votes.some((v) => v.youtube_id === currentVideo.youtube_id && v.voted_by === userId)}
                    >
                      <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">
                        Skip Vote ({votes.filter((v) => v.youtube_id === currentVideo.youtube_id).length})
                      </span>
                    </Button>
                  )}
                </div>

                {/* Debug Info */}
                {process.env.NODE_ENV === "development" && (
                  <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
                    <p>Current Video: {room.current_video}</p>
                    <p>Override: {room.override_video_id}</p>
                    <p>Order: {room.current_order}</p>
                    <p>Playing: {room.is_playing ? "Yes" : "No"}</p>
                    <p>Last Video ID: {lastVideoId}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Queue */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">Queue ({queue.length})</CardTitle>
                  <div className="flex gap-1 sm:gap-2">
                    <Button onClick={() => setShowSearch(true)} size="sm">
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Add Song</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                    {isHost && queue.length > 0 && (
                      <Button onClick={clearQueue} size="sm" variant="outline">
                        <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Clear All</span>
                        <span className="sm:hidden">Clear</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-64 sm:h-96">
                  {queue.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Music className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm sm:text-base">No songs in queue</p>
                      <p className="text-xs">Add some music to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {queue.map((item, index) => (
                        <div
                          key={item.queue_id}
                          className={`p-2 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 ${
                            item.order_index === room.current_order
                              ? "bg-purple-50 border-purple-200 dark:border-purple-400 text-card-foreground dark:text-foreground"
                              : "bg-white dark:bg-muted"
                          }`}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <img
                              src={item.thumbnail || "/placeholder.svg"}
                              alt={item.title}
                              className="w-10 h-8 sm:w-12 sm:h-9 object-cover rounded shrink-0"
                            />
                            <div className="flex-1 min-w-0 w-0">
                              {" "}
                              {/* Added w-0 here */}
                              <p className="text-sm sm:text-base font-medium truncate text-card-foreground dark:text-foreground">{item.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.duration}</p>
                              {item.order_index === room.current_order && (
                                <Badge variant="secondary" className="text-xs mt-1 text-card-foreground dark:text-foreground">
                                  Now Playing
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              {isHost && (
                                <>
                                  <div className="flex gap-1">
                                    <Button
                                      onClick={() => moveQueueItem(item.queue_id, "up")}
                                      variant="ghost"
                                      size="sm"
                                      disabled={index === 0}
                                      className="h-6 w-6 p-0"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      onClick={() => moveQueueItem(item.queue_id, "down")}
                                      variant="ghost"
                                      size="sm"
                                      disabled={index === queue.length - 1}
                                      className="h-6 w-6 p-0"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Button
                                    onClick={() => removeFromQueue(item.queue_id, item.added_by)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {!isHost && item.added_by === userId && (
                                <Button
                                  onClick={() => removeFromQueue(item.queue_id, item.added_by)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Dialog */}
        <Dialog open={showSearch} onOpenChange={setShowSearch}>
          <DialogContent className="w-[95vw] max-w-4xl mx-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add Song to Queue</DialogTitle>
              <DialogDescription className="text-sm">Search for YouTube videos to add to the queue</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for songs..."
                  onKeyPress={(e) => e.key === "Enter" && searchVideos()}
                  className="text-sm sm:text-base"
                />
                <Button onClick={searchVideos} disabled={searching} className="shrink-0">
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>

              <ScrollArea className="h-64 sm:h-96">
                <div className="space-y-2">
                  {searchResults.map((video) => (
                    <div key={video.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg">
                      <img
                        src={video.thumbnail || "/placeholder.svg"}
                        alt={video.title}
                        className="w-12 h-9 sm:w-16 sm:h-12 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0 w-0">
                        {" "}
                        {/* Added w-0 here */}
                        <p className="text-xs sm:text-sm font-medium truncate">{video.title}</p>
                        <p className="text-xs text-gray-500">{video.duration}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 shrink-0">
                        <Button 
                          onClick={() => addToQueue(video)} 
                          size="sm" 
                          className="text-xs"
                          disabled={addedSongs.has(video.id)}
                        >
                          {addedSongs.has(video.id) ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Added</span>
                              <span className="sm:hidden">Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Add to Queue</span>
                              <span className="sm:hidden">Add</span>
                            </>
                          )}
                        </Button>
                        {isHost && (
                          <Button
                            onClick={() => {
                              playOverride(video.id)
                              setShowSearch(false)
                            }}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Play Now</span>
                            <span className="sm:hidden">Play</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extend Dialog (host can extend anytime) */}
        <Dialog open={showExtend} onOpenChange={setShowExtend}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Extend Room</DialogTitle>
              <DialogDescription className="text-sm">ขยายเวลาใช้งานห้อง (+2 ชั่วโมง)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">โค้ด (ถ้ามี)</label>
                <Input
                  value={extendCode}
                  onChange={(e) => setExtendCode(e.target.value)}
                  placeholder='กรอกโค้ด'
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  โปรดกรอกโค้ดเพื่อขยายเวลาใช้งาน หากไม่มีโค้ดให้ติดต่อผู้ดูแลระบบ
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => extendRoom()} disabled={extending} className="flex-1">
                  {extending ? "Extending..." : "Extend +2 hours"}
                </Button>
                <Button variant="outline" onClick={() => setShowExtend(false)} className="flex-1">
                  Close
                </Button>
              </div>
              <div className="text-xs text-gray-600">
                Expires in: {formatTimeRemaining(room.expires_at)}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={showShare} onOpenChange={setShowShare}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                Share Room
              </DialogTitle>
              <DialogDescription className="text-sm">Share this room with your friends</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-6">
              {/* Room Info */}
              <div className="text-center">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-4">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Room Name</p>
                  <p className="text-base sm:text-lg font-semibold truncate">{room.room_name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2">Room ID</p>
                  <p className="text-xl sm:text-2xl font-mono font-bold text-purple-600">{room.room_id}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base font-medium">QR Code</span>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border inline-block">
                  {generatingQr ? (
                    <div className="w-32 h-32 sm:w-48 sm:h-48 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-600"></div>
                    </div>
                  ) : shareQrCode ? (
                    <img
                      src={shareQrCode || "/placeholder.svg"}
                      alt="Room QR Code"
                      className="w-32 h-32 sm:w-48 sm:h-48"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-48 sm:h-48 flex items-center justify-center text-gray-400">
                      <QrCode className="h-8 w-8 sm:h-12 sm:w-12" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Scan to join the room</p>
              </div>

              {/* Room Link */}
              <div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base font-medium">Room Link</span>
                </div>
                <div className="flex gap-2">
                  <Input value={`${window.location.origin}/room/${roomId}`} readOnly className="text-xs sm:text-sm" />
                  <Button onClick={copyRoomLink} size="sm" className="shrink-0">
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Share this link with friends to invite them</p>
              </div>

              {/* Room Stats */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Active Users:</span>
                  <span className="font-medium">{userCount}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm mt-1">
                  <span className="text-gray-600">Songs in Queue:</span>
                  <span className="font-medium">{queue.length}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm mt-1">
                  <span className="text-gray-600">Expires in:</span>
                  <span className="font-medium">{formatTimeRemaining(room.expires_at)}</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
