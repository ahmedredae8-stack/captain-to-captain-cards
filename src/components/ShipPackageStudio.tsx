import { useEffect, useMemo, useRef, useState } from "react";
declare global {
  interface Window {
    JSZip?: any;
  }
}

async function loadJSZip(): Promise<any> {
  if (typeof window !== "undefined" && window.JSZip) {
    return window.JSZip;
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[src*=\"jszip\"]");
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).JSZip));
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل مكتبة فك الضغط")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.async = true;
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error("تعذر تحميل مكتبة فك الضغط من السيرفر السحابي (CDN)"));
    document.head.appendChild(script);
  });
}
import { CheckCircle2, FileArchive, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { announceArtworkUpdate, artworkUrl, listArtwork } from "@/lib/artwork";
import { fleetCatalog } from "@/lib/fleetCatalog";

type ShipRow = {
  shipId: number;
  code: string;
  name: string;
  currentUrl: string;
  previewUrl: string;
  file?: File;
};

const LEVEL_ONE_COUNT = 10;
const ENGINE_URL = "/ship-effects/index.html";
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function filenameToShipNumber(filename: string): number | null {
  const base = filename.split("/").pop()?.toLowerCase() ?? "";
  const ship = base.match(/^level_01_ship_(0[1-9])\.png$/);
  if (ship) return Number(ship[1]);
  if (base === "level_01_boss_10.png") return 10;
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("تعذرت قراءة صورة المعاينة"));
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`تعذر تحميل صورة السفينة (${response.status})`);
  return blobToDataUrl(await response.blob());
}

