import { v4 as uuidv4 } from "uuid"

const USER_ID_KEY = "synctube_user_id"

export function generateUserId(): string {
  const userId = uuidv4()
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

export function getUserId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(USER_ID_KEY)
}
