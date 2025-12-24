import Link from "next/link";
import { Music, Github, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative w-full mt-auto border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg gradient-text">SyncTube Remote</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} SyncTube Remote</span>
            <Link
              href="https://github.com/65011211019/synctube-remote2"
              target="_blank"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Link>
          </div>

          {/* Credits */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-red-500 fill-red-500 animate-pulse" />
            <span>by</span>
            <span className="font-semibold text-foreground">NISIO-SUTTHIPHAT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}