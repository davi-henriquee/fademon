const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');global.window=global;
for(const f of ['data','assets-v2','engine','adventure','adventure-ui'])vm.runInThisContext(fs.readFileSync(__dirname+'/dist/'+f+'.js','utf8'));
const E=FMX;
async function main(){
 const s=E.newSave(),m=E.createMon('004',20);E.addOwned(s,m);s.items={'hp-3':2,'atk-1':2};
 assert(E.equipStone(s,m.uid,'hp-3'));const equipped=JSON.stringify(s);
 for(const id of ['',null,'restore','missing','hp-3'])assert(!E.equipStone(s,m.uid,id));assert.equal(JSON.stringify(s),equipped);
 let html='',changed=0;const ui=createAdventureUI({state:()=>s,esc:String,money:String,fmt:String,sprite:()=>'',button:(name,action,attrs='')=>`<button data-action="${action}" ${attrs}>${name}</button>`,modal:x=>html=x,close:()=>{},changed:()=>changed++,detail:()=>{},toast:()=>{}});
 await ui.action('equipment',{dataset:{uid:m.uid}});assert(!html.includes('Remover pedra'));assert(html.includes('anterior é destruída'));
 await ui.action('equip-stone',{dataset:{uid:m.uid,id:'atk-1'}});assert(html.includes('Confirmar aplicação'));assert(html.includes('Vida máxima'));assert(html.includes('será destruída'));assert.equal(JSON.stringify(s),equipped);
 await ui.action('equipment',{dataset:{uid:m.uid}});assert.equal(JSON.stringify(s),equipped);
 const request={dataset:{uid:m.uid,id:'atk-1',previous:'hp-3'}};await ui.action('confirm-equip-stone',request);
 assert.equal(changed,1);assert.equal(s.items['hp-3'],1);assert.equal(s.items['atk-1'],1);assert.equal(m.stone,'atk-1');assert.equal(E.equippedStats(m).hp,E.stats(m.species,m.level).hp);
 const replaced=JSON.stringify(s);await ui.action('confirm-equip-stone',request);assert.equal(JSON.stringify(s),replaced);
 const copy=E.clone(s);E.migrateAdventure(copy);E.validateAdventure(copy);assert.equal(copy.owned[0].stone,'atk-1');assert.deepEqual(copy.items,s.items);
 m.species=E.byId[m.species].next||m.species;assert.equal(m.stone,'atk-1');
 s.team=s.team.filter(id=>id!==m.uid);s.boxes[0]=m.uid;const price=E.saleValue(m),inventory=JSON.stringify(s.items),coins=s.coins;assert.equal(E.sell(s,m.uid),price);assert.equal(s.coins,coins+price);assert.equal(JSON.stringify(s.items),inventory);assert.equal(E.sell(s,m.uid),null);
 const other=E.createMon('004',20);E.addOwned(s,other);s.battle={};const before=JSON.stringify(s);assert(!E.equipStone(s,other.uid,'hp-3'));assert.equal(JSON.stringify(s),before);s.battle=null;
 assert(E.startExpedition(s,[other.uid],'collect'));assert(!E.equipStone(s,other.uid,'hp-3'));assert.equal(s.items['hp-3'],1);
 console.log('Stone rules and confirmation flow passed: consumption, replacement, cancellation, duplicate confirmation, sale, migration, evolution and locks.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
