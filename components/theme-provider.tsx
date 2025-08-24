'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      value={{ light: "light", dark: "dark", youtube: "youtube" }}
    >
      {children}
    </NextThemesProvider>
  )
}
