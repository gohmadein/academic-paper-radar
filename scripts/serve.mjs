// Development preview only. This script is never deployed.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {root} from './validate.mjs';

const base=resolve(root,'dist');
const port=Number(process.env.PORT || 4173);
await stat(resolve(base,'index.html')).catch(()=>{throw new Error('请先运行 npm run build');});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  // Support the GitHub Pages project subpath as well as a root deployment.
  pathname=pathname.replace(/^\/academic-paper-radar(?=\/|$)/,'');
  const file=resolve(base,`.${pathname || '/'}`,pathname.endsWith('/')||!pathname?'index.html':'');
  if(!file.startsWith(base+sep)){res.writeHead(403).end();return;}
  try{
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('404 · 文件未找到');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/academic-paper-radar/`));
process.on('SIGINT',()=>server.close());
