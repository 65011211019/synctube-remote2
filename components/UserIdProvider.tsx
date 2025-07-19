"use client";
import { useEffect } from "react";
import { generateUserId, getUserId } from "@/lib/user";

export function UserIdProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && !getUserId()) {
      generateUserId();
    }
  }, []);
  return <>{children}</>;
} 