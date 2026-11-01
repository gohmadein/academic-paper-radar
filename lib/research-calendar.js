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
export function upcomingCalendarEvents(events,now=new Date()){
 return events.filter(event=>!calendarEventStatus(event,now).closed).sort((a,b)=>calendarEventDay(a).localeCompare(calendarEventDay(b))||a.id.localeCompare(b.id)).slice(0,3);
}
export function validateCalendar(input){
 const errors=[];if(input?.version!==1||!Array.isArray(input?.events))return ['日历格式无效'];const ids=new Set();
 for(const event of input.events){
  if(!event.id||ids.has(event.id))errors.push('日历事件ID重复或缺失');ids.add(event.id);
  if(!event.name||!event.conference||!['conference','submission'].includes(event.type))errors.push('日历事件名称/类别无效');
  if(!isDate(event.startDate)||(event.endDate&&(!isDate(event.endDate)||event.endDate<event.startDate)))errors.push('日历日期无效');
  if(!['date','instant'].includes(event.precision))errors.push('日历精度无效');
  try{if(event.timeZone)calendarDate(new Date(),event.timeZone);}catch{errors.push('日历时区无效');}
  if((event.precision==='instant'&&!event.timeZone)||!safeUrl(event.sourceUrl)||!isDate(event.verifiedAt))errors.push('日历证据或时区缺失');
  if(event.precision==='instant'&&(event.type!=='submission'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(event.deadlineAt||'')||!Number.isFinite(Date.parse(event.deadlineAt))))errors.push('精确截止必须带时区偏移');
  if(event.precision==='date'&&event.deadlineAt)errors.push('日精度不得伪造时刻');
  if(event.precision==='instant'&&Number.isFinite(Date.parse(event.deadlineAt))&&calendarDate(event.deadlineAt,event.timeZone)!==event.startDate)errors.push('截止时刻与当地日期不符');
 }
 return errors;
}
function eventTiming(event){
 if(event.precision==='instant')return `${event.startDate} ${event.deadlineAt.slice(11,16)} ${event.timeZoneLabel||event.timeZone} · 北京 ${calendarDate(event.deadlineAt)} ${new Intl.DateTimeFormat('en-GB',{timeZone:CALENDAR_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(event.deadlineAt))}`;
 return `${event.startDate}${event.endDate&&event.endDate!==event.startDate?' — '+event.endDate:''} · ${event.timeZone||'当地日期'} · 仅日期`;
}
function eventHTML(event,now){const status=calendarEventStatus(event,now);return `<li><div><button data-calendar-event="${e(event.id)}">${e(event.name)}</button><span class="calendar-countdown${status.closed?' is-closed':''}">${e(status.label)}</span></div><p><span class="calendar-kind ${event.type==='submission'?'is-deadline':''}">${event.type==='submission'?e(event.deadlineKind||'投稿截止'):'会议日期'}</span>${e(eventTiming(event))}</p><a href="${e(safeUrl(event.sourceUrl))}" target="_blank" rel="noopener noreferrer">官方日期 ↗</a><small>核验 ${e(event.verifiedAt)}</small>${event.note?`<details><summary>投稿条件</summary><p>${e(event.note)}</p></details>`:''}</li>`;}
const robot='<svg class="calendar-robot" aria-hidden="true" viewBox="0 0 32 32"><path d="M16 4v4M8 12H5v10h3m16-10h3v10h-3M11 26v3m10-3v3"/><rect x="8" y="8" width="16" height="18" rx="5"/><circle cx="16" cy="3" r="2"/><circle cx="12" cy="15" r="1"/><circle cx="20" cy="15" r="1"/><path d="M12 21h8"/></svg>';
export function researchCalendarHTML(input,{month,selectedDate='',now=new Date()}={}){
 const today=calendarDate(now);month=month||today.slice(0,7);const events=input?.events||[],selected=events.filter(event=>calendarEventOn(event,selectedDate)),upcoming=upcomingCalendarEvents(events,now);
 const cells=calendarMonthDays(month).map(date=>{
  if(!date)return '<span aria-hidden="true"></span>';
  const matches=events.filter(event=>calendarEventOn(event,date));
  return `<button data-calendar-date="${date}" class="calendar-day${date===today?' is-today':''}${date===selectedDate?' is-selected':''}${matches.length?' has-events':''}" aria-label="${e(date+(date===today?'，北京时间今天':'')+(matches.length?'，'+matches.map(ev=>ev.name).join('、'):''))}" aria-pressed="${date===selectedDate}"${date===today?' aria-current="date"':''}>${Number(date.slice(8))}${matches.length?'<i aria-hidden="true"></i>':''}</button>`;
 }).join('');
 return `<div class="calendar-heading">${robot}<div><p>RESEARCH CALENDAR</p><h3 id="research-calendar-title">科研日历</h3></div><span class="calendar-zone">北京时间</span></div><div class="calendar-layout"><div class="calendar-month"><div class="calendar-toolbar"><strong aria-live="polite">${e(month.replace('-',' / '))}</strong><div><button data-calendar-month="-1" aria-label="上个月">‹</button><button data-calendar-today="true">今天</button><button data-calendar-month="1" aria-label="下个月">›</button></div></div><div class="calendar-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days" role="group" aria-label="${month}日历，选择日期查看事件">${cells}</div><p class="calendar-legend"><i></i> 已核验事件 · 点击日期</p></div><div class="calendar-agenda" aria-live="polite"><h4>${selectedDate?e(selectedDate)+' · 当日':'接下来'}</h4><ul>${(selectedDate?selected:upcoming).map(ev=>eventHTML(ev,now)).join('')||`<li class="calendar-empty">${input===null?'日期资料暂不可用':selectedDate?'当日无已核验事件':'暂无即将到来的已核验事件'}</li>`}</ul>${selectedDate?'<button class="calendar-back" data-calendar-upcoming="true">查看近期事件 →</button>':''}</div></div><p class="calendar-footnote">截止按官方时区；精确截止标在北京日期。会议仅按当地日期，天数为日期估计；以官方最新公告为准。</p>`;
}
