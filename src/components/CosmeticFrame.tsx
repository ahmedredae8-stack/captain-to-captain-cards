// src/components/CosmeticFrame.tsx
import React, { useMemo } from "react";
import { getTheme, getThemeIndex, getFrameSVG } from "@/lib/luxuryCosmetics";

type Props = {
  themeId?: string;
  themeIndex?: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
};

export function CosmeticFrame({
  themeId,
  themeIndex,
  size = 64,
  className = "",
  children,
}: Props) {
  const effectiveIndex = useMemo(() => {
    if (themeIndex !== undefined) return getThemeIndex(themeIndex);
    if (themeId !== undefined) return getThemeIndex(themeId);
    return 0;
  }, [themeIndex, themeId]);

  const theme = useMemo(() => getTheme(effectiveIndex), [effectiveIndex]);
  const svgMarkup = useMemo(() => getFrameSVG(effectiveIndex), [effectiveIndex]);

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.55)) drop-shadow(0 0 10px ${theme.gl})`,
      }}
    >
      {/* Avatar aperture perfectly centered at 68% */}
      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center pointer-events-auto"
        style={{
          width: "68%",
          height: "68%",
          left: "16%",
          top: "16%",
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)",
        }}
      >
        {children}
      </div>

      {/* SVG Frame Layer with animations */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-visible [&>svg]:w-full [&>svg]:h-full [&>svg]:overflow-visible"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  );
}

export default CosmeticFrame;
