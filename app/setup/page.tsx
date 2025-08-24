"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Copy } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function SetupPage() {
  const [checking, setChecking] = useState(false)
  const [setupStatus, setSetupStatus] = useState<{
    database: boolean | null
    supabase: boolean | null
    youtube: boolean | null
  }>({
    database: null,
    supabase: null,
    youtube: null,
  })

  const checkSetup = async () => {
    setChecking(true)

    try {
      // Check database setup
      const response = await fetch("/api/setup", { method: "POST" })
      const data = await response.json()

      setSetupStatus((prev) => ({
        ...prev,
        database: data.success,
        supabase: data.success,
      }))

      // Check YouTube API
      const youtubeResponse = await fetch("/api/youtube/search?q=test")
      const youtubeData = await youtubeResponse.json()

      setSetupStatus((prev) => ({
        ...prev,
        youtube: !youtubeData.error,
      }))

      if (data.success && !youtubeData.error) {
        toast({
          title: "Setup Complete!",
          description: "All services are configured correctly",
        })
      }
    } catch (error) {
      console.error("Setup check failed:", error)
      setSetupStatus({
        database: false,
        supabase: false,
        youtube: false,
      })
    } finally {
      setChecking(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Text copied to clipboard",
    })
  }

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
    if (status) return <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
    return <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
  }

  const getStatusText = (status: boolean | null) => {
    if (status === null) return "Not checked"
    if (status) return "Configured"
    return "Needs setup"
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">SyncTube Remote Setup</h1>
          <p className="text-sm sm:text-base text-gray-600">Configure your application to get started</p>
        </div>

        {/* Status and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Setup Status</CardTitle>
              <CardDescription className="text-sm">Check your configuration status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(setupStatus.supabase)}
                  <span className="text-sm sm:text-base">Supabase Connection</span>
                </div>
                <Badge variant={setupStatus.supabase ? "default" : "secondary"} className="text-xs">
                  {getStatusText(setupStatus.supabase)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(setupStatus.database)}
                  <span className="text-sm sm:text-base">Database Tables</span>
                </div>
                <Badge variant={setupStatus.database ? "default" : "secondary"} className="text-xs">
                  {getStatusText(setupStatus.database)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(setupStatus.youtube)}
                  <span className="text-sm sm:text-base">YouTube API</span>
                </div>
                <Badge variant={setupStatus.youtube ? "default" : "secondary"} className="text-xs">
                  {getStatusText(setupStatus.youtube)}
                </Badge>
              </div>

              <Button onClick={checkSetup} disabled={checking} className="w-full">
                {checking ? "Checking..." : "Check Setup"}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Quick Actions</CardTitle>
              <CardDescription className="text-sm">Common setup tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent text-sm"
                onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
              >
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Open Supabase Dashboard
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start bg-transparent text-sm"
                onClick={() => window.open("https://console.cloud.google.com/", "_blank")}
              >
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Open Google Cloud Console
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start bg-transparent text-sm"
                onClick={() => copyToClipboard("npm run setup")}
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Copy Setup Command
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Setup Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">1. Environment Variables</CardTitle>
              <CardDescription className="text-sm">Configure your .env.local file</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs sm:text-sm text-gray-800 whitespace-pre">
                    {`# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# YouTube API Key
YOUTUBE_API_KEY=your_youtube_api_key_here`}
                  </pre>
                </div>

                <div className="text-xs sm:text-sm text-gray-600">
                  <p className="mb-2">Get your Supabase values from:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Go to{" "}
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        className="text-blue-600 hover:underline"
                        rel="noreferrer"
                      >
                        Supabase Dashboard
                      </a>
                    </li>
                    <li>Select your project</li>
                    <li>Go to Settings → API</li>
                    <li>Copy the URL and keys</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">2. Database Setup</CardTitle>
              <CardDescription className="text-sm">Create the required tables</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg overflow-x-auto">
                  <code className="text-xs sm:text-sm text-gray-800">npm run setup</code>
                </div>

                <div className="text-xs sm:text-sm text-gray-600">
                  <p className="mb-2">Or manually via Supabase Dashboard:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open Supabase Dashboard</li>
                    <li>Go to SQL Editor</li>
                    <li>
                      Copy contents of <code className="bg-gray-100 px-1 rounded">scripts/create-tables.sql</code>
                    </li>
                    <li>Run the script</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* YouTube API Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">3. YouTube API Setup</CardTitle>
              <CardDescription className="text-sm">Enable YouTube Data API v3</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-xs sm:text-sm text-gray-600">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Go to{" "}
                      <a
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        className="text-blue-600 hover:underline"
                        rel="noreferrer"
                      >
                        Google Cloud Console
                      </a>
                    </li>
                    <li>Create a new project or select existing</li>
                    <li>Enable YouTube Data API v3</li>
                    <li>Create credentials (API Key)</li>
                    <li>Add the key to your .env.local file</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">4. Start the Application</CardTitle>
              <CardDescription className="text-sm">Run the development server</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg overflow-x-auto">
                  <code className="text-xs sm:text-sm text-gray-800">npm run dev</code>
                </div>

                <div className="text-xs sm:text-sm text-gray-600">
                  <p>
                    Once running, open{" "}
                    <a href="http://localhost:3000" className="text-blue-600 hover:underline">
                      http://localhost:3000
                    </a>{" "}
                    to start using SyncTube Remote!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
