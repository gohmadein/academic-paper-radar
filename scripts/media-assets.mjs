import {readFile} from 'node:fs/promises';import{resolve,sep,extname}from'node:path';import{createHash}from'node:crypto';
import{collectAssets,validateAsset}from'../lib/paper-media.js';
export function imageDimensions(bytes,extension){
 if(extension==='.png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(['.jpg','.jpeg'].includes(extension)&&bytes[0]===255&&bytes[1]===216){
  let at=2;while(at+8<bytes.length){if(bytes[at++]!==255)continue;while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===0xd9||marker===0xda)break;const length=bytes.readUInt16BE(at);if(length<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:bytes.readUInt16BE(at+3),width:bytes.readUInt16BE(at+5)};at+=length;}
 }
 if(extension==='.webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'){
  const type=bytes.subarray(12,16).toString();
  if(type==='VP8X'&&bytes.length>=30)return {width:bytes.readUIntLE(24,3)+1,height:bytes.readUIntLE(27,3)+1};
  if(type==='VP8 '&&bytes.length>=30)return {width:bytes.readUInt16LE(26)&16383,height:bytes.readUInt16LE(28)&16383};
  if(type==='VP8L'&&bytes.length>=25)return {width:1+bytes[21]+((bytes[22]&63)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
 }
 if(extension==='.svg'){
  const text=bytes.toString('utf8');if(/<script\b|<foreignObject\b|<(?:animate|set)\b|\bon\w+\s*=|@import|url\(\s*["']?\s*(?:https?:|\/\/|javascript:)/i.test(text))throw new Error('SVG含脚本、动态效果或外部运行时资源');
  for(const match of text.matchAll(/\b(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi))if(!/^(?:#|data:image\/(?:png|jpeg|webp);base64,)/.test(match[1]))throw new Error('SVG引用未打包资源或非图像URL');
  const box=text.match(/viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i);if(box)return {width:Number(box[1]),height:Number(box[2]),vector:true};
  const width=text.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i),height=text.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);if(width&&height)return {width:Number(width[1]),height:Number(height[1]),vector:true};
 }
 throw new Error('无法核验图片格式或尺寸');
}
export function uniqueAssets(papers){
 const map=new Map();for(const p of papers)for(const asset of collectAssets(p)){const existing=map.get(asset.path);if(existing&&existing.sha256!==asset.sha256)throw new Error(`同一路径对应不同素材：${asset.path}`);map.set(asset.path,asset);}return [...map.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
export async function readAsset(asset,base){
 const errors=validateAsset(asset,asset.kind);if(errors.length)throw new Error(errors.join('；'));
 const absolute=resolve(base,asset.path);if(!absolute.startsWith(resolve(base)+sep))throw new Error('素材路径越界');
 const bytes=await readFile(absolute);if(bytes.length>5*1024*1024)throw new Error('单个素材超过5MB，请无损或忠实优化后再发布');
 if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('素材SHA256不一致');
 const dimensions=imageDimensions(bytes,extname(absolute).toLowerCase());
 if(dimensions.vector?Math.abs(dimensions.width/dimensions.height-asset.width/asset.height)>.01:dimensions.width!==asset.width||dimensions.height!==asset.height)throw new Error('素材实际尺寸与声明不一致');
 return bytes;
}
export async function validateAssetFiles(papers,base){
 const errors=[];let assets=[];try{assets=uniqueAssets(papers);}catch(error){return [error.message];}
 for(const asset of assets)try{await readAsset(asset,base);}catch(error){errors.push(`${asset.path}: ${error.message}`);}return errors;
}
