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
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`,
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.warn(`YouTube API request failed with key ${apiKey}:`, errorData)
        lastError = errorData // Store error to return if all keys fail
        continue // Try next key
      }

      const data = await response.json()

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

      return NextResponse.json({ videos }) // Success, return results
    } catch (error) {
      console.error(`Error with YouTube API key ${apiKey}:`, error)
      lastError = error // Store error to return if all keys fail
    }
  }

  // If all keys in YOUTUBE_API_KEYS failed, try YOUTUBE_API_KEYS2
  for (const apiKey of YOUTUBE_API_KEYS2) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`,
      )
      if (!response.ok) {
        const errorData = await response.json()
        console.warn(`YouTube API request failed with key2 ${apiKey}:`, errorData)
        lastError = errorData
        continue
      }
      const data = await response.json()
      // Get video details including duration
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
      return NextResponse.json({ videos })
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
