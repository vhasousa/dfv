import {randomUUID,randomBytes} from 'node:crypto';
const ttl=7*86400;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const writeScript=`
local rows=cjson.decode(ARGV[1])
local received=tonumber(ARGV[2])
local ids={}
local unique={}
local seen={}
for _,r in ipairs(rows) do
 if not seen[r.id] then
  seen[r.id]=true
  table.insert(ids,r.id)
  table.insert(unique,r)
 end
end
local old=redis.call('HMGET',KEYS[2],unpack(ids))
local saved={}
local fresh={}
for i,r in ipairs(unique) do
 if old[i] then saved[r.id]=cjson.decode(old[i])
 else table.insert(fresh,r) end
end
if #fresh>0 then
 local last=tonumber(redis.call('INCRBY',KEYS[4],#fresh))
 local fields={}
 local scores={}
 for i,r in ipairs(fresh) do
  r.receivedAt=received
  r.seq=last-#fresh+i
  saved[r.id]=r
  table.insert(fields,r.id)
  table.insert(fields,cjson.encode(r))
  table.insert(scores,r.seq)
  table.insert(scores,r.id)
 end
 redis.call('HSET',KEYS[2],unpack(fields))
 redis.call('ZADD',KEYS[3],unpack(scores))
end
local ack={}
for _,r in ipairs(rows) do
 local item=saved[r.id]
 table.insert(ack,{id=item.id,receivedAt=item.receivedAt,seq=item.seq})
end
for _,k in ipairs(KEYS) do redis.call('EXPIRE',k,ARGV[3]) end
return cjson.encode(ack)
`;
function envConfig(){for(const prefix of ['KV_REST_API','UPSTASH_REDIS_REST']){const url=process.env[prefix+'_URL']?.trim(),token=process.env[prefix+'_TOKEN']?.trim();if(url&&token)return {url,token};}return {};}
export function createHandler(command){return async function handle(req){try{
 const u=new URL(req.url),action=u.searchParams.get('action');
 if(req.method==='POST'&&req.headers.get('origin')!==u.origin)return reply({error:'Abra a aplicação no mesmo endereço HTTPS da API.'},403);
 if(action==='create'&&req.method==='POST'){
 const b=await req.json(),session={code:randomUUID().replaceAll('-',''),writeToken:randomBytes(32).toString('hex'),readToken:randomBytes(32).toString('hex'),name:String(b.name||'Teste de movimento').slice(0,80),createdAt:Date.now()};
 await command(['SET','sensor:'+session.code,JSON.stringify(session),'EX',ttl,'NX']);return reply(session);
 }
 const code=u.searchParams.get('session');if(!/^[a-f0-9]{32}$/.test(code||''))return reply({error:'Sessão inválida.'},400);
 const raw=await command(['GET','sensor:'+code]);if(!raw)return reply({error:'Sessão não encontrada ou expirada. Toque em Sincronizar agora para ativar um novo painel.',code:'SESSION_NOT_FOUND'},404);const s=JSON.parse(raw),auth=req.headers.get('authorization'),writer=auth==='Bearer '+s.writeToken,reader=auth==='Bearer '+s.readToken;
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
  }catch(e){console.error('sensor API:',e.code||'STORAGE_ERROR');return reply({error:e.code?e.message:'Falha no armazenamento compartilhado. O celular mantém a fila local para tentar novamente.',...(e.code?{code:e.code}:{})},503);}};}
export default {async fetch(req){const config=envConfig();if(!config.url||!config.token)return reply({error:'Conecte Upstash Redis ao projeto Vercel (Storage/Marketplace) e faça Redeploy. São necessárias KV_REST_API_URL e KV_REST_API_TOKEN, ou UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.'},503);
 const command=async command=>{const res=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});const data=await res.json();if(!res.ok||data.error){const detail=String(data.error||'');const limited=res.status===429||/max requests|quota|limit exceeded/i.test(detail),auth=res.status===401||res.status===403||/wrongpass|unauthorized|noperm/i.test(detail);const error=Error(limited?'O Redis atingiu o limite de comandos. Confira o consumo no Upstash. A fila permanece no celular.':auth?'O Redis recusou as credenciais. Confira a URL REST e o token de escrita na Vercel e faça Redeploy.':'Redis indisponível. A fila permanece no celular para tentar novamente.');error.code=limited?'STORAGE_LIMIT':auth?'STORAGE_AUTH':'STORAGE_UNAVAILABLE';throw error;}return data.result;};return createHandler(command)(req);
}};
