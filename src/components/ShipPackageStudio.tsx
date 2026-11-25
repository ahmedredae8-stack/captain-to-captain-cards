import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Flame,
  Hammer,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Scissors,
  Shield,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { announceArtworkUpdate, isArtworkAdmin } from "@/lib/artwork";
import { playSfx } from "@/lib/sound";

type EffectMode = "idle" | "damage" | "repair" | "destroy";

type ExtractedShip = {
  name: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
};

/**
 * خوارزمية ذكية مدمجة لحذف الخلفية (البيضاء أو الملونة) وتحويل الصورة إلى PNG شفاف بالكامل.
 */
async function removeBackgroundSmart(blob: Blob, tolerance = 35): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;

  ctx.drawImage(bmp, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  // فحص ألوان الأركان لتحديد لون الخلفية الغالب
  const samples = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [Math.floor(w / 2), 0], [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]
  ];

  let bgR = 0, bgG = 0, bgB = 0, count = 0;
  for (const [x, y] of samples) {
    const idx = (y * w + x) * 4;
    if (data[idx + 3] > 30) {
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      count++;
    }
  }

  if (count > 0) {
    bgR = Math.round(bgR / count);
    bgG = Math.round(bgG / count);
    bgB = Math.round(bgB / count);
  } else {
    bgR = 255; bgG = 255; bgB = 255;
  }

  // حذف بكسلات الخلفية مع تنعيم حواف السفينة (feathering)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 10) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist <= tolerance) {
      data[i + 3] = 0;
    } else if (dist < tolerance + 16) {
      const factor = (dist - tolerance) / 16;
      data[i + 3] = Math.round(a * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? blob), "image/png");
  });
}

/**
 * نافذة استوديو متكاملة لرفع حزم السفن وتطبيق التأثيرات الحية (تلميع، صيانة، ضرر، تفجير)
 * تدعم الرفع المباشر لصور منفردة أو متعددة، وتدعم أيضاً ملفات ZIP المضغوطة، مع حذف الخلفية تلقائياً.
 */
