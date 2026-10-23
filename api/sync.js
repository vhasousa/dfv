import {randomUUID,randomBytes} from 'node:crypto';
const ttl=7*86400;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const writeScript=`
local rows=cjson.decode(ARGV[1])
local received=tonumber(ARGV[2])
local ack={}
for _,r in ipairs(rows) do
 local old=redis.call('HGET',KEYS[2],r.id)
 if not old then
  r.receivedAt=received
  local seq=redis.call('INCR',KEYS[4])
  r.seq=seq
  local encoded=cjson.encode(r)
  redis.call('HSET',KEYS[2],r.id,encoded)
  redis.call('ZADD',KEYS[3],seq,r.id)
  old=encoded
 end
 local saved=cjson.decode(old)
 table.insert(ack,{id=saved.id,receivedAt=saved.receivedAt,seq=saved.seq})
end
for _,k in ipairs(KEYS) do redis.call('EXPIRE',k,ARGV[3]) end
return cjson.encode(ack)
`;
function envConfig(){return {url:process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,token:process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN};}
export function createHandler(command){return async function handle(req){try{
 const u=new URL(req.url),action=u.searchParams.get('action');
 if(req.method==='POST'&&req.headers.get('origin')!==u.origin)return reply({error:'Abra a aplicação no mesmo endereço HTTPS da API.'},403);
 if(action==='create'&&req.method==='POST'){
 const b=await req.json(),session={code:randomUUID().replaceAll('-',''),writeToken:randomBytes(32).toString('hex'),readToken:randomBytes(32).toString('hex'),name:String(b.name||'Teste de movimento').slice(0,80),createdAt:Date.now()};
 await command(['SET','sensor:'+session.code,JSON.stringify(session),'EX',ttl,'NX']);return reply(session);
 }
 const code=u.searchParams.get('session');if(!/^[a-f0-9]{32}$/.test(code||''))return reply({error:'Sessão inválida.'},400);
 const raw=await command(['GET','sensor:'+code]);if(!raw)return reply({error:'Sessão não encontrada ou expirada. Ative um novo painel.'},404);const s=JSON.parse(raw),auth=req.headers.get('authorization'),writer=auth==='Bearer '+s.writeToken,reader=auth==='Bearer '+s.readToken;
 if(!writer&&!reader)return reply({error:'Link da sessão inválido. Copie o link completo novamente.'},403);
 if(action==='info'&&req.method==='GET')return reply({code,name:s.name,createdAt:s.createdAt,...(writer?{readToken:s.readToken}:{})});
 if(action==='push'&&req.method==='POST'){
 if(!writer)return reply({error:'Este link permite apenas visualizar.'},403);
 const text=await req.text();if(text.length>200000)return reply({error:'Lote muito grande.'},413);let rows;try{rows=JSON.parse(text).records;}catch{return reply({error:'Lote inválido.'},400);}
 if(!Array.isArray(rows)||!rows.length||rows.length>200)return reply({error:'Lote inválido.'},400);
 if(rows.some(r=>!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||!Number.isFinite(r.t)||!['sample','event','status'].includes(r.type)||(r.type==='sample'&&!['x','y','z','a','j'].every(k=>Number.isFinite(r[k])))||(r.type==='event'&&!['peak','jerk','duration'].every(k=>Number.isFinite(r[k])))))return reply({error:'Medição inválida.'},400);
 const clean=rows.map(r=>{const {receivedAt,seq,...rest}=r;return rest;});const prefix='sensor:'+code;
 const result=await command(['EVAL',writeScript,4,prefix,prefix+':rows',prefix+':order',prefix+':seq',JSON.stringify(clean),Date.now(),ttl]);return reply({acks:JSON.parse(result)});
 }
 if(action==='read'&&req.method==='GET'){
 const after=Number(u.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return reply({error:'Cursor inválido.'},400);
 const prefix='sensor:'+code,ids=await command(['ZRANGEBYSCORE',prefix+':order','('+after,'+inf','LIMIT',0,500]);
 const values=ids.length?await command(['HMGET',prefix+':rows',...ids]):[];const records=values.filter(Boolean).map(r=>JSON.parse(r));
 return reply({name:s.name,records,cursor:records.length?records.at(-1).seq:after,hasMore:ids.length===500,serverTime:Date.now()});
 }
 return reply({error:'Operação inválida.'},405);
 }catch(e){console.error('sensor API:',e.message);return reply({error:'Falha no armazenamento compartilhado. O celular mantém a fila local para tentar novamente.'},503);}};}
export default {async fetch(req){const config=envConfig();if(!config.url||!config.token)return reply({error:'Conecte Upstash Redis ao projeto Vercel (Storage/Marketplace) e faça Redeploy. São necessárias KV_REST_API_URL e KV_REST_API_TOKEN, ou UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.'},503);
 const command=async command=>{const res=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});const data=await res.json();if(!res.ok||data.error)throw Error(data.error||'Redis indisponível');return data.result;};return createHandler(command)(req);
}};
