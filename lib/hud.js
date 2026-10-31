export function countText(value) {
  return String(Number.isSafeInteger(value) && value >= 0 ? value : 0).padStart(3,'0');
}

export function setStaticValue(element,value,label) {
  if(!element)return;
  element.textContent=value;
  element.setAttribute('aria-label',label);
}

export function updateHUD({demo,papers,days}) {
  setStaticValue(document.getElementById('hud-entries'),countText(papers.length),`${demo?'演示条目':'真实论文'} ${papers.length} 篇`);
  setStaticValue(document.getElementById('hud-days'),countText(days.length),`${demo?'演示':'真实'}归档 ${days.length} 天`);
  const topics=new Set(papers.flatMap(p=>p.tags)).size;
  setStaticValue(document.getElementById('hud-topics'),countText(topics),`研究主题 ${topics} 个`);
  const mode=document.getElementById('hud-mode');
  mode.textContent=demo?'演示数据':'真实档案';
  mode.classList.toggle('demo',demo);
  document.getElementById('hud-entry-note').textContent=demo?'非真实论文':'真实资料统计';
  document.getElementById('hud-status').textContent=demo?'演示视图 / 非真实论文':'档案已读取 / 静态资料';
}
