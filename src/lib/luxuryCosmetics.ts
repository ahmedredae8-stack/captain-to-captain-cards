// src/lib/luxuryCosmetics.ts

export type LuxuryTheme = {
  id?: number;
  slug?: string;
  n: string;
  r: string;
  c: [string, string];
  bd: string;
  gl: string;
  f: [string, string, string];
  p: [string, string, string];
  bub?: string;
  o: string;
  nm: string;
  tx?: string;
};

const DEF: LuxuryTheme = {
  n: 'افتراضي كلاسيكي',
  r: 'قبطان',
  c: ['#1a2540', '#0a0f1f'],
  bd: '#8a96b8',
  gl: 'rgba(120,140,200,.25)',
  f: ['#d9a066', '#8a5a2b', '#3b2412'],
  p: ['#e8d7b0', '#a98b52', '#2b1c08'],
  o: 'wood',
  nm: 'القبطان',
  tx: 'أهلاً بك في بحار القراصنة!'
};

const T: LuxuryTheme[] = [
  DEF,
  {n:'ذهبي ملكي',r:'أسطوري',c:['#4a3410','#17100a'],bd:'#f2b934',gl:'rgba(242,185,52,.35)',f:['#fff6c4','#f2b934','#a86a05'],p:['#fff6c4','#e0a010','#3b2600'],bub:'background:linear-gradient(135deg,#fff1a8,#f2b934 55%,#c98308);color:#3b2600;border:2px solid #fff3b8',o:'crown',nm:'أمير البحار',tx:'يا جماعة مين جاهز للجولة الجاية؟'},
  {n:'نيون سايبر',r:'ملحمي',c:['#0e1a45','#050917'],bd:'#22e5ff',gl:'rgba(34,229,255,.4)',f:['#a8f6ff','#22e5ff','#0a8fb0'],p:['#7af0ff','#12b8e0','#04202c'],bub:'background:linear-gradient(135deg,#0b1230,#12204a);color:#c8fbff;border:2px solid #22e5ff;box-shadow:0 0 18px #22e5ff',o:'neon',nm:'الظل السايبر',tx:'الهجوم بعد ثلاث ثواني!'},
  {n:'ياقوت',r:'ملحمي',c:['#6a0a28','#22030d'],bd:'#ffd27a',gl:'rgba(194,20,74,.45)',f:['#ff8aa8','#c2144a','#5c0620'],p:['#ffe08a','#c98308','#4a0a1c'],bub:'background:linear-gradient(135deg,#c2144a,#6e0926);color:#fff;border:2px solid #ffd27a',o:'ruby',nm:'قبطان الياقوت',tx:'مبروك عليك الفوز يا بطل'},
  {n:'زمرد',r:'نادر',c:['#0a4a36','#031712'],bd:'#ffd27a',gl:'rgba(18,135,93,.45)',f:['#9ff5cf','#12875d','#06382a'],p:['#ffe08a','#c98308','#05301f'],bub:'background:linear-gradient(135deg,#12875d,#0a4a36);color:#fff;border:2px solid #ffd27a',o:'em',nm:'حارس الغابة',tx:'تعالوا الفريق ناقصنا واحد'},
  {n:'جليد',r:'نادر',c:['#244a7a','#0a1830'],bd:'#d7edff',gl:'rgba(140,200,255,.4)',f:['#ffffff','#a9d8ff','#4f93d6'],p:['#ffffff','#8cc8ff','#0b3556'],bub:'background:linear-gradient(135deg,#f2fbff,#a9d4ff);color:#0b3556;border:2px solid #fff',o:'ice',nm:'ملك الصقيع',tx:'برد الدنيا بس اللعبة سخنة'},
  {n:'كوني نابض',r:'أسطوري',c:['#35168f','#0b0524'],bd:'#e9b6ff',gl:'rgba(192,38,211,.5)',f:['#e9b6ff','#8b3df0','#2a1280'],p:['#f5d0ff','#c026d3','#2a0850'],bub:'background:linear-gradient(110deg,#5a1fe0,#c026d3,#4f46e5);color:#fff;border:2px solid #e9b6ff',o:'cosmic',nm:'مسافر المجرة',tx:'أنا دخلت الروم الفخم'},
  {n:'ناري',r:'ملحمي',c:['#6a1507','#1c0303'],bd:'#ffb347',gl:'rgba(255,122,26,.5)',f:['#fff0b0','#ff7a1a','#8f0d18'],p:['#fff0b0','#ff7a1a','#4a0d05'],bub:'background:linear-gradient(135deg,#cf3d0c,#8f0d18);color:#fff;border:2px solid #ffb347',o:'fire',nm:'سيّد اللهب',tx:'مين يتحداني؟ أنا هنا'},
  {n:'وردي ناعم',r:'نادر',c:['#722350','#2a0a1c'],bd:'#ffc2de',gl:'rgba(255,150,200,.45)',f:['#ffe3f0','#ff8fc0','#c2306f'],p:['#ffffff','#ff8fc0','#5a0f33'],bub:'background:linear-gradient(135deg,#ffe3f0,#ffb3d4);color:#5a0f33;border:2px solid #fff',o:'pink',nm:'ملكة الورد',tx:'صباح الخير على الكل'},
  {n:'بلاتيني',r:'أسطوري',c:['#2c3350','#0d101e'],bd:'#e6ecfa',gl:'rgba(200,215,255,.35)',f:['#ffffff','#c9d3e6','#6f7a96'],p:['#ffffff','#c9d3e6','#1c2236'],bub:'background:linear-gradient(135deg,#ffffff,#c9d3e6 55%,#8f9ab5);color:#1c2236;border:2px solid #fff',o:'wings',nm:'جناح الفضة',tx:'الأسطول كله تحت أمرك'},
  {n:'أوبسيديان',r:'أسطوري',c:['#1c1033','#07030f'],bd:'#a66bff',gl:'rgba(122,60,230,.5)',f:['#c9a6ff','#6a2fd0','#1a0638'],p:['#d9bfff','#7a3be0','#14052e'],bub:'background:linear-gradient(135deg,#2a0f55,#0d0420);color:#e6d4ff;border:2px solid #a66bff;box-shadow:0 0 16px #7a3be0',o:'thorn',nm:'ظل الليل',tx:'الليل لسه في أوله'},
  {n:'فرعوني',r:'أسطوري',c:['#0f4a52','#041b1f'],bd:'#f2b934',gl:'rgba(20,184,166,.45)',f:['#9ff5ee','#14b8a6','#0a5a55'],p:['#fff6c4','#e0a010','#3b2600'],bub:'background:linear-gradient(135deg,#14b8a6,#0a5a55);color:#fff;border:2px solid #f2b934',o:'sun',nm:'ابن الشمس',tx:'كنوز البحر كلها لينا'},
  {n:'أعماق المحيط',r:'ملحمي',c:['#0b3b5e','#04121f'],bd:'#7fe3ff',gl:'rgba(26,163,201,.45)',f:['#b8f4ff','#1aa3c9','#08425e'],p:['#e6fbff','#4fd0f0','#06324a'],bub:'background:linear-gradient(135deg,#1aa3c9,#08425e);color:#fff;border:2px solid #b8f4ff',o:'pearl',nm:'سيد اللؤلؤ',tx:'نزلت للقاع ولقيت كنز'},
  {n:'برق',r:'ملحمي',c:['#2d1f6e','#0b0625'],bd:'#ffe45a',gl:'rgba(255,214,26,.45)',f:['#fff7a8','#ffd21a','#a86a00'],p:['#fff7a8','#ffd21a','#3a2a00'],bub:'background:linear-gradient(135deg,#fff3a0,#ffd21a 55%,#c98308);color:#3a2a00;border:2px solid #fff7a8',o:'bolt',nm:'صاعقة البحر',tx:'ضربة واحدة وانتهت'},
  {n:'إكليل الغار',r:'نادر',c:['#2e3a14','#0d1204'],bd:'#e8c070',gl:'rgba(190,200,70,.4)',f:['#fff6c4','#e8b64a','#7a5a10'],p:['#fff6c4','#e0a010','#3b2600'],bub:'background:linear-gradient(135deg,#f6e7a4,#c9a43a);color:#3b2a00;border:2px solid #fff3b8',o:'laurel',nm:'بطل البطولة',tx:'المركز الأول من حقنا'},
  {n:'ذهب وردي',r:'ملحمي',c:['#4a2a2e','#170b0d'],bd:'#ffd0bd',gl:'rgba(232,153,122,.4)',f:['#ffe0d2','#e8997a','#8a4630'],p:['#ffe0d2','#e8997a','#3a141a'],bub:'background:linear-gradient(135deg,#e8997a,#a84a30);color:#fff;border:2px solid #ffd0bd',o:'rose',nm:'عاشق البحر',tx:'الأناقة عنوان القبطان'},
  {n:'ساكورا',r:'نادر',c:['#3a2a55','#120a22'],bd:'#ffd6e8',gl:'rgba(255,170,210,.4)',f:['#ffffff','#ffc2de','#e0709f'],p:['#ffffff','#ffc2de','#3a0a20'],bub:'background:linear-gradient(135deg,#fff0f7,#ffc2de);color:#3a0a20;border:2px solid #fff',o:'sak',nm:'زهرة الرياح',tx:'مع النسيم نبحر بعيد'},
  {n:'سماء',r:'نادر',c:['#2a5a9e','#0a1d3d'],bd:'#ffffff',gl:'rgba(159,214,255,.45)',f:['#ffffff','#9fd6ff','#4a8fd6'],p:['#ffffff','#9fd6ff','#082a50'],bub:'background:linear-gradient(135deg,#ffffff,#9fd6ff);color:#082a50;border:2px solid #fff',o:'cloud',nm:'فارس الأفق',tx:'السماء صافية والرحلة بدأت'},
  {n:'دوّامة سحرية',r:'أسطوري',c:['#2a0f4a','#0b0418'],bd:'#d99bff',gl:'rgba(176,74,224,.5)',f:['#f0c8ff','#b04ae0','#4a1180'],p:['#f0c8ff','#b04ae0','#240440'],bub:'background:linear-gradient(135deg,#b04ae0,#4a1180);color:#fff;border:2px solid #d99bff',o:'arc',nm:'ساحر الأعماق',tx:'الغموض في كل موجة'},
  {n:'هولوغرام',r:'أسطوري',c:['#1b1b3d','#07071a'],bd:'#ffffff',gl:'rgba(183,139,255,.5)',f:['#ffffff','#b78bff','#5ec8ff'],p:['#ffffff','#b78bff','#100a30'],bub:'background:linear-gradient(135deg,#1b1b3d,#2d1555);color:#5ec8ff;border:2px solid #b78bff;box-shadow:0 0 16px #5ec8ff',o:'holo',nm:'شبح المستقبل',tx:'أنا في كل مكان'},
  {n:'أسود ملكي',r:'أسطوري',c:['#1a1a1a','#050505'],bd:'#d4a017',gl:'rgba(212,160,23,.4)',f:['#fff0b0','#d4a017','#5a3a00'],p:['#fff6c4','#e0a010','#3b2600'],bub:'background:linear-gradient(135deg,#2a2a2a,#0a0a0a);color:#f6d56a;border:2px solid #d4a017;box-shadow:0 0 14px rgba(212,160,23,.5)',o:'wc',nm:'الملك الأسود',tx:'التاج لصاحبه'}
];

