"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Copy, Settings, Database, Youtube, Rocket, Terminal } from "lucide-react"
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
    if (status === null) return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    if (status) return <CheckCircle className="h-5 w-5 text-green-500" />
    return <XCircle className="h-5 w-5 text-destructive" />
  }

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="secondary" className="font-medium">Not checked</Badge>
    if (status) return <Badge className="bg-green-500 hover:bg-green-600 font-medium">Configured</Badge>
    return <Badge variant="destructive" className="font-medium">Needs setup</Badge>
  }

  const steps = [
    {
      number: 1,
      icon: Settings,
      title: "Environment Variables",
      description: "Configure your .env.local file",
      content: (
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-xl overflow-x-auto border">
            <pre className="text-sm text-foreground/80 whitespace-pre font-mono">
              {`# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# YouTube API Key
YOUTUBE_API_KEY=your_youtube_api_key_here`}
            </pre>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="mb-3 font-medium text-foreground">Get your Supabase values from:</p>
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>Go to <a href="https://supabase.com/dashboard" target="_blank" className="text-primary hover:underline font-medium" rel="noreferrer">Supabase Dashboard</a></li>
              <li>Select your project</li>
              <li>Go to Settings → API</li>
              <li>Copy the URL and keys</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      number: 2,
      icon: Database,
      title: "Database Setup",
      description: "Create the required tables",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-muted/50 p-4 rounded-xl border">
            <Terminal className="h-5 w-5 text-primary shrink-0" />
            <code className="text-sm font-mono font-semibold">npm run setup</code>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={() => copyToClipboard("npm run setup")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="mb-3 font-medium text-foreground">Or manually via Supabase Dashboard:</p>
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>Open Supabase Dashboard</li>
              <li>Go to SQL Editor</li>
              <li>Copy contents of <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">scripts/create-tables.sql</code></li>
              <li>Run the script</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      number: 3,
      icon: Youtube,
      title: "YouTube API Setup",
      description: "Enable YouTube Data API v3",
      content: (
        <div className="text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-primary hover:underline font-medium" rel="noreferrer">Google Cloud Console</a></li>
            <li>Create a new project or select existing</li>
            <li>Enable YouTube Data API v3</li>
            <li>Create credentials (API Key)</li>
            <li>Add the key to your .env.local file</li>
          </ol>
        </div>
      )
    },
    {
      number: 4,
      icon: Rocket,
      title: "Start the Application",
      description: "Run the development server",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-muted/50 p-4 rounded-xl border">
            <Terminal className="h-5 w-5 text-primary shrink-0" />
            <code className="text-sm font-mono font-semibold">npm run dev</code>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={() => copyToClipboard("npm run dev")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Once running, open <a href="http://localhost:3000" className="text-primary hover:underline font-medium">http://localhost:3000</a> to start using SyncTube Remote!
          </p>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Settings className="h-4 w-4" />
            <span>Configuration</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight">
            <span className="gradient-text">Setup Guide</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Configure your application to get started
          </p>
        </div>

        {/* Status and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 animate-slide-up">
          {/* Status Overview */}
          <Card className="border-2 card-hover">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                Setup Status
              </CardTitle>
              <CardDescription>Check your configuration status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Supabase Connection", status: setupStatus.supabase },
                { label: "Database Tables", status: setupStatus.database },
                { label: "YouTube API", status: setupStatus.youtube }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}

              <Button
                onClick={checkSetup}
                disabled={checking}
                className="w-full h-12 font-semibold btn-gradient rounded-xl mt-2"
              >
                {checking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  "Check Setup"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-2 card-hover">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                Quick Actions
              </CardTitle>
              <CardDescription>Common setup tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-12 text-left font-medium rounded-xl border-2 hover:bg-accent/50"
                onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-3 text-primary" />
                Open Supabase Dashboard
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12 text-left font-medium rounded-xl border-2 hover:bg-accent/50"
                onClick={() => window.open("https://console.cloud.google.com/", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-3 text-primary" />
                Open Google Cloud Console
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12 text-left font-medium rounded-xl border-2 hover:bg-accent/50"
                onClick={() => copyToClipboard("npm run setup")}
              >
                <Copy className="h-4 w-4 mr-3 text-primary" />
                Copy Setup Command
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Setup Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {steps.map((step, index) => (
            <Card
              key={step.number}
              className="border-2 card-hover animate-slide-up"
              style={{ animationDelay: `${(index + 2) * 100}ms` }}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-lg shrink-0">
                    {step.number}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <step.icon className="h-5 w-5 text-primary" />
                      {step.title}
                    </CardTitle>
                    <CardDescription className="mt-1">{step.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {step.content}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
