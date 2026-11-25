import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldAlert, Sparkles, Image, Users } from "lucide-react";
import { ArtworkStudio } from "@/components/ArtworkStudio";
import { ShipPackageStudio } from "@/components/ShipPackageStudio";
import { isArtworkAdmin } from "@/lib/artwork";
import { AiAccessRequests } from "@/components/AiAccessRequests";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "استوديو الوضعيات وتطوير السفن — عرش البحار" },
      { name: "description", content: "رفع وضعيات السفن وتحديث الحزم والمؤثرات للمشرفين." },
      { property: "og:title", content: "استوديو الإدارة — عرش البحار" },
      { property: "og:description", content: "إدارة صور ومؤثرات السفن." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

function AdminPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"package" | "poses" | "requests">("package");

  useEffect(() => {
    void isArtworkAdmin()
      .then(setOk)
      .catch(() => setOk(false));
  }, []);

  return (
    <main className="social-page" dir="rtl">
      <div className="social-wrap">
        <header className="social-titlebar">
          <Link to="/" className="icon-control" aria-label="رجوع">
            <ArrowRight />
          </Link>
          <div>
            <span>للمشرفين</span>
            <h1>استوديو الإدارة وتطوير السفن</h1>
          </div>
        </header>

        {ok === null ? (
          <p className="dock-loading">جارٍ التحقق من الصلاحيات…</p>
        ) : ok ? (
          <>
            {/* أزرار التبديل بين أقسام الإدارة */}
            <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
              <Button
                variant={tab === "package" ? "default" : "secondary"}
                onClick={() => setTab("package")}
                style={tab === "package" ? { background: "linear-gradient(135deg, #f4d18a, #d5a344)", color: "#231604", fontWeight: 700 } : {}}
              >
                <Sparkles size={16} style={{ marginLeft: 6 }} /> حزم السفن والمؤثرات
              </Button>
              <Button
                variant={tab === "poses" ? "default" : "secondary"}
                onClick={() => setTab("poses")}
              >
                <Image size={16} style={{ marginLeft: 6 }} /> استوديو الوضعيات الفردية
              </Button>
              <Button
                variant={tab === "requests" ? "default" : "secondary"}
                onClick={() => setTab("requests")}
              >
                <Users size={16} style={{ marginLeft: 6 }} /> طلبات الوصول
              </Button>
            </div>

            {tab === "package" && <ShipPackageStudio />}
            {tab === "poses" && <ArtworkStudio />}
            {tab === "requests" && <AiAccessRequests />}
          </>
        ) : (
          <div className="dock-empty">
            <ShieldAlert size={40} />
            <strong>هذه الصفحة للمشرفين فقط</strong>
            <span>سجّل الدخول بحساب لديه صلاحية الإدارة.</span>
          </div>
        )}
      </div>
    </main>
  );
}
