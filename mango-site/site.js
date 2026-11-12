/* The Mango Theory — elevated interactions
   Content-first logic runs unconditionally; decorative/motion is progressive + reduced-motion aware. */

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover:none),(pointer:coarse)').matches;
// set by the footer "Pause animations" button (and restored from localStorage in <head>)
const motionPaused = () => document.documentElement.classList.contains('motion-paused');
// iOS Safari fires 'resize' every time its address bar collapses or expands while scrolling.
// Layout here only depends on width, so ignore height-only resizes (they caused re-measuring
// and scroll jumps right as people started scrolling).
function onWidthResize(cb){
  let w=window.innerWidth;
  window.addEventListener('resize',()=>{ if(window.innerWidth===w) return; w=window.innerWidth; cb(); });
}
window.__onWidthResize = onWidthResize;

/* ---------------- CONTENT FIRST ---------------- */

document.getElementById('yr').textContent = new Date().getFullYear();

// brand logos (real)
const LOGOS = [
  {name:"Himalaya",file:"logos/Himalaya.png"},{name:"The Derma Co",file:"logos/The-Derma-Co.png"},
  {name:"OZiva",file:"logos/OZiva.png"},{name:"Nivea",file:"logos/Nivea.png"},
  {name:"Mamaearth",file:"logos/Mamaearth.png"},{name:"Lakme",file:"logos/Lakme.png"},
  {name:"BBLUNT",file:"logos/BBLUNT.png"},{name:"Plix",file:"logos/Plix.png"},
  {name:"WishCare",file:"logos/WishCare.png"},{name:"Vaseline",file:"logos/Vaseline.png"},
  {name:"Dr. Sheth's",file:"logos/Dr-Sheth-s.png"},{name:"mCaffeine",file:"logos/mCaffeine.png"},
  {name:"Mars",file:"logos/Mars.png"},{name:"Lenskart",file:"logos/Lenskart.png"},
  {name:"Love Beauty and Planet",file:"logos/Love-Beauty-and-Planet.png"},{name:"Hyphen",file:"logos/Hyphen.png"},
  {name:"Deconstruct",file:"logos/Deconstruct.png"},{name:"Bare Anatomy",file:"logos/Bare-Anatomy.png"},
  {name:"Bodywise",file:"logos/Bodywise.png"},{name:"Perfora",file:"logos/Perfora.png"},
  {name:"Dot & Key",file:"logos/Dot-and-Key.jpg"},{name:"Swiss Beauty",file:"logos/Swiss-Beauty.png"}
];
function fillBrandRow(id, logos){
  const el = document.getElementById(id); if(!el) return;
  const items = [...logos, ...logos];
  // inner wrapper kept separate from the outer cell for a clean split between the cell's
  // own subtle state and any per-logo detail
  el.innerHTML = items.map(l=>`<div class="brand-cell"><span class="brand-cell-inner"><img alt="${l.name}" loading="lazy" decoding="async"></span></div>`).join('');
  el.querySelectorAll('.brand-cell').forEach((cell,idx)=>{
    const l = items[idx];
    const img = cell.querySelector('img');
    const inner = cell.querySelector('.brand-cell-inner');
    img.addEventListener('error',()=>{
      img.style.display='none';
      if(!cell.querySelector('.brand-text')){
        const s=document.createElement('span'); s.className='brand-text'; s.textContent=l.name; inner.appendChild(s);
      }
    });
    img.src = l.file;
  });
}
// split dynamically down the middle so adding/removing brands never leaves one row empty
const brandMid = Math.ceil(LOGOS.length/2);
fillBrandRow('brandRow1', LOGOS.slice(0, brandMid));
fillBrandRow('brandRow2', LOGOS.slice(brandMid));

// the marquee's CSS animation keeps running (and its will-change layer stays GPU-promoted)
// for the entire page lifetime by default, even scrolled miles away — pause both rows
// whenever the section isn't visible so it isn't quietly competing for frame budget
// the whole time someone's reading a completely different part of the page.
(function pauseBrandsOffscreen(){
  var brandsSection = document.getElementById('brands');
  var rows = document.querySelectorAll('#brandRow1, #brandRow2');
  if(!brandsSection || !rows.length || !window.IntersectionObserver) return;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      rows.forEach(function(r){ r.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused'; });
    });
  }, {threshold:0});
  io.observe(brandsSection);
})();

