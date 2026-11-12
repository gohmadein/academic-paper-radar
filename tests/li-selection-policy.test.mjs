import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const rules = JSON.parse(await read('config/digest-rules.json'));
const watchlists = JSON.parse(await read('config/profile-watchlists.json'));

test('Li retains its primary research scope and daily/classic quotas', () => {
  const li = rules.profiles.li;
  assert.deepEqual([li.targetMin, li.targetMax], [1, 3]);
  assert.deepEqual(li.priorities, [
    '固定本体、映射与schema的VKG/OBDA实例更新',
    '视图更新、双向关系透镜',
    'provenance、lineage、causality',
    '副作用与约束更新、修复、SAT/SMT',
    'DL-Lite / OWL 2 QL、containment、chase',
    '可交互、可解释更新'
  ]);
  assert.equal(li.theoryWithoutCodeAllowed, true);
  assert.equal(li.alreadyReadSeeds.length, 2);
  assert.equal(rules.weeklyClassics.day, 'Monday');
  assert.equal(rules.weeklyClassics.li, 1);
  assert.equal(rules.weeklyClassics.separateFromDailyQuota, true);
  assert.ok(rules.qualityPolicy.allowShortfall && rules.qualityPolicy.allowZero && rules.qualityPolicy.neverPad);
});

test('Li database fallback is secondary, evidence-based and shares the daily quota', () => {
  const fallback = rules.profiles.li.databaseFallback;
  assert.equal(fallback.effectiveFrom, '2026-11-12');
  assert.equal(fallback.primaryScopeFirst, true);
  assert.match(fallback.trigger, /候选不足/);
  assert.match(fallback.trigger, /不挤掉/);
  assert.equal(fallback.label, '数据库拓展阅读');
  assert.equal(fallback.separateQuota, false);
  assert.equal(fallback.preserveWeeklyClassics, true);
  assert.match(fallback.quota, /1–3/);
  assert.match(fallback.quota, /0篇/);
  assert.match(fallback.scope, /不局限于/);
  assert.match(fallback.recency, /30天/);
  assert.match(fallback.recency, /older-discovery/);
  assert.match(fallback.relation, /没有直接联系/);
  assert.equal(fallback.influenceEvidence.required, true);
  assert.ok(fallback.influenceEvidence.examples.length >= 3);
  assert.ok(fallback.influenceEvidence.notSufficientAlone.includes('venue'));
  for (const venue of ['SIGMOD', 'PACMMOD', 'VLDB', 'PVLDB', 'PODS', 'ICDT', 'ICDE', 'EDBT', 'TODS', 'VLDB Journal', 'TKDE']) {
    assert.ok(fallback.venues.includes(venue));
    assert.ok(rules.profiles.li.venues.includes(venue));
  }
  for (const field of ['recommendations.li.whyRead', 'recommendations.li.relation', 'evidence', 'researchNotes']) {
    assert.ok(fallback.guidanceFields[field]);
  }
});

test('Li directory and handoff contract permit honest database expansion without affecting other profiles', async () => {
  const li = watchlists.profiles.li;
  assert.match(li.scope, /候选不足/);
  assert.match(li.notes.join(' '), /不局限于直接匹配/);
  assert.match(li.notes.join(' '), /不排除该补充规则/);
  const contract = await read('docs/DIGEST-INTERFACE.md');
  for (const text of ['数据库拓展阅读', '影响力', '没有直接联系', 'researchNotes', '不新增必填schema字段']) {
    assert.ok(contract.includes(text));
  }
  assert.deepEqual([rules.profiles.xun.targetMin, rules.profiles.xun.targetMax], [5, 5]);
  assert.deepEqual(rules.profiles.xun.curatedPublicationPolicy.dailyQuota, {conference: 3, journal: 2});
  assert.deepEqual([rules.profiles.lv.targetMin, rules.profiles.lv.targetMax], [1, 3]);
  assert.equal(rules.scheduleIntent.daily, '08:00');
});
