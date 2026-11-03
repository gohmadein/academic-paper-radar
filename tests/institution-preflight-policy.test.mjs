import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('every publication checks all paper schools and searches missing genuine marks without pretending success',async()=>{
 const rules=JSON.parse(await readFile(new URL('../config/digest-rules.json',import.meta.url)));const p=rules.qualityPolicy.institutionMarkPreflight;
 assert.equal(p.requiredForEveryPublication,true);assert.deepEqual(p.scope,['all-curated-profiles','all-arxiv-bulletin-entries']);
 for(const k of ['paperAffiliationEvidenceRequired','reuseVerifiedMarksByStableId','searchMissingMarksBeforePublication','compactGraphicalMarksOnly','preserveHistoricalResearchAndPrivateIds'])assert.equal(p[k],true);
 for(const k of ['institution-identity','actual-pixels','native-background-and-alpha','sha256','source-and-derivation','rights-boundaries'])assert.ok(p.verify.includes(k));
 assert.match(p.unresolved,/保留.*名称.*原因/);assert.equal(rules.qualityPolicy.neverPad,true);assert.equal(rules.profiles.xun.curatedPublicationPolicy.ratioIsSoft,true);
});
