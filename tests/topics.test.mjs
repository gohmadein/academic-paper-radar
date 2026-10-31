import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOPICS,paperTopics,availableTopics,matchesTopic,topicForProfile} from '../lib/topics.js';
import {filterPapers,readRoute,routeHash} from '../lib/model.js';
const day=JSON.parse(await readFile(new URL('../data/days/2026-10-31.json',import.meta.url),'utf8'));
const papers=day.papers.map(p=>({...p,date:day.date}));

test('bounded broad taxonomy covers every current paper and stays profile aware',()=>{
  assert.equal(TOPICS.length,8);
  for(const p of papers) assert.ok(paperTopics(p).length,p.id);
  assert.equal(availableTopics(papers,'xun').length,5);
  assert.deepEqual(availableTopics(papers,'li'),['topic:database-updates','topic:data-theory']);
  assert.deepEqual(availableTopics(papers,'lv'),['topic:robot-control','topic:robot-learning']);
  assert.ok(availableTopics(papers).length<=8);
  const mixed={profiles:['xun','li'],tags:['操作','视图更新']};
  assert.deepEqual(paperTopics(mixed,'xun'),['topic:robot-control']);
  assert.deepEqual(paperTopics(mixed,'li'),['topic:database-updates']);
});

test('future tags and title fallback keep all robot directions, without changing metadata',()=>{
  const p={profiles:['xun'],tags:['新子领域'],title:'Novel robot navigation'};
  const before=JSON.stringify(p);
  assert.deepEqual(paperTopics(p),['topic:robot-perception']);
  assert.equal(JSON.stringify(p),before);
  assert.deepEqual(paperTopics({...p,title:'New research'}),['topic:robot-systems']);
  assert.deepEqual(paperTopics({profiles:['li'],tags:['OBDA','约束']}),['topic:knowledge-reasoning','topic:data-theory']);
});

test('old fine-tag links stay exact; new broad links round trip and search keeps fine tags',()=>{
  for(const tag of ['力觉','topic:robot-control']){
    const route=readRoute(routeHash({view:'feed',category:'xun',date:'all',tag}));
    assert.equal(route.tag,tag);
    assert.ok(filterPapers(papers,route).length);
  }
  assert.equal(filterPapers(papers,{tag:'力觉'}).length,1);
  assert.equal(filterPapers(papers,{q:'力觉'}).length,1);
  assert.ok(filterPapers(papers,{tag:'topic:robot-control'}).length>1);
  assert.equal(topicForProfile(papers,'topic:database-updates','xun'),'all');
  assert.equal(topicForProfile(papers,'力觉','li'),'all');
  assert.equal(topicForProfile(papers,'topic:robot-control','lv'),'topic:robot-control');
  assert.equal(matchesTopic(papers[0],'topic:unknown'),false);
});

test('broad topics compose with dates, read status, bookmarks and historical occurrences',()=>{
  const p=papers[0],bookmarks=new Set([p.id]),read=new Set([p.id]);
  const options={category:'xun',tag:'topic:robot-control',date:day.date,bookmarks,read,readStatus:'read'};
  assert.deepEqual(filterPapers(papers,options).map(p=>p.id),[p.id]);
  assert.equal(filterPapers(papers,{...options,readStatus:'unread'}).length,0);
  const old={...p,date:'2026-10-30',tags:['导航']};
  const merged={...p,appearances:[p,old]};
  assert.ok(availableTopics([merged],'xun').includes('topic:robot-perception'));
  assert.equal(filterPapers([merged],{date:old.date,tag:'topic:robot-perception'}).length,1);
});
