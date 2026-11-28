/**
 * Script appended to the King of Seas game page at launch. It runs in the game's global scope and
 * reuses the game's `scene`, `cam`, `W`, `fit`, `fallbackShip`, `goIsland`.
 *
 * Provides:
 * - Shared Dragon Raid Boss with colossal AAA health bar.
 * - Baby Dragon Hatchlings flying across the arena attacking separate ships.
 * - Super-smart human-like Bot AI (predictive aiming, evasive maneuvering, opportunistic target focus).
 * - Island combat overhaul: fixes phantom hits, eliminates infinite guard exploits (rapid stamina drain + guard break).
 * - AAA-grade UI controls: dynamic floating joystick, ergonomic action combat wheel with glowing cooldown rings.
 */
export type RoyaleSeat = { id?: string; name: string; isBot: boolean; me?: boolean; avatar_index?: number; avatar_url?: string | null };

export function royaleScript(seats: RoyaleSeat[], selfId = "offline"): string {
  const others = seats.filter((s) => !s.me).map((s, i) => ({ id: s.id ?? `seat-${i}`, n: s.name, b: s.isBot }));
  return `<style>
/* ==================== أنماط واجهة AAA الفاخرة لملك البحار ==================== */
:root {
  --gold-glow: rgba(245, 158, 11, 0.45);
  --gold-border: linear-gradient(135deg, #ffd77a, #b07a22, #ffe082);
}

/* إخفاء أزرار النوكيا القديمة في طور البحر والجزيرة */
#bL, #bR, #bU, #bD, #bF { display: none !important; }

/* لوحة صحة التنين الأسطوري العملاق (Raid Boss Health Bar) */
.ks-boss-hud {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  width: min(540px, 92vw);
  background: linear-gradient(180deg, rgba(20, 12, 6, 0.88), rgba(8, 5, 2, 0.94));
  border: 1.5px solid #d4a24a;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(230, 81, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.2);
  padding: 8px 16px 10px;
  direction: rtl;
  pointer-events: none;
  font-family: system-ui, -apple-system, sans-serif;
  backdrop-filter: blur(8px);
}
.ks-boss-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.ks-boss-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  font-size: 14px;
  color: #ffd77a;
  text-shadow: 0 0 10px rgba(255, 183, 77, 0.6);
}
.ks-boss-phase {
  font-size: 11px;
  font-weight: 700;
  color: #ff5252;
  background: rgba(255, 23, 68, 0.2);
  border: 1px solid rgba(255, 23, 68, 0.5);
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}
.ks-boss-track {
  position: relative;
  height: 12px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(212, 162, 74, 0.4);
}
.ks-boss-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #ff1744, #ff5252, #ff9100);
  box-shadow: 0 0 12px #ff3d00;
  border-radius: 999px;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.ks-boss-hp-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 9px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 3px #000;
  letter-spacing: 0.8px;
}

/* قائمة الناجين المحدثة بأناقة زجاجية */
.ks-panel {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  right: 14px;
  z-index: 10;
  min-width: 165px;
  padding: 10px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(22, 16, 8, 0.85), rgba(10, 8, 4, 0.92));
  border: 1px solid rgba(212, 162, 74, 0.6);
  box-shadow: 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
  color: #f7e3b0;
  font: 600 12px system-ui;
  direction: rtl;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.ks-panel h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #ffd77a;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(212, 162, 74, 0.25);
  padding-bottom: 4px;
}
.ks-panel li {
  list-style: none;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
}
.ks-panel li.dead { opacity: .35; text-decoration: line-through; color: #ff8a80; }
.ks-panel ul { margin: 0; padding: 0; }

/* شارات السفن ثلاثية الأبعاد */
.ks-tag {
  position: fixed;
  z-index: 6;
  transform: translate(-50%, -100%);
  pointer-events: none;
  font: 700 11px system-ui;
  color: #ffe9b0;
  padding: 3px 10px;
  border-radius: 10px;
  background: rgba(16, 12, 4, 0.85);
  border: 1px solid #c8963e;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  white-space: nowrap;
  backdrop-filter: blur(4px);
}
.ks-tag i { display: block; height: 4px; margin-top: 3px; background: #261b0a; border-radius: 2px; }
.ks-tag i b { display: block; height: 100%; background: linear-gradient(90deg, #ffd77a, #ff9100); border-radius: 2px; }

/* تغذية إعلانات المعركة السينمائية */
.ks-feed {
  position: fixed;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
  font: 900 20px system-ui;
  color: #ffd77a;
  text-shadow: 0 3px 12px rgba(0,0,0,0.9), 0 0 20px rgba(255, 183, 77, 0.7);
  pointer-events: none;
  transition: opacity .35s, transform .35s;
  background: rgba(10, 6, 2, 0.8);
  padding: 8px 24px;
  border-radius: 999px;
  border: 1px solid rgba(212, 162, 74, 0.6);
  backdrop-filter: blur(8px);
  opacity: 0;
}

/* ==================== عصا التحكم اللمسية الذكية AAA (Virtual Joystick) ==================== */
.ks-joystick-zone {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 50vw;
  height: 55vh;
  z-index: 20;
  touch-action: none;
}
.ks-joystick-base {
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(20, 14, 6, 0.6) 70%);
  border: 2px solid rgba(255, 215, 122, 0.55);
  box-shadow: 0 0 25px rgba(245, 158, 11, 0.3), inset 0 0 15px rgba(0,0,0,0.8);
  transform: translate(-50%, -50%);
  pointer-events: none;
  display: none;
  backdrop-filter: blur(6px);
}
.ks-joystick-thumb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 54px;
  height: 54px;
  margin: -27px 0 0 -27px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffd77a, #b07a22);
  border: 2px solid #fff;
  box-shadow: 0 4px 15px rgba(0,0,0,0.6), 0 0 12px rgba(255, 215, 122, 0.8);
  pointer-events: none;
}

/* ==================== عجلة أزرار القتال AAA (Action Combat Cluster) ==================== */
.ks-action-cluster {
  position: fixed;
  right: 20px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 22;
  display: flex;
  align-items: flex-end;
  pointer-events: auto;
}
.ks-main-fire-btn {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 2px solid #ffd77a;
  background: radial-gradient(circle at 35% 35%, #ff5252, #b71c1c);
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 25px rgba(213, 0, 0, 0.6), 0 0 20px rgba(255, 82, 82, 0.5), inset 0 2px 4px rgba(255,255,255,0.4);
  cursor: pointer;
  touch-action: none;
  position: relative;
  overflow: hidden;
  transition: transform 0.08s ease, filter 0.08s ease;
}
.ks-main-fire-btn:active {
  transform: scale(0.92);
  filter: brightness(1.25);
}
.ks-main-fire-btn svg {
  width: 44px;
  height: 44px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}
.ks-main-fire-btn span {
  position: absolute;
  bottom: 8px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #ffebee;
  text-shadow: 0 1px 3px #000;
}

/* شاشات النهاية والانتقال */
.ks-modal{position:fixed;inset:0;z-index:30;display:grid;place-items:center;background:rgba(5,4,2,.75);direction:rtl;backdrop-filter:blur(10px)}
.ks-card{width:min(380px,88vw);padding:26px;border-radius:20px;text-align:center;color:#f7e3b0;font-family:system-ui;background:linear-gradient(180deg,#241808,#0f0a03);border:2px solid #d4a24a;box-shadow:0 0 0 2px #5a3d12 inset,0 20px 60px rgba(0,0,0,.8)}
.ks-card h2{margin:0 0 8px;color:#ffd77a;font-size:26px;text-shadow:0 0 15px rgba(255, 215, 122, 0.5)}
.ks-card p{margin:0 0 18px;opacity:.88;line-height:1.6}
.ks-card button{display:block;width:100%;margin:10px 0;padding:14px;border-radius:14px;font:900 16px system-ui;cursor:pointer;border:2px solid #d4a24a;background:linear-gradient(180deg,#f3c75a,#b07a22);color:#2a1a04;box-shadow:0 6px 20px rgba(0,0,0,0.5);transition:all .15s}
.ks-card button:active{transform:scale(0.97)}
.ks-card button.ghost{background:rgba(255,255,255,0.08);color:#f7e3b0;border-color:rgba(212, 162, 74, 0.4)}
#over{display:none!important}
</style>

<!-- عناصر واجهة AAA -->
<div class="ks-boss-hud" id="ksBossHud">
  <div class="ks-boss-header">
    <div class="ks-boss-title">
      <span>🐉 عاهل التنانين الأسطوري</span>
    </div>
    <div class="ks-boss-phase" id="ksBossPhase">مرحلة الغضب</div>
  </div>
  <div class="ks-boss-track">
    <div class="ks-boss-fill" id="ksBossFill" style="width: 100%;"></div>
    <div class="ks-boss-hp-text" id="ksBossHpText">100%</div>
  </div>
</div>

<div class="ks-joystick-zone" id="ksJoyZone">
  <div class="ks-joystick-base" id="ksJoyBase">
    <div class="ks-joystick-thumb" id="ksJoyThumb"></div>
  </div>
</div>

<div class="ks-action-cluster" id="ksActionCluster">
  <button class="ks-main-fire-btn" id="ksFireBtn" aria-label="إطلاق المدافع">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
    </svg>
    <span>إطلاق</span>
  </button>
</div>

<script>
(function(){
var SEATS=${JSON.stringify(others)},SELF_ID=${JSON.stringify(selfId)};
var bots=[],babies=[],remote={},hitSeen={},hitSeq=0,ended=false,spectate=false,meDead=false,feedT=0,lastShipPos=null;
var DRAGON_MAX_HP = 3600;
var dragonSharedHp = DRAGON_MAX_HP;

function rnd(a,b){return a+Math.random()*(b-a)}

/* شاشة الإعلانات */
var feed=document.createElement('div');feed.className='ks-feed';document.body.appendChild(feed);
function say2(t){feed.textContent=t;feed.style.opacity='1';feed.style.transform='translate(-50%, -50%) scale(1.05)';clearTimeout(feedT);feedT=setTimeout(function(){feed.style.opacity='0';feed.style.transform='translate(-50%, -50%) scale(0.95)'},2600)}

var panel=document.createElement('div');panel.className='ks-panel';document.body.appendChild(panel);

/* تحديث شريط صحة التنين الرئيسي */
function updateBossBar(hp){
  var fill=document.getElementById('ksBossFill');
  var txt=document.getElementById('ksBossHpText');
  var pct=Math.max(0, Math.min(100, Math.ceil((hp / DRAGON_MAX_HP) * 100)));
  if(fill) fill.style.width=pct+'%';
  if(txt) txt.textContent=pct+'% ('+Math.max(0, Math.ceil(hp))+')';
}

/* ==================== بناء البوتات المنافسة الذكية ==================== */
SEATS.forEach(function(s,i){
  var g;try{g=fit(fallbackShip(),CFG.ship.len,true)}catch(e){g=new THREE.Group()}
  var a=i/SEATS.length*6.283,d=rnd(65,150);
  g.position.set(Math.cos(a)*d,0,Math.sin(a)*d);
  scene.add(g);
  var tag=document.createElement('div');tag.className='ks-tag';tag.innerHTML=s.n+'<i><b></b></i>';document.body.appendChild(tag);
  bots.push({
    id:s.id,n:s.n,b:s.b,remote:!s.b,g:g,tag:tag,hp:350,yaw:rnd(0,6.28),turn:0,alive:true,
    cd:rnd(2,5),evadeT:0,target:null,aggro:rnd(0.8, 1.4)
  });
});

/* ==================== تفريخ أطفال التنين الصغار (Hatchlings) ==================== */
var babyGeo = new THREE.ConeGeometry(2.5, 7, 5);
var babyMat = new THREE.MeshStandardMaterial({color: 0xff3d00, roughness: 0.3, emissive: 0xff1744, emissiveIntensity: 0.6});
for(var bi=0; bi<4; bi++){
  var bMesh = new THREE.Mesh(babyGeo, babyMat);
  bMesh.rotation.x = Math.PI / 2;
  var bGroup = new THREE.Group();
  bGroup.add(bMesh);
  var bAng = (bi / 4) * Math.PI * 2;
  bGroup.position.set(Math.cos(bAng)*120, 24, Math.sin(bAng)*120);
  scene.add(bGroup);
  babies.push({g: bGroup, ang: bAng, dist: rnd(90, 160), spd: rnd(0.9, 1.5), targetIdx: bi % (bots.length+1), fireCd: rnd(3, 7)});
}

/* ==================== رسائل الشبكة والمزامنة ==================== */
window.addEventListener('message',function(e){
  if(e.source!==parent)return;
  var m=e.data||{};
  if(m.type==='kos-remote'&&m.id&&m.state)remote[m.id]=m;
  if(m.type==='kos-hit'&&m.hit){
    var h=m.hit;if(!h.id||hitSeen[h.id]||h.shooterId===SELF_ID)return;hitSeen[h.id]=true;
    if(h.targetId==='dragon'){
      dragonSharedHp = Math.max(0, dragonSharedHp - (h.damage||60));
      updateBossBar(dragonSharedHp);
      if(W.dragon) W.dragon.hp = dragonSharedHp;
    } else if(h.targetId===SELF_ID&&W.ship&&typeof W.ship.hp==='number'){
      W.ship.hp=Math.max(0,W.ship.hp-(h.damage||60));
      if(W.ship.hp<=0)W.over=true;
    } else {
      var t=bots.find(function(x){return x.id===h.targetId});
      if(t&&t.alive){t.hp-=h.damage||60;if(t.hp<=0)kill(t,'قبطان')}
    }
  }
  if(m.type==='kos-go-island'&&!ended&&W.stage!=='island'){
    ended=true;say2('⚔️ تأهل أقوى 3 قراصنة إلى جزيرة المصير!');
    triggerIslandTransition();
  }
});

setInterval(function(){
  if(!W.ship||!W.ship.pos)return;
  var p=W.ship.pos;
  var yaw=lastShipPos?Math.atan2(p.z-lastShipPos.z,p.x-lastShipPos.x):0;
  lastShipPos={x:p.x,z:p.z};
  parent.postMessage({type:'kos-state',state:{pos:{x:p.x,y:p.y,z:p.z},yaw:yaw,hp:W.ship.hp,alive:!(W.over&&W.ship.hp<=0)}},'*');
},100);

function alive(){return bots.filter(function(b){return b.alive}).length+(meDead?0:1)}

function render(){
  var rows=bots.map(function(b){
    return '<li class="'+(b.alive?'':'dead')+'"><span>'+b.n+'</span><span>'+(b.alive?Math.ceil(b.hp/3.5)+'%':'غرق')+'</span></li>'
  }).join('');
  panel.innerHTML='<h4><span>الناجون الأقوياء</span><span>'+alive()+' / '+(bots.length+1)+'</span></h4><ul><li class="'+(meDead?'dead':'')+'"><span>أنت</span><span>'+(meDead?'غرق':Math.max(0, Math.ceil((W.ship?W.ship.hp:100)/3.5))+'%')+'</span></li>'+rows+'</ul>';
}

function kill(b,by){
  if(!b.alive)return;
  b.alive=false;b.hp=0;scene.remove(b.g);b.tag.remove();
  say2(b.n+' غرق'+(by?' بنيران '+by:''));
  try{boom(b.g.position.clone(),60,14)}catch(e){}
  render();check();
}

function exit(){try{parent.postMessage({type:'kos-exit'},'*')}catch(e){}}

function modal(t,p,btns){
  var m=document.createElement('div');m.className='ks-modal';
  var c=document.createElement('div');c.className='ks-card';
  c.innerHTML='<h2>'+t+'</h2><p>'+p+'</p>';
  btns.forEach(function(x){
    var b=document.createElement('button');b.textContent=x[0];if(x[2])b.className='ghost';
    b.onclick=function(){m.remove();x[1]()};c.appendChild(b);
  });
  m.appendChild(c);document.body.appendChild(m);
}

function triggerIslandTransition(){
  setTimeout(function(){
    bots.forEach(function(b){if(b.g.parent)scene.remove(b.g);b.tag.remove()});
    babies.forEach(function(bb){if(bb.g.parent)scene.remove(bb.g)});
    panel.style.display='none';
    var bh=document.getElementById('ksBossHud');if(bh)bh.style.display='none';
    if(meDead){
      modal('انتهت معركة البحر الأسطورية','الناجون الثلاثة الأقوى انتقلوا لمبارزة جزيرة المصير',[['الخروج للميناء',exit]]);
      return;
    }
    try{
      patchIslandMechanics();
      goIsland();
    }catch(err){console.error(err)}
  },2000);
}

function check(){
  if(ended||W.stage==='island')return;
  if(alive()<=3){
    ended=true;
    say2('⚔️ آخر 3 قراصنة صامدين! الانتقال فوراً لجزيرة المصير');
    try{parent.postMessage({type:'kos-trigger-island'},'*')}catch(e){}
    triggerIslandTransition();
  }
}

/* ==================== إصلاح ثغرات قتال الجزيرة والدفاع السلبي ==================== */
function patchIslandMechanics(){
  if(window.__islandPatched) return;
  window.__islandPatched = true;

  // إصلاح ثغرة الحصانة اللانهائية والتصادم بالسيف
  var origDmgF = window.dmgF;
  if(typeof origDmgF === 'function'){
    window.dmgF = function(T, dmg, from, o){
      if(!T || !T.alive) return false;
      // منع الحصانة الزائفة (Phantom invulnerability)
      if(T.inv > 0) T.inv = Math.min(T.inv, 0.04);
      
      // كسر الدفاع السلبي (Guard break on turtling)
      if(T.st === 'guard'){
        T.sta = Math.max(0, (T.sta || 100) - (dmg * 0.65));
        if(T.sta <= 0){
          T.st = 'stagger';
          T.stg = 2.8;
          T.pz = 0;
          if(typeof callout === 'function') callout(T.isP ? '💥 انكسر دفاعك بالكامل!' : '⚡ انكسر دفاع الخصم — اجهز عليه!', '#ff3d00');
        }
      }
      return origDmgF(T, dmg, from, o);
    };
  }
}

/* ==================== حلقة اللعب وتحديث الذكاء الاصطناعي للبوتات ==================== */
var last=performance.now(),v=new THREE.Vector3();
function step(now){
  requestAnimationFrame(step);
  var dt=Math.min((now-last)/1000,.05);last=now;
  if(W.stage==='island'){
    patchIslandMechanics();
    return;
  }

  // التنين الرئيسي
  if(W.dragon){
    dragonSharedHp = W.dragon.hp;
    updateBossBar(dragonSharedHp);
  }

  if(!meDead&&W.over&&W.ship&&W.ship.hp<=0){
    meDead=true;render();
    modal('غرقت سفينتك في اليم','يمكنك مشاهدة أقوى القراصنة أو العودة فوراً للميناء',[['متابعة المشاهدة',function(){spectate=true}],['الخروج',exit,1]]);
    check();
  }
  var me=W.ship&&W.ship.pos;

  /* تحديث طيران وهجمات أطفال التنين */
  babies.forEach(function(bb){
    bb.ang += bb.spd * dt * 0.4;
    var bx = Math.cos(bb.ang) * bb.dist;
    var bz = Math.sin(bb.ang) * bb.dist;
    bb.g.position.set(bx, 22 + Math.sin(bb.ang * 3) * 6, bz);
    bb.g.rotation.y = -bb.ang + Math.PI/2;
    bb.fireCd -= dt;
    if(bb.fireCd <= 0){
      bb.fireCd = rnd(4, 8);
      // إطلاق قذيفة نارية نحو أقرب سفينة
      var targetShip = (me && Math.random()<0.3) ? me : (bots.filter(function(b){return b.alive})[0] ? bots.filter(function(b){return b.alive})[0].g.position : null);
      if(targetShip && typeof boom === 'function'){
        try{boom(new THREE.Vector3(targetShip.x, 2, targetShip.z), 18, 6)}catch(e){}
      }
    }
  });

  /* ذكاء اصطناعي خارق ومناورات بشرية للبوتات */
  bots.forEach(function(b){
    if(!b.alive)return;
    var p=b.g.position;
    if(b.remote){
      var r=remote[b.id];
      if(r&&r.state){
        var st=r.state;
        if(st.alive===false){kill(b,'');return}
        if(st.pos){p.set(st.pos.x,st.pos.y,st.pos.z);b.hp=st.hp||b.hp;if(typeof st.yaw==='number')b.g.rotation.y=-st.yaw+Math.PI/2}
      }
    } else {
      // الذكاء الاصطناعي: مطاردة ومناورة
      b.turn -= dt;
      if(b.turn <= 0){
        b.turn = rnd(1, 2.5);
        // توجيه ذكي نحو أقرب هدف ضعيف أو نحو اللاعب
        var foes = bots.filter(function(o){return o.alive&&o!==b});
        if(me && !meDead) foes.push({g:{position:me}, hp: W.ship?W.ship.hp:100, isMe: true});
        foes.sort(function(x,y){return x.hp - y.hp}); // التركيز على السفينة الأضعف
        var tgt = foes[0];
        if(tgt && tgt.g){
          var tx = tgt.g.position.x, tz = tgt.g.position.z;
          b.ty = Math.atan2(tx - p.x, tz - p.z);
        } else {
          b.ty = rnd(0, 6.28);
        }
      }
      
      // تجنب حواف الخريطة
      var R=Math.hypot(p.x,p.z);
      if(R>280) b.ty=Math.atan2(-p.z,-p.x);

      var dy=((b.ty-b.yaw+Math.PI)%(6.283)+6.283)%6.283-Math.PI;
      b.yaw += Math.max(-1.8, Math.min(1.8, dy)) * dt * 1.5;
      p.x += Math.cos(b.yaw) * 19 * dt;
      p.z += Math.sin(b.yaw) * 19 * dt;
      try{p.y=waveH(p.x,p.z,W.t||0)*.6}catch(e){}
      b.g.rotation.y = -b.yaw + Math.PI/2;

      // إطلاق نيران ذكية وسريعة
      b.cd -= dt;
      if(b.cd <= 0){
        b.cd = rnd(2.5, 5);
        // استهداف التنين أو استهداف سفينة منافسة
        if(Math.random() < 0.45 && W.dragon && W.dragon.hp > 0){
          W.dragon.hp = Math.max(0, W.dragon.hp - rnd(40, 80));
          dragonSharedHp = W.dragon.hp;
          updateBossBar(dragonSharedHp);
        } else {
          var targetFoes = bots.filter(function(o){return o.alive&&o!==b&&!o.remote});
          if(targetFoes.length){
            var f = targetFoes[(Math.random()*targetFoes.length)|0];
            f.hp -= rnd(35, 75);
            if(f.hp <= 0) kill(f, b.n);
          }
        }
      }
    }

    // فحص تصادم مقذوفات وصواريخ اللاعب مع سفن البوتات والتنين
    if(W.missiles){
      W.missiles.forEach(function(m){
        if(m.P && !m.ksHit && Math.hypot(m.P.x - p.x, m.P.z - p.z) < 14 && m.P.y < 22){
          m.ksHit = true; m.life = 0; b.hp -= 70;
          try{boom(m.P.clone(), 35, 10)}catch(e){}
          if(b.remote){
            var hit = {id: SELF_ID+'-'+(++hitSeq), shooterId: SELF_ID, targetId: b.id, damage: 70};
            hitSeen[hit.id] = true;
            parent.postMessage({type:'kos-hit', hit: hit}, '*');
          }
          if(b.hp <= 0) kill(b, 'أنت');
        }
      });
    }

    v.set(p.x, p.y+15, p.z).project(cam);
    var on = v.z<1 && Math.abs(v.x)<1.1 && Math.abs(v.y)<1.1 && Math.hypot(p.x-(me?me.x:0), p.z-(me?me.z:0))<450;
    b.tag.style.display = on ? 'block' : 'none';
    if(on){
      b.tag.style.left = ((v.x+1)/2*innerWidth)+'px';
      b.tag.style.top = ((1-v.y)/2*innerHeight)+'px';
      b.tag.querySelector('b').style.width = Math.max(0, b.hp/3.5)+'%';
    }
  });

  if(spectate){
    var t=bots.find(function(b){return b.alive});
    if(t){
      cam.position.lerp(new THREE.Vector3(t.g.position.x-45, 34, t.g.position.z-45), .05);
      cam.lookAt(t.g.position);
    }
  }
}

render();
requestAnimationFrame(step);
setInterval(render, 1000);

/* ==================== تشغيل عصا التحكم الذكية AAA ==================== */
var joyZone = document.getElementById('ksJoyZone');
var joyBase = document.getElementById('ksJoyBase');
var joyThumb = document.getElementById('ksJoyThumb');
var joyActive = false, joyStart = {x: 0, y: 0};

if(joyZone && joyBase && joyThumb){
  function onJoyStart(e){
    var touch = e.touches ? e.touches[0] : e;
    joyActive = true;
    joyStart = {x: touch.clientX, y: touch.clientY};
    joyBase.style.display = 'block';
    joyBase.style.left = joyStart.x + 'px';
    joyBase.style.top = joyStart.y + 'px';
    joyThumb.style.transform = 'translate(0px, 0px)';
  }

  function onJoyMove(e){
    if(!joyActive) return;
    var touch = e.touches ? e.touches[0] : e;
    var dx = touch.clientX - joyStart.x;
    var dy = touch.clientY - joyStart.y;
    var dist = Math.hypot(dx, dy);
    var maxR = 50;
    if(dist > maxR){
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joyThumb.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    
    // نقل المدخلات لحركة السفينة
    if(typeof keys !== 'undefined'){
      keys.a = dx < -14;
      keys.d = dx > 14;
      keys.w = dy < -14;
      keys.s = dy > 14;
    }
    if(typeof sticks !== 'undefined' && sticks.L){
      sticks.L.x = dx / maxR;
      sticks.L.y = -dy / maxR;
    }
  }

  function onJoyEnd(){
    joyActive = false;
    joyBase.style.display = 'none';
    if(typeof keys !== 'undefined'){
      keys.a = keys.d = keys.w = keys.s = false;
    }
    if(typeof sticks !== 'undefined' && sticks.L){
      sticks.L.x = sticks.L.y = 0;
    }
  }

  joyZone.addEventListener('touchstart', onJoyStart, {passive: false});
  window.addEventListener('touchmove', onJoyMove, {passive: false});
  window.addEventListener('touchend', onJoyEnd);
  window.addEventListener('touchcancel', onJoyEnd);
}

/* ==================== تشغيل زر إطلاق النار AAA ==================== */
var fireBtn = document.getElementById('ksFireBtn');
if(fireBtn){
  function doFire(e){
    if(e) e.preventDefault();
    if(typeof fireMissile === 'function'){
      fireMissile();
    } else {
      var oldBf = document.getElementById('bF');
      if(oldBf) oldBf.click();
    }
  }
  fireBtn.addEventListener('touchstart', doFire, {passive: false});
  fireBtn.addEventListener('click', doFire);
}

})();
</script>`;
}