export function ShipPackageStudio() {
  const [ships, setShips] = useState<ShipRow[]>([]);
  const [selectedId, setSelectedId] = useState(1);
  const [engineHtml, setEngineHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const levelShips = useMemo(() => fleetCatalog.slice(0, LEVEL_ONE_COUNT), []);
  const selectedShip = ships.find((ship) => ship.shipId === selectedId) ?? ships[0];

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(ENGINE_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`لم يُعثر على محرك التأثيرات (${ENGINE_URL})`);
        const html = await response.text();
        if (!html.includes("const shipSources=[") || !html.includes("drawShipCondition")) {
          throw new Error("ملف المعاينة ليس نسخة محرك التأثيرات المرفق كاملة.");
        }
        if (alive) setEngineHtml(html);
      } catch (error) {
        if (alive) setEngineError(error instanceof Error ? error.message : String(error));
      }
    })();

    void (async () => {
      try {
        const rows = await listArtwork();
        const latest = new Map<string, string>();
        for (const row of rows) {
          if (row.category === "ship" && row.pose === "idle" && !latest.has(row.subject)) {
            latest.set(row.subject, row.image_path);
          }
        }
        const items = await Promise.all(levelShips.map(async (ship, index) => {
          const shipId = index + 1;
          const storedPath = latest.get(`ship-${shipId}`);
          let currentUrl = ship.hull;
          if (storedPath) {
            try { currentUrl = await artworkUrl(storedPath); } catch { /* use bundled hull */ }
          }
          return {
            shipId,
            code: ship.code,
            name: ship.name,
            currentUrl,
            previewUrl: currentUrl,
          } satisfies ShipRow;
        }));
        if (alive) setShips(items);
      } catch (error) {
        if (alive) setStatus(`تعذر تحميل بيانات السفن الحالية: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    return () => {
      alive = false;
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current = [];
    };
  }, [levelShips]);

  useEffect(() => {
    let alive = true;
    if (!engineHtml || ships.length === 0) return;

    void (async () => {
      try {
        const imageData = await Promise.all(ships.map(async (ship) => {
          if (ship.file) return blobToDataUrl(ship.file);
          return urlToDataUrl(ship.currentUrl);
        }));

        // Keep the original golden ship image at index 0. Replace only the ten
        // level-one entries, so the attached engine remains the source of effects.
        const sourceArray = /const shipSources=\[("data:image\/[^"]+")[\s\S]*?\];/;
        if (!sourceArray.test(engineHtml)) throw new Error("تعذر العثور على قائمة الصور داخل محرك التأثيرات.");
        let html = engineHtml.replace(sourceArray, (_match, originalShip: string) =>
          `const shipSources=[${originalShip},${imageData.map((src) => JSON.stringify(src)).join(",")}];`,
        );
        const queryLine = "const query=new URLSearchParams(location.search);";
        if (!html.includes(queryLine)) throw new Error("تعذر ضبط السفينة المختارة في المعاينة.");
        html = html.replace(queryLine, `${queryLine}query.set('ship',${JSON.stringify(String(selectedId))});`);
        if (alive) setPreviewHtml(html);
      } catch (error) {
        if (alive) setPreviewHtml("");
        if (alive) setEngineError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => { alive = false; };
  }, [engineHtml, ships, selectedId]);

  async function importZip(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setStatus("اختر ملف ZIP للحزمة.");
      return;
    }
    if (file.size > MAX_ZIP_BYTES) {
      setStatus("حجم ملف ZIP أكبر من الحد المسموح (100 ميجابايت).");
      return;
    }

    setBusy(true);
    setStatus("جارٍ قراءة الحزمة والبحث عن صور المستوى الأول…");
    try {
      const JSZipLib = await loadJSZip();
      const zip = await JSZipLib.loadAsync(file);
      const found = new Map<number, File>();
      let totalBytes = 0;
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const shipNumber = filenameToShipNumber(path);
        if (!shipNumber) continue;
        const blob = await entry.async("blob");
        totalBytes += blob.size;
        if (blob.size > MAX_IMAGE_BYTES || totalBytes > 80 * 1024 * 1024) {
          throw new Error("صور ZIP أكبر من الحد المسموح.");
        }
        const name = path.split("/").pop()!;
        found.set(shipNumber, new File([blob], name, { type: "image/png" }));
      }
      if (found.size === 0) {
        throw new Error("لم أجد صور level_01_ship_01.png إلى level_01_ship_09.png وlevel_01_boss_10.png داخل ZIP.");
      }

      const next = ships.map((ship) => {
        const fileFromZip = found.get(ship.shipId);
        if (!fileFromZip) return ship;
        const objectUrl = URL.createObjectURL(fileFromZip);
        objectUrlsRef.current.push(objectUrl);
        return { ...ship, file: fileFromZip, previewUrl: objectUrl };
      });
      setShips(next);
      const missing = Array.from({ length: LEVEL_ONE_COUNT }, (_, i) => i + 1).filter((n) => !found.has(n));
      setStatus(missing.length
        ? `تم استيراد ${found.size} صورة. بقيت الأرقام ${missing.join("، ")} من الحزمة الحالية كما هي؛ لن تُستبدل عند النشر.`
        : "تم استيراد سفن المستوى الأول التسع والزعيم. اختر سفينة لمعاينتها، ثم انشر عند الاستعداد.");
    } catch (error) {
      setStatus(`تعذر فتح الحزمة: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function publishUpdates() {
    const staged = ships.filter((ship) => ship.file);
    if (!staged.length) {
      setStatus("لا توجد صور جديدة جاهزة للنشر. ارفع ZIP أولاً.");
      return;
    }
    setBusy(true);
    setStatus("جارٍ رفع الصور وتحديث سجلات السفن…");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("سجّل الدخول بحساب المشرف أولاً.");

      for (const ship of staged) {
        if (!ship.file) continue;
        const path = `ships/level-01/ship-${ship.shipId}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from("game-artwork").upload(path, ship.file, {
          contentType: "image/png",
          upsert: true,
        });
        if (uploadError) throw uploadError;

        const subject = `ship-${ship.shipId}`;
        const { error: deleteError } = await supabase.from("artwork_poses")
          .delete().eq("category", "ship").eq("subject", subject).eq("pose", "idle");
        if (deleteError) throw deleteError;
        const { error: insertError } = await supabase.from("artwork_poses").insert({
          category: "ship",
          subject,
          pose: "idle",
          image_path: path,
          created_by: authData.user.id,
        });
        if (insertError) throw insertError;
      }

      announceArtworkUpdate();
      setShips((current) => current.map((ship) => ship.file ? { ...ship, file: undefined, currentUrl: ship.previewUrl } : ship));
      setStatus(`تم نشر ${staged.length} صورة للمستوى الأول. ستُحدّث صور السفن المتصلة بهذه السجلات بعد وصول إشعار التحديث.`);
    } catch (error) {
      setStatus(`فشل النشر: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section dir="rtl" style={{ background: "#0b1f2d", color: "#fff", borderRadius: 16, padding: 20, marginTop: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#ffd36e", fontSize: 20 }}>حزم السفن — المستوى الأول</h2>
          <p style={{ margin: "5px 0 0", color: "#a9c1cc", fontSize: 13 }}>ارفع ZIP كما هو، وعاين السفن بمحرك التأثيرات الأصلي المرفق.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept=".zip,application/zip" hidden onChange={(event) => void importZip(event.target.files?.[0])} />
          <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <FileArchive size={16} style={{ marginLeft: 6 }} /> اختر ZIP
          </Button>
          <Button disabled={busy || !ships.some((ship) => ship.file)} onClick={() => void publishUpdates()} style={{ background: "linear-gradient(135deg,#f4d18a,#d5a344)", color: "#231604", fontWeight: 700 }}>
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} style={{ marginLeft: 6 }} />
            {busy ? "جارٍ العمل…" : "نشر التحديث"}
          </Button>
        </div>
      </header>

      {status && <p role="status" style={{ background: "rgba(255,255,255,.08)", padding: 10, borderRadius: 8, lineHeight: 1.7 }}>{status}</p>}
      {engineError && <p role="alert" style={{ color: "#ffb4a9", lineHeight: 1.7 }}>المعاينة: {engineError}. تأكد من وضع ملف index.html المرفق في public/ship-effects/index.html.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,260px) minmax(0,1fr)", gap: 14, marginTop: 14 }}>
        <aside style={{ background: "#061520", borderRadius: 12, padding: 12, maxHeight: 700, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 10px", color: "#bfd4dd", fontSize: 14 }}>سفن الحزمة ({ships.length}/10)</h3>
          {ships.map((ship) => (
            <button key={ship.shipId} type="button" onClick={() => setSelectedId(ship.shipId)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, textAlign: "right", padding: 8, marginBottom: 5, color: "white", cursor: "pointer", borderRadius: 8, border: ship.shipId === selectedId ? "1px solid #ffd36e" : "1px solid rgba(255,255,255,.08)", background: ship.shipId === selectedId ? "rgba(255,211,110,.12)" : "transparent" }}>
              <img src={ship.previewUrl} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} />
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ship.shipId === 10 ? "زعيم المستوى الأول" : `سفينة ${String(ship.shipId).padStart(2, "0")}`}</b><small style={{ color: "#91aab7" }}>{ship.name} · {ship.code}</small></span>
              {ship.file && <CheckCircle2 size={16} color="#4ade80" />}
            </button>
          ))}
          <p style={{ color: "#91aab7", fontSize: 12, lineHeight: 1.7 }}>المطابقة حسب أسماء PNG داخل ZIP: level_01_ship_01 إلى 09 وlevel_01_boss_10. الترتيب يربطها بأول 10 سفن في كتالوج اللعبة.</p>
        </aside>

        <div style={{ minWidth: 0, background: "#061520", borderRadius: 12, padding: 12 }}>
          {previewHtml ? <iframe title="معاينة محرك تأثيرات السفن" sandbox="allow-scripts" srcDoc={previewHtml} style={{ display: "block", width: "100%", height: 720, border: 0, borderRadius: 10, background: "#0e2a3a" }} /> : <div style={{ minHeight: 320, display: "grid", placeItems: "center", color: "#a9c1cc" }}>جارٍ تجهيز معاينة التأثيرات…</div>}
          <p style={{ margin: "8px 4px 0", color: "#91aab7", fontSize: 12 }}>المعاينة تعرض محرك التأثيرات الأصلي: اللمعة، الإصلاح وإعادة التجميع، الضرر، والتدمير. قد يتطلب التحميل الأول بضع ثوانٍ لأن الصور تُجهّز للمعاينة.</p>
          {selectedShip && <p style={{ margin: "6px 4px 0", color: "#ffd36e", fontSize: 12 }}>المختار: {selectedShip.shipId === 10 ? "زعيم المستوى الأول" : `السفينة ${selectedShip.shipId}`} — {selectedShip.name}</p>}
        </div>
      </div>
    </section>
  );
}
