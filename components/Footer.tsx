import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full mt-12 border-t bg-card text-card-foreground border-border py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-bold text-primary text-lg">SyncTube Remote</div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} SyncTube Remote</span>
          <span className="hidden sm:inline">·</span>
          <Link href="https://github.com/65011211019/synctube-remote2" target="_blank" className="hover:underline text-accent-foreground">GitHub</Link>
        </div>
        <div className="text-xs text-muted-foreground text-center sm:text-right">
          Made with <span className="text-primary">♥</span> by NISIO-SUTTHIPHAT
        </div>
      </div>
    </footer>
  );
} 