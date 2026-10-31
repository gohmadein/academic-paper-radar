export function countText(value) {
  return String(Number.isSafeInteger(value) && value >= 0 ? value : 0).padStart(3,'0');
}

export function localClockText(date) {
  return [date.getHours(),date.getMinutes(),date.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
}

export function setFlipValue(element, value, label) {
  if (!element || element.dataset.value === value) return;
  const old = element.dataset.value;
  const children = [...element.children];
  const sameLength = old?.length === value.length && children.length === value.length;
  if (!sameLength) element.replaceChildren();
  [...value].forEach((digit,index)=>{
    if (sameLength && old[index] === digit) return;
    const slot = document.createElement('span');
    slot.setAttribute('aria-hidden','true');
    if (digit === ':') { slot.className = 'clock-colon'; slot.textContent = ':'; }
    else {
      slot.className = 'flip-digit';
      const current = document.createElement('span'); current.className = 'digit-current'; current.textContent = digit; slot.append(current);
      if (sameLength && old[index] !== ':') {
        const top = document.createElement('span'); top.className = 'digit-top'; top.textContent = old[index];
        const bottom = document.createElement('span'); bottom.className = 'digit-bottom'; bottom.textContent = digit;
        slot.append(top,bottom);
      }
    }
    if (sameLength) children[index].replaceWith(slot); else element.append(slot);
  });
  element.dataset.value = value;
  element.setAttribute('aria-label',label);
}

export function updateHUD({demo, papers, days, realCount}) {
  setFlipValue(document.getElementById('hud-entries'),countText(papers.length),`${demo?'演示条目':'真实论文'} ${papers.length} 篇`);
  setFlipValue(document.getElementById('hud-days'),countText(days.length),`${demo?'演示':'真实'}归档 ${days.length} 天`);
  const topics = new Set(papers.flatMap(p=>p.tags)).size;
  setFlipValue(document.getElementById('hud-topics'),countText(topics),`研究主题 ${topics} 个`);
  const mode = document.getElementById('hud-mode'); mode.textContent = demo?'演示数据':'真实档案'; mode.classList.toggle('demo',demo);
  document.getElementById('hud-entry-note').textContent = demo?'非真实论文':'真实资料统计';
  document.getElementById('hud-status').textContent = demo?'◇ 演示视图 / 非真实论文':'◇ 档案已读取 / 静态资料';
  document.getElementById('hex-json').classList.add('ready');
  document.getElementById('hex-json').setAttribute('aria-label','JSON 资料读取成功');
  const feed=document.getElementById('hex-feed'); feed.classList.toggle('ready',realCount>0); feed.classList.toggle('waiting',realCount===0); feed.setAttribute('aria-label',realCount>0?`真实论文 ${realCount} 篇`:'真实论文尚未收录');
}

export function startClock() {
  const tick=()=>{
    if(document.hidden)return;
    const now=new Date();
    setFlipValue(document.getElementById('hud-clock'),localClockText(now),`本机时间 ${localClockText(now)}`);
  };
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || '设备本地时区';
  document.getElementById('hud-timezone').textContent=`${zone} / 设备本地时间`;
  tick();
  let timer=setInterval(tick,1000);
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null;});
  window.addEventListener('pageshow',()=>{if(timer===null){tick();timer=setInterval(tick,1000);}});
}
