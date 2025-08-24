export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
}

export async function searchYouTube(query: string, type: "search" | "playlist" = "search"): Promise<YouTubeVideo[]> {
  try {
    const params = new URLSearchParams({ q: query })
    if (type === "playlist") {
      params.append("type", "playlist")
    }
    
    const response = await fetch(`/api/youtube/search?${params.toString()}`)
    if (!response.ok) throw new Error("Search failed")

    const data = await response.json()
    return data.videos || []
  } catch (error) {
    console.error("YouTube search error:", error)
    return []
  }
}

function parseDurationToSeconds(duration: string): number {
  // รองรับรูปแบบเช่น 1:23:45, 12:34, 5:00
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

export async function getRandomYouTubeVideo(): Promise<YouTubeVideo | null> {
  const keywords = [
    // เพลงไทย
    "เพลงฮิต", "เพลงใหม่", "เพลงลูกทุ่ง", "เพลงเพื่อชีวิต", "เพลงรัก", "เพลงไทยสากล", "เพลงอกหัก", "เพลงช้า", "เพลงเร็ว", "เพลงดังในTikTok"
  ];
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  const results = await searchYouTube(randomKeyword);
  // กรองไม่เอา live และไม่เอาวิดีโอที่เกิน 10 นาที
  const filtered = results.filter(v => {
    if (!v.duration || v.duration === '0:00' || v.duration.toLowerCase() === 'live') return false;
    const seconds = parseDurationToSeconds(v.duration);
    return seconds > 0 && seconds <= 600;
  });
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
