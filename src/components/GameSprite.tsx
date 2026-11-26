import { CAPTAINS } from "@/lib/art";
import armorAtlas from "@/assets/armor-atlas.png.asset.json";
import captainsAtlas from "@/assets/captains-atlas.png.asset.json";
import crewAtlas from "@/assets/crew-atlas.png.asset.json";
import gemsAtlas from "@/assets/gems-atlas.png.asset.json";
import weaponsAtlas from "@/assets/weapons-atlas.png.asset.json";
import { CosmeticFrame } from "./CosmeticFrame";
import { useEquippedFrame } from "../lib/equippedFrame";

type Atlas = "weapon" | "crew" | "captain" | "armor" | "gem";

const atlasData: Record<Atlas, { src: string; columns: number; rows: number }> = {
  weapon: { src: weaponsAtlas.url, columns: 3, rows: 2 },
  crew: { src: crewAtlas.url, columns: 3, rows: 3 },
  captain: { src: captainsAtlas.url, columns: 3, rows: 2 },
  armor: { src: armorAtlas.url, columns: 3, rows: 2 },
  gem: { src: gemsAtlas.url, columns: 2, rows: 2 },
};

export function GameSprite({ atlas, index, className = "" }: { atlas: Atlas; index: number; className?: string }) {
  const data = atlasData[atlas];
  const x = index % data.columns;
  const y = Math.floor(index / data.columns);
  return (
    <span
      aria-hidden="true"
      className={`game-sprite ${className}`}
      style={{
        backgroundImage: `url(${data.src})`,
        backgroundSize: `${data.columns * 100}% ${data.rows * 100}%`,
        backgroundPosition: `${data.columns === 1 ? 0 : (x / (data.columns - 1)) * 100}% ${data.rows === 1 ? 0 : (y / (data.rows - 1)) * 100}%`,
      }}
    />
  );
}

export function CaptainAvatar({
  seed = 0,
  url,
  className = "",
  size = 64,
  frameIndex,
  isSelf = false,
}: {
  seed?: number;
  url?: string | null | undefined;
  className?: string;
  size?: number;
  frameIndex?: number;
  isSelf?: boolean;
}) {
  const src = url || CAPTAINS[Math.abs(seed) % CAPTAINS.length];
  const mine = useEquippedFrame();
  const idx = frameIndex ?? (isSelf ? mine : 0);

  return (
    <CosmeticFrame themeIndex={idx} size={size}>
      <img src={src} alt="" draggable={false} className={`captain-sprite captain-photo ${className}`} />
    </CosmeticFrame>
  );
}

export function nameSeed(name: string) {
  return [...name].reduce((sum, letter) => sum + (letter.codePointAt(0) ?? 0), 0);
}
