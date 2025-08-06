import { type NextRequest, NextResponse } from "next/server"

// Parse multiple YouTube API keys from environment variable
const YOUTUBE_API_KEYS =
  process.env.YOUTUBE_API_KEYS?.split(",")
    .map((key) => key.trim())
    .filter(Boolean) || []

const YOUTUBE_API_KEYS2 =
  process.env.YOUTUBE_API_KEYS2?.split(",")
    .map((key) => key.trim())
    .filter(Boolean) || []

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const type = searchParams.get("type") || "search" // "search" or "playlist"

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  if (YOUTUBE_API_KEYS.length === 0) {
    return NextResponse.json({ error: "YouTube API keys not configured" }, { status: 500 })
  }

  let lastError: any = null

  // Try each API key in YOUTUBE_API_KEYS
  for (const apiKey of YOUTUBE_API_KEYS) {
    try {
      let response
      let data

      if (type === "playlist") {
        // Handle playlist URL or ID
        const playlistId = extractPlaylistId(query)
        if (!playlistId) {
          return NextResponse.json({ error: "Invalid YouTube playlist URL or ID" }, { status: 400 })
        }

        // Get playlist items
        response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${apiKey}&maxResults=50`,
        )

        if (!response.ok) {
          const errorData = await response.json()
          console.warn(`YouTube playlist API request failed with key ${apiKey}:`, errorData)
          lastError = errorData
          continue // Try next key
        }

        data = await response.json()

        // Get video details for all videos in the playlist
        const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean).join(",")
        
        if (videoIds) {
          const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`,
          )

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json()
            
            // Map playlist items with video details
            const videos = data.items.map((item: any, index: number) => {
              const videoId = item.snippet.resourceId.videoId
              const details = detailsData.items.find((v: any) => v.id === videoId)
              const duration = details ? formatDuration(details.contentDetails.duration) : "Unknown"

              return {
                id: videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "/placeholder.svg",
                duration,
                channelTitle: item.snippet.videoOwnerChannelTitle || "Unknown",
                fromPlaylist: true,
                playlistTitle: item.snippet.playlistTitle || "Unknown Playlist"
              }
            })

            return NextResponse.json({ videos, type: "playlist" })
          }
        }
        
        // Fallback if we can't get video details
        const videos = data.items.map((item: any) => ({
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "/placeholder.svg",
          duration: "Unknown",
          channelTitle: item.snippet.videoOwnerChannelTitle || "Unknown",
          fromPlaylist: true,
          playlistTitle: item.snippet.playlistTitle || "Unknown Playlist"
        }))

        return NextResponse.json({ videos, type: "playlist" })

      } else {
        // Regular search
        response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`,
        )

        if (!response.ok) {
          const errorData = await response.json()
          console.warn(`YouTube API request failed with key ${apiKey}:`, errorData)
          lastError = errorData // Store error to return if all keys fail
          continue // Try next key
        }

        data = await response.json()

        // Get video details including duration
        const videoIds = data.items.map((item: any) => item.id.videoId).join(",")
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`,
        )

        if (!detailsResponse.ok) {
          const detailsErrorData = await detailsResponse.json()
          console.warn(`YouTube video details API request failed with key ${apiKey}:`, detailsErrorData)
          lastError = detailsErrorData
          continue // Try next key
        }

        const detailsData = await detailsResponse.json()

        const videos = data.items.map((item: any, index: number) => {
          const details = detailsData.items[index]
          const duration = details ? formatDuration(details.contentDetails.duration) : "Unknown"

          return {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            duration,
            channelTitle: item.snippet.channelTitle,
          }
        })

        return NextResponse.json({ videos, type: "search" }) // Success, return results
      }
    } catch (error) {
      console.error(`Error with YouTube API key ${apiKey}:`, error)
      lastError = error // Store error to return if all keys fail
    }
  }

  // If all keys in YOUTUBE_API_KEYS failed, try YOUTUBE_API_KEYS2
  for (const apiKey of YOUTUBE_API_KEYS2) {
    try {
      let response
      let data

      if (type === "playlist") {
        const playlistId = extractPlaylistId(query)
        if (!playlistId) {
          return NextResponse.json({ error: "Invalid YouTube playlist URL or ID" }, { status: 400 })
        }

        response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${apiKey}&maxResults=50`,
        )
        
        if (!response.ok) {
          const errorData = await response.json()
          console.warn(`YouTube playlist API request failed with key2 ${apiKey}:`, errorData)
          lastError = errorData
          continue
        }

        data = await response.json()

        const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean).join(",")
        
        if (videoIds) {
          const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`,
          )

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json()
            
            const videos = data.items.map((item: any, index: number) => {
              const videoId = item.snippet.resourceId.videoId
              const details = detailsData.items.find((v: any) => v.id === videoId)
              const duration = details ? formatDuration(details.contentDetails.duration) : "Unknown"

              return {
                id: videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "/placeholder.svg",
                duration,
                channelTitle: item.snippet.videoOwnerChannelTitle || "Unknown",
                fromPlaylist: true,
                playlistTitle: item.snippet.playlistTitle || "Unknown Playlist"
              }
            })

            return NextResponse.json({ videos, type: "playlist" })
          }
        }
        
        const videos = data.items.map((item: any) => ({
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "/placeholder.svg",
          duration: "Unknown",
          channelTitle: item.snippet.videoOwnerChannelTitle || "Unknown",
          fromPlaylist: true,
          playlistTitle: item.snippet.playlistTitle || "Unknown Playlist"
        }))

        return NextResponse.json({ videos, type: "playlist" })

      } else {
        response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`,
        )
        
        if (!response.ok) {
          const errorData = await response.json()
          console.warn(`YouTube API request failed with key2 ${apiKey}:`, errorData)
          lastError = errorData
          continue
        }
        
        data = await response.json()
        
        const videoIds = data.items.map((item: any) => item.id.videoId).join(",")
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`,
        )
        
        if (!detailsResponse.ok) {
          const detailsErrorData = await detailsResponse.json()
          console.warn(`YouTube video details API request failed with key2 ${apiKey}:`, detailsErrorData)
          lastError = detailsErrorData
          continue
        }
        
        const detailsData = await detailsResponse.json()
        const videos = data.items.map((item: any, index: number) => {
          const details = detailsData.items[index]
          const duration = details ? formatDuration(details.contentDetails.duration) : "Unknown"
          return {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            duration,
            channelTitle: item.snippet.channelTitle,
          }
        })
        
        return NextResponse.json({ videos, type: "search" })
      }
    } catch (error) {
      console.error(`Error with YouTube API key2 ${apiKey}:`, error)
      lastError = error
    }
  }

  // If loop finishes, all keys failed
  return NextResponse.json({ error: "All YouTube API keys failed or exhausted", details: lastError }, { status: 500 })
}

function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
  if (!match) return "Unknown"

  const hours = match[1] ? Number.parseInt(match[1].slice(0, -1)) : 0
  const minutes = match[2] ? Number.parseInt(match[2].slice(0, -1)) : 0
  const seconds = match[3] ? Number.parseInt(match[3].slice(0, -1)) : 0

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function extractPlaylistId(input: string): string | null {
  // Handle different URL formats
  const patterns = [
    /(?:youtube\.com\/playlist\?list=|youtu\.be\/|youtube\.com\/watch\?v=)[^&]*&list=|youtube\.com\/playlist\?list=([^&]+)/,
    /list=([^&]+)/
  ]
  
  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  // Check if input is already a playlist ID (PL format)
  if (input.startsWith("PL") && input.length === 34) {
    return input
  }
  
  return null
}
