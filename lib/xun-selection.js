// Forward-only ingest guard. Historical schema validation and other profiles stay unchanged.
export function validateXunSelection(day,rules){
 const policy=rules?.profiles?.xun?.curatedPublicationPolicy;
 if(!policy||day.demo||day.date<policy.effectiveFrom)return [];
 return day.papers.filter(p=>p.profiles?.includes('xun')&&!policy.allowedStatuses.includes(p.publicationStatus))
  .map(p=>`${p.id}: 迅精选只接受已核实正式会议/期刊版本；仅预印本或未知状态请放入独立arXiv模块`);
}
