"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function MagicSparkles() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Only show sparkles for Harry Potter theme
    if (!mounted || theme !== "harrypotter") return null;

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