const ring = (i: number, t: LuxuryTheme, k?: string) => {
  const G = `url(#g${i})`, c = t.f;
  if (k === 'o') return `<polygon points="100,12 162,38 188,100 162,162 100,188 38,162 12,100 38,38" fill="none" stroke="${c[1]}" stroke-width="6"/><polygon points="100,30 150,50 170,100 150,150 100,170 50,150 30,100 50,50" fill="none" stroke="${c[0]}" stroke-width="2" stroke-dasharray="28 56"/>`;
  if (k === 'h') return `<polygon points="100,22 168,61 168,139 100,178 32,139 32,61" fill="none" stroke="${G}" stroke-width="13"/><polygon points="100,14 174,57 174,143 100,186 26,143 26,57" fill="none" stroke="#f2b934" stroke-width="3"/>`;
  return `<circle cx="100" cy="100" r="76" fill="none" stroke="${G}" stroke-width="13"/><circle cx="100" cy="100" r="82.5" fill="none" stroke="${c[0]}" stroke-width="1.5"/><circle cx="100" cy="100" r="69" fill="none" stroke="${c[2]}" stroke-width="1.5"/>`;
};

const rot = (id: string, a: number, extra = '') => `<use href="#${id}" transform="rotate(${a} 100 100)" ${extra}/>`;
const rays = (n: number, k: number, G: string, x = '') => Array.from({length:n},(_,j)=>`<use href="#sh" fill="${G}" ${x} transform="rotate(${j*360/n} 100 100) translate(100 6) scale(${k}) translate(-100 -6)"/>`).join('');
const pts = (n: number, r: number, f: (x: number, y: number, j: number) => string) => Array.from({length:n},(_,j)=>{const a=j*2*Math.PI/n;return f(100+r*Math.sin(a),100-r*Math.cos(a),j)}).join('');
const crown = (G: string) => `<path d="M70 30 L62 8 L84 22 L100 0 L116 22 L138 8 L130 30Z" fill="${G}" stroke="#7a4a00" stroke-width="1.2" stroke-linejoin="round"/><circle class="tw" cx="62" cy="8" r="3.5" fill="#ff3d6e"/><circle class="tw" cx="138" cy="8" r="3.5" fill="#ff3d6e"/><circle class="tw" cx="100" cy="6" r="4.5" fill="#22e5ff"/>`;
const wing = (G: string, c: string) => `<use href="#wg" fill="${G}" stroke="${c}" stroke-width="1"/><use href="#wg" fill="${G}" stroke="${c}" stroke-width="1" transform="translate(200 0) scale(-1 1)"/>`;

