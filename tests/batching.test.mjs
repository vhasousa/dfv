import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createHandler,writeScript} from '../api/sync.js';
import {mockRedis} from './mock-redis.mjs';

test('comparação com Lua original: gravação de 200 registros cai de 806 para 10 comandos',async()=>{
 const original=readFileSync(new URL('./fixtures/original-write.lua',import.meta.url),'utf8');
 const rows=Array.from({length:200},()=>({id:randomUUID(),type:'sample',t:1,x:1,y:0,z:0,a:1,j:0}));
 const counts=[];
 for(const script of [original,writeScript]){
  const redis=mockRedis(),prefix='sensor:'+'b'.repeat(32);
  await redis(['SET',prefix,'{}','EX',604800]);redis.commands.length=0;
  await redis(['GET',prefix]);
  const acks=JSON.parse(await redis(['EVAL',script,4,prefix,prefix+':rows',prefix+':order',prefix+':seq',JSON.stringify(rows),Date.now(),604800]));
  assert.equal(acks.length,200);assert.equal(acks.at(-1).seq,200);counts.push(redis.commands.length);
 }
 assert.deepEqual(counts,[806,10]);
});

test('200 medições usam dez comandos, incluindo os internos do Lua; reenvio não duplica',async()=>{
 const redis=mockRedis(),handle=createHandler(redis),origin='https://sensor.example';
 const call=(action,s,body,after=0)=>handle(new Request(origin+'/api/sync?action='+action+(s?'&session='+s.code:'')+'&after='+after,{method:body?'POST':'GET',headers:{origin,'Content-Type':'application/json',Authorization:'Bearer '+s?.writeToken},body:body?JSON.stringify(body):undefined}));
 const session=await(await call('create',null,{name:'Lote'})).json();
 const rows=Array.from({length:200},(_,i)=>({id:randomUUID(),type:'sample',t:i,x:1,y:0,z:0,a:1,j:0}));
 redis.commands.length=0;
 const response=await call('push',session,{records:rows});assert.equal(response.status,200);
 const first=await response.json();assert.equal(first.acks.length,200);
 assert.equal(redis.commands.length,10);
 for(const op of ['HMGET','INCRBY','HSET','ZADD'])assert.equal(redis.commands.filter(c=>c[0]===op).length,1);
 redis.commands.length=0;
 const again=await(await call('push',session,{records:rows})).json();assert.deepEqual(again,first);
 assert.equal(redis.commands.length,7);assert.ok(!redis.commands.some(c=>c[0]==='INCRBY'));
 let read=await(await call('read',session)).json();assert.equal(read.records.length,200);assert.equal(read.cursor,200);
 // IDs repetidos no mesmo lote, inclusive com payload diferente, mantêm a primeira versão.
 const fresh={...rows[0],id:randomUUID()};
 const mixed=await(await call('push',session,{records:[rows[0],fresh,{...fresh,x:99}]})).json();
 assert.deepEqual(mixed.acks[1],mixed.acks[2]);assert.equal(mixed.acks[1].seq,201);
 read=await(await call('read',session,null,200)).json();assert.equal(read.records.length,1);assert.equal(read.records[0].x,1);
});

test('chaves antigas continuam legíveis e o próximo lote preserva a sequência',async()=>{
 const redis=mockRedis(),prefix='sensor:'+'a'.repeat(32),row={id:randomUUID(),type:'status',t:1,state:'started',seq:50,receivedAt:100};
 await redis(['SET',prefix,'{}','EX',604800]);await redis(['SET',prefix+':seq','50']);
 await redis(['HSET',prefix+':rows',row.id,JSON.stringify(row)]);await redis(['ZADD',prefix+':order',50,row.id]);
 const next={id:randomUUID(),type:'status',t:2,state:'stopped'};
 const ack=JSON.parse(await redis(['EVAL',writeScript,4,prefix,prefix+':rows',prefix+':order',prefix+':seq',JSON.stringify([row,next]),200,604800]));
 assert.equal(ack[0].seq,50);assert.equal(ack[0].receivedAt,100);assert.equal(ack[1].seq,51);
});
