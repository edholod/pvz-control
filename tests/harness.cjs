const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let passed=0;const reports=[];
function context(raw){
 const store=new Map(raw===undefined?[]:[['pvz-control-v1',raw]]),elements=new Map(),events={},alerts=[];
 const el=()=>({innerHTML:'',textContent:'',className:'',style:{},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},querySelector(){return null},remove(){}});
 const doc={body:el(),hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelector(){return null},createElement:el,addEventListener(){}};
 const c={console:{error(){},warn(){}},crypto:require('crypto').webcrypto,Event,AbortController,TextEncoder,URL,URLSearchParams,Blob,Intl,Date,JSON,Math,Set,Map,Number,FormData:class {constructor(x){this.x=x}get(n){return this.x[n]??null}has(n){return n in this.x}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},document:doc,navigator:{onLine:true},location:{hash:''},alert:m=>alerts.push(m),confirm:()=>true,setTimeout:()=>1,clearTimeout(){},setInterval(){},addEventListener:(n,fn)=>{(events[n]??=[]).push(fn)},dispatchEvent:e=>{for(const fn of events[e.type]||[])fn(e)},fetch:()=>{throw Error('unexpected fetch')}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('app.js','utf8'),c);return {c,store,elements,alerts,run:s=>vm.runInContext(s,c)};
}
module.exports={context};
