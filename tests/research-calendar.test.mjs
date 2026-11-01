import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calendarDate,shiftCalendarMonth,calendarMonthDays,calendarEventDay,calendarEventOn,calendarEventStatus,upcomingCalendarEvents,validateCalendar,researchCalendarHTML} from '../lib/research-calendar.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const data=JSON.parse(await read('data/conference-calendar.json'));
const deadline=data.events.find(e=>e.id==='cvpr-2027-enrollment');

test('Verified calendar keeps source provenance, watched conferences and explicit precision',async()=>{
 assert.deepEqual(validateCalendar(data),[]);assert.equal(data.events.length,27);assert.equal(data.coverage.length,14);
 const registry=JSON.parse(await read('config/source-registry.json'));
 for(const event of data.events){assert.ok(registry.sources.some(s=>s.name===event.conference&&s.type==='conference'));assert.ok(event.sourceUrl.startsWith('https://'));assert.equal(event.verifiedAt,'2026-11-01');}
 for(const event of data.events.filter(e=>e.type==='conference')){assert.equal(event.precision,'date');assert.equal(event.deadlineAt,null);}
 assert.ok(!data.events.some(e=>e.conference==='IROS'&&e.type==='conference'));
 assert.match(deadline.name,/论文登记/);assert.match(data.events.find(e=>e.id==='rss-2027-stage1').note,/6 页扩展摘要/);
 assert.ok(validateCalendar({...data,events:[...data.events,data.events[0]]}).length);
 assert.ok(validateCalendar({version:1,events:[{...deadline,deadlineAt:'2026-11-10T23:59:00'}]}).length);
 assert.ok(validateCalendar({version:1,events:[{...deadline,startDate:'2026-11-11'}]}).length);
 assert.ok(validateCalendar({version:1,events:[{...data.events[0],deadlineAt:'2026-11-09T00:00:00Z'}]}).length);
});

test('Beijing midnight, AoE and DST boundaries are computed independently of browser timezone',()=>{
 assert.equal(calendarDate('2026-11-01T15:59:59Z'),'2026-11-01');assert.equal(calendarDate('2026-11-01T16:00:00Z'),'2026-11-02');
 assert.equal(calendarDate('2026-11-11T11:59:00Z','AoE'),'2026-11-10');
 assert.equal(calendarDate('2026-11-11T12:00:00Z','AoE'),'2026-11-11');
 assert.equal(calendarEventDay(deadline),'2026-11-11');
 assert.equal(calendarEventOn(deadline,'2026-11-10'),false);assert.equal(calendarEventOn(deadline,'2026-11-11'),true);
 assert.equal(calendarEventStatus(deadline,'2026-11-11T11:58:59Z').closed,false);
 assert.equal(calendarEventStatus(deadline,'2026-11-11T11:59:00Z').closed,true);
 assert.equal(calendarDate('2026-11-01T06:30:00Z','America/Chicago'),'2026-11-01');
 assert.equal(calendarDate('2026-11-01T07:30:00Z','America/Chicago'),'2026-11-01');
});

test('Date-only meetings have inclusive ranges, approximate date counts and no fake exact hour',()=>{
 const event=data.events.find(e=>e.id==='corl-2026-conference');
 assert.equal(calendarEventOn(event,'2026-11-12'),true);assert.equal(calendarEventOn(event,'2026-11-13'),false);
 assert.equal(calendarEventStatus(event,'2026-11-01T08:00:00Z').label,'约 8 天后开会');
 assert.equal(calendarEventStatus(event,'2026-11-09T08:00:00Z').label,'会议日期内');
 assert.equal(calendarEventStatus(event,'2026-11-13T08:00:00Z').closed,true);
 const html=researchCalendarHTML(data,{selectedDate:'2026-11-09',now:new Date('2026-11-01T08:00:00Z')});
 assert.ok(html.includes('当地日期 · 仅日期'));assert.ok(!html.includes('00:00'));
});

test('Month navigation handles year changes and leap years; upcoming list omits ended nodes',()=>{
 assert.equal(shiftCalendarMonth('2026-12',1),'2027-01');assert.equal(shiftCalendarMonth('2027-01',-1),'2026-12');
 assert.equal(calendarMonthDays('2028-02').filter(Boolean).length,29);assert.equal(calendarMonthDays('2027-02').filter(Boolean).length,28);
 assert.equal(calendarMonthDays('2026-11').filter(x=>x===null).length,6);
 assert.equal(upcomingCalendarEvents(data.events,'2026-11-01T08:00:00Z').length,3);
 assert.deepEqual(upcomingCalendarEvents(data.events,'2026-11-18T08:00:00Z').map(e=>e.conference),['RSS','NeurIPS','ICAPS']);
 assert.deepEqual(upcomingCalendarEvents(data.events,'2028-01-01T00:00:00Z'),[]);
});

test('Calendar uses accessible native controls, source links, specific deadlines and escaped notes',()=>{
 const html=researchCalendarHTML(data,{month:'2026-11',selectedDate:'2026-11-11',now:new Date('2026-11-01T12:00:00Z')});
 for(const text of ['aria-current="date"','aria-pressed=','aria-label="上个月"','aria-label="下个月"','论文登记','2026-11-10 23:59 AoE (UTC−12)','北京 2026-11-11 19:59','官方日期'])assert.ok(html.includes(text),text);
 const malicious={version:1,events:[{...deadline,name:'<script>alert(1)</script>',note:'<img src=x>',sourceUrl:'javascript:alert(1)'}]};
 const escaped=researchCalendarHTML(malicious,{selectedDate:'2026-11-11'});assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img src=x>'));assert.ok(!escaped.includes('javascript:'));
 assert.ok(researchCalendarHTML(data,{selectedDate:'2026-11-03'}).includes('当日无已核验会议事项'));
 assert.ok(researchCalendarHTML(null).includes('日期资料暂不可用'));
});

test('Daily source coverage, optional tracks, places and private markers are explicit and safe',()=>{
 const sources=data.coverage.map(row=>row.sourceId);assert.deepEqual(validateCalendar(data,sources),[]);
 assert.ok(validateCalendar({version:1,events:[]},sources).length);
 for(const changed of [{...data,events:[null]},{...data,coverage:[null]},{...data,events:[{...deadline,track:'typo'}]},{...data,coverage:data.coverage.slice(1)}])assert.ok(validateCalendar(changed,sources).length);
 assert.ok(upcomingCalendarEvents(data.events,'2026-11-01T00:00:00Z','all').some(event=>event.track==='workshop'));
 assert.ok(!upcomingCalendarEvents(data.events,'2026-11-01T00:00:00Z').some(event=>event.track==='workshop'));
 const hidden=researchCalendarHTML(data,{selectedDate:'2026-11-02',scope:'main'}),all=researchCalendarHTML(data,{selectedDate:'2026-11-02',scope:'all'});
 assert.ok(!hidden.includes('data-calendar-event="icra-2027-workshop-proposal"'));assert.ok(all.includes('data-calendar-event="icra-2027-workshop-proposal"'));
 assert.match(all,/Seoul/);assert.match(all,/官方信息冲突/);
 const html=researchCalendarHTML(data,{tab:'private',selectedDate:'2026-11-05',month:'2026-11',tasks:[{id:'task-1',date:'2026-11-05',text:'<script>private</script>',done:false}]});
 assert.ok(html.includes('personal-marker'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.match(html,/不上传或发送提醒/);
});
