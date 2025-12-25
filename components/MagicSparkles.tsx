"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function MagicSparkles() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Show effects for specific themes
    if (!mounted) return null;

    if (theme === "harrypotter") {
        return (
            <div className="magic-sparkles" aria-hidden="true">
                {/* Magic sparkle particles */}
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="magic-sparkle" />
                ))}

                {/* Occasional lightning flash overlay */}
                <div
                    className="fixed inset-0 bg-yellow-500/5 pointer-events-none lightning-flash"
                    style={{ zIndex: 1 }}
                />
            </div>
        );
    }

    if (theme === "zootopia") {
        return (
            <div className="urban-glow" aria-hidden="true">
                <div className="city-orb" />
                <div className="city-orb" />
            </div>
        );
    }

    if (theme === "avatar") {
        return (
            <div className="bioluminescent-glow" aria-hidden="true">
                <div className="glow-orb" />
                <div className="glow-orb" />
                <div className="glow-orb" />
            </div>
        );
    }

    return null;
}