// counters
document.querySelectorAll('.why-num').forEach(numEl=>{
  const target = parseInt(numEl.dataset.count,10);
  const isLive = numEl.parentElement.parentElement.querySelector('#liveTag');
  function startLiveTick(cur){
    if(!isLive) return;
    document.getElementById('liveTag').classList.add('show');
    setInterval(()=>{
      if(document.hidden || motionPaused()) return;
      cur += 1; numEl.textContent = cur;
      numEl.classList.add('tick'); setTimeout(()=>numEl.classList.remove('tick'),350);
    }, 900);
  }
  if(window.IntersectionObserver){
    const io = new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){
        let cur=0; const step=Math.max(1,Math.round(target/34));
        const t=setInterval(()=>{cur+=step; if(cur>=target){cur=target;clearInterval(t);numEl.textContent=cur;startLiveTick(cur);return;} numEl.textContent=cur;},28);
        io.unobserve(numEl);
      }
    }),{threshold:.5});
    io.observe(numEl);
  } else { numEl.textContent = target; startLiveTick(target); }
});

// language rotator
const regions=[
  {lang:"हिंदी",name:"Hindi",meta:"Pan-India · Hindi"},
  {lang:"தமிழ்",name:"Tamil",meta:"Tamil Nadu · Tamil"},
  {lang:"తెలుగు",name:"Telugu",meta:"Andhra / Hyderabad · Telugu"},
  {lang:"বাংলা",name:"Bengali",meta:"West Bengal · Bengali"},
  {lang:"मराठी",name:"Marathi",meta:"Maharashtra · Marathi"},
  {lang:"ਪੰਜਾਬੀ",name:"Punjabi",meta:"Punjab · Punjabi"},
  {lang:"മലയാളം",name:"Malayalam",meta:"Kerala · Malayalam"},
  {lang:"ಕನ್ನಡ",name:"Kannada",meta:"Karnataka · Kannada"},
  {lang:"राजस्थानी",name:"Rajasthani",meta:"Rajasthan · Rajasthani"},
  {lang:"English",name:"English",meta:"Pan-India · English"}
];
const rotatorWord=document.getElementById('rotatorWord');
const rotatorMeta=document.getElementById('rotatorMeta');
const rotatorDots=document.getElementById('rotatorDots');
const expStrip=document.getElementById('expStrip');
rotatorDots.innerHTML = regions.map((r,i)=>`<button type="button" data-i="${i}" class="${i===0?'active':''}" aria-label="Show ${r.name}"${i===0?' aria-current="true"':''}></button>`).join('');
expStrip.innerHTML = regions.map((r,i)=>`<span class="exp-chip ${i===0?'on':''}" data-i="${i}">${r.name}</span>`).join('');
let rIdx=0, rTimer=null;
function showRegion(i){
  rIdx=i;
  rotatorWord.classList.add('fade');
  setTimeout(()=>{
    rotatorWord.innerHTML = `<span class="rw-accent">${regions[i].lang}</span>`;
    rotatorMeta.textContent = regions[i].meta;
    rotatorWord.classList.remove('fade');
  },230);
  rotatorDots.querySelectorAll('button').forEach(s=>{
    const on = +s.dataset.i===i;
    s.classList.toggle('active', on);
    if(on) s.setAttribute('aria-current','true'); else s.removeAttribute('aria-current');
  });
  expStrip.querySelectorAll('.exp-chip').forEach(s=>s.classList.toggle('on', +s.dataset.i===i));
}
// auto-advance holds while the rotator is hovered or has keyboard focus, and while the
// visitor has paused animations — so it can always be read / operated at the visitor's pace
let rotatorHeld=false;
function nextRegion(){ if(rotatorHeld || motionPaused()) return; showRegion((rIdx+1)%regions.length); }
function startRotator(){ clearInterval(rTimer); rTimer=setInterval(nextRegion, 1600); }
const rotatorEl=document.getElementById('rotator');
if(rotatorEl){
  rotatorEl.addEventListener('mouseenter',()=>{ rotatorHeld=true; });
  rotatorEl.addEventListener('mouseleave',()=>{ rotatorHeld=rotatorEl.contains(document.activeElement); });
  rotatorEl.addEventListener('focusin',()=>{ rotatorHeld=true; });
  rotatorEl.addEventListener('focusout',e=>{ if(!rotatorEl.contains(e.relatedTarget)) rotatorHeld=rotatorEl.matches(':hover'); });
}
rotatorDots.querySelectorAll('button').forEach(s=>s.addEventListener('click',()=>{showRegion(+s.dataset.i);startRotator();}));
expStrip.querySelectorAll('.exp-chip').forEach(s=>s.addEventListener('click',()=>{showRegion(+s.dataset.i);startRotator();}));
showRegion(0); startRotator();

// tab title nudge
const originalTitle=document.title;
document.addEventListener('visibilitychange',()=>{ document.title = document.hidden ? 'Come back, we miss you :(' : originalTitle; });