export function ShipPackageStudio({ onClose }: { onClose?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [ships, setShips] = useState<ExtractedShip[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  const [currentMode, setCurrentMode] = useState<EffectMode>("idle");
  const [isEngineLoaded, setIsEngineLoaded] = useState(false);

  useEffect(() => {
    void isArtworkAdmin()
      .then(setIsAdmin)
      .finally(() => setLoadingAdmin(false));
  }, []);

  const selectedShip = ships[selectedIndex] ?? null;

  // إرسال صورة السفينة المختارة وحالة التأثير لمحرك Canvas
  useEffect(() => {
    if (!isEngineLoaded || !iframeRef.current || !selectedShip) return;

    try {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "SET_SHIP_IMAGE",
          dataUrl: selectedShip.previewUrl,
        },
        "*"
      );
    } catch {
      // إطار معزول
    }
  }, [isEngineLoaded, selectedShip]);

  const applyEffect = (mode: EffectMode) => {
    setCurrentMode(mode);
    playSfx("click", 0.6);
    if (!iframeRef.current) return;

    try {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "SET_EFFECT_MODE",
          mode,
        },
        "*"
      );
    } catch {
      // تجاهل
    }
  };

  /** معالجة الملفات (سواء صور مباشرة أو ملف ZIP) */
  const handleFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessing(true);
    setStatusMsg(null);
    playSfx("click", 0.7);

    try {
      const isZip = files.length === 1 && (files[0].name.endsWith(".zip") || files[0].type.includes("zip"));
      const extracted: ExtractedShip[] = [];

      if (isZip) {
        // فك حزمة ZIP
        if (typeof (window as any).JSZip === "undefined") {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("تعذّر تحميل مكتبة فك الضغط JSZip"));
            document.head.appendChild(script);
          });
        }

        const zip = await (window as any).JSZip.loadAsync(files[0]);
        const imageEntries: any[] = [];

        zip.forEach((path: string, entry: any) => {
          if (!entry.dir && /\.(png|jpe?g|webp)$/i.test(path) && !path.includes("__MACOSX")) {
            imageEntries.push(entry);
          }
        });

        imageEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        for (const entry of imageEntries) {
          let blob = await entry.async("blob");
          if (autoRemoveBg) {
            blob = await removeBackgroundSmart(blob);
          }
          const previewUrl = URL.createObjectURL(blob);
          const bmp = await createImageBitmap(blob);
          extracted.push({
            name: entry.name.split("/").pop() || entry.name,
            blob,
            previewUrl,
            width: bmp.width,
            height: bmp.height,
          });
        }
      } else {
        // رفع صور متعددة أو منفردة مباشرة
        const fileArr = Array.from(files).filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
        fileArr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        for (const file of fileArr) {
          let blob: Blob = file;
          if (autoRemoveBg) {
            blob = await removeBackgroundSmart(file);
          }
          const previewUrl = URL.createObjectURL(blob);
          const bmp = await createImageBitmap(blob);
          extracted.push({
            name: file.name,
            blob,
            previewUrl,
            width: bmp.width,
            height: bmp.height,
          });
        }
      }

      if (extracted.length === 0) {
        setStatusMsg({ text: "لم يتم العثور على صور سفن صالحة.", type: "err" });
      } else {
        setShips(extracted);
        setSelectedIndex(0);
        setStatusMsg({
          text: `تم تجهيز ${extracted.length} سفينة بنجاح${autoRemoveBg ? " وإزالة خلفياتها" : ""}. جاهزة للمعاينة والنشر.`,
          type: "ok",
        });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || "حدث خطأ أثناء معالجة الملفات.", type: "err" });
    } finally {
      setProcessing(false);
    }
  };

  /** رفع السفن الجاهزة إلى Supabase وتحديث قاعدة البيانات مباشرة */
  const handleUploadAll = async () => {
    if (ships.length === 0) return;
    setUploading(true);
    setStatusMsg({ text: "جاري التحقق من صلاحيات الأدمن والرفع إلى Supabase...", type: "info" });
    playSfx("click", 0.7);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("يجب أن تكون مسجلاً بحسابك كأدمن لإتمام النشر.");
      }

      let successCount = 0;
      const targetSlot = "ship_idle";

      for (let i = 0; i < ships.length; i++) {
        const item = ships[i];
        const fileName = `ship_${Date.now()}_${i}.png`;
        const storagePath = `${user.id}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("game-artwork")
          .upload(storagePath, item.blob, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadErr) {
          throw new Error(`فشل رفع الصورة (${item.name}): ${uploadErr.message}`);
        }

        // تنظيف السجلات القديمة للسفينة
        await supabase
          .from("artwork_poses")
          .delete()
          .eq("slot", targetSlot)
          .eq("variation_id", `custom_${i}`);

        // إدراج سجل العمل الفني
        const { error: insertErr } = await supabase
          .from("artwork_poses")
          .insert({
            slot: targetSlot,
            variation_id: `custom_${i}`,
            image_path: storagePath,
            source_file: item.name,
            published: true,
            created_by: user.id,
          });

        if (insertErr) {
          throw new Error(`فشل تسجيل السفينة بقاعدة البيانات: ${insertErr.message}`);
        }

        successCount++;
      }

      await announceArtworkUpdate();

      setStatusMsg({
        text: `تم بنجاح رفع وتثبيت ${successCount} سفينة في اللعبة! ستظهر لجميع اللاعبين فوراً.`,
        type: "ok",
      });
      playSfx("click", 1);
    } catch (err: any) {
      setStatusMsg({ text: err.message || "فشل النشر.", type: "err" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="daily-overlay studio-overlay" dir="rtl" role="dialog" aria-modal="true">
      <div className="daily-panel studio-panel max-w-4xl max-h-[92vh] flex flex-col p-4 bg-slate-900 border border-tos-gold/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* رأس النافذة */}
        <header className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-tos-gold" />
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">استوديو حزم السفن والتأثيرات</h2>
              <p className="text-xs text-slate-400">ارفع صور السفن (مباشرة أو ZIP) مع حذف الخلفية تلقائياً ومعاينة محرك المعارك</p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* تنبيه صلاحيات الأدمن */}
        {!loadingAdmin && !isAdmin && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>حسابك الحالي لا يملك صلاحية الأدمن. للمعاينة يمكنك التجربة، لكن النشر في قاعدة البيانات يتطلب حساب الأدمن.</span>
          </div>
        )}

        {/* خيارات الرفع وإزالة الخلفية */}
        <div className="mt-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={processing || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-tos-gold hover:brightness-110 text-slate-950 font-bold text-sm rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>اختيار صور السفن أو ملف ZIP</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,.zip,application/zip"
              className="hidden"
              onChange={(e) => void handleFilesChosen(e.target.files)}
            />

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRemoveBg}
                onChange={(e) => setAutoRemoveBg(e.target.checked)}
                className="rounded border-slate-600 text-tos-gold focus:ring-tos-gold"
              />
              <Scissors className="h-3.5 w-3.5 text-tos-gold" />
              <span>إزالة الخلفية تلقائياً (شفافة PNG)</span>
            </label>
          </div>

          {ships.length > 0 && (
            <button
              type="button"
              disabled={uploading || !isAdmin}
              onClick={handleUploadAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>نشر كل السفن باللعبة ({ships.length})</span>
            </button>
          )}
        </div>

        {/* رسائل الحالة */}
        {statusMsg && (
          <div
            className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
              statusMsg.type === "ok"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                : statusMsg.type === "err"
                ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
                : "bg-sky-500/15 border-sky-500/40 text-sky-200"
            }`}
          >
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* المعاينة الحية وشريط السفن */}
        <div className="mt-3 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-h-0">
          {/* محرك التأثيرات (IFrame) */}
          <div className="md:col-span-2 relative bg-slate-950 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-tos-gold" />
                <span>معاينة المحرك: {selectedShip ? selectedShip.name : "لا توجد سفينة محددة"}</span>
              </span>

              {/* أزرار اختبار التأثيرات */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyEffect("idle")}
                  className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 ${
                    currentMode === "idle" ? "bg-tos-gold text-slate-950 font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>طبيعي</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyEffect("repair")}
                  className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 ${
                    currentMode === "repair" ? "bg-emerald-500 text-white font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Hammer className="h-3 w-3" />
                  <span>إصلاح</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyEffect("damage")}
                  className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 ${
                    currentMode === "damage" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Flame className="h-3 w-3" />
                  <span>ضرر</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyEffect("destroy")}
                  className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 ${
                    currentMode === "destroy" ? "bg-rose-600 text-white font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  <span>تدمير</span>
                </button>
              </div>
            </div>

            <div className="flex-1 relative w-full h-[320px] md:h-auto min-h-[300px] bg-slate-950">
              <iframe
                ref={iframeRef}
                src="/ship-effects/index.html"
                title="Ship Effects Canvas Engine"
                className="w-full h-full border-0"
                onLoad={() => setIsEngineLoaded(true)}
              />
            </div>
          </div>

          {/* قائمة السفن المرفوعة */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col min-h-0">
            <span className="text-xs font-bold text-slate-300 mb-2 block">السفن الجاهزة ({ships.length})</span>
            {ships.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-500 text-xs">
                <Upload className="h-8 w-8 mb-2 opacity-40" />
                <p>لم تختر سفناً بعد.</p>
                <p className="mt-1 text-[11px] text-slate-600">اختر صور PNG أو JPG أو ملف ZIP لبدء التجربة.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {ships.map((s, idx) => (
                  <button
                    key={s.name + idx}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(idx);
                      playSfx("hover", 0.3);
                    }}
                    className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition text-right ${
                      selectedIndex === idx
                        ? "bg-slate-800 border border-tos-gold/60 text-white"
                        : "bg-slate-900/50 hover:bg-slate-800/40 text-slate-400 border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded bg-slate-950 border border-slate-700 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={s.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {s.width} × {s.height} px
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
