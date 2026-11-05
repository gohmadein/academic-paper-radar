// Forward-only guard: archived issues and other profiles retain their original contract.
export function validateXunSelection(day,rules){
 const policy=rules?.profiles?.xun?.curatedPublicationPolicy;
 if(!policy||day.demo||day.date<policy.effectiveFrom||!Array.isArray(day.papers))return [];
 const errors=[],counts={conference:0,journal:0};
 const papers=day.papers.filter(p=>p?.profiles?.includes('xun'));
 for(const p of papers){
  if(!policy.allowedStatuses.includes(p.publicationStatus))errors.push(`${p.id}: 迅精选只接受已核实正式会议/期刊的accepted/published状态；仅预印本、workshop或未知状态不计入精选`);
  const formal=p.formalPublication;
  if(!formal||!Object.hasOwn(counts,formal.type)){errors.push(`${p.id}: 需要formalPublication明确conference或journal，不能由arXiv或标题猜测`);continue;}
  counts[formal.type]++;
  let official=false;
  try {const u=new URL(formal.evidenceUrl);official=['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/(^|\.)arxiv\.org$/i.test(u.hostname);}catch{}
  if(!official||!p.evidence?.some(e=>e.url===formal.evidenceUrl&&typeof e.claim==='string'&&e.claim.trim()))errors.push(`${p.id}: 正式会议/期刊依据须指向同篇evidence中的官方录用/出版证据，不能只用arXiv`);
 }
 const quota=policy.dailyQuota;
 if(quota){
  for(const type of ['conference','journal'])if(counts[type]>quota[type])errors.push(`迅精选${type}超出固定名额${quota[type]}，不得跨类补位`);
  if(counts.conference<quota.conference||counts.journal<quota.journal){
   const prefix=`迅精选不足：会议 ${counts.conference}/${quota.conference}，期刊 ${counts.journal}/${quota.journal}；`;
   if(!day.coverage?.limitations?.some(note=>typeof note==='string'&&note.startsWith(prefix)&&note.slice(prefix.length).trim()))errors.push(`缺少真实缺口及原因说明：${prefix}具体原因`);
  }
 }
 return errors;
}
