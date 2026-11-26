import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  Flame,
  Hammer,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package, Plus,
  RefreshCw,
  Save,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { announceArtworkUpdate, deleteArtwork, isArtworkAdmin, useArtworkMap } from "@/lib/artwork";
import { fleetCatalog, tripLabel, WEAPON_AR, type FleetShip } from "@/lib/fleetCatalog";
import { resolveShipArtwork } from "@/lib/shipArtwork";
import { deleteOverride, saveOverride, useLiveShips, type LiveShip } from "@/lib/shipOverrides";
import { ARMORS, CREWS, WEAPONS } from "@/lib/items";
import { themes } from "@/lib/themes";
import { playSfx } from "@/lib/sound";

type EffectMode = "shine" | "repair" | "damage" | "destroyed" | "none";

type ShipItem = LiveShip;

/**
 * خوارزمية ذكية متقدمة لإزالة الخلفية (البيضاء أو الملونة) وتحويل الصورة إلى PNG شفاف بالكامل
 */
async function removeBackgroundSmart(blob: Blob, tolerance = 35): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  
  // تصغير الأبعاد لتسريع المعالجة والرفع إذا كانت الصورة ضخمة
  const MAX_DIM = 640;
  let targetW = bmp.width;
  let targetH = bmp.height;
  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    if (targetW > targetH) {
      targetH = Math.round((targetH * MAX_DIM) / targetW);
      targetW = MAX_DIM;
    } else {
      targetW = Math.round((targetW * MAX_DIM) / targetH);
      targetH = MAX_DIM;
    }
  }

  const canvas = document.createElement(canvas);
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;

  ctx.drawImage(bmp, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  // فحص ألوان الأركان والأطراف لتحديد لون الخلفية الغالب
  const samples = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [Math.floor(w / 2), 0], [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)], [Math.floor(w / 2), h - 1]
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

  const tolSq = tolerance * tolerance * 3;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 15) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const distSq = dr * dr + dg * dg + db * db;

    if (distSq < tolSq) {
      data[i + 3] = 0;
    } else if (distSq < tolSq * 1.6) {
      const factor = (distSq - tolSq) / (tolSq * 0.6);
      data[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || blob), "image/png");
  });
}

