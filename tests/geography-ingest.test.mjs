import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,cp,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateGeography,reusePaperGeography} from '../lib/geography-validation.js';
import {prepareDigest} from '../scripts/ingest.mjs';
import {root} from '../scripts/validate.mjs';
const location={id:'illinois',institutionId:'illinois',label:'Urbana',city:'Urbana',countryCode:'US',countryLabel:'美国',lat:40.11,lon:-88.21,coordinatePrecision:'representative-city',evidenceUrls:['https://illinois.edu/']};
const catalog=()=>({version:1,locations:{illinois:structuredClone(location)},papers:{},unresolvedInstitutions:{amazon:{reason:'No campus evidence'}}});
const affiliation=(institutionId='illinois')=>({institutionId,evidence:[{url:'https://arxiv.org/abs/2610.31841'}]});

test('verified campus reuse requires exact institution and paper affiliation evidence; unknowns stay unknown',()=>{
 const c=catalog();reusePaperGeography([{id:'one',visuals:{institutions:[affiliation(),affiliation('amazon')]}},{id:'two',visuals:{institutions:[{institutionId:'illinois'}]}},{id:'three',visuals:{institutions:[affiliation('different-campus')]}}],c);
 assert.deepEqual(c.papers.one.locationIds,['illinois']);assert.deepEqual(c.papers.one.unresolvedInstitutionIds,['amazon']);assert.equal(c.papers.two,undefined);assert.equal(c.papers.three,undefined);
 const ambiguous=catalog();ambiguous.locations.other={...location,id:'other'};reusePaperGeography([{id:'four',visuals:{institutions:[affiliation()]}}],ambiguous);assert.equal(ambiguous.papers.four,undefined);
});

test('explicit reviewed geography can correct a mapping; malformed or unreviewed locations fail closed',()=>{
 const c=catalog();c.papers.one={locationIds:['illinois'],unresolvedInstitutionIds:[],evidenceUrls:['https://arxiv.org/abs/2610.31841']};
 const before=JSON.stringify(c);reusePaperGeography([{id:'one',visuals:{institutions:[]}}],c);assert.equal(JSON.stringify(c),before);
 reusePaperGeography([{id:'one',verifiedGeography:{locationIds:[],evidenceUrls:['https://arxiv.org/abs/2610.31841']}}],c);assert.deepEqual(c.papers.one.locationIds,[]);
 for(const metadata of [{locationIds:['missing'],evidenceUrls:['https://example.org/paper']},{locationIds:['illinois'],evidenceUrls:['javascript:alert(1)']},{locationIds:['illinois','illinois'],evidenceUrls:['https://example.org/paper']}])assert.throws(()=>reusePaperGeography([{id:'one',verifiedGeography:metadata}],catalog()));
 for(const patch of [{lat:NaN},{lon:181},{countryCode:'USA'},{evidenceUrls:[]},{coordinatePrecision:'headquarters'}]){const c=catalog();Object.assign(c.locations.illinois,patch);assert.ok(validateGeography(c).length);}
});

test('ingestion updates optional sidecar in its atomic plan without extending strict daily schema',async t=>{
 const base=await mkdtemp(join(tmpdir(),'map-ingest-'));t.after(()=>rm(base,{recursive:true,force:true}));
 await cp(join(root,'data'),join(base,'data'),{recursive:true});await cp(join(root,'config'),join(base,'config'),{recursive:true});
 const day=JSON.parse(await readFile(join(root,'data/days/2026-10-31.json'),'utf8'));
 await writeFile(join(base,'data/paper-geography.json'),JSON.stringify(catalog()));
 day.papers[0].verifiedGeography={locationIds:['illinois'],evidenceUrls:['https://arxiv.org/html/2610.31841']};
 const plan=await prepareDigest(day,base);const file=plan.files.find(f=>f.path==='data/paper-geography.json');assert.ok(file);
 const mapped=JSON.parse(file.content);assert.deepEqual(mapped.papers[day.papers[0].id].locationIds,['illinois']);assert.equal(JSON.parse(plan.files[0].content).papers[0].verifiedGeography,undefined);
 assert.deepEqual(JSON.parse(await readFile(join(base,'data/paper-geography.json'),'utf8')),catalog(),'plan remains non-mutating');
 await writeFile(join(base,'data/paper-geography.json'),file.content);const again=await prepareDigest(day,base);assert.ok(!again.files.some(f=>f.path==='data/paper-geography.json'));
 const duplicated=structuredClone(day);duplicated.papers.push({...structuredClone(day.papers[0]),verifiedGeography:{locationIds:[],evidenceUrls:['https://arxiv.org/html/2610.31841']}});await assert.rejects(prepareDigest(duplicated,base),/地理核验证据冲突/);
 const malformed=structuredClone(day);malformed.papers.push({...structuredClone(day.papers[0]),verifiedGeography:{locationIds:['missing'],evidenceUrls:['https://arxiv.org/html/2610.31841']}});await assert.rejects(prepareDigest(malformed,base),/未核验地点/);
 await rm(join(base,'data/paper-geography.json'));await assert.rejects(prepareDigest(day,base),/先建立/);delete day.papers[0].verifiedGeography;assert.equal((await prepareDigest(day,base)).files.length,4);
});
