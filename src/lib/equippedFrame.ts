/**
 * equippedFrame.ts — حالة الإطارات (المملوكة + المجهّزة) محفوظة في localStorage
 * تتحدّث فورياً في كل المكونات (وبين التابات) عبر useSyncExternalStore.
 * ملاحظة: localStorage يخص جهاز اللاعب فقط. عشان باقي اللاعبين يشوفوا إطارك،
 * احفظ الرقم المجهّز في ملف اللاعب على السيرفر ومرّره لـ CaptainAvatar كـ frameIndex.
 */
import { useSyncExternalStore } from "react";
import { clampTheme } from "./luxuryCosmetics";

const KEY_EQ = "cosmetic.frame.equipped";
const KEY_OWN = "cosmetic.frame.owned";
type Snap = { equipped: number; owned: number[] };

function read<T>(key: string, fallback: T): T {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function load(): Snap {
  const owned = read<number[]>(KEY_OWN, [0]).map(clampTheme);
  const equipped = clampTheme(read<number>(KEY_EQ, 0));
  return { equipped: owned.includes(equipped) ? equipped : 0, owned: Array.from(new Set([0, ...owned])) };
}

let snap: Snap = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function save(next: Snap) {
  snap = next;
  try {
    localStorage.setItem(KEY_EQ, JSON.stringify(next.equipped));
    localStorage.setItem(KEY_OWN, JSON.stringify(next.owned));
  } catch {
    /* التخزين غير متاح — الحالة تبقى في الذاكرة */
  }
  emit();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY_EQ || e.key === KEY_OWN) {
      snap = load();
      cb();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export const grantFrame = (i: number) => {
  const k = clampTheme(i);
  if (!snap.owned.includes(k)) save({ ...snap, owned: [...snap.owned, k] });
};
export const equipFrame = (i: number) => {
  const k = clampTheme(i);
  if (snap.owned.includes(k) && snap.equipped !== k) save({ ...snap, equipped: k });
};
export const getEquippedFrame = () => snap.equipped;

const getSnap = () => snap;
const getServerSnap = (): Snap => ({ equipped: 0, owned: [0] });
export const useFrameState = (): Snap => useSyncExternalStore(subscribe, getSnap, getServerSnap);
/** رقم الإطار المجهّز حالياً للاعب الحالي */
export const useEquippedFrame = (): number => useFrameState().equipped;
