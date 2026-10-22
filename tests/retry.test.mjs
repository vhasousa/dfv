import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('confirmação local falha: preserva pendência, evita novas tentativas imediatas e permite reenvio manual',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const record={id:'sample',type:'sample',t:100};let fail=true,calls=0,persisted;
 const state={textContent:''};
 const ctx=vm.createContext({
  Date,Map,Promise,Math,Infinity,cloudBusy:false,nextCloudAttempt:0,cloudRetry:30000,lastCloudSync:0,
  current:{cloud:{code:'test'}},records:[record],navigator:{onLine:true},$:()=>state,
  cloudAPI:async()=>{calls++;return {acks:[{id:'sample',seq:1,receivedAt:200}]};},
  db:{transaction(){const t={objectStore:()=>({put(r){if(!fail)persisted=structuredClone(r);}})};queueMicrotask(()=>{if(fail){t.error=Error('Disco indisponível');t.onabort();}else t.oncomplete();});return t;}},
 });
 vm.runInContext(source.slice(source.indexOf('async function syncCloud('),source.indexOf('setInterval(syncCloud')),ctx);
 await vm.runInContext('syncCloud()',ctx);
 assert.equal(record.receivedAt,undefined);assert.equal(calls,1);assert.match(state.textContent,/Disco indisponível/);
 await vm.runInContext('syncCloud()',ctx);assert.equal(calls,1);
 fail=false;await vm.runInContext('syncCloud(true)',ctx);
 assert.equal(calls,2);assert.equal(record.receivedAt,200);assert.equal(persisted.seq,1);assert.equal(ctx.nextCloudAttempt,0);
});

test('painel reduz consultas ociosas e recua após falha, recuperando depois',async()=>{
 const source=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');
 let time=100000,fail=false,calls=0;const message={};
 const ctx=vm.createContext({
  Date:class extends Date{static now(){return time;}},Math,
  code:'session',token:'token',busy:false,nextPollAt:0,pollDelay:30000,retryDelay:30000,
  lastContact:0,serverOffset:0,latest:null,state:null,cursor:0,all:new Map(),document:{hidden:false},
  $:()=>message,open(){},render(){},alertEvent(){},
  api:async()=>{calls++;if(fail)throw Error('indisponível');return {name:'Carga',serverTime:time,records:[],cursor:0,hasMore:false};}
 });
 vm.runInContext(source.slice(source.indexOf('async function poll()'),source.indexOf('function render()')),ctx);
 await vm.runInContext('poll()',ctx);assert.equal(calls,1);
 time+=3000;await vm.runInContext('poll()',ctx);assert.equal(calls,1);
 time=ctx.nextPollAt;fail=true;await vm.runInContext('poll()',ctx);assert.equal(ctx.nextPollAt-time,30000);
 time+=15000;await vm.runInContext('poll()',ctx);assert.equal(calls,2);
 time=ctx.nextPollAt;await vm.runInContext('poll()',ctx);assert.equal(ctx.nextPollAt-time,60000);
 time=ctx.nextPollAt;fail=false;ctx.document.hidden=true;await vm.runInContext('poll()',ctx);
 assert.equal(calls,3);ctx.document.hidden=false;await vm.runInContext('poll()',ctx);assert.equal(calls,4);assert.equal(ctx.nextPollAt-time,30000);assert.equal(ctx.retryDelay,30000);assert.equal(message.textContent,'');
});
