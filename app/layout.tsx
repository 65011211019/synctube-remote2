import type { Metadata } from 'next'
import './globals.css'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import Link from "next/link"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import Image from "next/image"
import * as React from "react"
import { generateUserId, getUserId } from "@/lib/user";
import { useEffect } from "react";
import { UserIdProvider } from "@/components/UserIdProvider";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: 'SyncTube Remote2',
  description: 'SyncTube Remote2',
  generator: 'SyncTube Remote2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isMobile = typeof window !== "undefined" ? useIsMobile() : false
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>SyncTube Remote2</title>
        <link rel="icon" href="/logostr.png" />
      </head>
      <body>
        <ThemeProvider>
          <UserIdProvider>
            {/* Navbar */}
            <nav className="bg-background border-b shadow-sm">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/logostr.png" alt="SyncTube Remote logo" width={32} height={32} className="h-8 w-8" priority />
                  <span className="font-bold text-lg hidden sm:inline">SyncTube Remote</span>
                </Link>
                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-4">
                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuLink asChild>
                          <Link href="/" className="font-bold text-lg px-3 py-2 hover:bg-muted rounded transition-colors">Home</Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                      <NavigationMenuItem>
                        <NavigationMenuLink asChild>
                          <Link href="/active-rooms" className="font-bold text-lg px-3 py-2 hover:bg-muted rounded transition-colors">Active Rooms</Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>
                  <ThemeToggle />
                </div>
                {/* Mobile Hamburger */}
                <div className="md:hidden">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Open menu">
                        <Menu className="h-6 w-6" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <div className="flex flex-col gap-2 p-4">
                        <Link href="/" className="font-bold text-lg px-3 py-2 hover:bg-muted rounded transition-colors">Home</Link>
                        <Link href="/active-rooms" className="font-bold text-lg px-3 py-2 hover:bg-muted rounded transition-colors">Active Rooms</Link>
                        <div className="mt-4"><ThemeToggle /></div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>
            </nav>
            {/* Main Content */}
            {children}
          </UserIdProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
