import { useEffect, useRef, useState } from "react";

import { playSfx } from "@/lib/sound";
import introArt from "@/assets/intro-epic.jpg";
import { hulls, fleetCatalog } from "@/lib/fleetCatalog";
import { FISH } from "@/lib/catches";
import { themes } from "@/lib/themes";
import { listArtwork, artworkUrl } from "@/lib/artwork";

const STAGES = [
  "تجهيز الأسطول والمدافع",
  "جلب سفن وتأثيرات السحابة",
  "صلي علي النبي",
  "رسم خرائط ومياه المحيط",
  "تحميل قمرة القيادة والعتاد",
  "رفع راية المعركة",
];

// جلب كافة الأصول والصور المضمنة في مجلد assets تلقائياً
const bundledImages = Object.values(
  import.meta.glob("@/assets/**/*.{png,jpg,jpeg,webp}", { eager: true, import: "default" })
) as string[];

/** جمع كافة الصور الثابتة التي تحتاجها اللعبة عند البداية */
function baseCriticalImages(): string[] {
  const list = [
    ...bundledImages,
    ...themes.flatMap((t) => [t.day.poster, t.night.poster]),
    ...hulls,
    ...fleetCatalog.map((s) => s.hull),
    ...fleetCatalog.map((s) => s.photo),
    ...FISH.map((f) => f.img),
  ];
  return [...new Set(list.filter(Boolean))];
}

function preloadImage(src: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if ("decode" in img) {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function IntroLoader({ ready = true, onDone }: { ready?: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let alive = true;
    let totalAssets = 0;
    let loadedAssets = 0;
    let cloudArtworkFetched = false;
    const t0 = performance.now();
    const MIN_TIME = 2000;

    const updateProgress = () => {
      if (!alive) return;
      const assetRatio = totalAssets > 0 ? loadedAssets / totalAssets : 0;
      const timeRatio = Math.min(1, (performance.now() - t0) / MIN_TIME);
      
      const isCloudReady = cloudArtworkFetched && ready;
      const real = isCloudReady ? assetRatio : Math.min(assetRatio, 0.75);

      const combined = Math.min(real, timeRatio);
      setProgress(combined * 100);

      if (assetRatio >= 1 && isCloudReady && timeRatio >= 1) {
        setLeaving(true);
        window.setTimeout(() => {
          if (alive) onDone();
        }, 500);
        return;
      }

      requestAnimationFrame(updateProgress);
    };

    const raf = requestAnimationFrame(updateProgress);

    // 1. تحميل الصور المضمنة
    const localUrls = baseCriticalImages();
    totalAssets = localUrls.length;

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
            // تخطي الرابط إن تعذر
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

    // صمام أمان حتى لا يتعطل اللاعب إذا كان الإنترنت بطيئاً جداً
    const timeoutGuard = window.setTimeout(() => {
      if (alive) {
        cloudArtworkFetched = true;
        loadedAssets = totalAssets;
      }
    }, 8000);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutGuard);
    };
  }, [ready, onDone]);

  // تشغيل الموسيقى التصويرية فور أول تفاعل
  useEffect(() => {
    const fire = () => {
      if (started.current) return;
      started.current = true;
      playSfx("intro", 0.9);
    };
    fire();
    window.addEventListener("pointerdown", fire, { once: true });
    return () => window.removeEventListener("pointerdown", fire);
  }, []);

  const stage = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length));

  return (
    <div className={`tos-intro ${leaving ? "out" : ""}`} role="status" aria-live="polite" aria-label="جاري تحميل اللعبة">
      <img src={introArt} alt="عرش إله البحار وأسطول يشق الموج العاصف" width={1088} height={1920} className="tos-intro-art" />
      <div className="tos-intro-rays" aria-hidden="true" />
      <div className="tos-intro-top" dir="rtl">
        <span className="tos-intro-badge">الموسم الأول</span>
        <h1 className="tos-intro-title"><span>عرش</span><b>البحار</b></h1>
        <p>من يحكم الموج… يحكم العالم</p>
      </div>
      <div className="tos-intro-bottom" dir="rtl">
        <div className="tos-intro-ring" style={{ "--p": `${progress * 3.6}deg` } as React.CSSProperties}>
          <span>{Math.round(progress)}<small>%</small></span>
        </div>
        <div className="tos-intro-status">
          <strong>{STAGES[stage]}</strong>
          <ol className="tos-intro-steps" aria-hidden="true">
            {STAGES.map((s, i) => (
              <li key={s} className={i < stage ? "done" : i === stage ? "now" : ""} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
