export function countText(value) {
  return String(Number.isSafeInteger(value) && value >= 0 ? value : 0).padStart(3,'0');
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
    {
      slot.className = 'flip-digit';
      const current = document.createElement('span'); current.className = 'digit-current'; current.textContent = digit; slot.append(current);
      if (sameLength) {
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

export function updateHUD({demo, papers, days}) {
  setFlipValue(document.getElementById('hud-entries'),countText(papers.length),`${demo?'演示条目':'真实论文'} ${papers.length} 篇`);
  setFlipValue(document.getElementById('hud-days'),countText(days.length),`${demo?'演示':'真实'}归档 ${days.length} 天`);
  const topics = new Set(papers.flatMap(p=>p.tags)).size;
  setFlipValue(document.getElementById('hud-topics'),countText(topics),`研究主题 ${topics} 个`);
  const mode = document.getElementById('hud-mode'); mode.textContent = demo?'演示数据':'真实档案'; mode.classList.toggle('demo',demo);
  document.getElementById('hud-entry-note').textContent = demo?'非真实论文':'真实资料统计';
  document.getElementById('hud-status').textContent = demo?'◇ 演示视图 / 非真实论文':'◇ 档案已读取 / 静态资料';
}
