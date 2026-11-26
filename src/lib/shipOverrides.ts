import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fleetCatalog, type FleetShip } from "@/lib/fleetCatalog";

export type ShipOverride = { product_id: string; name: string | null; description: string | null; price: number | null; hidden: boolean };
export const OVERRIDES_UPDATED = "tos:ship-overrides";

export type LiveShip = FleetShip & { key: string; description: string; hidden: boolean };

/** Applies admin edits (name, text, price, hidden) on top of the bundled catalog and loads custom ships. */
export function applyOverrides(rows: ShipOverride[]): LiveShip[] {
  const map = new Map(rows.map((r) => [r.product_id, r]));
  const baseShips: LiveShip[] = fleetCatalog.map((ship) => {
    const key = `ship-${ship.id}`;
    const o = map.get(key);
    return {
      ...ship,
      key,
      name: o?.name?.trim() || ship.name,
      price: o?.price ?? ship.price,
      description: o?.description?.trim() || "",
      hidden: o?.hidden ?? false,
    };
  });

  // Custom added ships stored in ship_overrides with prefix "custom-ship-"
  const customShips: LiveShip[] = [];
  for (const r of rows) {
    if (r.product_id.startsWith("custom-ship-")) {
      let extra: any = {};
      try {
        if (r.description && r.description.startsWith("{")) {
          extra = JSON.parse(r.description);
        }
      } catch (_) {}

      const numId = parseInt(r.product_id.replace("custom-ship-", ""), 10) || (9000 + customShips.length);
      customShips.push({
        id: numId,
        key: r.product_id,
        name: r.name?.trim() || `سفينة #${numId}`,
        price: r.price ?? 50000,
        currency: extra.currency === "gem" ? "gem" : "gold",
        photo: extra.photo || "/assets/ships/cutter.png",
        tripSeconds: extra.tripSeconds || 120,
        description: extra.desc || r.description || "",
        hidden: r.hidden ?? false,
        data: {
          tier: typeof extra.tier === "number" ? extra.tier : 1,
          class_ar: extra.class_ar || "سفينة بحرية",
          class_en: extra.class_en || "Custom Ship",
          hp: extra.hp || 3000,
          speed: extra.speed || 15,
          weapons: extra.weapons || ["cannon"],
        } as any,
      });
    }
  }

  return [...baseShips, ...customShips];
}

export function useLiveShips(includeHidden = false) {
  const [rows, setRows] = useState<ShipOverride[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("ship_overrides").select("product_id,name,description,price,hidden");
      if (alive && data) setRows(data as ShipOverride[]);
    };
    void load();
    window.addEventListener(OVERRIDES_UPDATED, load);
    return () => { alive = false; window.removeEventListener(OVERRIDES_UPDATED, load); };
  }, []);
  const ships = applyOverrides(rows);
  return includeHidden ? ships : ships.filter((s) => !s.hidden);
}

export async function saveOverride(o: ShipOverride) {
  const { error } = await supabase.from("ship_overrides").upsert({ ...o, updated_at: new Date().toISOString() });
  if (!error) window.dispatchEvent(new Event(OVERRIDES_UPDATED));
  return error;
}

export async function deleteOverride(productId: string) {
  const { error } = await supabase.from("ship_overrides").delete().eq("product_id", productId);
  if (!error) window.dispatchEvent(new Event(OVERRIDES_UPDATED));
  return error;
}
