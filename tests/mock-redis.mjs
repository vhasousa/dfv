import {executeLua} from './lua-runtime.mjs';
export function mockRedis(){
 const strings=new Map(),hashes=new Map(),sets=new Map(),expires=new Map();
 const commands=[];
 const exists=key=>strings.has(key)||hashes.has(key)||sets.has(key);
 function run(args){
  commands.push([...args]);
  const [op,key,...rest]=args;
  if(expires.has(key)&&expires.get(key)<=Date.now()){strings.delete(key);hashes.delete(key);sets.delete(key);expires.delete(key);}
  if(op==='SET'){if(rest.includes('NX')&&exists(key))return null;strings.set(key,String(rest[0]));if(rest[1]==='EX')expires.set(key,Date.now()+Number(rest[2])*1000);return 'OK';}
  if(op==='GET')return strings.get(key)??null;
  if(op==='INCR'||op==='INCRBY'){const value=Number(strings.get(key)||0)+(op==='INCR'?1:Number(rest[0]));strings.set(key,String(value));return value;}
  if(op==='HGET')return hashes.get(key)?.get(rest[0])??null;
  if(op==='HMGET')return rest.map(id=>hashes.get(key)?.get(id)??null);
  if(op==='HSET'){let map=hashes.get(key);if(!map){map=new Map();hashes.set(key,map);}let added=0;for(let i=0;i<rest.length;i+=2){if(!map.has(rest[i]))added++;map.set(rest[i],rest[i+1]);}return added;}
  if(op==='ZADD'){let map=sets.get(key);if(!map){map=new Map();sets.set(key,map);}let added=0;for(let i=0;i<rest.length;i+=2){if(!map.has(rest[i+1]))added++;map.set(rest[i+1],Number(rest[i]));}return added;}
  if(op==='ZRANGEBYSCORE')return [...(sets.get(key)||[])].filter(([,seq])=>seq>Number(String(rest[0]).slice(1))).sort((a,b)=>a[1]-b[1]).slice(Number(rest[3]),Number(rest[3])+Number(rest[4])).map(([id])=>id);
  if(op==='EXPIRE'){if(!exists(key))return 0;expires.set(key,Date.now()+Number(rest[0])*1000);return 1;}
  if(op==='EVAL'){const count=Number(rest[0]);return executeLua(key,rest.slice(1,count+1),rest.slice(count+1),run);}
  throw Error('Comando inesperado: '+op);
 }
 const command=async args=>run(args);command.commands=commands;
 return command;
}