// theme toggle
const themeToggle=document.getElementById('themeToggle');
const iconMoon=document.getElementById('iconMoon'), iconSun=document.getElementById('iconSun');
function syncThemeIcon(){
  const isLight=document.documentElement.classList.contains('light-theme');
  iconMoon.style.display=isLight?'block':'none';
  iconSun.style.display=isLight?'none':'block';
}
syncThemeIcon();
themeToggle.addEventListener('click',()=>{
  document.documentElement.classList.toggle('light-theme');
  const isLight=document.documentElement.classList.contains('light-theme');
  try{ localStorage.setItem('mt-theme', isLight?'light':'dark'); }catch(e){}
  syncThemeIcon();
});

// mobile menu
const navToggle=document.getElementById('navToggle'), mobileMenu=document.getElementById('mobileMenu');
// closed menu is `inert` (starts that way in the HTML) so its off-screen links can't be tabbed
// to; aria-expanded tells screen readers the state
function setMenu(open){
  navToggle.classList.toggle('open', open);
  mobileMenu.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  mobileMenu.inert = !open;
  if(open){ const first=mobileMenu.querySelector('a'); if(first) first.focus(); }
}
navToggle.addEventListener('click',()=>{ setMenu(!mobileMenu.classList.contains('open')); });
mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
window.addEventListener('keydown',e=>{
  if(e.key==='Escape' && mobileMenu.classList.contains('open')){ setMenu(false); navToggle.focus(); }
});

// pause/resume all animations (footer button) — remembered for next visit
const motionToggle=document.getElementById('motionToggle');
function syncMotionToggle(){
  if(!motionToggle) return;
  const p=motionPaused();
  motionToggle.textContent = p ? 'Play animations' : 'Pause animations';
  motionToggle.setAttribute('aria-pressed', String(p));
}
if(motionToggle){
  syncMotionToggle();
  motionToggle.addEventListener('click',()=>{
    const p=document.documentElement.classList.toggle('motion-paused');
    try{ localStorage.setItem('mt-motion', p?'paused':'playing'); }catch(e){}
    syncMotionToggle();
  });
}

// nav hide on scroll down
let lastY=window.scrollY, navHidden=false;
const navEl=document.querySelector('nav');
window.addEventListener('scroll',()=>{
  const y=window.scrollY, hide = y>lastY && y>160;
  if(hide!==navHidden){ navHidden=hide; navEl.style.transform = hide ? 'translateY(-115%)' : 'translateY(0)'; }
  lastY=y;
},{passive:true});

// contact form → Netlify with mailto fallback
// Success is only shown when Netlify actually accepted the submission. If it fails, the
// visitor is told plainly, their answers stay in the form, and the mail-app draft is offered
// as a fallback — previously the fallback also showed "Sweet, that's in." even if the email
// was never sent, silently losing the lead.
document.getElementById('campaignForm').addEventListener('submit',function(e){
  e.preventDefault();
  const form=this;
  const submitBtn=form.querySelector('[type="submit"]');
  const btnLabel=submitBtn.textContent;
  const errorEl=document.getElementById('formError');
  errorEl.classList.remove('show');
  submitBtn.disabled=true; submitBtn.textContent='Sending…';
  const encoded=new URLSearchParams(new FormData(form)).toString();
  fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:encoded})
    .then(res=>{ if(!res.ok) throw new Error('form endpoint returned '+res.status); showSuccess(form); })
    .catch(()=>{
      submitBtn.disabled=false; submitBtn.textContent=btnLabel;
      errorEl.classList.add('show');
      const g=id=>document.getElementById(id).value;
      const subject=encodeURIComponent(`${g('fcompany')} x The Mango Theory | Collaboration`);
      const body=encodeURIComponent(`Name: ${g('fname')}\nEmail: ${g('femail')}\nCompany: ${g('fcompany')}\nWebsite: ${g('fwebsite')}\nBudget: ${g('fbudget')}\n\nWhat they're looking to promote:\n${g('fmessage')}`);
      window.location.href=`mailto:business@themangotheory.co?subject=${subject}&body=${body}`;
    });
});
function showSuccess(form){
  form.style.display='none';
  const s=document.getElementById('successState');
  s.classList.add('show'); s.focus(); // move focus so keyboard/screen-reader users land on the confirmation
}

