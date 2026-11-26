import { memo, useMemo, type ReactNode } from "react";
import { THEMES, clampTheme, frameSVG } from "../lib/luxuryCosmetics";

interface CosmeticFrameProps {
  /** رقم الثيم 0..20 (0 = الافتراضي الثابت) */
  themeIndex?: number;
  /** مقاس الإطار كاملاً بالبكسل */
  size?: number;
  /** صورة القبطان — توضع في ثقب بنسبة 68% وتتمركز تلقائياً. يفضّل <img className="h-full w-full object-cover" /> */
  children?: ReactNode;
  className?: string;
  title?: string;
}

function CosmeticFrameBase({ themeIndex = 0, size = 64, children, className, title }: CosmeticFrameProps) {
  const i = clampTheme(themeIndex);
  const svg = useMemo(() => frameSVG(i), [i]);
  const glow = THEMES[i].gl;
  return (
    <span
      className={className}
      title={title}
      style={{
        position: "relative",
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        filter:
          i === 0
            ? undefined
            : `drop-shadow(0 4px 8px rgba(0,0,0,.5)) drop-shadow(0 0 ${Math.max(6, size / 10)}px ${glow})`,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "16%",
          top: "16%",
          width: "68%",
          height: "68%",
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </span>
      <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}
export const CosmeticFrame = memo(CosmeticFrameBase);

/** أفاتار مؤقت للمعاينة فقط */
export function AvatarPlaceholder() {
  return (
    <span style={{ position: "relative", display: "block", width: "100%", height: "100%", background: "linear-gradient(#4a4580,#27234e)" }}>
      <span style={{ position: "absolute", left: "35%", top: "20%", width: "30%", height: "30%", borderRadius: "50%", background: "#9a94d6" }} />
      <span style={{ position: "absolute", left: "18%", top: "57%", width: "64%", height: "50%", borderRadius: "50% 50% 0 0", background: "#9a94d6" }} />
    </span>
  );
}
