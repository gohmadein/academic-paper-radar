import {routeHash} from './model.js';
export function publicPaperURL(base,paper){
 const url=new URL(base);url.search='';url.hash=routeHash({view:'feed',demo:paper.demo===true,date:paper.date||'all',category:'all',readStatus:'all',q:'',tag:'all',paper:paper.id});return url.href;
}
export async function sharePaper({url,title},{share,copy}={}){
 if(share){try{await share({title,url});return 'shared';}catch(error){if(error?.name==='AbortError')return 'cancelled';}}
 if(copy){try{await copy(url);return 'copied';}catch{}}
 return 'manual';
}
