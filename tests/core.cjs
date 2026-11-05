const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let passed=0;const reports=[];
function context(raw){
 const store=new Map(raw===undefined?[]:[['pvz-control-v1',raw]]),elements=new Map(),events={},alerts=[];
 const el=()=>({innerHTML:'',textContent:'',className:'',style:{},prepend(){},setAttribute(){},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},querySelector(){return null},remove(){}});
 const doc={body:el(),hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelector(){return null},createElement:el,addEventListener(){}};
 const c={console:{error(){},warn(){}},crypto:require('crypto').webcrypto,Event,AbortController,TextEncoder,URL,URLSearchParams,Blob,Intl,Date,JSON,Math,Set,Map,Number,FormData:class {constructor(x){this.x=x}get(n){return this.x[n]??null}has(n){return n in this.x}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},document:doc,navigator:{onLine:true},location:{hash:''},alert:m=>alerts.push(m),confirm:()=>true,setTimeout:()=>1,clearTimeout(){},setInterval(){},addEventListener:(n,fn)=>{(events[n]??=[]).push(fn)},dispatchEvent:e=>{for(const fn of events[e.type]||[])fn(e)},fetch:()=>{throw Error('unexpected fetch')}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('app.js','utf8'),c);return {c,store,elements,alerts,run:s=>vm.runInContext(s,c)};
}
function test(name,fn){fn();passed++;reports.push(name);console.log('PASS',name)}
const a=context(),r=a.run;
const seed=`db=empty();db.points=[{id:'p1',name:'Первый',market:'wb'},{id:'p2',name:'Второй',market:'ozon'},{id:'p3',name:'Третий',market:'ym'}];db.people=[{id:'e1',name:'Анна',role:'employee',rate:1500,hourlyRate:0,color:'#B99CDA'}];pointId='p1';year=2026;month=10;`;
r(seed);
test('valid base and three marketplaces',()=>assert.equal(r('validate(db)'),true));
test('calendar toolbar has no literal expressions',()=>{const h=r('calendar(activePoint())');assert(h.includes('Выбрать даты'));assert(!h.includes("'+("))});
test('create, persist and reload',()=>{assert(r("commit(()=>db.shifts.push({id:'s1',point:'p1',person:'e1',date:'2026-11-01',actual:false}))"));const b=context(a.store.get('pvz-control-v1'));assert.equal(b.run('db.shifts.length'),1)});
test('salary rate freezes when worked',()=>{r("db.shifts[0].actual=true;freezeShiftRate(db.shifts[0]);db.people[0].rate=9999");assert.equal(r('shiftEarned(db.shifts[0])'),1500)});
test('hourly snapshot takes precedence',()=>{assert.equal(r("shiftEarned({...db.shifts[0],hourlyRateSnapshot:200,hours:7.5})"),1500)});
test('payment ledger carries previous months',()=>{r("db.payments.push({id:'pay1',point:'p1',person:'e1',amount:500,date:'2026-11-02'})");assert.equal(r("payrollLedger('p1','e1','2026-12-01').balance"),1000)});
test('duplicate shifts rejected and rolled back',()=>{assert.equal(r("commit(()=>db.shifts.push({...db.shifts[0]}))"),false);assert.equal(r('db.shifts.length'),1)});
test('cross point conflicts rejected',()=>assert.equal(r("ensureNoConflicts([{person:'e1',point:'p2',date:'2026-11-01'}])"),false));
test('past shifts notices only unworked',()=>{r('db.shifts[0].actual=false');assert(r("unclosedShifts('p1').length")>0);assert(r("unclosedNotice('p1')").includes('aria-expanded="false"'));assert(r("unclosedNotice('p1')").includes('hidden'))});
test('vacant shift ranges 0/7/90',()=>{for(const n of [0,7,90]){r('db.settings.vacantShiftAlertDays='+n);assert.equal(r("upcomingUnstaffedDays('p3').length"),n)}});
test('impossible dates rejected',()=>{assert(!r("dateValid('2026-02-30')"));assert(r("dateValid('2028-02-29')"))});
test('import IDs cannot inject inline handlers',()=>assert.throws(()=>r("validate({...db,points:[{id:\"p');alert(1)//\",market:'wb',name:'bad'}]})")));
test('date pickers for all date fields',()=>{for(const name of ['date','start','first'])assert(r(`field('Дата','${name}','text','required value="2026-11-01"')`).includes('date-pick-trigger'))});
test('stale tab cannot overwrite saved data',()=>{a.store.set('pvz-control-v1','{"other":true}');assert.equal(r("commit(()=>db.settings.mode='simple')"),false);assert.equal(a.store.get('pvz-control-v1'),'{"other":true}')});
test('damaged storage survives startup untouched',()=>{for(const raw of ['{broken','[]','42','{"points":[]}']){const b=context(raw);assert.equal(b.store.get('pvz-control-v1'),raw);assert.equal(b.run('storageFault'),true)}});
(async()=>{
 const {verifyTelegram}=await import('../server/auth.mjs');const crypto=require('crypto');
 const token='123456:test-secret',now=Date.now(),params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123456}),query_id:'test'});
 const sign=p=>{const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();return crypto.createHmac('sha256',secret).update(check).digest('hex')};params.set('hash',sign(params));
 assert.equal(await verifyTelegram(params.toString(),token,now),123456);console.log('PASS Telegram valid signed data');passed++;
 for(const bad of [params.toString().replace('123456','999999'),params.toString()+'&auth_date=1'])await assert.rejects(verifyTelegram(bad,token,now));
 await assert.rejects(verifyTelegram(params.toString(),token,now+86401000));console.log('PASS Telegram forged, duplicate and expired launch rejected');passed++;
 console.log('TOTAL',passed);
})().catch(e=>{console.error(e);process.exitCode=1});
