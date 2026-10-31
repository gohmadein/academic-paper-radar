// Optional backend adapter. Not imported by the app until a project, owner, auth
// flow and allowed site origins have been verified. Never reads localStorage.
const ID=/^[a-z0-9][a-z0-9-]{0,99}$/;

function publicKeyOnly(key) {
  if(typeof key!=='string'||!key||key.startsWith('sb_secret_'))return false;
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;
  try {
    const parts=key.split('.'); if(parts.length!==3)return false;
    const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.role==='anon';
  }catch{return false;}
}

export function createSupabaseBookmarkAdapter({url,publishableKey,getAccessToken=()=>null,fetchImpl=fetch}) {
  const base=new URL(url);
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('Supabase URL 必须为无凭据的 HTTPS 项目根地址');
  if(!publicKeyOnly(publishableKey))throw new Error('只接受 publishable 或旧版 anon 公钥，禁止 secret/service_role');
  async function request(path,{method='GET',body,owner=false}={}) {
    const token=await getAccessToken();
    if(owner && (!token||typeof token!=='string'))throw new Error('请先完成所有者登录；未保存到云端');
    const headers={apikey:publishableKey};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(body!==undefined)headers['Content-Type']='application/json';
    if(method==='POST' && path.startsWith('paper_signal_bookmarks'))headers.Prefer='resolution=ignore-duplicates,return=minimal';
    const response=await fetchImpl(`${base.origin}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store'});
    if(!response.ok)throw new Error(response.status===401||response.status===403?'登录或所有者权限不足；未确认云端保存':'云端请求失败；请重试，尚未确认保存');
    return response.status===204||response.headers.get('content-length')==='0'?null:response.text().then(text=>text?JSON.parse(text):null);
  }
  async function read() {
    const rows=await request('paper_signal_bookmarks?select=paper_id&order=created_at.asc');
    if(!Array.isArray(rows)||rows.length>5000||rows.some(row=>!row||typeof row.paper_id!=='string'||!ID.test(row.paper_id)))throw new Error('云端清单数据无效');
    return new Set(rows.map(row=>row.paper_id));
  }
  return {
    kind:'supabase-public-owner-writes',
    read,
    async isOwner(){const value=await request('rpc/paper_signal_is_owner',{method:'POST',body:{},owner:true});return value===true;},
    async add(id){if(typeof id!=='string'||!ID.test(id)||id.startsWith('demo-'))throw new Error('只能公开收藏已核实的真实论文 ID');await request('paper_signal_bookmarks?on_conflict=paper_id',{method:'POST',body:{paper_id:id},owner:true});const ids=await read();if(!ids.has(id))throw new Error('云端尚未确认此书签，不能标记已同步');return ids;},
    async remove(id){if(typeof id!=='string'||!ID.test(id))throw new Error('论文 ID 无效');await request(`paper_signal_bookmarks?paper_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',owner:true});const ids=await read();if(ids.has(id))throw new Error('云端尚未确认移除，不能标记已同步');return ids;}
  };
}