/* ---------------- OFFERINGS DATA + BUILD ---------------- */
const SERVICES=[
  {num:"01",name:"Influencer Marketing",eyebrow:"Reach with resonance",desc:"The right creators, the right audience, the right moment.",detail:"We match brands with creators who fit the story — not just the follower count — then run the campaign end to end: discovery, negotiation, execution and reporting."},
  {num:"02",name:"Performance Marketing",eyebrow:"Strategy, creativity, data",desc:"Campaigns engineered to move a real business metric.",detail:"Strategy and creative, pressure-tested against data at every step. Built to grow the number that actually matters, not the vanity one."},
  {num:"03",name:"Creator Management",eyebrow:"Our exclusive roster",desc:"We represent a roster of exclusive creators and help them grow.",detail:"Brand deals, negotiations, content planning and long-term growth, handled for the creators we manage. Creator looking for representation? <a href=\"mailto:business@themangotheory.co?subject=Creator%20onboarding\">Write to us to get onboarded</a>."},
  {num:"04",name:"Music Production",eyebrow:"Sound that sticks",desc:"Original jingles and sound design you can't scroll past.",detail:"Custom music and audio identity, crafted so your brand is recognised in three notes — before anyone reads a word."},
  {num:"05",name:"End-to-End Video Production",eyebrow:"Concept to final cut",desc:"Video built to stop the scroll, not just fill a feed.",detail:"Concept, shoot and edit, entirely in-house. Made for the platform it lives on, and for the moment someone decides not to keep scrolling."}
];
const offNav=document.getElementById('offNav');
const offStage=document.querySelector('.off-stage.off-desktop');
const offSlides=document.getElementById('offSlides');
const offBigNum=document.getElementById('offBigNum');
const offProgressBar=document.getElementById('offProgressBar');
const offMobile=document.getElementById('offMobile');
// real <button>s so keyboard users can reach and activate each offering
offNav.innerHTML=SERVICES.map((s,i)=>`<button type="button" class="off-nav-item magnetic ${i===0?'active':''}" data-i="${i}" data-cursor="explore" aria-controls="offSlides"><span class="oi-num">${s.num}</span><span class="oi-name">${s.name}</span></button>`).join('');
offSlides.innerHTML=SERVICES.map((s,i)=>`<div class="off-slide ${i===0?'active':''}" data-i="${i}"><div class="os-eyebrow">${s.eyebrow}</div><h3>${s.name}</h3><p class="os-desc">${s.desc}</p><p class="os-detail">${s.detail}</p></div>`).join('');
offMobile.innerHTML='<div class="off-mhint"><span></span>Swipe through</div><div class="off-mtrack" id="offMtrack">'+SERVICES.map(s=>`<div class="off-mcard"><div class="mc-num">${s.num}</div><div class="mc-eyebrow">${s.eyebrow}</div><h3>${s.name}</h3><p class="mc-desc">${s.desc}</p><p class="mc-detail">${s.detail}</p></div>`).join('')+'</div>';

// keep the progress bar + big number in sync with the mobile swipe carousel too —
// it was visible on mobile but nothing was updating it as you swiped between cards
(function(){
  const track = document.getElementById('offMtrack');
  if(!track) return;
  const cards = track.querySelectorAll('.off-mcard');
  let ticking = false;
  function updateFromSwipe(){
    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + trackRect.width/2;
    let closest = 0, closestDist = Infinity;
    cards.forEach((card,i)=>{
      const r = card.getBoundingClientRect();
      const dist = Math.abs((r.left+r.width/2) - center);
      if(dist < closestDist){ closestDist = dist; closest = i; }
    });
    offBigNum.textContent = SERVICES[closest].num;
    offProgressBar.style.transform = `translateX(${closest*100}%)`;
    ticking = false;
  }
  track.addEventListener('scroll', ()=>{
    if(!ticking){ requestAnimationFrame(updateFromSwipe); ticking = true; }
  }, {passive:true});
})();

let offActive=-1;
function setOffActive(i){
  if(i===offActive) return; offActive=i;
  offNav.querySelectorAll('.off-nav-item').forEach(el=>{
    const on = +el.dataset.i===i;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  offSlides.querySelectorAll('.off-slide').forEach(el=>{
    const on = +el.dataset.i===i;
    el.classList.toggle('active', on);
    // links in the hidden (opacity:0) slides must not be reachable by Tab
    el.querySelectorAll('a').forEach(a=>{ a.tabIndex = on ? 0 : -1; });
  });
  offBigNum.textContent=SERVICES[i].num;
  offProgressBar.style.transform=`translateX(${i*100}%)`;
}
setOffActive(0);
function goToOffering(i){
  if(window.__lenis && window.__offTop!=null){
    window.__lenis.scrollTo(window.__offTop + (i/SERVICES.length)*window.__offLen + 8, {duration:0.55});
  } else {
    setOffActive(i);
  }
}
offNav.querySelectorAll('.off-nav-item').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ if(window.__offScrub) return; setOffActive(+el.dataset.i); });
  // tabbing onto an offering shows it — on desktop the pinned section is driven by scroll
  // position, so jump to that item's spot exactly like a click does
  el.addEventListener('focus',()=>{ if(el.matches(':focus-visible')) goToOffering(+el.dataset.i); });
  el.addEventListener('click',()=>goToOffering(+el.dataset.i));
});

