// Display taxonomy only: never used to admit or reject papers at ingestion.
// Stable IDs are URL values; fine-grained paper.tags remain untouched.
export const TOPICS = [
  {id:'robot-perception',label:'感知与导航',domain:'robot',pattern:/感知|视觉|导航|定位|建图|里程计|perception|vision|navigation|localization|slam/i},
  {id:'robot-control',label:'操作与控制',domain:'robot',pattern:/操作|控制|规划|抓取|运动|力觉|触觉|manipulation|control|planning|grasp|locomotion|tactile/i},
  {id:'robot-learning',label:'机器人学习',domain:'robot',pattern:/学习|策略|数据采集|人类纠正|行为克隆|残差RL|损失函数|learning|policy|policies|imitation|reinforcement/i},
  {id:'embodied-models',label:'具身智能与模型',domain:'robot',pattern:/具身|世界模型|大模型|基础模型|embodied|world model|foundation model|\b(?:vla|vlm|llm)\b/i},
  {id:'robot-systems',label:'机器人系统与评测',domain:'robot',pattern:/系统|多机器人|协作|安全|不确定性|保证|评估|评测|仿真|嵌入式|system|multi.robot|collaboration|safety|uncertainty|evaluation|benchmark|simulation|sim.to.real/i},
  {id:'knowledge-reasoning',label:'知识图谱与推理',domain:'knowledge',pattern:/知识图谱|本体|推理|语义|knowledge graph|ontology|reasoning|semantic|\b(?:vkg|obda|rdf|owl)\b/i},
  {id:'database-updates',label:'数据库与更新',domain:'knowledge',pattern:/数据库|查询|视图|更新|插入|删除|缺失答案|database|query|queries|view|update|insertion|deletion/i},
  {id:'data-theory',label:'数据理论与溯源',domain:'knowledge',pattern:/理论|溯源|约束|修复|复杂性|见证|副作用|整数线性规划|provenance|constraint|repair|complexity|witness|theory|causality/i},
];

const value = topic => `topic:${topic.id}`;
export const topicLabel = tag => TOPICS.find(t=>value(t)===tag)?.label || tag;

export function paperTopics(paper, category='all') {
  const profiles=paper.profiles || [];
  // Profile membership is editorial metadata, not inferred from keywords.
  const domains=new Set();
  if ((category==='all'||category==='xun'||category==='lv') && profiles.some(p=>p==='xun'||p==='lv')) domains.add('robot');
  if ((category==='all'||category==='li') && profiles.includes('li')) domains.add('knowledge');
  // Legacy/demo entries have no profile: allow matching, without inventing membership.
  if (!profiles.length && category==='all') { domains.add('robot'); domains.add('knowledge'); }
  const tags=(paper.tags||[]).join(' ');
  const title=[paper.title,paper.titleEn].filter(Boolean).join(' ');
  const result=[];
  for(const domain of domains){
    const candidates=TOPICS.filter(t=>t.domain===domain);
    let matched=candidates.filter(t=>t.pattern.test(tags));
    if(!matched.length) matched=candidates.filter(t=>t.pattern.test(title));
    // New subfields remain discoverable without multiplying navigation chips.
    if(!matched.length && profiles.length) matched=candidates.filter(t=>t.id===(domain==='robot'?'robot-systems':'database-updates'));
    result.push(...matched.map(value));
  }
  return result;
}

export function availableTopics(papers, category='all') {
  const present=new Set(papers.filter(p=>category==='all'||p.profiles?.includes(category))
    .flatMap(p=>(p.appearances||[p]).flatMap(occurrence=>paperTopics(occurrence,category))));
  return TOPICS.map(value).filter(id=>present.has(id));
}

export function matchesTopic(paper, tag, category='all') {
  return tag==='all' || (tag.startsWith('topic:') ? paperTopics(paper,category).includes(tag) : (paper.tags||[]).includes(tag));
}

export function topicForProfile(papers, tag, category) {
  return tag==='all' || papers.some(p=>(p.appearances||[p]).some(occurrence=>
    (category==='all'||occurrence.profiles?.includes(category)) && matchesTopic(occurrence,tag,category))) ? tag : 'all';
}