const frame = (i: number, t: LuxuryTheme) => {
  const G = `url(#g${i})`, c = t.f, o = t.o;
  let s = '';
  if (o === 'wood') return '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="77" fill="none" stroke="#6e6a66" stroke-width="9"/><circle cx="100" cy="100" r="71" fill="none" stroke="#4a4744" stroke-width="2"/></svg>';
  if (o === 'crown') s = ring(i,t) + `<circle class="sp" cx="100" cy="100" r="88" fill="none" stroke="${G}" stroke-width="4" stroke-dasharray=".1 9" stroke-linecap="round"/>` + crown(G);
  if (o === 'neon') s = `<polygon points="100,18 158,42 182,100 158,158 100,182 42,158 18,100 42,42" fill="none" stroke="#ff2bd6" stroke-width="1.5"/>` + ring(i,t,'o') + `<path d="M18 100H6M182 100h12M100 18V6M100 182v12M42 42L28 28M158 42l14-14M42 158l-14 14M158 158l14 14" stroke="${c[1]}" stroke-width="3" stroke-linecap="round"/>`;
  if (o === 'ruby') s = ring(i,t) + `<polygon points="100,10 109,22 100,34 91,22" fill="${G}" stroke="#f2b934" stroke-width="1.5"/><polygon points="14,100 22,89 30,100 22,111" fill="${G}" stroke="#f2b934" stroke-width="1.5"/><polygon points="186,100 178,89 170,100 178,111" fill="${G}" stroke="#f2b934" stroke-width="1.5"/><polygon points="100,162 122,180 100,204 78,180" fill="${G}" stroke="#f2b934" stroke-width="2"/>`;
  if (o === 'em') s = [-48,48,132,228].map(a=>rot('lf',a,`fill="${G}" stroke="#f2b934" stroke-width="1.5"`)).join('') + ring(i,t,'h') + `<polygon points="100,4 108,14 100,24 92,14" fill="#f2b934"/><polygon points="100,176 108,186 100,196 92,186" fill="#f2b934"/>`;
  if (o === 'ice') s = `<g fill="${G}" stroke="${c[2]}" stroke-width=".8" class="tw" style="animation-duration:3s">` + [0,45,90,135,180,225,270,315].map(a=>rot('sh',a)).join('') + `</g>` + ring(i,t) + `<use class="tw" href="#spk" fill="#fff" transform="translate(30 36)"/><use class="tw" href="#spk" fill="#fff" transform="translate(172 166) scale(.8)"/>`;
  if (o === 'cosmic') s = `<circle class="sp" cx="100" cy="100" r="92" fill="none" stroke="${c[0]}" stroke-width="2" stroke-dasharray="8 14"/><circle class="sp" cx="100" cy="100" r="88" fill="none" stroke="${c[1]}" stroke-width="1.5" stroke-dasharray="3 7" style="animation-direction:reverse;animation-duration:12s"/>` + ring(i,t) + pts(6,90,(x,y)=>`<circle class="tw" cx="${x}" cy="${y}" r="3" fill="#fff"/>`);
  if (o === 'fire') s = [0,45,90,135,180,225,270,315].map(a=>rot('fl',a,`fill="${G}" stroke="#ff3d00" stroke-width="1.2"`)).join('') + ring(i,t);
  if (o === 'pink') s = [0,60,120,180,240,300].map(a=>rot('lf',a,`fill="${G}" stroke="#fff" stroke-width="1"`)).join('') + ring(i,t) + pts(6,86,(x,y)=>`<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="#ff3d8b" stroke-width="1"/>`);
  if (o === 'wings') s = wing(G,c[1]) + ring(i,t) + `<circle cx="100" cy="16" r="5" fill="#fff" stroke="${c[1]}" stroke-width="1.5"/><circle cx="100" cy="184" r="5" fill="#fff" stroke="${c[1]}" stroke-width="1.5"/>`;
  if (o === 'thorn') s = rays(12,1.2,G,`stroke="#4a157a" stroke-width="1.2"`) + ring(i,t) + pts(12,88,(x,y)=>`<circle cx="${x}" cy="${y}" r="2.5" fill="${c[0]}"/>`);
  if (o === 'sun') s = rays(16,1,G,`stroke="#f2b934" stroke-width="1"`) + ring(i,t) + `<circle cx="100" cy="100" r="88" fill="none" stroke="${c[0]}" stroke-width="2"/>`;
  if (o === 'pearl') s = ring(i,t) + pts(12,86,(x,y)=>`<circle cx="${x}" cy="${y}" r="4.2" fill="#fff" stroke="${c[1]}" stroke-width="1.2"/>`);
  if (o === 'bolt') s = ring(i,t) + [0,90,180,270].map(a=>`<path d="M100 6 L108 26 L98 26 L106 46 L90 28 L98 28Z" fill="${G}" stroke="#5a3a00" stroke-width="1" transform="rotate(${a} 100 100)"/>`).join('');
  if (o === 'laurel') s = rays(16,0.6,G,`stroke="#7a5a10" stroke-width=".6"`) + ring(i,t) + `<circle cx="100" cy="190" r="6" fill="#d33" stroke="${c[0]}" stroke-width="1.5"/>`;
  if (o === 'rose') s = ring(i,t) + pts(8,88,(x,y)=>`<circle cx="${x}" cy="${y}" r="4" fill="${G}" stroke="#ffe0d2" stroke-width="1"/>`);
  if (o === 'sak') s = ring(i,t) + [[28,34,1.1],[172,40,0.8],[34,166,0.8],[170,164,1.1]].map(([x,y,k],j)=>`<g transform="translate(${x} ${y}) scale(${k})" class="tw" style="animation-delay:${j*0.5}s">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-8" rx="5.5" ry="8.5" fill="${G}" stroke="#e0709f" stroke-width=".8" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="#ffd54a"/></g>`).join('');
  if (o === 'cloud') s = ring(i,t) + `<g fill="${G}" stroke="#4a8fd6" stroke-width="1"><circle cx="70" cy="188" r="11"/><circle cx="90" cy="182" r="15"/><circle cx="112" cy="185" r="13"/><circle cx="128" cy="190" r="9"/></g><g fill="#fff" opacity=".9"><circle cx="30" cy="40" r="7"/><circle cx="42" cy="36" r="9"/><circle cx="54" cy="41" r="6"/></g>`;
  if (o === 'arc') s = ring(i,t) + `<circle class="sp" cx="100" cy="100" r="90" fill="none" stroke="${c[0]}" stroke-width="1.5" stroke-dasharray="18 8"/><circle class="sp" cx="100" cy="100" r="95" fill="none" stroke="${c[1]}" stroke-width="2" stroke-dasharray="3 12" style="animation-direction:reverse;animation-duration:20s"/>` + pts(4,95,(x,y,j)=>`<polygon points="${x},${y-9} ${x+6},${y} ${x},${y+9} ${x-6},${y}" fill="${G}" stroke="${c[0]}" class="tw" style="animation-delay:${j*0.4}s"/>`);
  if (o === 'holo') s = `<g class="sp" style="animation-duration:14s">` + ['#ff5d8f','#ffb347','#f7ee6a','#5ee8a6','#5ec8ff','#b78bff'].map((k,j)=>`<circle cx="100" cy="100" r="76" fill="none" stroke="${k}" stroke-width="13" stroke-dasharray="79.6 398" stroke-dashoffset="${-j*79.6}"/>`).join('') + `</g><circle cx="100" cy="100" r="83.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="100" cy="100" r="69" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/><g fill="#fff" class="tw"><use href="#spk" transform="translate(24 40)"/><use href="#spk" transform="translate(178 150) scale(.8)"/></g>`;
  if (o === 'wc') s = ring(i,t) + crown(G) + pts(8,88,(x,y)=>`<circle cx="${x}" cy="${y}" r="3.5" fill="#f6d56a" stroke="#000" stroke-width="1"/>`);

  return `<svg viewBox="0 0 200 200"><g filter="url(#fx)"><g class="pl">${s}</g>${o==='neon'||o==='em'?'':`<circle class="gl" cx="100" cy="100" r="76" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="26 452" opacity=".85"/>`}</g></svg>`;
};