/* ---------------- DECORATIVE / MOTION ---------------- */
try {

// reveals
const REVEAL='.reveal,.reveal-left,.reveal-right,.reveal-pop,.reveal-up-big';
// phones show everything immediately (see the mobile CSS block) — no observer needed there
if(window.IntersectionObserver && !isTouch){
  const io=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('in', e.isIntersecting)),{threshold:.16,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll(REVEAL).forEach(el=>io.observe(el));
} else { document.querySelectorAll(REVEAL).forEach(el=>el.classList.add('in')); }

// grain — a small noise tile generated once and repeated, instead of a full-screen SVG
// turbulence filter under mix-blend-mode:overlay (which forced an extra full-page blend pass
// every frame). At 2.8% opacity the visual is the same faint speckle.
(function(){
  const grainEl=document.getElementById('grain'); if(!grainEl) return;
  const c=document.createElement('canvas'); c.width=c.height=160;
  const g=c.getContext('2d'); if(!g) return;
  const img=g.createImageData(160,160);
  for(let i=0;i<img.data.length;i+=4){ const v=(Math.random()*255)|0; img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255; }
  g.putImageData(img,0,0);
  grainEl.style.backgroundImage=`url(${c.toDataURL()})`;
})();

// custom cursor
const cursorDot=document.getElementById('cursorDot');
const swarmParticles=[...document.querySelectorAll('.swarm-p')];
const cursorLabel=document.getElementById('cursorLabel');
const cursorGlow=document.getElementById('cursorGlow');
let hoverTarget=null, mx=window.innerWidth/2, my=window.innerHeight/2;

if(!isTouch){
  // only now that the custom cursor is actually running do we hide the native one (see CSS)
  document.documentElement.classList.add('custom-cursor');
  // each particle orbits independently — its own radius, angular speed (some reversed),
  // and starting phase — so the swarm never looks mechanically synchronized
  const PARTICLE_CFG=[
    {radius:16, speed:1.7, phase:0},
    {radius:23, speed:-1.15, phase:1.3},
    {radius:12, speed:2.2, phase:2.7},
    {radius:27, speed:0.85, phase:4.1},
    {radius:19, speed:-1.75, phase:5.4}
  ];
  let orbitX=mx, orbitY=my, glowX=mx, glowY=my;
  let radiusMult=1, targetRadiusMult=1, t=0;
  window.addEventListener('mousemove',e=>{
    mx=e.clientX; my=e.clientY;
    cursorDot.style.transform='translate3d('+mx+'px,'+my+'px,0) translate(-50%,-50%)'; // transform, not left/top — skips layout, GPU-composited only
    cursorLabel.style.left=mx+'px'; cursorLabel.style.top=my+'px';
  });
  const orbitEase=prefersReduced?1:0.2;
  const glowEase=prefersReduced?1:0.09; // noticeably slower than the swarm — this lag is the whole trailing-light effect
  (function loop(){
    let tx=mx, ty=my;
    if(hoverTarget){
      const r=hoverTarget.getBoundingClientRect();
      tx=r.left+r.width/2; ty=r.top+r.height/2;
    }
    orbitX+=(tx-orbitX)*orbitEase; orbitY+=(ty-orbitY)*orbitEase;
    targetRadiusMult=hoverTarget?1.9:1;
    radiusMult+=(targetRadiusMult-radiusMult)*0.15;
    if(!prefersReduced) t+=0.016;

    swarmParticles.forEach((p,i)=>{
      const cfg=PARTICLE_CFG[i];
      const angle=cfg.phase+t*cfg.speed;
      const r=cfg.radius*radiusMult;
      const px=orbitX+Math.cos(angle)*r;
      const py=orbitY+Math.sin(angle)*r*0.62; // squashed into an ellipse for a swirling-disk feel
      p.style.transform=`translate(${px}px,${py}px) translate(-50%,-50%)`;
    });

    if(cursorGlow){ glowX+=(mx-glowX)*glowEase; glowY+=(my-glowY)*glowEase; cursorGlow.style.transform='translate3d('+glowX+'px,'+glowY+'px,0) translate(-50%,-50%)'; }
    requestAnimationFrame(loop);
  })();

  function bindCursor(el){
    el.addEventListener('mouseenter',()=>{
      hoverTarget=el;
      if(cursorGlow) cursorGlow.classList.add('hovering');
      const mode=el.getAttribute('data-cursor');
      if(mode==='explore'){ cursorLabel.textContent='Explore'; cursorLabel.classList.add('show'); }
      else if(mode==='arrow'){ cursorLabel.textContent='→'; cursorLabel.classList.add('show'); }
    });
    el.addEventListener('mouseleave',()=>{ hoverTarget=null; if(cursorGlow) cursorGlow.classList.remove('hovering'); cursorLabel.classList.remove('show'); });
  }
  document.querySelectorAll('.magnetic,[data-cursor]').forEach(bindCursor);
  bindCursor(navToggle);

  // shining trail — spawns a fading dot once the cursor has traveled a minimum distance
  // since the last one, so movement density (not time) controls how often it appears;
  // completely silent while the cursor is still
  if(!prefersReduced){
    let trailLastX=mx, trailLastY=my;
    const TRAIL_MIN_DIST=22;
    document.addEventListener('mousemove',e=>{
      const dx=e.clientX-trailLastX, dy=e.clientY-trailLastY;
      if(Math.hypot(dx,dy) < TRAIL_MIN_DIST) return;
      trailLastX=e.clientX; trailLastY=e.clientY;
      const t=document.createElement('div');
      t.className='cursor-trail';
      t.style.left=e.clientX+'px'; t.style.top=e.clientY+'px';
      document.body.appendChild(t);
      t.addEventListener('animationend',()=>t.remove());
    });
  }

  // magnetic pull
  document.querySelectorAll('.magnetic').forEach(btn=>{
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      const rx=e.clientX-(r.left+r.width/2), ry=e.clientY-(r.top+r.height/2);
      btn.style.transform=`translate(${rx*0.2}px,${ry*0.26}px)`;
    });
    btn.addEventListener('mouseleave',()=>{ btn.style.transform=''; });
  });
}

