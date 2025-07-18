export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
}

export async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  try {
    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) throw new Error("Search failed")

    const data = await response.json()
    return data.videos || []
  } catch (error) {
    console.error("YouTube search error:", error)
    return []
  }
}