const ANIM = '.pl{transform-origin:100px 100px;animation:pl 2.4s ease-in-out infinite}@keyframes pl{50%{transform:scale(1.035);filter:brightness(1.18)}}.gl{transform-origin:100px 100px;animation:sp 3.6s linear infinite}.sp{transform-origin:100px 100px;animation:sp 30s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}.tw{animation:tw 2s ease-in-out infinite}@keyframes tw{50%{opacity:.25}}';
const GRAD = (i: number) => `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T[i].f[0]}"/><stop offset=".5" stop-color="${T[i].f[1]}"/><stop offset="1" stop-color="${T[i].f[2]}"/></linearGradient>`;
const INNER = `
<filter id="fx" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<path id="wg" d="M26 112 C10 108 0 90 4 62 C12 76 20 80 30 80 C20 88 16 96 16 104 C22 100 28 100 32 102 C24 106 22 112 26 112Z"/><path id="lf" d="M100 8 C114 18 116 34 100 50 C84 34 86 18 100 8Z"/><path id="sh" d="M100 6 L110 36 L100 52 L90 36Z"/>
<path id="fl" d="M100 4 C116 26 124 34 117 52 C112 45 107 43 100 49 C93 43 88 45 83 52 C76 34 84 26 100 4Z"/>
<path id="spk" d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10Z"/>
`;

