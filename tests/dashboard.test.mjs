import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {randomUUID} from 'node:crypto';import {createHandler} from '../api/sync.js';import {mockRedis} from './mock-redis.mjs';
test('dashboard carrega duas páginas e não duplica leituras em novas consultas',async()=>{const handler=createHandler(mockRedis());const base='https://sensor.example';const request=(action,s,token,body)=>handler(new Request(base+'/api/sync?action='+action+(s?'&session='+s:''),{method:body?'POST':'GET',headers:{origin:base,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}));const session=await(await request('create',null,null,{name:'Carga real de teste automatizado'})).json();let now=Date.now();for(let batch=0;batch<3;batch++){const records=Array.from({length:200},(_,i)=>({id:randomUUID(),type:'sample',t:now+batch*200+i,x:0,y:1,z:0,a:1,j:0}));await request('push',session.code,session.writeToken,{records});}
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',checked:false,value:'',clientWidth:600,classList:{add(){},remove(){},toggle(){}},replaceChildren(){},getContext:()=>({scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})});return elements.get(id);};
const context=vm.createContext({document:{getElementById:element,createElement:()=>element(randomUUID())},location:{hash:'#session='+session.code+'&token='+session.readToken,origin:base},URLSearchParams,Date,AbortSignal,Map,devicePixelRatio:1,setInterval(){},setTimeout(){},navigator:{},fetch:(url,opts)=>handler(new Request(base+url,opts))});context.window=context;context.addEventListener=()=>{};const src=fs.readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8').replace("if(code&&token){open('Carregando sessão…');poll();}","globalThis.testReady=poll();");vm.runInContext(src,context);await context.testReady;assert.equal(vm.runInContext('all.size',context),600);assert.equal(vm.runInContext('cursor',context),600);assert.equal(element('x').textContent,'0.00');assert.equal(element('cargo').textContent,'Carga real de teste automatizado');await vm.runInContext('nextPollAt=0;poll()',context);assert.equal(vm.runInContext('all.size',context),600);
});

test('resumo trata sessão vazia e calcula pico, período e último evento',()=>{
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element},Date,Math});
 const src=fs.readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');
 vm.runInContext("const $=id=>document.getElementById(id);const stamp=t=>new Date(t).toLocaleString('pt-BR');"+src.slice(src.indexOf('function renderSummary(')),context);
 vm.runInContext('renderSummary([],[])',context);
 assert.equal(element('summarySamples').textContent,'0');
 assert.equal(element('summaryPeak').textContent,'—');
 assert.equal(element('summaryDuration').textContent,'—');
 assert.equal(element('summaryLastEvent').textContent,'Nenhum evento recebido nesta sessão.');
 vm.runInContext('renderSummary([{t:125000,a:8.25},{t:0,a:1.5},{t:60000,a:3}],[{t:60000,peak:8.25}])',context);
 assert.equal(element('summarySamples').textContent,'3');
 assert.equal(element('summaryEvents').textContent,'1');
 assert.equal(element('summaryPeak').textContent,'8,25');
 assert.equal(element('summaryDuration').textContent,'2 min 5 s');
 assert.ok(element('summaryLastEvent').textContent.includes('pico 8.25 m/s²'));
 vm.runInContext('renderSummary([{t:0,a:0}],[])',context);
 assert.equal(element('summaryPeak').textContent,'0,00');
 assert.equal(element('summaryDuration').textContent,'0 s');
});
