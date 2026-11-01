import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileSources} from '../lib/source-directory.js';
import {digestDetails} from '../lib/digest-view.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const rules=JSON.parse(await read('config/digest-rules.json'));
const watchlists={profiles:JSON.parse(await read('config/profile-watchlists.json')),registry:JSON.parse(await read('config/source-registry.json'))};

test('Lv research priorities and dual reading lines preserve quota without beginner/math/RL gates',()=>{
 const lv=rules.profiles.lv;
 assert.deepEqual(lv.priorities.map(p=>p.slice(0,2)),['P0','P1','P1','P2','P2']);
 for(const topic of ['IL','BC','RL','Diffusion Policy','Visuomotor Policy'])assert.ok(lv.priorities[0].includes(topic));
 for(const topic of ['3D','空间感知','深度','点云','6D','检测分割','视觉表征','视觉操作'])assert.ok(lv.priorities[1].includes(topic));
 for(const topic of ['Isaac Lab','MuJoCo','Simulation','Sim2Real','合成数据','评估','环境设计'])assert.ok(lv.priorities[2].includes(topic));
 assert.deepEqual([lv.targetMin,lv.targetMax,rules.weeklyClassics.lv],[1,3,1]);
 assert.equal(rules.weeklyClassics.day,'Monday');assert.equal(rules.weeklyClassics.separateFromDailyQuota,true);
 assert.equal(lv.readingPolicy.beginnerOnly,false);assert.equal(lv.readingPolicy.excludeForMathOrRL,false);
 assert.ok(lv.readingPolicy.frontierLine&&lv.readingPolicy.foundationLine);
 assert.ok(rules.qualityPolicy.allowZero&&rules.qualityPolicy.neverPad);
});

test('Vision sources reuse authentic registry identity/links with Lv scope only',()=>{
 const lv=profileSources('lv',watchlists),xun=profileSources('xun',watchlists);
 for(const name of ['CVPR','ICCV','ECCV']){
  const entry=lv.find(s=>s.name===name),original=watchlists.registry.sources.find(s=>s.name===name);
  assert.equal(entry.type,'conference');assert.equal(entry.links,original.links);
  assert.match(entry.details.join(' '),/机器人感知、操作、空间理解或具身任务/);
  assert.equal(xun.find(s=>s.name===name),original);
 }
 assert.equal(lv.filter(s=>s.type==='conference').length,10);
 assert.equal(lv.filter(s=>s.type==='lab').length,7);assert.equal(xun.length,70);
});

test('Existing detail renderer exposes all guidance fields without schema changes',async()=>{
 const day=JSON.parse(await read('data/days/2026-11-01.json'));
 const paper=structuredClone(day.papers.find(p=>p.profiles.includes('lv')));
 const r=paper.recommendations.lv;
 r.whyRead='测试·为什么现在值得读';r.relation='测试·具体机器人任务关联';r.prerequisites=['测试·待补前置概念'];r.difficulty='advanced';r.readRecommendation='skim';
 paper.limits=['测试·作者报告不等于独立验证'];paper.assumptions=['测试·任务实验条件'];paper.researchNotes=['测试·驴阅读路线：前沿线与基础线；仅摘要，具体章节图表未核验'];paper.readDepth='abstract';
 const html=digestDetails(paper);
 for(const text of [r.whyRead,r.relation,...r.prerequisites,...paper.limits,...paper.assumptions,...paper.researchNotes])assert.ok(html.includes(text));
 assert.ok(html.includes('阅读与核验记录'));assert.ok(html.includes('阅读前置'));assert.ok(html.includes('局限与假设'));
 const contract=await read('docs/LV-READING-GUIDE.md');
 for(const field of ['summaryEn','whyRead','relation','prerequisites','researchNotes','readRecommendation','readDepth','evidence'])assert.ok(contract.includes(field));
 assert.ok(contract.includes('不填猜测编号'));
});
