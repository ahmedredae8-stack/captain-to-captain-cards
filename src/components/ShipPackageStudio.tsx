import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, RefreshCw, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { announceArtworkUpdate, artworkUrl, isArtworkAdmin, listArtwork } from "@/lib/artwork";
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
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function filenameToShipNumber(filename: string): number | null {
  const base = filename.split("/").pop()?.toLowerCase() ?? "";
  const ship = base.match(/^level_01_ship_(0[1-9])\.png$/);
  if (ship) return Number(ship[1]);
  if (base === "level_01_boss_10.png") return 10;
  // فحص أي رقم في اسم الملف كبديل
  const anyNum = base.match(/(\d+)/);
  if (anyNum) {
    const n = Number(anyNum[1]);
    if (n >= 1 && n <= 10) return n;
  }
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
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const levelShips = useMemo(() => fleetCatalog.slice(0, LEVEL_ONE_COUNT), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(ENGINE_URL, { cache: "no-store" });
        if (!response.ok) {
          const fallbackResp = await fetch("/index.html", { cache: "no-store" });
          if (!fallbackResp.ok) throw new Error("لم يُعثر على محرك التأثيرات في /ship-effects/index.html");
          const fallbackHtml = await fallbackResp.text();
          if (alive && fallbackHtml.includes("drawShipCondition")) {
            setEngineHtml(fallbackHtml);
            return;
          }
        }
        const html = await response.text();
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
            try { currentUrl = await artworkUrl(storedPath); } catch { /* الاحتفاظ بالصورة الافتراضية */ }
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

        const sourceArray = /const shipSources=\[("data:image\/[^"]+")[\s\S]*?\];/;
        if (!sourceArray.test(engineHtml)) throw new Error("تعذر العثور على قائمة الصور داخل محرك التأثيرات.");
        let html = engineHtml.replace(sourceArray, (_match, originalShip: string) =>
          `const shipSources=[${originalShip},${imageData.map((src) => JSON.stringify(src)).join(",")}];`,
        );
        const queryLine = "const query=new URLSearchParams(location.search);";
        if (html.includes(queryLine)) {
          html = html.replace(queryLine, `${queryLine}query.set('ship',${JSON.stringify(String(selectedId))});`);
        }
        if (alive) setPreviewHtml(html);
      } catch (error) {
        if (alive) setPreviewHtml("");
        if (alive) setEngineError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => { alive = false; };
  }, [engineHtml, ships, selectedId]);

  function handleMultipleImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus("جارٍ ربط الصور المختارة بالسفن…");

    try {
      const fileList = Array.from(files);
      const updated = ships.map((ship, idx) => {
        let matched = fileList.find(f => filenameToShipNumber(f.name) === ship.shipId);
        if (!matched && idx < fileList.length && fileList.length > 1) {
          matched = fileList[idx];
        }
        if (!matched) return ship;

        const objectUrl = URL.createObjectURL(matched);
        objectUrlsRef.current.push(objectUrl);
        return { ...ship, file: matched, previewUrl: objectUrl };
      });

      setShips(updated);
      setStatus(`تم تجهيز ${fileList.length} صورة بنجاح. عاين السفن ثم اضغط «نشر التحديث».`);
    } catch (err) {
      setStatus(`حدث خطأ أثناء معالجة الصور: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    }
  }

  function handleSingleImage(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus("حجم الصورة أكبر من 25 ميجابايت.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlsRef.current.push(objectUrl);

    setShips(prev => prev.map(s => s.shipId === selectedId ? { ...s, file, previewUrl: objectUrl } : s));
    setStatus(`تم تحديث معاينة سفينة (${ships.find(s => s.shipId === selectedId)?.name ?? selectedId}) بنجاح. اضغط «نشر التحديث» لحفظها.`);
    if (singleFileInputRef.current) singleFileInputRef.current.value = "";
  }

  async function publishUpdates() {
    const staged = ships.filter((ship): ship is ShipRow & { file: File } => Boolean(ship.file));
    if (staged.length === 0) {
      setStatus("لا توجد صور جديدة جاهزة للنشر. اختر صوراً أولاً.");
      return;
    }

    setBusy(true);
    setStatus("جارٍ التحقق من صلاحيات الأدمن…");

    try {
      // 1. فحص تسجيل الدخول
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        throw new Error("يجب تسجيل الدخول في اللعبة أولاً بحساب الأدمن قبل الرفع.");
      }

      // 2. فحص صلاحية الأدمن
      const isAdmin = await isArtworkAdmin();
      if (!isAdmin) {
        throw new Error("حسابك لا يمتلك رتبة الأدمن (admin). تأكد من تفعيل صلاحية الأدمن لحسابك في جدول user_roles.");
      }

      setStatus(`جارٍ رفع وحفظ ${staged.length} سفينة…`);

      for (const ship of staged) {
        const ext = ship.file.name.split(".").pop()?.toLowerCase() || "png";
        // المسار الإلزامي المطابق لسياسات Supabase RLS: user_id/filename
        const fileName = `ship-${ship.shipId}-${Date.now()}.${ext}`;
        const storagePath = `${user.id}/${fileName}`;

        // أ) رفع الملف إلى Storage
        const uploadResult = await supabase.storage
          .from("game-artwork")
          .upload(storagePath, ship.file, {
            contentType: ship.file.type || "image/png",
            upsert: true,
          });

        if (uploadResult.error) {
          throw new Error(`فشل رفع ملف ${ship.name}: ${uploadResult.error.message}`);
        }

        // ب) جلب السجلات القديمة لهذه السفينة لتنظيفها لاحقاً
        const { data: oldRows } = await supabase
          .from("artwork_poses")
          .select("id, image_path")
          .eq("category", "ship")
          .eq("subject", `ship-${ship.shipId}`)
          .eq("pose", "idle");

        // ج) إدراج السجل الجديد ببيانات مطابقة لقواعد RLS
        const { error: insertError } = await supabase
          .from("artwork_poses")
          .insert({
            category: "ship",
            subject: `ship-${ship.shipId}`,
            pose: "idle",
            image_path: storagePath,
            created_by: user.id,
          });

        if (insertError) {
          // التراجع عن الملف المرفوع إذا فشل حفظ قاعدة البيانات
          await supabase.storage.from("game-artwork").remove([storagePath]);
          throw new Error(`فشل حفظ سجل ${ship.name}: ${insertError.message}`);
        }

        // د) حذف السجلات والملفات القديمة في التخزين إن وجدت
        if (oldRows && oldRows.length > 0) {
          for (const old of oldRows) {
            await supabase.from("artwork_poses").delete().eq("id", old.id);
            await supabase.storage.from("game-artwork").remove([old.image_path]);
          }
        }
      }

      await announceArtworkUpdate();

      setShips(prev => prev.map(s => s.file ? { ...s, currentUrl: s.previewUrl, file: undefined } : s));
      setStatus(`تم نشر وتحديث ${staged.length} سفينة بنجاح! التحديث أصبح متاحاً باللعبة فوراً.`);
    } catch (error) {
      setStatus(`تعذر النشر: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const selectedShip = ships.find(s => s.shipId === selectedId) ?? ships[0];
  const stagedCount = ships.filter(s => Boolean(s.file)).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", background: "#0b1d28", border: "1px solid rgba(246,194,75,.35)", borderRadius: 12, padding: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#ffd36e" }}>استوديو رفع وتحديث السفن المباشر</h2>
          <p style={{ margin: "4px 0 0", color: "#a9c1cc", fontSize: 13 }}>
            ارفع صور PNG الشفافة مباشرة (سفينة بسفينة أو تحديد متعدد) وتطبيق التحديث باللعبة فورياً.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            ref={multiFileInputRef}
            type="file"
            accept="image/png,image/webp,image/*"
            multiple
            hidden
            onChange={(e) => handleMultipleImages(e.target.files)}
          />
          <Button variant="outline" disabled={busy} onClick={() => multiFileInputRef.current?.click()}>
            <Upload style={{ width: 16, height: 16, marginLeft: 8 }} />
            رفع عدة صور دفعة واحدة
          </Button>

          <input
            ref={singleFileInputRef}
            type="file"
            accept="image/png,image/webp,image/*"
            hidden
            onChange={(e) => handleSingleImage(e.target.files?.[0])}
          />
          <Button variant="secondary" disabled={busy} onClick={() => singleFileInputRef.current?.click()}>
            <ImagePlus style={{ width: 16, height: 16, marginLeft: 8 }} />
            رفع صورة للسفينة المختارة ({selectedShip?.name ?? selectedId})
          </Button>

          <Button disabled={busy || stagedCount === 0} onClick={() => void publishUpdates()}>
            {busy ? <RefreshCw className="animate-spin" style={{ width: 16, height: 16, marginLeft: 8 }} /> : <CheckCircle2 style={{ width: 16, height: 16, marginLeft: 8 }} />}
            نشر التحديث ({stagedCount})
          </Button>
        </div>
      </header>

      {status && (
        <div style={{ background: "#102a3a", border: "1px solid #355870", borderRadius: 8, padding: "10px 14px", color: "#e3f2fd", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{status}</span>
        </div>
      )}

      {engineError && (
        <div style={{ background: "#33161a", border: "1px solid #7f2632", borderRadius: 8, padding: "10px 14px", color: "#ffb4be", fontSize: 13 }}>
          تنبيه المحرك: {engineError} (تأكد من وجود الملف في <code>public/ship-effects/index.html</code>)
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <aside style={{ background: "#0b1d28", border: "1px solid rgba(246,194,75,.2)", borderRadius: 12, padding: 12, display: "grid", gap: 8, maxHeight: 760, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: "#ffd36e", fontSize: 14, fontWeight: "bold" }}>سفن المستوى الأول</span>
            <span style={{ color: "#8da6b5", fontSize: 12 }}>{stagedCount} معدلة</span>
          </div>

          {ships.map((ship) => {
            const isSelected = ship.shipId === selectedId;
            const hasNew = Boolean(ship.file);
            return (
              <div
                key={ship.shipId}
                onClick={() => setSelectedId(ship.shipId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isSelected ? "rgba(246,194,75,.15)" : "#07141d",
                  border: isSelected ? "1px solid #ffd36e" : "1px solid #1a3242",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 6, background: "#0e2a3a", border: "1px solid #244458", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={ship.previewUrl} alt={ship.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: isSelected ? "#fff" : "#cfe0ea", fontWeight: isSelected ? "bold" : "normal" }}>{ship.name}</span>
                    {hasNew && <span style={{ fontSize: 11, background: "#1b4d3e", color: "#68d391", padding: "1px 6px", borderRadius: 4 }}>جديدة</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "#718b99" }}>رقم: {ship.shipId}</span>
                </div>
              </div>
            );
          })}
        </aside>

        <div style={{ minWidth: 0, background: "#061520", borderRadius: 12, padding: 12 }}>
          {previewHtml ? (
            <iframe
              title="معاينة محرك تأثيرات السفن"
              sandbox="allow-scripts"
              srcDoc={previewHtml}
              style={{ display: "block", width: "100%", height: 720, border: 0, borderRadius: 10, background: "#0e2a3a" }}
            />
          ) : (
            <div style={{ minHeight: 320, display: "grid", placeItems: "center", color: "#a9c1cc" }}>
              جارٍ تجهيز معاينة التأثيرات…
            </div>
          )}
          <p style={{ margin: "8px 4px 0", color: "#91aab7", fontSize: 12 }}>
            المعاينة الحية تعرض محرك التأثيرات: اللمعة، الإصلاح وإعادة التجميع، وتفتت الخشب والنيران عند التدمير.
          </p>
        </div>
      </div>
    </div>
  );
}
