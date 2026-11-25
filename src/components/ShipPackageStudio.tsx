import React, { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, Wrench, Flame, Skull, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { announceArtworkUpdate, artworkUrl, listArtwork } from "@/lib/artwork";
import { fleetCatalog } from "@/lib/fleetCatalog";

type FxMode = "shine" | "repair" | "damage" | "destroy" | "none";

interface StagedShip {
  shipId: number;
  shipCode: string;
  name: string;
  file?: File;
  previewUrl: string;
  isCustom: boolean;
}

function clampFx(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function smoothFx(v: number) {
  v = clampFx(v, 0, 1);
  return v * v * (3 - 2 * v);
}

export function ShipPackageStudio() {
  const [ships, setShips] = useState<StagedShip[]>([]);
  const [selectedId, setSelectedId] = useState<number>(1);
  const [fxMode, setFxMode] = useState<FxMode>("shine");
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const modeStartedAtRef = useRef<number>(performance.now());
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function loadCurrent() {
      try {
        const rows = await listArtwork();
        const shipRows = rows.filter((r) => r.category === "ship" && r.pose === "idle");
        const urlMap: Record<string, string> = {};

        for (const row of shipRows) {
          try {
            urlMap[row.subject] = await artworkUrl(row.image_path);
          } catch {
            // fallback
          }
        }

        const list: StagedShip[] = fleetCatalog.map((s) => {
          const key = `ship-${s.id}`;
          const currentUrl = urlMap[key] || s.hull;
          return {
            shipId: s.id,
            shipCode: s.code,
            name: s.name,
            previewUrl: currentUrl,
            isCustom: Boolean(urlMap[key]),
          };
        });

        setShips(list);
      } catch (err) {
        console.error("Failed to load artworks", err);
      }
    }
    void loadCurrent();
  }, []);

  const currentShip = ships.find((s) => s.shipId === selectedId) || ships[0];

  useEffect(() => {
    if (!currentShip?.previewUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentShip.previewUrl;
    img.onload = () => {
      activeImgRef.current = img;
      modeStartedAtRef.current = performance.now();
    };
  }, [currentShip?.previewUrl]);

  function switchMode(m: FxMode) {
    setFxMode(m);
    modeStartedAtRef.current = performance.now();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    function render(now: number) {
      if (!running || !canvas || !ctx) return;
      const W = (canvas.width = 800);
      const H = (canvas.height = 560);

      ctx.clearRect(0, 0, W, H);
      const img = activeImgRef.current;
      const elapsed = Math.max(0, (now - modeStartedAtRef.current) / 1000);
      const power = 1.3;

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        const scale = Math.min((W * 0.7) / img.naturalWidth, (H * 0.7) / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;

        if (fxMode === "repair") {
          drawRepairSpotlight(ctx, W, H, now, power);
        }

        if (fxMode === "destroy" || fxMode === "damage") {
          drawSmokeBehind(ctx, W, H, now, power, fxMode === "destroy");
        }

        if (fxMode === "destroy") {
          drawBrokenShip(ctx, img, dx, dy, dw, dh, now);
          drawFire(ctx, W, H, now, power, elapsed);
          drawDebris(ctx, W, H, now, power, elapsed);
          drawSmokeFront(ctx, W, H, now, power);
        } else {
          if (fxMode === "damage") {
            ctx.filter = "grayscale(30%) brightness(85%) contrast(115%)";
          }
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.filter = "none";

          if (fxMode === "damage") {
            drawFire(ctx, W, H, now, power * 0.5, elapsed);
            drawSmokeFront(ctx, W, H, now, power * 0.6);
          }
        }

        if (fxMode === "repair") {
          drawRepairCondition(ctx, W, H, now, power, elapsed);
          drawRepairSpiral(ctx, W, H, now, true, power);
        }

        if (fxMode === "shine") {
          drawGoldenShine(ctx, dx, dy, dw, dh, now);
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fxMode, selectedId]);

  function drawGoldenShine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, now: number) {
    ctx.save();
    const period = 3000;
    const t = (now % period) / period;
    const gradX = x - w + t * (w * 3);

    const grad = ctx.createLinearGradient(gradX, y, gradX + w * 0.5, y + h);
    grad.addColorStop(0, "rgba(255, 215, 0, 0)");
    grad.addColorStop(0.5, "rgba(255, 238, 160, 0.55)");
    grad.addColorStop(1, "rgba(255, 215, 0, 0)");

    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawRepairSpiral(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, front: boolean, power: number) {
    const elapsed = (now - modeStartedAtRef.current) / 1000;
    const rise = smoothFx(elapsed / 1.8);
    if (rise < 0.01) return;
    const cx = W * 0.5;
    const steps = Math.max(8, Math.floor(rise * 190));
    const activation = Math.min(0.95, (front ? 0.62 : 0.28) * power * (0.35 + 0.65 * rise));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= steps; i++) {
      const u = (rise * i) / steps;
      const theta = u * Math.PI * 2 * 1.18 - now * 0.0019;
      const depth = Math.cos(theta);
      if (depth > 0 !== front) {
        drawing = false;
        continue;
      }
      const rx = W * (0.13 + 0.24 * Math.sin(Math.PI * u));
      const px = cx + Math.sin(theta) * rx;
      const py = H * (0.95 - 0.74 * u);
      if (!drawing) {
        ctx.moveTo(px, py);
        drawing = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.globalAlpha = activation;
    ctx.strokeStyle = "rgba(115, 232, 255, 0.95)";
    ctx.lineWidth = W * (front ? 0.012 : 0.007);
    ctx.shadowColor = front ? "#86eaff" : "#f8d28c";
    ctx.shadowBlur = W * (front ? 0.022 : 0.012);
    ctx.stroke();
    ctx.restore();
  }

  function drawRepairSpotlight(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number) {
    const cx = W * 0.5;
    const sourceY = H * 0.965;
    const shipY = H * 0.4;
    const pulse = 0.78 + 0.22 * Math.sin(now * 0.0031);
    const elapsed = (now - modeStartedAtRef.current) / 1000;
    const activation = smoothFx(elapsed / 0.4);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cone = ctx.createLinearGradient(0, shipY, 0, sourceY);
    cone.addColorStop(0, "rgba(255,230,169,0)");
    cone.addColorStop(0.3, `rgba(119,224,255,${0.18 * power * activation})`);
    cone.addColorStop(0.7, `rgba(255,205,107,${0.4 * power * pulse * activation})`);
    cone.addColorStop(1, `rgba(255,246,209,${0.75 * power * pulse * activation})`);

    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.38, shipY);
    ctx.lineTo(cx + W * 0.38, shipY);
    ctx.lineTo(cx + W * 0.055, sourceY);
    ctx.lineTo(cx - W * 0.055, sourceY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRepairCondition(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number, elapsed: number) {
    const cx = W * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const phase = (elapsed * 0.34 + i / 40) % 1;
      const px = cx + Math.sin(now * 0.0018 + i * 2.17) * W * (0.02 + phase * 0.16);
      const py = H * (0.95 - phase * 0.56);
      const r = W * 0.004;
      const alpha = Math.sin(Math.PI * phase) * power * 0.7;
      ctx.fillStyle = `rgba(142,237,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSmokeBehind(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number, destroyed: boolean) {
    const elapsed = Math.max(0, (now - modeStartedAtRef.current) / 1000);
    ctx.save();
    const count = destroyed ? 24 : 10;
    for (let i = 0; i < count; i++) {
      const phase = (elapsed * 0.2 + i * 0.08) % 1;
      const px = W * (0.2 + (i % 5) * 0.15) + Math.sin(now * 0.0007 + i) * W * 0.02;
      const py = H * (0.82 - phase * (destroyed ? 0.45 : 0.3));
      const r = W * (0.015 + phase * 0.05);
      const alpha = (1 - phase) * (destroyed ? 0.4 : 0.18) * Math.min(1.4, power);
      ctx.fillStyle = `rgba(80,80,80,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSmokeFront(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number) {
    const elapsed = Math.max(0, (now - modeStartedAtRef.current) / 1000);
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const phase = (elapsed * 0.2 + i * 0.08) % 1;
      const px = W * (0.28 + (i % 5) * 0.11) + Math.sin(now * 0.001 + i) * W * 0.015;
      const py = H * (0.8 - phase * 0.44);
      const r = W * (0.02 + phase * 0.04);
      const alpha = (1 - phase) * 0.35 * Math.min(1.3, power);
      ctx.fillStyle = `rgba(100,95,90,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFire(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number, elapsed: number) {
    const sites = [0.3, 0.42, 0.52, 0.64, 0.74];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = smoothFx(elapsed / 0.4);
    for (let i = 0; i < sites.length; i++) {
      const x = W * sites[i];
      const y = H * 0.8;
      const f = 0.7 + 0.3 * Math.sin(now * 0.012 + i * 2);
      const h = H * (0.12 + power * 0.05) * f;

      const grad = ctx.createLinearGradient(0, y - h, 0, y);
      grad.addColorStop(0, "rgba(255,246,173,0.1)");
      grad.addColorStop(0.3, "rgba(255,190,52,0.85)");
      grad.addColorStop(0.7, "rgba(255,81,20,0.9)");
      grad.addColorStop(1, "rgba(133,28,14,0.2)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - W * 0.03, y);
      ctx.bezierCurveTo(x - W * 0.04, y - h * 0.4, x - W * 0.01, y - h * 0.7, x, y - h);
      ctx.bezierCurveTo(x + W * 0.01, y - h * 0.7, x + W * 0.04, y - h * 0.4, x + W * 0.03, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDebris(ctx: CanvasRenderingContext2D, W: number, H: number, now: number, power: number, elapsed: number) {
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const age = elapsed - i * 0.04;
      if (age < 0 || age > 2.5) continue;
      const sx = W * (0.28 + (i % 7) * 0.07);
      const sy = H * 0.78;
      const dir = i % 2 ? 1 : -1;
      const vx = dir * W * (0.13 + (i % 5) * 0.02);
      const vy = -H * (0.24 + (i % 4) * 0.05);
      const px = sx + vx * age;
      const py = sy + vy * age + H * 0.12 * age * age;
      const fade = age > 1.8 ? (2.5 - age) / 0.7 : 1;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(age * 4);
      ctx.globalAlpha = fade;
      ctx.fillStyle = i % 2 ? "#75462d" : "#b87a43";
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBrokenShip(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, now: number) {
    const elapsed = Math.max(0, (now - modeStartedAtRef.current) / 1000);
    const p = smoothFx(elapsed / 0.85);
    const off = p * 38;
    const hw = w / 2;
    const hh = h / 2;
    const sw = img.naturalWidth / 2;
    const sh = img.naturalHeight / 2;

    ctx.save();
    ctx.save();
    ctx.translate(x - off * 1.1, y - off * 0.7);
    ctx.rotate(-0.04 * p);
    ctx.drawImage(img, 0, 0, sw, sh, 0, 0, hw, hh);
    ctx.restore();

    ctx.save();
    ctx.translate(x + hw + off * 1.1, y - off * 0.5);
    ctx.rotate(0.04 * p);
    ctx.drawImage(img, sw, 0, sw, sh, 0, 0, hw, hh);
    ctx.restore();

    ctx.save();
    ctx.translate(x - off * 1.2, y + hh + off * 0.9);
    ctx.rotate(-0.03 * p);
    ctx.drawImage(img, 0, sh, sw, sh, 0, 0, hw, hh);
    ctx.restore();

    ctx.save();
    ctx.translate(x + hw + off * 0.9, y + hh + off * 1.2);
    ctx.rotate(0.05 * p);
    ctx.drawImage(img, sw, sh, sw, sh, 0, 0, hw, hh);
    ctx.restore();
    ctx.restore();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/") || f.name.endsWith(".png") || f.name.endsWith(".webp"));

    if (fileArray.length === 0) {
      setStatusMsg("يرجى اختيار صور PNG مفرغة.");
      return;
    }

    setShips((prev) => {
      const next = [...prev];
      fileArray.forEach((file) => {
        const lower = file.name.toLowerCase();
        let matchedIndex = -1;

        const numMatch = lower.match(/(?:ship_?|s|boss_?)0?(\d+)/);
        if (numMatch && numMatch[1]) {
          const num = parseInt(numMatch[1], 10);
          matchedIndex = next.findIndex((s) => s.shipId === num);
        }

        if (matchedIndex === -1 && lower.includes("boss")) {
          matchedIndex = next.findIndex((s) => s.shipId === 10);
        }

        if (matchedIndex !== -1) {
          next[matchedIndex] = {
            ...next[matchedIndex],
            file,
            previewUrl: URL.createObjectURL(file),
            isCustom: true,
          };
        }
      });
      return next;
    });

    setStatusMsg(`تم التعرف على ${fileArray.length} صورة وربطها بالسفن بنجاح.`);
  }

  async function publishUpdates() {
    const staged = ships.filter((s) => Boolean(s.file));
    if (staged.length === 0) {
      setStatusMsg("لم تقم بتحديد صور جديدة للرفع.");
      return;
    }

    setUploading(true);
    setStatusMsg("جارٍ رفع الصور إلى Supabase وتحديث اللعبة…");

    try {
      const { data: userAuth } = await supabase.auth.getUser();

      for (const ship of staged) {
        if (!ship.file) continue;
        const fileExt = ship.file.name.split(".").pop() || "png";
        const path = `ships/ship_${ship.shipId}_${Date.now()}.${fileExt}`;

        const { error: upErr } = await supabase.storage.from("game-artwork").upload(path, ship.file, {
          contentType: ship.file.type || "image/png",
          upsert: true,
        });
        if (upErr) throw upErr;

        const subject = `ship-${ship.shipId}`;
        await supabase.from("artwork_poses").delete().eq("category", "ship").eq("subject", subject).eq("pose", "idle");

        const { error: insErr } = await supabase.from("artwork_poses").insert({
          category: "ship",
          subject,
          pose: "idle",
          image_path: path,
          created_by: userAuth.user?.id || "admin",
        });
        if (insErr) throw insErr;
      }

      announceArtworkUpdate();
      setStatusMsg("✅ تم نشر وتحديث صور السفن بنجاح! تم تطبيق التغييرات فورياً عند جميع اللاعبين.");
    } catch (err: any) {
      setStatusMsg(`❌ خطأ أثناء الرفع: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="ship-studio-container" dir="rtl" style={{ background: "#0b1f2d", color: "#fff", borderRadius: 16, padding: 20, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#ffd36e" }}>استوديو حزم السفن والمؤثرات</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#97b4c4" }}>ارفع صور السفن الشفافة (PNG) وعاين مؤثرات اللمعة والإصلاح والتدمير مباشرة.</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept="image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => folderInputRef.current?.click()} style={{ borderColor: "#ffd36e", color: "#ffd36e" }}>
            <Upload size={16} style={{ marginLeft: 6 }} /> اختر صور الحزمة (PNG)
          </Button>

          <Button onClick={publishUpdates} disabled={uploading} style={{ background: "linear-gradient(135deg, #f4d18a, #d5a344)", color: "#231604", fontWeight: 700 }}>
            <RefreshCw size={16} className={uploading ? "animate-spin" : ""} style={{ marginLeft: 6 }} />
            {uploading ? "جارٍ التحديث…" : "تطبيق وتحديث في اللعبة"}
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: "rgba(255,255,255,0.08)", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div style={{ background: "#061520", borderRadius: 12, padding: 12, maxHeight: 620, overflowY: "auto" }}>
          <h3 style={{ fontSize: 14, color: "#bfd4dd", marginBottom: 10 }}>سفن الأسطول ({ships.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ships.map((s) => {
              const active = s.shipId === selectedId;
              const hasNewFile = Boolean(s.file);
              return (
                <div
                  key={s.shipId}
                  onClick={() => setSelectedId(s.shipId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: active ? "rgba(255, 211, 110, 0.15)" : "transparent",
                    border: active ? "1px solid #ffd36e" : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <img src={s.previewUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, background: "rgba(255,255,255,0.03)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#7a9cb0" }}>كود: {s.shipCode} {s.isCustom && "· مخصصة"}</div>
                  </div>
                  {hasNewFile && <span title="مجهزة للرفع"><CheckCircle2 size={16} color="#4ade80" /></span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: "#061520", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Button size="sm" variant={fxMode === "shine" ? "default" : "secondary"} onClick={() => switchMode("shine")}>
              <Sparkles size={14} style={{ marginLeft: 4 }} /> لمعة ذهبية
            </Button>
            <Button size="sm" variant={fxMode === "repair" ? "default" : "secondary"} onClick={() => switchMode("repair")}>
              <Wrench size={14} style={{ marginLeft: 4 }} /> كشاف وإصلاح
            </Button>
            <Button size="sm" variant={fxMode === "damage" ? "default" : "secondary"} onClick={() => switchMode("damage")}>
              <Flame size={14} style={{ marginLeft: 4 }} /> ضرر
            </Button>
            <Button size="sm" variant={fxMode === "destroy" ? "default" : "secondary"} onClick={() => switchMode("destroy")}>
              <Skull size={14} style={{ marginLeft: 4 }} /> تدمير وتفكك
            </Button>
            <Button size="sm" variant={fxMode === "none" ? "default" : "secondary"} onClick={() => switchMode("none")}>
              بدون تأثير
            </Button>
          </div>

          <div style={{ position: "relative", width: "100%", height: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "#0e2a3a", borderRadius: 10, overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%" }} />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#87a5b6" }}>
            السفينة المحددة: <strong style={{ color: "#ffd36e" }}>{currentShip?.name}</strong> — يتم تشغيل التأثير المختار كما سيظهر في ساحة اللعبة.
          </div>
        </div>
      </div>
    </div>
  );
}
