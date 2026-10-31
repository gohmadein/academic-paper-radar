// Geography is separately verified metadata, never derived from nationality or a company HQ.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(x);
const url = x => {try {const u=new URL(x);return typeof x==='string'&&['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
const ids = x => Array.isArray(x)&&x.every(id)&&new Set(x).size===x.length;
const urls = x => Array.isArray(x)&&x.length>0&&x.every(url);

export function validateGeography(catalog) {
  const errors=[];
  if(!object(catalog)||catalog.version!==1||!object(catalog.locations)||!object(catalog.papers))return ['地理库结构无效'];
  for(const [key,p] of Object.entries(catalog.locations)){
    if(!object(p)){errors.push(`${key}: 地点结构无效`);continue;}
    if(!id(key)||p.id!==key||!id(p.institutionId))errors.push(`${key}: 地点或机构ID无效`);
    if(!['label','city','countryLabel'].every(k=>typeof p[k]==='string'&&p[k].trim())||!/^[A-Z]{2}$/.test(p.countryCode))errors.push(`${key}: 地点名称无效`);
    if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180)errors.push(`${key}: 经纬度无效`);
    if(p.coordinatePrecision!=='representative-city'||!urls(p.evidenceUrls))errors.push(`${key}: 缺少已核验城市来源`);
  }
  for(const [key,p] of Object.entries(catalog.papers)){
    if(!id(key)||!object(p)||!ids(p.locationIds)||p.locationIds.some(x=>!Object.hasOwn(catalog.locations,x))||!ids(p.unresolvedInstitutionIds)||!urls(p.evidenceUrls))errors.push(`${key}: 论文地理引用或证据无效`);
  }
  return errors;
}

export function validateVerifiedGeography(value,catalog) {
  if(!object(value)||Object.keys(value).some(k=>!['locationIds','evidenceUrls'].includes(k))||!ids(value.locationIds)||!urls(value.evidenceUrls))return ['verifiedGeography 需要去重地点ID和可访问的证据URL'];
  if(value.locationIds.some(x=>!Object.hasOwn(catalog.locations,x)))return ['verifiedGeography 引用未核验地点'];
  return [];
}

export function reusePaperGeography(papers,catalog) {
  const errors=validateGeography(catalog);if(errors.length)throw new Error(errors.join('\n'));
  for(const p of papers){
    const explicit=p.verifiedGeography;
    if(explicit!==undefined){const problems=validateVerifiedGeography(explicit,catalog);if(problems.length)throw new Error(`${p.id}: ${problems.join('; ')}`);}
    // Existing reviewed mappings stay unchanged unless the curator explicitly corrects them.
    if(explicit===undefined&&Object.hasOwn(catalog.papers,p.id))continue;
    const affiliations=p.visuals?.institutions||[];
    const locationIds=[],unresolvedInstitutionIds=[],evidenceUrls=[];
    for(const affiliation of affiliations){
      const institutionId=affiliation.institutionId;
      const candidates=Object.values(catalog.locations).filter(x=>x.institutionId===institutionId);
      const evidence=(affiliation.evidence||[]).map(x=>x.url).filter(url);
      // A reviewed location is reusable only with this paper's affiliation evidence,
      // a single campus match and no explicit unresolved/ambiguous institution entry.
      if(id(institutionId)&&candidates.length===1&&evidence.length&&!Object.hasOwn(catalog.unresolvedInstitutions||{},institutionId)){
        locationIds.push(candidates[0].id);evidenceUrls.push(...evidence);
      }else if(id(institutionId))unresolvedInstitutionIds.push(institutionId);
    }
    if(explicit!==undefined){locationIds.splice(0,locationIds.length,...explicit.locationIds);evidenceUrls.splice(0,evidenceUrls.length,...explicit.evidenceUrls);}
    // No evidence is not an invented record: absence remains visibly unknown in the UI.
    if(evidenceUrls.length)catalog.papers[p.id]={locationIds:[...new Set(locationIds)].sort(),unresolvedInstitutionIds:[...new Set(unresolvedInstitutionIds)].sort(),evidenceUrls:[...new Set(evidenceUrls)].sort()};
  }
  return catalog;
}
