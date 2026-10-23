import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../api/sync.js';
test('usa par completo de credenciais e informa limite sem expor tokens',async()=>{
 const names=['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
 const previous=names.map(k=>process.env[k]),fetchOriginal=globalThis.fetch;
 const request=()=>new Request('https://sensor.example/api/sync?action=create',{method:'POST',headers:{origin:'https://sensor.example','Content-Type':'application/json'},body:'{"name":"Teste"}'});
 try{
  for(const name of names)delete process.env[name];
  process.env.KV_REST_API_URL='https://old.example';
  process.env.UPSTASH_REDIS_REST_URL=' https://redis.example ';
  process.env.UPSTASH_REDIS_REST_TOKEN=' write-token ';
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://redis.example');assert.equal(options.headers.Authorization,'Bearer write-token');return Response.json({result:'OK'});};
  assert.equal((await worker.fetch(request())).status,200);
  globalThis.fetch=async()=>Response.json({error:'ERR max requests limit exceeded. secret-value'});
  const res=await worker.fetch(request()),data=await res.json();
  assert.equal(res.status,503);assert.equal(data.code,'STORAGE_LIMIT');assert.ok(!data.error.includes('secret-value'));
 }finally{
  globalThis.fetch=fetchOriginal;
  names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});
 }
});
