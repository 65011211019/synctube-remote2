import type { Metadata } from 'next'
import './globals.css'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import Link from "next/link"
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Menu, Music, Home, Radio } from "lucide-react"
import Image from "next/image"
import * as React from "react"
import { UserIdProvider } from "@/components/UserIdProvider";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/ThemeToggle";
import MagicSparkles from "@/components/MagicSparkles";

export const metadata: Metadata = {
  title: 'SyncTube Remote',
  description: 'Share and listen to YouTube music with friends in real-time',
  generator: 'SyncTube Remote',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>SyncTube Remote</title>
        <link rel="icon" href="/logostr.png" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <MagicSparkles />
          <UserIdProvider>
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                    <Image
                      src="/logostr.png"
                      alt="SyncTube Remote logo"
                      width={36}
                      height={36}
                      className="h-7 w-7 object-contain"
                      priority
                    />
                  </div>
                  <span className="font-bold text-lg hidden sm:inline gradient-text">SyncTube Remote</span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-2">
                  <NavigationMenu>
                    <NavigationMenuList className="gap-1">
                      <NavigationMenuItem>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/"
                            className="flex items-center gap-2 font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-accent transition-colors"
                          >
                            <Home className="h-4 w-4" />
                            Home
                          </Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                      <NavigationMenuItem>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/active-rooms"
                            className="flex items-center gap-2 font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-accent transition-colors"
                          >
                            <Radio className="h-4 w-4" />
                            Active Rooms
                          </Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>

                  <div className="w-px h-6 bg-border mx-2" />

                  <ThemeToggle />
                </div>

                {/* Mobile Hamburger */}
                <div className="md:hidden">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Open menu" className="h-10 w-10 rounded-xl">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <div className="flex flex-col gap-2 p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Music className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-bold text-lg">SyncTube Remote</span>
                        </div>

                        <Link
                          href="/"
                          className="flex items-center gap-3 font-medium text-base px-4 py-3 rounded-xl hover:bg-accent transition-colors"
                        >
                          <Home className="h-5 w-5 text-primary" />
                          Home
                        </Link>
                        <Link
                          href="/active-rooms"
                          className="flex items-center gap-3 font-medium text-base px-4 py-3 rounded-xl hover:bg-accent transition-colors"
                        >
                          <Radio className="h-5 w-5 text-primary" />
                          Active Rooms
                        </Link>

                        <div className="mt-6 pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-3 px-4">Theme</p>
                          <ThemeToggle />
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <main className="min-h-[calc(100vh-4rem)]">
              {children}
            </main>
          </UserIdProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
