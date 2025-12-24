"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sun, Moon, Youtube, Sparkles, Wand2, Rabbit } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "youtube", label: "YouTube", icon: Youtube },
    { value: "avatar", label: "Avatar", icon: Sparkles },
    { value: "zootopia", label: "Zootopia", icon: Rabbit },
    { value: "harrypotter", label: "Harry Potter", icon: Wand2 },
  ];

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="w-[130px] h-10 rounded-xl border-2 bg-background hover:bg-accent/50 transition-colors">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-2">
        {themes.map((t) => (
          <SelectItem
            key={t.value}
            value={t.value}
            className="rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}