export function ShipPackageStudio() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [studioSection, setStudioSection] = useState<"ships" | "store" | "themes">("ships");

  // سفن اللعبة المباشرة
  const liveShips = useLiveShips(true);
  const artwork = useArtworkMap();

  // تصفية السفن حسب المستوى (Tier)
  const [selectedTier, setSelectedTier] = useState<number | "all">("all");
  const [selectedShipId, setSelectedShipId] = useState<number>(1);

  // حالة الصورة المرفوعة للسفينة المحددة
  const [uploadedBlob, setUploadedBlob] = useState<Blob | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string>("");
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [bgTolerance, setBgTolerance] = useState(38);
  const [isProcessingBg, setIsProcessingBg] = useState(false);

  // تعديل خصائص السفينة (الاسم، السعر، الوصف)
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDesc, setEditDesc] = useState("");
  const [savingOverrides, setSavingOverrides] = useState(false);

  // معاينة التأثيرات التفاعلية
  const [activeEffect, setActiveEffect] = useState<EffectMode>("shine");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // حالة الرفع والنشر
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  // قسم منتجات المتجر
  const [storeCategory, setStoreCategory] = useState<"weapons" | "crew" | "armor">("weapons");
  const [selectedStoreItemId, setSelectedStoreItemId] = useState<string>(WEAPONS[0].id);
  const [storeUploadedBlob, setStoreUploadedBlob] = useState<Blob | null>(null);
  const [storeUploadedPreview, setStoreUploadedPreview] = useState<string>("");
  const [storeUploading, setStoreUploading] = useState(false);

  // فحص صلاحيات الأدمن
  useEffect(() => {
    void isArtworkAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, []);

  // السفن المصفاة حسب المستوى
  const filteredShips = useMemo(() => {
    if (selectedTier === "all") return liveShips;
    return liveShips.filter((s) => s.data.tier === selectedTier);
  }, [liveShips, selectedTier]);

  // السفينة المحددة حالياً
  const currentShip = useMemo(() => {
    return liveShips.find((s) => s.id === selectedShipId) || liveShips[0];
  }, [liveShips, selectedShipId]);

  // تحديث حقول التعديل عند تغيير السفينة
  useEffect(() => {
    if (currentShip) {
      setEditName(currentShip.name);
      setEditPrice(currentShip.price);
      setEditDesc(currentShip.description || "");
      setUploadedBlob(null);
      setUploadedPreview("");
    }
  }, [currentShip?.id]);

  // الصورة الحالية للسفينة (من السوبابيز أو الأصلية)
  const currentShipArtUrl = useMemo(() => {
    if (!currentShip) return "";
    return resolveShipArtwork(artwork, currentShip.id, "idle", currentShip.photo);
  }, [artwork, currentShip]);

  // إرسال الصورة والحالة إلى محرك التأثيرات (iframe)
  const syncIframeEffects = (dataUrl: string, mode: EffectMode) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "SET_SHIP_IMAGE", dataUrl },
        "*"
      );
      iframeRef.current.contentWindow.postMessage(
        { type: "SET_EFFECT_MODE", mode },
        "*"
      );
    }
  };

  // تحديث المعاينة في المحرك عند تغيير التأثير أو الصورة
  useEffect(() => {
    const url = uploadedPreview || currentShipArtUrl;
    if (url) {
      syncIframeEffects(url, activeEffect);
    }
  }, [uploadedPreview, currentShipArtUrl, activeEffect]);

  // معالجة اختيار صورة السفينة (منفردة أو متعددة أو ZIP)
  const handleShipFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setStatusMsg({ text: "جاري قراءة ومعالجة صورة السفينة...", type: "info" });
    setIsProcessingBg(true);

    try {
      let finalBlob: Blob = file;
      if (autoRemoveBg) {
        finalBlob = await removeBackgroundSmart(file, bgTolerance);
      }
      setUploadedBlob(finalBlob);
      const url = URL.createObjectURL(finalBlob);
      setUploadedPreview(url);
      setStatusMsg({
        text: `تم تجهيز الصورة بنجاح${autoRemoveBg ? " مع تفريغ الخلفية الشفافة" : ""}. يمكنك معاينة التأثيرات ونشرها.`,
        type: "ok",
      });
      playSfx("click", 0.8);
    } catch (err: any) {
      setStatusMsg({ text: `تعذر تجهيز الصورة: ${err.message}`, type: "err" });
    } finally {
      setIsProcessingBg(false);
    }
  };

  // إعادة تطبيق حذف الخلفية عند تغيير حساسية التسامح (Tolerance)
  const reprocessCurrentBg = async () => {
    if (!uploadedBlob) return;
    setIsProcessingBg(true);
    try {
      const refined = await removeBackgroundSmart(uploadedBlob, bgTolerance);
      setUploadedBlob(refined);
      const url = URL.createObjectURL(refined);
      setUploadedPreview(url);
      setStatusMsg({ text: `تم تحديث تفريغ الخلفية بحساسية (${bgTolerance}).`, type: "ok" });
    } catch (e: any) {
      setStatusMsg({ text: `خطأ في المعالجة: ${e.message}`, type: "err" });
    } finally {
      setIsProcessingBg(false);
    }
  };

  // حفظ خصائص السفينة (الاسم، السعر، الوصف) في ship_overrides
  const handleSaveShipOverrides = async () => {
    if (!currentShip) return;
    setSavingOverrides(true);
    setStatusMsg({ text: "جاري حفظ خصائص السفينة...", type: "info" });

    try {
      const err = await saveOverride({
        product_id: `ship-${currentShip.id}`,
        name: editName.trim() || null,
        price: Number(editPrice) || null,
        description: editDesc.trim() || null,
        hidden: currentShip.hidden || false,
      });

      if (err) throw err;

      setStatusMsg({ text: `تم بنجاح حفظ خصائص (${editName}) وتحديثها لجميع اللاعبين!`, type: "ok" });
      playSfx("click", 1);
    } catch (e: any) {
      setStatusMsg({ text: `فشل حفظ الخصائص: ${e.message}`, type: "err" });
    } finally {
      setSavingOverrides(false);
    }
  };

  // رفع صورة السفينة وتثبيتها في اللعبة بقاعدة بيانات Supabase
  const handleUploadShipArtwork = async () => {
    if (!currentShip || !uploadedBlob) {
      setStatusMsg({ text: "يرجى اختيار صورة للسفينة أولاً.", type: "err" });
      return;
    }

    setUploading(true);
    setStatusMsg({ text: "جاري رفع الصورة الشفافة وتحديث قاعدة البيانات...", type: "info" });
    playSfx("click", 0.7);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول بحساب المشرف.");

      // 1. رفع الصورة إلى Storage bucket game-artwork
      const fileName = `ship-${currentShip.id}-${Date.now()}.png`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("game-artwork")
        .upload(storagePath, uploadedBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (upErr) throw new Error(`فشل رفع الصورة إلى التخزين السحابي: ${upErr.message}`);

      // 2. تحديث جدول artwork_poses للسفينة المحددة
      // حذف أي سجل idle قديم لنفس السفينة لعدم التكرار
      await supabase
        .from("artwork_poses")
        .delete()
        .eq("category", "ship")
        .eq("subject", `ship-${currentShip.id}`)
        .eq("pose", "idle");

      // إدراج السجل الجديد المطابق لمخطط قاعدة البيانات
      const { error: insertErr } = await supabase
        .from("artwork_poses")
        .insert({
          category: "ship",
          subject: `ship-${currentShip.id}`,
          pose: "idle",
          image_path: storagePath,
          created_by: user.id,
        });

      if (insertErr) throw new Error(`فشل تسجيل الصورة في قاعدة البيانات: ${insertErr.message}`);

      // 3. حفظ الخصائص أيضاً إذا تم تعديلها
      await saveOverride({
        product_id: `ship-${currentShip.id}`,
        name: editName.trim() || null,
        price: Number(editPrice) || null,
        description: editDesc.trim() || null,
        hidden: currentShip.hidden || false,
      });

      // 4. إشعار جميع اللاعبين بالتحديث اللحظي
      await announceArtworkUpdate();

      setStatusMsg({
        text: `تم بنجاح رفع وتثبيت سفينة (${editName}) في اللعبة! ستظهر لجميع اللاعبين وفي المعارك وسوق السفن فوراً.`,
        type: "ok",
      });
      playSfx("click", 1);
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء الرفع.", type: "err" });
    } finally {
      setUploading(false);
    }
  };

  // منتجات المتجر المتاحة
  const currentStoreItems = useMemo(() => {
    if (storeCategory === "weapons") return WEAPONS;
    if (storeCategory === "crew") return CREWS;
    return ARMORS;
  }, [storeCategory]);

  const activeStoreItem = useMemo(() => {
    return currentStoreItems.find((i) => i.id === selectedStoreItemId) || currentStoreItems[0];
  }, [currentStoreItems, selectedStoreItemId]);

  // رفع وتثبيت صورة منتج المتجر
  const handleStoreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const transparent = autoRemoveBg ? await removeBackgroundSmart(file, 35) : file;
      setStoreUploadedBlob(transparent);
      setStoreUploadedPreview(URL.createObjectURL(transparent));
      setStatusMsg({ text: "تم تجهيز صورة المنتج للتثبيت في المتجر.", type: "ok" });
    } catch (err: any) {
      setStatusMsg({ text: `تعذر معالجة صورة المنتج: ${err.message}`, type: "err" });
    }
  };

  const handlePublishStoreItem = async () => {
    if (!activeStoreItem || !storeUploadedBlob) {
      setStatusMsg({ text: "اختر صورة للمنتج أولاً.", type: "err" });
      return;
    }
    setStoreUploading(true);
    setStatusMsg({ text: "جاري نشر صورة المنتج في المتجر...", type: "info" });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول بحساب المشرف.");

      const fileName = `store-${activeStoreItem.id}-${Date.now()}.png`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("game-artwork")
        .upload(storagePath, storeUploadedBlob, { contentType: "image/png", upsert: true });

      if (upErr) throw upErr;

      const subjectKey = storeCategory === "weapons"
        ? activeStoreItem.id
        : `store:${storeCategory === "crew" ? "crew" : "shield"}-${activeStoreItem.id}`;

      // حذف القديم إن وجد
      await supabase
        .from("artwork_poses")
        .delete()
        .eq("subject", subjectKey)
        .eq("pose", "idle");

      // استخدام الفئات المتوافقة مع القيود (rocket للمقذوفات والأسلحة والدروع)
      const category = storeCategory === "weapons" ? "rocket" : "rocket";

      const { error: insErr } = await supabase
        .from("artwork_poses")
        .insert({
          category,
          subject: subjectKey,
          pose: "idle",
          image_path: storagePath,
          created_by: user.id,
        });

      if (insErr) throw insErr;

      await announceArtworkUpdate();
      setStatusMsg({
        text: `تم بنجاح تحديث ونشر صورة (${activeStoreItem.name}) في المتجر لجميع اللاعبين!`,
        type: "ok",
      });
      playSfx("click", 1);
    } catch (e: any) {
      setStatusMsg({ text: `فشل نشر صورة المنتج: ${e.message}`, type: "err" });
    } finally {
      setStoreUploading(false);
    }
  };

  return (
    <section className="ship-studio-container" dir="rtl" style={{ marginTop: 12 }}>
      {/* شريط الإشعارات والرسائل */}
      {statusMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background:
              statusMsg.type === "ok"
                ? "rgba(46, 204, 113, 0.15)"
                : statusMsg.type === "err"
                ? "rgba(231, 76, 60, 0.15)"
                : "rgba(52, 152, 219, 0.15)",
            border: `1px solid ${
              statusMsg.type === "ok"
                ? "#2ecc71"
                : statusMsg.type === "err"
                ? "#e74c3c"
                : "#3498db"
            }`,
            color: "#fff",
            fontSize: 14,
          }}
        >
          {statusMsg.type === "ok" && <CheckCircle2 size={18} color="#2ecc71" />}
          {statusMsg.type === "err" && <AlertTriangle size={18} color="#e74c3c" />}
          {statusMsg.type === "info" && <Loader2 size={18} className="animate-spin" color="#3498db" />}
          <span style={{ flex: 1 }}>{statusMsg.text}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* التبويبات الرئيسية للاستوديو */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setStudioSection("ships")}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: studioSection === "ships" ? "linear-gradient(135deg, #f39c12, #d35400)" : "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "none",
          }}
        >
          <Sparkles size={18} /> رفع وتطوير السفن والمستويات
        </button>

        <button
          type="button"
          onClick={() => setStudioSection("store")}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: studioSection === "store" ? "linear-gradient(135deg, #9b59b6, #8e44ad)" : "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "none",
          }}
        >
          <ShoppingBag size={18} /> تعديل صور منتجات المتجر
        </button>

        <button
          type="button"
          onClick={() => setStudioSection("themes")}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: studioSection === "themes" ? "linear-gradient(135deg, #2980b9, #2c3e50)" : "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "none",
          }}
        >
          <Layers size={18} /> ملف الخلفيات وحريق الجزيرة
        </button>
      </div>

      {/* ────────────────── القسم الأول: استوديو السفن والمستويات ────────────────── */}
      {studioSection === "ships" && (
        <div>
          {/* شريط اختيار المستوى (Tier Selector) */}
          <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: "16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontWeight: 700, color: "#f1c40f", fontSize: 16 }}>
                اختر المستوى لتنظيم السفن ورفع صورها:
              </span>
              <span style={{ fontSize: 13, color: "#888" }}>
                إجمالي السفن: {liveShips.length} سفينة
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedTier("all")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: selectedTier === "all" ? 700 : 500,
                  background: selectedTier === "all" ? "#f39c12" : "rgba(255,255,255,0.08)",
                  color: selectedTier === "all" ? "#111" : "#fff",
                  border: "none",
                }}
              >
                جميع السفن ({liveShips.length})
              </button>

              {availableTiers.map((t) => {
                const count = liveShips.filter((s) => s.data.tier === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTier(t)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: selectedTier === t ? 700 : 500,
                      background: selectedTier === t ? "#f39c12" : "rgba(255,255,255,0.08)",
                      color: selectedTier === t ? "#111" : "#fff",
                      border: "none",
                    }}
                  >
                    مستوى {t} ({count})
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowAddShipModal(true)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                  color: "#fff",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(46, 204, 113, 0.4)",
                }}
              >
                <Plus size={15} /> إضافة سفينة / مستوى جديد
              </button>
            </div>
          </div>

          {/* قائمة السفن في المستوى المختار وبطاقة السفينة الحالية */}
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
            {/* القائمة الجانبية للسفن */}
            <div style={{ background: "rgba(15, 20, 30, 0.8)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", maxHeight: 600, overflowY: "auto", padding: 10 }}>
              <div style={{ padding: "6px 10px", fontSize: 13, color: "#aaa", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
                اختر السفينة المستهدفة:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredShips.map((ship) => {
                  const isCur = ship.id === selectedShipId;
                  const thumb = resolveShipArtwork(artwork, ship.id, "idle", ship.photo);
                  return (
                    <button
                      key={ship.id}
                      type="button"
                      onClick={() => {
                        setSelectedShipId(ship.id);
                        playSfx("click", 0.5);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: isCur ? "rgba(243, 156, 18, 0.2)" : "rgba(255,255,255,0.03)",
                        border: isCur ? "1px solid #f39c12" : "1px solid transparent",
                        cursor: "pointer",
                        color: "#fff",
                        textAlign: "right",
                        width: "100%",
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 6, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        <img src={thumb} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <strong style={{ display: "block", fontSize: 14, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                          {ship.name}
                        </strong>
                        <span style={{ fontSize: 12, color: "#888" }}>
                          مستوى {ship.data.tier} · {ship.data.class_ar}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#f1c40f" }}>
                        {ship.price ? `${ship.price.toLocaleString("ar-EG")}` : "مجاناً"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* تفاصيل السفينة المحددة، الرفع، المعاينة، والتعديل */}
            {currentShip && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* بطاقة معلومات وتعديل السفينة */}
                <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: "#f39c12", display: "flex", alignItems: "center", gap: 8 }}>
                        <Package size={20} /> تفاصيل وتخصيص ({currentShip.name})
                      </h3>
                      <span style={{ fontSize: 12, color: "#888" }}>
                        معرف السفينة: #{currentShip.id} · المستوى {currentShip.data.tier} · {currentShip.data.class_ar}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleSaveShipOverrides}
                        disabled={savingOverrides}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          background: "#27ae60",
                          color: "#fff",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {savingOverrides ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        حفظ الخصائص
                      </button>
                    </div>
                  </div>

                  {/* تعديل الاسم والسعر والوصف */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                        اسم السفينة في اللعبة:
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                        سعر السفينة في السوق (عملات):
                      </label>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                      وصف السفينة أو قصتها (يظهر للاعبين):
                    </label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="أدخل وصفاً مشوقاً للسفينة..."
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                      }}
                    />
                  </div>
                </div>

                {/* منطقة رفع الصورة وتفريغ الخلفية الشفافة */}
                <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h4 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                    <ImageIcon size={18} color="#f39c12" /> رفع صورة السفينة وحذف الخلفية تلقائياً
                  </h4>

                  {/* إعدادات حذف الخلفية الشفافة */}
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px 16px", borderRadius: 8, marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={autoRemoveBg}
                        onChange={(e) => setAutoRemoveBg(e.target.checked)}
                      />
                      <span>حذف وتفريغ الخلفية تلقائياً (تصبح شفافة 100%)</span>
                    </label>

                    {autoRemoveBg && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#aaa" }}>حساسية التفريغ: {bgTolerance}</span>
                        <input
                          type="range"
                          min="15"
                          max="65"
                          step="1"
                          value={bgTolerance}
                          onChange={(e) => setBgTolerance(Number(e.target.value))}
                          style={{ width: 100 }}
                        />
                        {uploadedBlob && (
                          <button
                            type="button"
                            onClick={reprocessCurrentBg}
                            disabled={isProcessingBg}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.1)",
                              color: "#fff",
                              border: "none",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            تطبيق الحساسية
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* صندوق السحب والإفلات / اختيار الملف */}
                  <div style={{ border: "2px dashed rgba(243, 156, 18, 0.4)", borderRadius: 10, padding: "24px", textAlign: "center", background: "rgba(0,0,0,0.2)" }}>
                    <input
                      type="file"
                      id="ship-upload-input"
                      accept="image/png,image/jpeg,image/webp,.zip"
                      onChange={handleShipFileSelect}
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="ship-upload-input"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 24px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #f39c12, #e67e22)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginBottom: 8,
                      }}
                    >
                      <Upload size={18} /> اختر صورة للسفينة (أو مجلد ZIP)
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                      يدعم PNG ، JPG ، WebP ، وتفريغ الخلفيات البيضاء والرمادية والملونة لتصبح بدون خلفية.
                    </p>
                  </div>

                  {/* معاينة الصورة المرفوعة ومقارنتها */}
                  {uploadedPreview && (
                    <div style={{ marginTop: 20, display: "flex", gap: 20, alignItems: "center", background: "rgba(0,0,0,0.4)", padding: 16, borderRadius: 10 }}>
                      <div
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: 8,
                          /* نمط مربعات الشفافية الشائع للتأكد من خلوها من الخلفية */
                          backgroundImage:
                            "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)",
                          backgroundSize: "16px 16px",
                          backgroundColor: "#111",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        <img src={uploadedPreview} alt="معاينة الشفافية" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2ecc71", fontWeight: 700, marginBottom: 6 }}>
                          <CheckCircle2 size={16} /> الصورة جاهزة ومفرغة من الخلفية تماماً!
                        </div>
                        <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#bbb" }}>
                          يمكنك تجربة تأثيرات اللمعة والإصلاح والتدمير عليها بالأسفل، ثم الضغط على زر التثبيت.
                        </p>
                        <button
                          type="button"
                          onClick={handleUploadShipArtwork}
                          disabled={uploading}
                          style={{
                            padding: "10px 24px",
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                            color: "#fff",
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 15,
                            boxShadow: "0 4px 14px rgba(46, 204, 113, 0.4)",
                          }}
                        >
                          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                          رفع وتثبيت السفينة في اللعبة الآن
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* نافذة معاينة التأثيرات التفاعلية (Canvas Effects) */}
                <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkles size={18} color="#f1c40f" /> معاينة التأثيرات الحية (محرك القتال والتأثيرات)
                    </h4>

                    {/* أزرار التبديل بين أوضاع التأثير */}
                    <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.5)", padding: 4, borderRadius: 8 }}>
                      <button
                        type="button"
                        onClick={() => setActiveEffect("shine")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: activeEffect === "shine" ? "#f39c12" : "transparent",
                          color: activeEffect === "shine" ? "#111" : "#aaa",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        اللمعة الذهبية
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEffect("repair")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: activeEffect === "repair" ? "#2ecc71" : "transparent",
                          color: activeEffect === "repair" ? "#111" : "#aaa",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        الإصلاح والترميم
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEffect("damage")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: activeEffect === "damage" ? "#e67e22" : "transparent",
                          color: activeEffect === "damage" ? "#111" : "#aaa",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        الضرر والاشتعال
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEffect("destroyed")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: activeEffect === "destroyed" ? "#e74c3c" : "transparent",
                          color: activeEffect === "destroyed" ? "#fff" : "#aaa",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        التدمير والانفجار
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveEffect("none")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: activeEffect === "none" ? "#7f8c8d" : "transparent",
                          color: activeEffect === "none" ? "#fff" : "#aaa",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        بدون مؤثرات
                      </button>
                    </div>
                  </div>

                  {/* إطار عرض محرك التأثيرات index.html */}
                  <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", background: "#060913", height: 380 }}>
                    <iframe
                      ref={iframeRef}
                      src="/ship-effects/index.html"
                      style={{ width: "100%", height: "100%", border: "none" }}
                      title="معاينة مؤثرات السفن"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── القسم الثاني: استوديو منتجات المتجر ────────────────── */}
      {studioSection === "store" && (
        <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 18, color: "#9b59b6", display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingBag size={20} /> تخصيص وتعديل صور أي منتج في المتجر بدون استثناء
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              يمكنك رفع وتحديث صور الصواريخ والأسلحة، الدروع والتحصينات، طاقم البحارة والمصلحين. وتظهر لجميع اللاعبين فوراً!
            </p>
          </div>

          {/* تبديل فئة المنتج */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => { setStoreCategory("weapons"); setSelectedStoreItemId(WEAPONS[0].id); }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: storeCategory === "weapons" ? "#9b59b6" : "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              🚀 الصواريخ والأسلحة ({WEAPONS.length})
            </button>

            <button
              type="button"
              onClick={() => { setStoreCategory("crew"); setSelectedStoreItemId(CREWS[0].id); }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: storeCategory === "crew" ? "#9b59b6" : "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              👥 طاقم البحارة والمصلحين ({CREWS.length})
            </button>

            <button
              type="button"
              onClick={() => { setStoreCategory("armor"); setSelectedStoreItemId(ARMORS[0].id); }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: storeCategory === "armor" ? "#9b59b6" : "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              🛡️ الدروع والتحصينات ({ARMORS.length})
            </button>
          </div>

          {/* شبكة العناصر في الفئة */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            {currentStoreItems.map((item: any) => {
              const isSel = item.id === selectedStoreItemId;
              const storeKey = storeCategory === "weapons" ? item.id : `store:${storeCategory === "crew" ? "crew" : "shield"}-${item.id}`;
              const customArt = artwork[`${storeKey}:idle`] || artwork[`${item.id}:idle`];
              const displayImg = customArt || item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedStoreItemId(item.id);
                    setStoreUploadedBlob(null);
                    setStoreUploadedPreview("");
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: isSel ? "rgba(155, 89, 182, 0.2)" : "rgba(255,255,255,0.03)",
                    border: isSel ? "1px solid #9b59b6" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 6, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {displayImg ? (
                      <img src={displayImg} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <Shield size={24} color="#9b59b6" />
                    )}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 13, color: "#fff" }}>{item.name}</strong>
                    <span style={{ fontSize: 11, color: "#888" }}>{item.desc || `${item.price} عملة`}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* منطقة رفع وحفظ صورة المنتج المحدد */}
          {activeStoreItem && (
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 16, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <strong style={{ fontSize: 15, color: "#fff" }}>
                  تحديث صورة: {activeStoreItem.name}
                </strong>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#aaa" }}>
                  ارفع صورة جديدة مفرغة الخلفية لتظهر مكان صورة المنتج الحالية في المتجر.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="file"
                  id="store-item-upload"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleStoreFileSelect}
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="store-item-upload"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <Upload size={16} /> اختيار صورة جديدة
                </label>
                <button
                  type="button"
                  onClick={handleResetStoreItemArt}
                  disabled={storeUploading}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "rgba(230, 126, 34, 0.2)",
                    border: "1px solid #e67e22",
                    color: "#e67e22",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <RefreshCw size={15} /> تعطيل الصورة المخصصة واستعادة الأصلية
                </button>


                {storeUploadedPreview && (
                  <button
                    type="button"
                    onClick={handlePublishStoreItem}
                    disabled={storeUploading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      background: "#27ae60",
                      color: "#fff",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    {storeUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    نشر الصورة في المتجر
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── القسم الثالث: ملف الخلفيات وحريق الجزيرة ────────────────── */}
      {studioSection === "themes" && (
        <div style={{ background: "rgba(20, 25, 35, 0.7)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#3498db", display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={20} /> ملف الخلفيات وأوضاع المشاهد (حريق الجزيرة والنهار والليل)
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#aaa" }}>
            يتم إدارة خلفيات اللعبة عبر ملف <code style={{ color: "#f1c40f" }}>src/lib/themes.ts</code> والذي يدعم:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              <strong style={{ color: "#f39c12", display: "block", marginBottom: 6 }}>1. وضعية ضوء الشمس (day)</strong>
              <span style={{ fontSize: 12, color: "#888" }}>تظهر تلقائياً من الساعة 6 صباحاً حتى 6 مساءً في توقيت اللاعب.</span>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              <strong style={{ color: "#3498db", display: "block", marginBottom: 6 }}>2. وضعية ضوء القمر (night)</strong>
              <span style={{ fontSize: 12, color: "#888" }}>تظهر تلقائياً من الساعة 6 مساءً حتى 6 صباحاً مع أصوات الأمواج الهادئة.</span>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              <strong style={{ color: "#e74c3c", display: "block", marginBottom: 6 }}>3. وضعية حريق الجزيرة (burned)</strong>
              <span style={{ fontSize: 12, color: "#888" }}>تتفعل تلقائياً عندما تتعرض الجزيرة لهجوم أو غارة صواريخ من قراصنة آخرين!</span>
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.5)", padding: 16, borderRadius: 8, fontFamily: "monospace", fontSize: 12, color: "#eee", direction: "ltr", overflowX: "auto" }}>
            {`// نموذج إضافة المشهد المحترق في src/lib/themes.ts:
export const themes: Theme[] = [
  {
    id: "throne-coast",
    name: "ساحل العرش",
    day: { video: "", poster: throneCoastImg.url },
    night: { video: "", poster: throneCoastImg.url },
    burned: { video: "", poster: "/assets/scenes/throne-coast-burned.jpg" }, // حريق الجزيرة
    ambient: { day: "waves", night: "night" },
  },
];`}
          </div>
        </div>
      )}

      {/* ────────────────── نافذة منبثقة: إضافة سفينة أو مستوى جديد ────────────────── */}
      {showAddShipModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddShipModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: "linear-gradient(180deg, #182236 0%, #0d1422 100%)",
              border: "2px solid #2ecc71",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(46, 204, 113, 0.2)",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#2ecc71", display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={20} /> إضافة سفينة جديدة وتحديد مستواها
              </h3>
              <button
                type="button"
                onClick={() => setShowAddShipModal(false)}
                style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>المستوى (Tier):</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={newShipTier}
                  onChange={(e) => setNewShipTier(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>اسم السفينة:</label>
                <input
                  type="text"
                  placeholder="مثال: غضب المحيط الملكي"
                  value={newShipName}
                  onChange={(e) => setNewShipName(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>الفئة البحرية:</label>
                <input
                  type="text"
                  value={newShipClass}
                  onChange={(e) => setNewShipClass(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>العملة والسعر:</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="number"
                    value={newShipPrice}
                    onChange={(e) => setNewShipPrice(Number(e.target.value))}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  />
                  <select
                    value={newShipCurrency}
                    onChange={(e) => setNewShipCurrency(e.target.value as any)}
                    style={{ padding: "8px", borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  >
                    <option value="gold">🪙 ذهب</option>
                    <option value="gem">💎 جواهر</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>نقاط الصحة (HP):</label>
                <input
                  type="number"
                  value={newShipHp}
                  onChange={(e) => setNewShipHp(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>السرعة (عقدة):</label>
                <input
                  type="number"
                  value={newShipSpeed}
                  onChange={(e) => setNewShipSpeed(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 4 }}>وصف السفينة أو قصتها:</label>
              <textarea
                rows={2}
                placeholder="وصف مشوق للسفينة يظهر في المتجر والأسطول..."
                value={newShipDesc}
                onChange={(e) => setNewShipDesc(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
              />
            </div>

            {/* اختيار صورة السفينة مع إزالة الخلفية السريعة */}
            <div style={{ marginBottom: 16, background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, border: "1px dashed rgba(46, 204, 113, 0.4)" }}>
              <label style={{ display: "block", fontSize: 12, color: "#2ecc71", fontWeight: 700, marginBottom: 6 }}>
                صورة السفينة (تفريغ فوري شفاف):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const transparent = await removeBackgroundSmart(f, 35);
                  setNewShipBlob(transparent);
                  setNewShipPreview(URL.createObjectURL(transparent));
                }}
                style={{ color: "#aaa", fontSize: 12 }}
              />
              {newShipPreview && (
                <div style={{ marginTop: 8, width: 64, height: 64, background: "#111", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                  <img src={newShipPreview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddShipModal(false)}
                style={{ padding: "8px 16px", borderRadius: 6, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateNewShip}
                disabled={creatingShip}
                style={{
                  padding: "8px 22px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                  color: "#fff",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {creatingShip ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                حفظ ونشر السفينة
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
