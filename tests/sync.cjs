const {context}=require('./harness.cjs'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let server=null,rev=0,writes=0,offline=false,conflict=false;
function client(){
 const a=context();a.c.Telegram={WebApp:{initData:'signed-test-fixture'}};
 a.c.fetch=async(url,o)=>{
  if(offline)throw Error('offline');const b=JSON.parse(o.body);
  const response=(value,status=200)=>({ok:status<400,status,json:async()=>value});
  if(b.action==='read')return response({user_id:'123',state:server?{data:structuredClone(server),revision:rev}:null});
  if(b.action==='write'){
   if(conflict||b.revision!==rev)return response({error:'CONFLICT'},409);
   server=structuredClone(b.data);writes++;return response({revision:++rev});
  }
  throw Error('unexpected action');
 };
 vm.runInContext(fs.readFileSync('sync.js','utf8'),a.c);return a;
}
const settle=async a=>{for(let i=0;i<20;i++)await new Promise(setImmediate);assert(!a.run('syncBusy'))};
(async()=>{
 const a=client();await settle(a);assert.equal(rev,1);assert.equal(a.run('KEY'),'pvz-control-tg-123');console.log('PASS verified user gets isolated local namespace');
 a.run("commit(()=>db.points.push({id:'p1',name:'Первый',market:'wb'}))");await a.run('runSync()');assert.equal(server.points.length,1);console.log('PASS local edits uploaded');
 server=structuredClone(a.run('db'));server=Object.fromEntries(Object.entries(server).reverse());a.run("sheetKind='day'");await a.run('runSync()');assert.equal(a.run('sheetKind'),'day');console.log('PASS JSONB key reordering does not close active forms');a.run("sheetKind=''");
 const b=client();await settle(b);assert.equal(b.run('db.points.length'),1);console.log('PASS second device downloads server state');
 offline=true;a.run("commit(()=>db.points[0].name='Без интернета')");await a.run('runSync()');assert.equal(server.points[0].name,'Первый');assert.equal(a.run('db.points[0].name'),'Без интернета');console.log('PASS network failure preserves local data');offline=false;
 b.run("commit(()=>db.points[0].name='Второе устройство')");await b.run('runSync()');await a.run('runSync()');assert(a.run('syncConflict'));assert.equal(a.run('db.points[0].name'),'Без интернета');assert.equal(server.points[0].name,'Второе устройство');console.log('PASS concurrent edits stop without overwriting either device');
 await a.run("resolveSync('local')");assert.equal(server.points[0].name,'Без интернета');assert(!a.run('syncConflict'));assert(a.store.has('pvz-control-tg-123-recovery'));console.log('PASS explicit conflict choice checkpoints before replacement');
 await b.run('runSync()');assert.equal(b.run('db.points[0].name'),'Без интернета');console.log('PASS unchanged device refreshes from newer cloud revision');
 conflict=true;b.run("commit(()=>db.settings.mode='simple')");await b.run('runSync()');assert(b.run('syncConflict'));console.log('PASS server CAS conflict cannot silently replace cloud data');
})().catch(e=>{console.error(e);process.exitCode=1});
