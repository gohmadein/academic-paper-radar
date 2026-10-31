// DOM adaptation of X-PostProcessing / GlitchRGBSplitV4 (QianMo, 2020).
// MIT: see THIRD_PARTY_NOTICES.txt. The source shader quantizes time in C#,
// then offsets isolated RGB samples. This uses an SVG filter, not Unity code.
export function v4Split(timeX, intensity = 0.02, speed = 10) {
  const tick = Math.floor(timeX * speed);
  const value = Math.sin(tick * 12.9898 + 2 * 78.233) * 43758.5453;
  const noise = value - Math.floor(value);
  return {tick, noise, amount:intensity * 0.1 * noise};
}

export function createHeroRGBEffect() {
  const hero=document.getElementById('hero');
  const toggle=document.getElementById('rgb-toggle');
  const red=document.getElementById('rgb-red-offset');
  const blue=document.getElementById('rgb-blue-offset');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const key='paper-signal-rgb-v4';
  let enabled=true;
  try{enabled=localStorage.getItem(key)!=='off';}catch{}
  let visible=false, suspended=false, timer=null, timeX=1, lastTime=0, lastTick=-1, amount=0;
  const applyOffset=()=>{
    const pixels=amount*hero.getBoundingClientRect().width;
    // Sampling R(u+s) moves visible red left; sampling B(u-s) moves blue right.
    red.setAttribute('dx',String(-pixels)); blue.setAttribute('dx',String(pixels));
  };
  const advance=()=>{
    const now=performance.now();
    timeX+=(now-lastTime)/1000; lastTime=now;
    if(timeX>100)timeX=0;
    const split=v4Split(timeX);
    if(split.tick!==lastTick){lastTick=split.tick;amount=split.amount;applyOffset();}
  };
  const tick=()=>{advance();timer=setTimeout(tick,100);};
  const reconcile=()=>{
    const running=visible&&enabled&&!reduced.matches&&!document.hidden&&!suspended;
    hero.classList.toggle('rgb-enabled',running);
    toggle.disabled=reduced.matches;
    toggle.setAttribute('aria-pressed',String(enabled&&!reduced.matches));
    toggle.textContent=reduced.matches?'RGB 分离：已按系统设置关闭':`RGB 分离：${enabled?'开启':'关闭'}`;
    if(running&&timer===null){lastTime=performance.now();advance();timer=setTimeout(tick,100);}
    else if(!running&&timer!==null){advance();clearTimeout(timer);timer=null;}
  };
  toggle.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(key,enabled?'on':'off');}catch{}reconcile();});
  document.addEventListener('visibilitychange',reconcile);
  reduced.addEventListener('change',reconcile);
  window.addEventListener('pagehide',()=>{suspended=true;reconcile();});
  window.addEventListener('pageshow',()=>{suspended=false;reconcile();});
  new ResizeObserver(()=>{if(timer!==null)applyOffset();}).observe(hero);
  reconcile();
  return {setVisible(value){visible=Boolean(value);reconcile();}};
}