// hero masked line reveal (signature on-load moment)
function playHeroReveal(){
  const inner=document.getElementById('heroInner');
  if(inner) inner.classList.add('revealed');
}

// hero scroll scrub
const heroSection=document.getElementById('hero'), heroInner=document.getElementById('heroInner'), heroGlow=document.getElementById('heroGlow'), heroHint=document.getElementById('heroHint');
const heroOrb1=document.getElementById('heroOrb1'), heroOrb2=document.getElementById('heroOrb2');
// hero size is measured on load/resize only — reading offsetHeight inside every scroll
// event forced the browser to recalculate layout each time, a real cost on phones
let heroH=1, heroW=0, lastHeroP=-1;
function measureHero(){ heroH=heroSection.offsetHeight||1; heroW=heroSection.offsetWidth; lastHeroP=-1; }
measureHero();
onWidthResize(()=>{ measureHero(); updateHeroScroll(window.scrollY||0); });
window.addEventListener('load',measureHero); // hero logo / fonts can change its height after first paint
function updateHeroScroll(y){
  if(isTouch) return; // phones: the hero stays as-is while scrolling — the fade read as jank
  const h=heroH, w=heroW;
  const p=Math.min(Math.max(y/h,0),1);
  if(p===lastHeroP) return; // e.g. scrolled well past the hero — nothing to update
  lastHeroP=p;
  heroInner.style.transform=`translateY(${p*60}px) scale(${1-p*0.06})`;
  heroInner.style.opacity=String(1-p*0.85);
  heroGlow.style.opacity=String(p*0.9);
  heroHint.style.opacity=String(1-p*3);
  // the orbs are slid with transform (GPU only) — same path as the old CSS-var gradient
  // positions, without repainting the hero
  heroOrb1.style.transform=`translate(${(-0.22*p*w).toFixed(1)}px,${(0.55*p*h).toFixed(1)}px)`;
  heroOrb2.style.transform=`translate(${(-0.30*p*w).toFixed(1)}px,${(0.40*p*h).toFixed(1)}px)`;
}

