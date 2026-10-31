// Horizontal GlitchLineBlock DOM adaptation, QianMo / 浅墨 (2020), MIT.
// Source: X-PostProcessing/Effects/GlitchLineBlock; full notice in THIRD_PARTY_NOTICES.txt.
// Preserve its uv.y quantization and two irregular block grids. SVG resamples
// the actual hero horizontally; no cloned controls or decorative stripe overlay.
const fract=value=>value-Math.floor(value);
const noise=value=>fract(Math.sin(value*(12.9898+78.233))*43758.5453);
const trunc=(value,levels)=>levels>0?Math.floor(value*levels)/levels:0;

export function lineBlockAt(y,timeX,{amount=.5,linesWidth=1,speed=.8,frequency=1}={}){
  const phase=timeX*speed*.2;
  const time=phase*(.5+.5*Math.cos(phase*frequency));
  const uvTrunc=noise(trunc(y,8)+100*trunc(time,4));
  const randomTrunc=6*trunc(time,24*uvTrunc);
  let block=.5*noise(trunc(y+randomTrunc,8/linesWidth))+.5*noise(trunc(y+randomTrunc,7));
  block=block*2-1;
  return Math.sign(block)*Math.min(1,Math.max(0,(Math.abs(block)-amount)/.4));
}

export function buildLineMap(timeX,rows=512){
  const bands=[];
  for(let y=0;y<rows;y++){
    const red=128+Math.round(127*lineBlockAt((y+.5)/rows,timeX));
    const previous=bands.at(-1);
    if(previous?.red===red)previous.height++;
    else bands.push({y,height:1,red});
  }
  return {bands};
}

export function createHeroLineEffect(){
  const hero=document.getElementById('hero');
  const toggle=document.getElementById('line-toggle');
  const map=document.getElementById('line-map');
  const strips=Array.from({length:64},(_,i)=>document.getElementById(`line-band-${i}`));
  const displacement=document.getElementById('line-displacement');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const key='paper-signal-line-block';
  let enabled=true;
  try{enabled=(localStorage.getItem(key)??localStorage.getItem('paper-signal-rgb-v4'))!=='off';}catch{}
  let visible=false,suspended=false,timer=null,timeX=1,lastTime=0,lastTick=-1;
  const resize=()=>{
    // Shader samples u + .1 * block * Offset. Offset .2 limits displacement
    // to 2% of hero width; objectBoundingBox units follow responsive sizing.
    // Green is fixed at exactly .5 in the SVG filter,
    // so its vertical sampling displacement is always zero.
    displacement.setAttribute('scale','0.04');
  };
  const advance=()=>{
    const now=performance.now();timeX+=(now-lastTime)/1000;lastTime=now;
    if(timeX>100)timeX=0;
    const tick=Math.floor(timeX*8);
    if(tick!==lastTick){
      lastTick=tick;
      const {bands}=buildLineMap(timeX);
      strips.forEach((strip,i)=>{
        const band=bands[i];
        strip.setAttribute('y',band?String(band.y/512):'0');
        strip.setAttribute('height',band?String(Math.min(1-band.y/512,(band.height+1)/512)):'0');
        strip.setAttribute('flood-color',band?`rgb(${band.red},128,0)`:'rgb(128,128,0)');
      });
      map.setAttribute('data-band-count',String(bands.length));
    }
  };
  const tick=()=>{advance();timer=setTimeout(tick,125);};
  const reconcile=()=>{
    const running=visible&&enabled&&!reduced.matches&&!document.hidden&&!suspended;
    hero.classList.toggle('line-enabled',running);
    toggle.disabled=reduced.matches;
    toggle.setAttribute('aria-pressed',String(enabled&&!reduced.matches));
    toggle.textContent=reduced.matches?'横条错位：已按系统设置关闭':`横条错位：${enabled?'开启':'关闭'}`;
    if(running&&timer===null){resize();lastTime=performance.now();advance();timer=setTimeout(tick,125);}
    else if(!running&&timer!==null){clearTimeout(timer);timer=null;}
  };
  toggle.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(key,enabled?'on':'off');}catch{}reconcile();});
  document.addEventListener('visibilitychange',reconcile);
  reduced.addEventListener('change',reconcile);
  window.addEventListener('pagehide',()=>{suspended=true;reconcile();});
  window.addEventListener('pageshow',()=>{suspended=false;reconcile();});
  new ResizeObserver(()=>{if(timer!==null)resize();}).observe(hero);
  reconcile();
  return {setVisible(value){visible=Boolean(value);reconcile();}};
}
