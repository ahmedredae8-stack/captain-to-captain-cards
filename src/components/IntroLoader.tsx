import { useEffect, useRef, useState } from "react";
import { Anchor, Sparkles } from "lucide-react";

import { artworkUrl, listArtwork } from "@/lib/artwork";
import { playAmbient, playSfx } from "@/lib/sound";

const STAGES = [
  "نجهّز أشرعة السفن...",
  "نضبط مدافع المعركة...",
  "نستطلع حركة الرياح والأمواج...",
  "نجمع كنوز الجزيرة...",
  "نستقبل قبطان البحر...",
];

/** وقت أدنى لضمان رؤية الهوية بسلاسة (ثانية واحدة) */
const MIN_TIME = 1000;

/** فحص وتحميل أي صورة في الذاكرة */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** جلب جميع الصور الثابتة المحلية عبر Vite */
function baseCriticalImages(): string[] {
  const cardAssets = import.meta.glob<{ default: string }>("@/assets/cards/*.{jpg,png,webp}", { eager: true });
  const themeAssets = import.meta.glob<{ default: string }>("@/assets/themes/*.{jpg,png,webp}", { eager: true });
  const iconAssets = import.meta.glob<{ default: string }>("@/assets/icons/*.{jpg,png,webp,svg}", { eager: true });
  const shopAssets = import.meta.glob<{ default: string }>("@/assets/shop/*.{jpg,png,webp}", { eager: true });

  const urls: string[] = [];
  [cardAssets, themeAssets, iconAssets, shopAssets].forEach((group) => {
    Object.values(group).forEach((mod) => {
      if (mod?.default) urls.push(mod.default);
    });
  });
  return urls;
}

export function IntroLoader({ ready = true, onDone }: { ready?: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(15);
  const [leaving, setLeaving] = useState(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    let totalAssets = 1;
    let loadedAssets = 0;
    let cloudArtworkFetched = false;
    let forceDone = false;

    const updateProgress = () => {
      if (!alive) return;
      const assetRatio = totalAssets > 0 ? loadedAssets / totalAssets : 0;
      const elapsed = performance.now() - t0;
      const timeRatio = Math.min(1, elapsed / MIN_TIME);
      
      const isCloudReady = (cloudArtworkFetched && readyRef.current) || forceDone;
      const real = isCloudReady ? assetRatio : Math.min(assetRatio, 0.85);

      const targetRatio = forceDone ? 1 : Math.max(0.15, Math.min(real, timeRatio));
      setProgress((prev) => Math.min(100, Math.max(prev, Math.round(targetRatio * 100))));

      if ((assetRatio >= 1 && isCloudReady && timeRatio >= 1) || forceDone) {
        setLeaving(true);
        window.setTimeout(() => {
          if (alive) onDoneRef.current();
        }, 400);
        return;
      }

      requestAnimationFrame(updateProgress);
    };

    const raf = requestAnimationFrame(updateProgress);

    // 1. تحميل الصور المضمنة
    const localUrls = baseCriticalImages();
    totalAssets = Math.max(1, localUrls.length);

    localUrls.forEach((url) => {
      void preloadImage(url).then(() => {
        if (alive) loadedAssets++;
      });
    });

    // 2. جلب صور السفن والتأثيرات المخصصة من Supabase وتحميلها فوراً قبل الفتح
    void (async () => {
      try {
        const rows = await listArtwork();
        const cloudUrls: string[] = [];
        for (const row of rows) {
          try {
            const signed = await artworkUrl(row.image_path);
            if (signed) cloudUrls.push(signed);
          } catch {
            // تخطي إن تعذر
          }
        }

        if (alive && cloudUrls.length > 0) {
          totalAssets += cloudUrls.length;
          cloudUrls.forEach((u) => {
            void preloadImage(u).then(() => {
              if (alive) loadedAssets++;
            });
          });
        }
      } catch {
        // الاستمرار بالصور الافتراضية
      } finally {
        if (alive) cloudArtworkFetched = true;
      }
    })();

    // صمام أمان أقصاه 5 ثوانٍ حتى لا يعلق اللاعب أبداً على 0%
    const timeoutGuard = window.setTimeout(() => {
      if (alive) {
        forceDone = true;
        cloudArtworkFetched = true;
        loadedAssets = totalAssets;
      }
    }, 5000);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutGuard);
    };
  }, []);

  // تشغيل الموسيقى التصويرية فور أول تفاعل
  useEffect(() => {
    const fire = () => {
      startAmbientSound();
      window.removeEventListener("pointerdown", fire);
      window.removeEventListener("keydown", fire);
    };
    window.addEventListener("pointerdown", fire, { once: true });
    window.addEventListener("keydown", fire, { once: true });
    return () => {
      window.removeEventListener("pointerdown", fire);
      window.removeEventListener("keydown", fire);
    };
  }, []);

  const startAmbientSound = () => {
    try {
      playSfx("click", 0.6);
      playAmbient();
    } catch {
      // تجاهل إذا حظر المتصفح الصوت التلقائي
    }
  };

  const stage = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length));

  return (
    <aside
      className={`tos-intro-backdrop ${leaving ? "leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="شاشة التحميل والتجهيز"
    >
      <div className="tos-intro-panel">
        <div className="tos-intro-anchor">
          <Anchor className="h-10 w-10 text-tos-gold animate-bounce" />
        </div>

        <div className="tos-intro-ring" style={{ "--p": `${progress * 3.6}deg` } as React.CSSProperties}>
          <span>{Math.round(progress)}<small>%</small></span>
        </div>

        <div className="tos-intro-stage">
          <Sparkles className="h-4 w-4 text-tos-gold inline ml-1.5 animate-spin" />
          <span>{STAGES[stage]}</span>
        </div>

        <div className="tos-intro-bar">
          <div className="tos-intro-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </aside>
  );
}