function frameSVG(i: number) {
  const safeIdx = Math.abs(i) % T.length;
  return frame(safeIdx, T[safeIdx]).replace(
    '<svg viewBox="0 0 200 200">',
    `<svg class="frame-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><style>${ANIM}</style><defs>${GRAD(safeIdx)}${INNER}</defs>`
  );
}

export { T as LUXURY_THEMES, DEF };

export function getTheme(idOrSlugOrIndex?: string | number | null): LuxuryTheme {
  if (idOrSlugOrIndex === undefined || idOrSlugOrIndex === null) return DEF;
  if (typeof idOrSlugOrIndex === 'number') {
    const idx = Math.abs(idOrSlugOrIndex) % T.length;
    return T[idx] || DEF;
  }
  const found = T.find((t: any, i: number) => String(i) === idOrSlugOrIndex || t.n === idOrSlugOrIndex);
  return found || DEF;
}

export function getThemeIndex(idOrSlugOrIndex?: string | number | null): number {
  if (idOrSlugOrIndex === undefined || idOrSlugOrIndex === null) return 0;
  if (typeof idOrSlugOrIndex === 'number') {
    return Math.abs(idOrSlugOrIndex) % T.length;
  }
  const idx = T.findIndex((t: any, i: number) => String(i) === idOrSlugOrIndex || t.n === idOrSlugOrIndex);
  return idx >= 0 ? idx : 0;
}

export function getFrameSVG(index: number): string {
  const safeIdx = Math.abs(index) % T.length;
  return frameSVG(safeIdx);
}

export const ACTIVE_FRAME_KEY = 'c2c_active_frame_index';

export function getEquippedFrame(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const saved = localStorage.getItem(ACTIVE_FRAME_KEY);
    if (saved !== null) return parseInt(saved, 10) || 0;
  } catch (_) {}
  return 0;
}

export function setEquippedFrame(index: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_FRAME_KEY, String(index));
    window.dispatchEvent(new CustomEvent('c2c:frame_changed', { detail: { index } }));
  } catch (_) {}
}
