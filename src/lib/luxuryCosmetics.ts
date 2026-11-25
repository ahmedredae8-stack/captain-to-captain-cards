// src/lib/luxuryCosmetics.ts

export type LuxuryTheme = {
  id: string;
  n: string; // الاسم
  r: "أسطوري" | "ملحمي" | "نادر"; // الرتبة
  c: [string, string]; // خلفية البطاقة المتدرجة
  bd: string; // لون الحدود المشعة
  gl: string; // التوهج الخارجي
  f: [string, string, string]; // ألوان تدرج إطار الصورة
  p: [string, string, string]; // ألوان لوحة الاسم وشريط الرتبة
  bub: string; // ستايل فقاعة الشات
  o: string; // نوع زخرفة الإطار (تاج، نيون، أجنحة، إلخ)
  nm: string; // اللقب الافتراضي
  tx: string; // نص المحاكاة
};

export const LUXURY_THEMES: LuxuryTheme[] = [
  { id: 'gold', n:'ذهبي ملكي', r:'أسطوري', c:['#4a3410','#17100a'], bd:'#f2b934', gl:'rgba(242,185,52,.35)', f:['#fff6c4','#f2b934','#a86a05'], p:['#fff6c4','#e0a010','#3b2600'], bub:'background:linear-gradient(135deg,#fff1a8,#f2b934 55%,#c98308);color:#3b2600;border:2px solid #fff3b8', o:'crown', nm:'أمير البحار', tx:'يا جماعة مين جاهز للجولة الجاية؟' },
  { id: 'cyber', n:'نيون سايبر', r:'ملحمي', c:['#0e1a45','#050917'], bd:'#22e5ff', gl:'rgba(34,229,255,.4)', f:['#a8f6ff','#22e5ff','#0a8fb0'], p:['#7af0ff','#12b8e0','#04202c'], bub:'background:linear-gradient(135deg,#0b1230,#12204a);color:#c8fbff;border:2px solid #22e5ff;box-shadow:0 0 18px #22e5ff', o:'neon', nm:'الظل السايبر', tx:'الهجوم بعد ثلاث ثواني!' },
  { id: 'ruby', n:'ياقوت', r:'ملحمي', c:['#6a0a28','#22030d'], bd:'#ffd27a', gl:'rgba(194,20,74,.45)', f:['#ff8aa8','#c2144a','#5c0620'], p:['#ffe08a','#c98308','#4a0a1c'], bub:'background:linear-gradient(135deg,#c2144a,#6e0926);color:#fff;border:2px solid #ffd27a', o:'ruby', nm:'قبطان الياقوت', tx:'مبروك عليك الفوز يا بطل' },
  { id: 'emerald', n:'زمرد', r:'نادر', c:['#0a4a36','#031712'], bd:'#ffd27a', gl:'rgba(18,135,93,.45)', f:['#9ff5cf','#12875d','#06382a'], p:['#ffe08a','#c98308','#0a3022'], bub:'background:linear-gradient(135deg,#0e6b48,#063826);color:#e0fff3;border:2px solid #5ee8a6', o:'em', nm:'صقر الزمرد', tx:'تعالوا الفريق ناقصنا واحد' },
  { id: 'ice', n:'جليد', r:'نادر', c:['#244a7a','#0a1830'], bd:'#d7edff', gl:'rgba(140,200,255,.4)', f:['#ffffff','#a9d8ff','#4f93d6'], p:['#ffffff','#8cc8ff','#0a2040'], bub:'background:linear-gradient(135deg,#e2f1ff,#7ab8f5);color:#0a2040;border:2px solid #ffffff', o:'ice', nm:'سيد الصقيع', tx:'برد الدنيا بس اللعبة سخنة' },
  { id: 'cosmic', n:'كوني نابض', r:'أسطوري', c:['#35168f','#0b0524'], bd:'#e9b6ff', gl:'rgba(192,38,211,.5)', f:['#e9b6ff','#8b3df0','#2a1280'], p:['#f5d0ff','#c026d3','#200838'], bub:'background:linear-gradient(135deg,#a855f7,#581c87);color:#fff;border:2px solid #e9b6ff', o:'cosmic', nm:'نجم المجرة', tx:'أنا دخلت الروم الفخم' },
  { id: 'fire', n:'ناري', r:'ملحمي', c:['#6a1507','#1c0303'], bd:'#ffb347', gl:'rgba(255,122,26,.5)', f:['#fff0b0','#ff7a1a','#8f0d18'], p:['#fff0b0','#ff7a1a','#380608'], bub:'background:linear-gradient(135deg,#ea580c,#7c1d0a);color:#fff;border:2px solid #ffb347', o:'fire', nm:'لهب المعركة', tx:'مين يتحداني؟ أنا هنا' },
  { id: 'pink', n:'وردي ناعم', r:'نادر', c:['#722350','#2a0a1c'], bd:'#ffc2de', gl:'rgba(255,150,200,.45)', f:['#ffe3f0','#ff8fc0','#c2306f'], p:['#ffffff','#ff8fc0','#420822'], bub:'background:linear-gradient(135deg,#fff0f7,#ffb8da);color:#420822;border:2px solid #fff', o:'pink', nm:'وردة البحر', tx:'صباح الخير على الكل' },
  { id: 'platinum', n:'بلاتيني', r:'أسطوري', c:['#2c3350','#0d101e'], bd:'#e6ecfa', gl:'rgba(200,215,255,.35)', f:['#ffffff','#c9d3e6','#6f7a96'], p:['#ffffff','#c9d3e6','#1a2030'], bub:'background:linear-gradient(135deg,#f0f4fc,#9baec9);color:#1a2030;border:2px solid #ffffff', o:'wings', nm:'الدرع البلاتيني', tx:'الدفاع أقوى من الهجوم' },
  { id: 'obsidian', n:'أوبسيديان', r:'أسطوري', c:['#1c1033','#07030f'], bd:'#a66bff', gl:'rgba(122,60,230,.5)', f:['#c9a6ff','#6a2fd0','#1a0638'], p:['#d9bfff','#7a38e8','#1a0638'], bub:'background:linear-gradient(135deg,#2e125b,#0d041e);color:#e0caff;border:2px solid #a66bff', o:'wc', nm:'فارس الظلام', tx:'الهدوء الذي يسبق العاصفة' },
  { id: 'pharaoh', n:'فرعوني', r:'أسطوري', c:['#0f4a52','#041b1f'], bd:'#f2b934', gl:'rgba(20,184,166,.45)', f:['#9ff5ee','#14b8a6','#0a5a55'], p:['#fff6c4','#e0a010','#04252a'], bub:'background:linear-gradient(135deg,#0d9488,#115e59);color:#f0fdfa;border:2px solid #f2b934', o:'sun', nm:'حارس العرش', tx:'كنز الفراعنة لا يُقهر' },
  { id: 'abyss', n:'أعماق المحيط', r:'ملحمي', c:['#0b3b5e','#04121f'], bd:'#7fe3ff', gl:'rgba(26,163,201,.45)', f:['#b8f4ff','#1aa3c9','#08425e'], p:['#e6fbff','#22bfe6','#041c2c'], bub:'background:linear-gradient(135deg,#0369a1,#082f49);color:#e0f2fe;border:2px solid #7fe3ff', o:'pearl', nm:'وحش الأعماق', tx:'البحر ينادي الشجعان' },
  { id: 'lightning', n:'برق', r:'ملحمي', c:['#2d1f6e','#0b0625'], bd:'#ffe45a', gl:'rgba(255,214,26,.45)', f:['#fff7a8','#ffd21a','#a86a00'], p:['#fff7a8','#ffd21a','#221800'], bub:'background:linear-gradient(135deg,#ca8a04,#713f12);color:#fef08a;border:2px solid #ffe45a', o:'bolt', nm:'الصاعقة', tx:'سريع كالبرق حاسم كالرعد' },
  { id: 'laurel', n:'إكليل الغار', r:'نادر', c:['#2e3a14','#0d1204'], bd:'#e8c070', gl:'rgba(190,200,70,.4)', f:['#fff6c4','#e8b64a','#7a5a10'], p:['#fff6c4','#e0a010','#1a2008'], bub:'background:linear-gradient(135deg,#65a30d,#365314);color:#f7fee7;border:2px solid #e8c070', o:'laurel', nm:'بطل النصر', tx:'المجد لمن يثبت للنهاية' },
  { id: 'rosegold', n:'ذهب وردي', r:'ملحمي', c:['#4a2a2e','#170b0d'], bd:'#ffd0bd', gl:'rgba(232,153,122,.4)', f:['#ffe0d2','#e8997a','#8a4630'], p:['#ffe9de','#e8997a','#381518'], bub:'background:linear-gradient(135deg,#fb7185,#9f1239);color:#fff;border:2px solid #ffd0bd', o:'sak', nm:'سفير الفخامة', tx:'الأناقة في قلب المعركة' },
  { id: 'sakura', n:'ساكورا', r:'نادر', c:['#3a2a55','#120a22'], bd:'#ffd6e8', gl:'rgba(255,170,210,.4)', f:['#ffffff','#ffc2de','#e0709f'], p:['#ffffff','#ffc2de','#2e1026'], bub:'background:linear-gradient(135deg,#f472b6,#831843);color:#fff;border:2px solid #ffd6e8', o:'sak', nm:'نسيم الشرق', tx:'رياح الربيع تهب بقوة' },
  { id: 'sky', n:'سماء', r:'نادر', c:['#2a5a9e','#0a1d3d'], bd:'#ffffff', gl:'rgba(159,214,255,.45)', f:['#ffffff','#9fd6ff','#4a8fd6'], p:['#ffffff','#9fd6ff','#081a36'], bub:'background:linear-gradient(135deg,#38bdf8,#0369a1);color:#fff;border:2px solid #fff', o:'cloud', nm:'صقر الأعالي', tx:'حر كطائر النورس' },
  { id: 'vortex', n:'دوّامة سحرية', r:'أسطوري', c:['#2a0f4a','#0b0418'], bd:'#d99bff', gl:'rgba(176,74,224,.5)', f:['#f0c8ff','#b04ae0','#4a1180'], p:['#f5d0ff','#c026d3','#200438'], bub:'background:linear-gradient(135deg,#7e22ce,#3b0764);color:#f3e8ff;border:2px solid #d99bff', o:'arc', nm:'حكيم السحر', tx:'أسرار البحر لا تنتهي' },
  { id: 'holo', n:'هولوغرام', r:'أسطوري', c:['#1b1b3d','#07071a'], bd:'#ffffff', gl:'rgba(183,139,255,.5)', f:['#ffffff','#b78bff','#5ec8ff'], p:['#ffffff','#c9b3ff','#0d0d26'], bub:'background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#67e8f9;border:2px solid #a5f3fc', o:'holo', nm:'طيف المستقبل', tx:'أنا أسبق الجميع بخطوة' },
  { id: 'blackgold', n:'أسود ملكي', r:'أسطوري', c:['#1a1a1a','#050505'], bd:'#d4a017', gl:'rgba(212,160,23,.4)', f:['#fff0b0','#d4a017','#5a3a00'], p:['#fff6c4','#e0a010','#1a1500'], bub:'background:linear-gradient(135deg,#262626,#0a0a0a);color:#fde047;border:2px solid #d4a017', o:'crown', nm:'ملك القراصنة', tx:'البحر ملك لمن يجرؤ!' }
];

export function getTheme(idOrIndex?: string | number): LuxuryTheme {
  if (typeof idOrIndex === "number") {
    return LUXURY_THEMES[Math.abs(idOrIndex) % LUXURY_THEMES.length] ?? LUXURY_THEMES[0]!;
  }
  const found = LUXURY_THEMES.find(t => t.id === idOrIndex);
  return found ?? LUXURY_THEMES[0]!;
}
