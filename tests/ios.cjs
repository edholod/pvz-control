const {context}=require('./harness.cjs'),assert=require('node:assert/strict');
const a=context(),listeners={};
const field={getBoundingClientRect:()=>({top:500,bottom:550})};
const sheet={style:{},scrollTop:0,addEventListener(){},removeEventListener(){},contains:x=>x===field,getBoundingClientRect:()=>({top:8,bottom:334})};
a.c.innerHeight=800;a.c.scrollY=250;a.c.scrollTo=(x,y)=>a.c.restored=y;
a.c.visualViewport={height:800,offsetTop:0,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
a.c.document.querySelector=()=>sheet;a.c.document.activeElement=field;
a.run('setupSheetKeyboard()');assert.equal(a.c.document.body.style.position,'fixed');assert.equal(a.c.document.body.style.top,'-250px');
a.c.visualViewport.height=350;a.c.visualViewport.offsetTop=40;listeners.resize();
assert.equal(sheet.style.top,'48px');assert.equal(sheet.style.maxHeight,'334px');assert.equal(sheet.style.bottom,'auto');assert(sheet.scrollTop>0);
a.run('sheetCleanup()');assert.equal(a.c.restored,250);
console.log('PASS keyboard viewport constrains sheet and scrolls only its content; page position restored');

a.c.innerWidth=390;a.c.visualViewport.height=800;a.c.visualViewport.offsetTop=0;a.run('setupSheetKeyboard()');assert.equal(sheet.style.top,'8px');assert.equal(sheet.style.height,'784px');
// iOS may resize innerHeight along with visualViewport; the form must remain pinned.
a.c.innerHeight=360;a.c.visualViewport.height=360;a.c.visualViewport.offsetTop=0;listeners.resize();assert.equal(sheet.style.top,'8px');assert.equal(sheet.style.height,'344px');
a.c.innerHeight=800;a.c.visualViewport.height=350;a.c.visualViewport.offsetTop=90;listeners.resize();assert.equal(sheet.style.top,'98px');assert.equal(sheet.style.height,'334px');a.run('sheetCleanup()');
console.log('PASS compact form stays inside viewport for both iOS keyboard resizing modes');