// background SVG parallax + per-section intensity
const bg=document.getElementById('bgTexture');
const texHeavy=bg.querySelector('.tex-heavy'), texSoft=bg.querySelector('.tex-soft');
let cursorPX=0, cursorPY=0;
if(!isTouch && !prefersReduced){
  window.addEventListener('mousemove',e=>{ cursorPX=(e.clientX/window.innerWidth-0.5); cursorPY=(e.clientY/window.innerHeight-0.5); });
}
function updateBgParallax(y){
  // moving the blurred SVG forces the blur to be recomputed each scroll — keep it static on touch
  if(prefersReduced || isTouch) return;
  const hy=y*-0.06 + cursorPY*24, hx=cursorPX*24;
  const sy=y*-0.03 + cursorPY*-14, sx=cursorPX*-14;
  if(texHeavy) texHeavy.style.transform=`translate(${hx.toFixed(1)}px,${hy.toFixed(1)}px)`;
  if(texSoft) texSoft.style.transform=`translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
}
// intensity: strong in hero/contact, quiet in content
const INTENSITY={hero:1,about:0.4,offerings:0.55,why:0.4,brands:0,expertise:0.5,contact:1};
if(window.IntersectionObserver){
  const io3=new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ const v=INTENSITY[e.target.id]; if(v!=null) bg.style.opacity=String(v); } });
  },{threshold:.4});
  ['hero','about','offerings','why','brands','expertise','contact'].forEach(id=>{ const el=document.getElementById(id); if(el) io3.observe(el); });
}

/* ---------------- LENIS + GSAP ---------------- */
let lenis=null;
function initLenis(){
  if(prefersReduced || isTouch || !window.Lenis) return null;
  const l=new Lenis({ duration:1.05, smoothWheel:true, smoothTouch:false, easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)) });
  window.__lenis=l;
  if(window.gsap && window.ScrollTrigger){
    l.on('scroll',()=>ScrollTrigger.update());
    gsap.ticker.add(t=>l.raf(t*1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    function raf(t){ l.raf(t); requestAnimationFrame(raf); } requestAnimationFrame(raf);
  }
  return l;
}

// unified scroll read (works with lenis or native)
function onScroll(y){ updateHeroScroll(y); updateBgParallax(y); }

function setupScroll(){
  lenis=initLenis();
  if(lenis){ lenis.on('scroll',({scroll})=>onScroll(scroll)); }
  else { window.addEventListener('scroll',()=>onScroll(window.scrollY),{passive:true}); }
  onScroll(window.scrollY||0);

  // smooth anchor nav
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const id=a.getAttribute('href');
      if(id==='#'){ e.preventDefault(); if(lenis) lenis.scrollTo(0); else window.scrollTo({top:0,behavior:'smooth'}); return; }
      const t=document.querySelector(id);
      if(t){ e.preventDefault(); if(lenis) lenis.scrollTo(t,{offset:-10}); else t.scrollIntoView({behavior:'smooth'}); }
    });
  });

  // GSAP: pinned Offerings + band drift
  if(window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    const mm=gsap.matchMedia();
    mm.add("(min-width:981px)",()=>{
      if(prefersReduced) return;
      const len=window.innerHeight*(SERVICES.length-0.15);
      let lastOffFr=null;
      const st=ScrollTrigger.create({
        trigger:"#offerings", start:"top top", end:"+="+len, pin:"#offPin", scrub:true, anticipatePin:1,
        onUpdate:self=>{
          window.__offScrub=true;
          const idx=Math.max(0,Math.min(SERVICES.length-1,Math.floor(self.progress*SERVICES.length*0.999)));
          setOffActive(idx);
          // one-time shift, not a repeating pulse: the nav recedes and the detail panel
          // gains focus once, early in the very first point, then STAYS that way through
          // all 5 points — no reversing back to "reference" between points anymore
          // zooms in once near the start, holds through all 5 points, then eases back to
          // reference once more right at the very end (after point 5), symmetric with the
          // opening transition — not a repeat per point, just bookends on the whole section
          const riseEnd=0.06, fallStart=0.94;
          let focus;
          if(self.progress<riseEnd){ focus=0.5-0.5*Math.cos(Math.PI*(self.progress/riseEnd)); }
          else if(self.progress<fallStart){ focus=1; }
          else { focus=0.5+0.5*Math.cos(Math.PI*((self.progress-fallStart)/(1-fallStart))); }
          // the fr value drives a grid re-layout — only write it when it actually changes, so
          // the long flat middle of the pin (focus=1) costs no layout at all
          const fr=(1.15 - focus*0.55).toFixed(3);
          if(offStage && fr!==lastOffFr){ lastOffFr=fr; offStage.style.setProperty('--off-nav-fr', fr+'fr'); }
          if(offNav){ offNav.style.opacity=(1 - focus*0.32).toFixed(3); }
        },
        onEnter:()=>window.__offScrub=true, onLeave:()=>window.__offScrub=false, onLeaveBack:()=>window.__offScrub=false, onEnterBack:()=>window.__offScrub=true
      });
      window.__offTop=st.start; window.__offLen=len;
      return ()=>{ st.kill(); window.__offScrub=false; };
    });

    // Why section — scroll-scrubbed reveal, not the site's usual threshold-triggered
    // fixed-duration transition. Each row's opacity/position is driven directly by scroll
    // progress through its own trigger range, so it's exactly as smooth as the scroll
    // itself and fully reverses (eases back out) when scrolling back up past it. Direction
    // alternates left/right by row index, matching the rows' own alternating grid layout.
    if(!prefersReduced){
      document.querySelectorAll('#why .why-row').forEach((row,i)=>{
        const fromX = i % 2 === 0 ? -90 : 90;
        gsap.fromTo(row,
          {opacity:0, x:fromX, scale:.965},
          {opacity:1, x:0, scale:1, ease:'none',
            scrollTrigger:{trigger:row, start:'top 90%', end:'top 48%', scrub:0.6}}
        );
      });
    }

    ScrollTrigger.refresh();
  }
  // Band marquee movement is handled entirely by the vanilla scroll-linked
  // script in index.html (initScrollBands) — intentionally not duplicated
  // here, since two systems fighting for the same transform was the cause
  // of the empty-space/stutter bug.
}

// mobile offerings reveal
if(window.IntersectionObserver){
  const io4=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('in',e.isIntersecting)),{threshold:.2});
  offMobile.querySelectorAll('.reveal-up-big').forEach(el=>io4.observe(el));
}

// loader → scroll setup (decoupled from window.load, which can hang on CDN/fonts)
const loaderEl=document.getElementById('loader');
let scrollReady=false;
// GSAP/ScrollTrigger/Lenis load async from CDNs, so scroll effects start once they've
// arrived — page content never waits on them. The loader itself is dismissed by the inline
// script in <head>.
function libsReady(){
  if(isTouch || prefersReduced) return true; // these devices don't load the scroll libraries
  return !!(window.gsap && window.ScrollTrigger && window.Lenis);
}
function startScrollWhenReady(){
  if(scrollReady) return;
  const go=()=>{ if(!scrollReady){ scrollReady=true; setupScroll(); } };
  if(libsReady() || document.readyState==='complete') return go();
  const poll=setInterval(()=>{ if(libsReady()){ clearInterval(poll); go(); } }, 100);
  window.addEventListener('load', ()=>{ clearInterval(poll); go(); }, {once:true});
  setTimeout(()=>{ clearInterval(poll); go(); }, 5000); // a stalled CDN must not leave the page without its basic scroll wiring
}
function finishLoad(){
  if(loaderEl){ loaderEl.classList.add('done'); setTimeout(()=>{ if(loaderEl) loaderEl.style.display='none'; },850); }
  startScrollWhenReady();
}
if(prefersReduced){ if(loaderEl) loaderEl.style.display='none'; startScrollWhenReady(); }
else { setTimeout(finishLoad, 800); } // matches the .75s loader iris (was 1.4s)

onWidthResize(()=>{ if(window.ScrollTrigger) ScrollTrigger.refresh(); });

// easter egg
(function(){
  let buf='';
  window.addEventListener('keydown',e=>{
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    if(tag==='INPUT'||tag==='TEXTAREA') return;
    if(e.key&&e.key.length===1){ buf=(buf+e.key).slice(-5).toLowerCase(); }
    if(buf==='mango'){ buf=''; egg(); }
  });
  function egg(){
    const toast=document.createElement('div'); toast.className='mango-toast'; toast.textContent='🥭 You found the ripest secret on the page.';
    document.body.appendChild(toast); requestAnimationFrame(()=>toast.classList.add('show'));
    setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=>toast.remove(),500); },2600);
    const cx=innerWidth/2, cy=innerHeight/2, colors=['#FFC93C','#F5821F','#D94E1F','#6B2E3C','#4A4E22','#F7F2E4'];
    for(let i=0;i<60;i++){
      const p=document.createElement('div'); p.className='mango-confetti';
      const circ=Math.random()>0.6, w=5+Math.random()*6, h=circ?w:8+Math.random()*10;
      p.style.cssText=`width:${w}px;height:${h}px;border-radius:${circ?'50%':'2px'};background:${colors[(Math.random()*colors.length)|0]};left:${cx}px;top:${cy}px;`;
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2, dist=100+Math.random()*300, spin=(Math.random()>.5?1:-1)*(360+Math.random()*540);
      p.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:`translate(-50%,-50%) translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist+180}px) rotate(${spin}deg)`,opacity:0}],{duration:1000+Math.random()*700,easing:'cubic-bezier(.15,.7,.3,1)'}).onfinish=()=>p.remove();
    }
  }
})();

} catch(err){ console.warn('decorative effects skipped:', err); }
