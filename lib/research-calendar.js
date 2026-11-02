import {profileIcon} from './profile-icons.js';
import {escapeHTML as e,safeUrl,isDate} from './model.js';
export const CALENDAR_ZONE='Asia/Shanghai';
const DAY=86400000;
export function calendarDate(now=new Date(),zone=CALENDAR_ZONE){
 const d=new Date(now);if(zone==='AoE')return new Date(d.getTime()-12*3600000).toISOString().slice(0,10);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export function shiftCalendarMonth(month,delta){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);}
export function calendarMonthDays(month){
 const first=new Date(`${month}-01T00:00:00Z`),offset=(first.getUTCDay()+6)%7;
 const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return [...Array(offset).fill(null),...Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
export function calendarEventDay(event){return event.precision==='instant'?calendarDate(event.deadlineAt):event.startDate;}
export function calendarEventOn(event,date){return event.precision==='instant'?calendarEventDay(event)===date:date>=event.startDate&&date<=(event.endDate||event.startDate);}
export function calendarEventStatus(event,now=new Date()){
 if(event.precision==='instant'){
  const remaining=Date.parse(event.deadlineAt)-new Date(now).getTime();
  return remaining<=0?{closed:true,label:'已截止'}:{closed:false,label:remaining<DAY?'不足24小时':`剩 ${Math.ceil(remaining/DAY)} 天`};
 }
 const today=calendarDate(now,event.timeZone||CALENDAR_ZONE),end=event.endDate||event.startDate;
 if(today>end)return {closed:true,label:event.type==='submission'?'已截止':'日期已过'};
 if(today>=event.startDate)return {closed:false,label:event.type==='submission'?'今日截止 · 时刻未公布':'会议日期内'};
 const days=Math.round((Date.parse(event.startDate)-Date.parse(today))/DAY);
 return {closed:false,label:`${event.timeZone?'':'约 '}${days} 天后${event.type==='submission'?'截止':'开会'}`};
}
export function upcomingCalendarEvents(events,now=new Date(),scope='main'){
 return events.filter(event=>(scope==='all'||!event.track||event.track==='main')&&!calendarEventStatus(event,now).closed).sort((a,b)=>calendarEventDay(a).localeCompare(calendarEventDay(b))||a.id.localeCompare(b.id)).slice(0,3);
}
export function validateCalendar(input,expectedSources=[]){
 const errors=[];if(input?.version!==1||!Array.isArray(input?.events))return ['日历格式无效'];const ids=new Set();
 if(expectedSources.length&&input.coverage===undefined)errors.push('缺少会议每日核验覆盖记录');
 if(input.coverage!==undefined){
  if(!isDate(input.checkedAt)||!Array.isArray(input.coverage))errors.push('日历每日核验元数据无效');
  else{
   const checked=new Set();
   for(const row of input.coverage){
    if(!row||typeof row!=='object'){errors.push('会议覆盖记录无效');continue;}
    if(!row.sourceId||checked.has(row.sourceId)||!['verified','unpublished','conflict','unavailable'].includes(row.status)||!isDate(row.checkedAt)||row.checkedAt>input.checkedAt||!Array.isArray(row.sourceUrls)||!row.sourceUrls.length||row.sourceUrls.some(url=>!safeUrl(url)))errors.push('会议覆盖记录无效');
    checked.add(row.sourceId);
   }
   if(expectedSources.length&&(checked.size!==expectedSources.length||expectedSources.some(name=>!checked.has(name))))errors.push('未逐项覆盖关注的会议');
  }
 }
 if(input.profileSources!==undefined){
  for(const profile of ['xun','li','lv']){const sources=input.profileSources?.[profile];if(!Array.isArray(sources)||new Set(sources).size!==sources.length||sources.some(id=>!input.coverage?.some?.(row=>row?.sourceId===id)))errors.push('方向会议范围无效');}
 }
 for(const event of input.events){
  if(!event||typeof event!=='object'){errors.push('日历事件无效');continue;}
  if(input.coverage!==undefined&&(!['main','workshop','journal-transfer','conditional','supplementary','camera-ready'].includes(event.track)||!input.coverage?.some?.(row=>row?.sourceId===event.sourceId)||event.verifiedAt>input.checkedAt))errors.push('会议来源、类型或核验日期无效');
  if(event.place&&(!['city','country','venue'].every(key=>event.place[key]===null||typeof event.place[key]==='string')||!safeUrl(event.place.sourceUrl)))errors.push('会议地点证据无效');
  if(expectedSources.length&&!expectedSources.includes(event.sourceId||event.conference))errors.push('会议不在迅关注目录');
  if(!event.id||ids.has(event.id))errors.push('日历事件ID重复或缺失');ids.add(event.id);
  if(!event.name||!event.conference||!['conference','submission'].includes(event.type))errors.push('日历事件名称/类别无效');
  if(!isDate(event.startDate)||(event.endDate&&(!isDate(event.endDate)||event.endDate<event.startDate)))errors.push('日历日期无效');
  if(!['date','instant'].includes(event.precision))errors.push('日历精度无效');
  let validZone=true;try{if(event.timeZone)calendarDate(new Date(),event.timeZone);}catch{validZone=false;errors.push('日历时区无效');}
  if((event.precision==='instant'&&!event.timeZone)||!safeUrl(event.sourceUrl)||!isDate(event.verifiedAt))errors.push('日历证据或时区缺失');
  if(event.precision==='instant'&&(event.type!=='submission'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(event.deadlineAt||'')||!Number.isFinite(Date.parse(event.deadlineAt))))errors.push('精确截止必须带时区偏移');
  if(event.precision==='date'&&event.deadlineAt)errors.push('日精度不得伪造时刻');
  if(validZone&&event.precision==='instant'&&Number.isFinite(Date.parse(event.deadlineAt))&&calendarDate(event.deadlineAt,event.timeZone)!==event.startDate)errors.push('截止时刻与当地日期不符');
 }
 return errors;
}
export function calendarForProfile(input,profile='xun'){
 if(!input)return null;
 const declared=input.profileSources?.[profile];
 const sources=(Array.isArray(declared)?declared:null)||(profile==='xun'?input.coverage?.map(row=>row.sourceId)||[]:[]);
 return {...input,events:input.events.filter(event=>sources.includes(event.sourceId||event.conference)),coverage:(input.coverage||[]).filter(row=>sources.includes(row.sourceId))};
}
export function validateCalendarProfiles(input,expected){
 const errors=validateCalendar(input,[...new Set(Object.values(expected).flat())]);
 for(const profile of ['xun','li','lv']){
  const actual=input?.profileSources?.[profile];
  if(!Array.isArray(actual)||new Set(actual).size!==actual.length||actual.length!==expected[profile]?.length||expected[profile]?.some(id=>!actual.includes(id)))errors.push(`${profile}会议关注范围不一致`);
 }
 return errors;
}
function eventTiming(event){
 if(event.precision==='instant')return `${event.startDate} ${event.deadlineAt.slice(11,16)} ${event.timeZoneLabel||event.timeZone} · 北京 ${calendarDate(event.deadlineAt)} ${new Intl.DateTimeFormat('en-GB',{timeZone:CALENDAR_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(event.deadlineAt))}`;
 return `${event.startDate}${event.endDate&&event.endDate!==event.startDate?' — '+event.endDate:''} · ${event.timeZone||'当地日期'} · 仅日期`;
}
function eventHTML(event,now){const status=calendarEventStatus(event,now);return `<li><div><button data-calendar-event="${e(event.id)}">${e(event.name)}</button><span class="calendar-countdown${status.closed?' is-closed':''}">${e(status.label)}</span></div><p><span class="calendar-kind ${event.type==='submission'?'is-deadline':''}">${event.type==='submission'?e(event.deadlineKind||'投稿截止'):'会议日期'}</span>${e(eventTiming(event))}</p><p class="calendar-place">地点：${e([event.place?.city,event.place?.country,event.place?.venue].filter(Boolean).join(' · ')||'官方地点待核实')}</p><a href="${e(safeUrl(event.sourceUrl))}" target="_blank" rel="noopener noreferrer">官方日期 ↗</a></li>`;}

export function researchCalendarHTML(input,{profile='xun',month,selectedDate='',now=new Date(),tab='conference',tasks=[],taskError='',refreshError='',scope='main'}={}){
 const today=calendarDate(now);month=month||today.slice(0,7);const events=input?.events||[],selected=events.filter(event=>(scope==='all'||!event.track||event.track==='main')&&calendarEventOn(event,selectedDate)),upcoming=upcomingCalendarEvents(events,now,scope);
 const cells=calendarMonthDays(month).map(date=>{
  if(!date)return '<span aria-hidden="true"></span>';
  const matches=events.filter(event=>calendarEventOn(event,date)),personal=tasks.filter(task=>task.date===date);
  const taskLabel=personal.length?'，'+personal.length+'条私人事项':'';
  return `<button data-calendar-date="${date}" class="calendar-day${date===today?' is-today':''}${date===selectedDate?' is-selected':''}${matches.length?' has-events':''}" aria-label="${e(date+(date===today?'，北京时间今天':'')+(matches.length?'，'+matches.map(ev=>ev.name).join('、'):'')+taskLabel)}" aria-pressed="${date===selectedDate}"${date===today?' aria-current="date"':''}>${Number(date.slice(8))}${matches.length?'<i aria-hidden="true"></i>':''}${personal.length?'<i class="personal-marker" aria-hidden="true"></i>':''}</button>`;
 }).join('');
 const taskDate=selectedDate||today,dayTasks=tasks.filter(task=>task.date===taskDate);
 const privatePanel=`<h4>${e(taskDate)} · 本机事项</h4><button class="calendar-add-task" data-calendar-task-add="${taskDate}">＋ 添加事项</button><ul class="calendar-task-list">${dayTasks.map(task=>`<li><div><button class="calendar-task-done" data-calendar-task-toggle="${e(task.id)}" aria-label="${task.done?'标为未完成':'标为完成'}" aria-pressed="${task.done}">${task.done?'✓':'○'}</button><span class="${task.done?'task-completed':''}">${e(task.text)}</span></div><div class="calendar-task-actions"><button data-calendar-task-edit="${e(task.id)}">编辑</button><button data-calendar-task-delete="${e(task.id)}">删除</button></div></li>`).join('')||'<li class="calendar-empty">这一天还没有私人事项</li>'}</ul><p class="calendar-private-note">仅本浏览器保存，不上传或发送提醒。</p>${taskError?`<p class="calendar-task-error" role="status">${e(taskError)}</p><button data-calendar-task-retry="true">重试保存</button>`:''}<button class="calendar-back" data-calendar-task-backup="true">事项备份与迁移</button>`;
 const conferencePanel=`<div class="calendar-event-scopes"><button data-calendar-scope="main" aria-pressed="${scope==='main'}">主会节点</button><button data-calendar-scope="all" aria-pressed="${scope==='all'}">全部类型</button></div><h4>${selectedDate?e(selectedDate)+' · 当日会议事项':'接下来 · 关注的会议'}</h4><ul>${(selectedDate?selected:upcoming).map(ev=>eventHTML(ev,now)).join('')||`<li class="calendar-empty">${input===null?'日期资料暂不可用':selectedDate?'当日无已核验会议事项':'暂无即将到来的已核验事项'}</li>`}</ul>${selectedDate?'<button class="calendar-back" data-calendar-upcoming="true">查看近期事件 →</button>':''}`;
 return `<div class="calendar-heading">${profileIcon(profile)}<div><h3 id="research-calendar-title">科研日历</h3></div><span class="calendar-zone">北京时间</span></div><div class="calendar-layout"><div class="calendar-month"><div class="calendar-toolbar"><strong aria-live="polite">${e(month.replace('-',' / '))}</strong><div><button data-calendar-month="-1" aria-label="上个月">‹</button><button data-calendar-today="true">今天</button><button data-calendar-month="1" aria-label="下个月">›</button></div></div><div class="calendar-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days" role="group" aria-label="${month}日历，选择日期查看事项">${cells}</div><p class="calendar-legend"><i></i>会议 <i class="personal-marker"></i>私人</p></div><div class="calendar-agenda"><div class="calendar-tabs" role="tablist" aria-label="日程类型"><button role="tab" id="calendar-tab-private" data-calendar-tab="private" aria-controls="calendar-agenda-panel" aria-selected="${tab==='private'}" tabindex="${tab==='private'?0:-1}">私人事项</button><button role="tab" id="calendar-tab-conference" data-calendar-tab="conference" aria-controls="calendar-agenda-panel" aria-selected="${tab==='conference'}" tabindex="${tab==='conference'?0:-1}">会议事项</button></div><div id="calendar-agenda-panel" class="calendar-agenda-scroll" role="tabpanel" tabindex="0" aria-labelledby="calendar-tab-${tab==='private'?'private':'conference'}">${tab==='private'?privatePanel:conferencePanel}</div></div></div>${refreshError?`<p class="calendar-task-error" role="status">${e(refreshError)}</p>`:''}`;
}
