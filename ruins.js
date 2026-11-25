/* Daily ruins: one Mon, persistent HP/PP and one entry per day. */
(function(E){
'use strict';
E.D.scenes.ruins='assets/scenes/ruins.png';
E.ruinsDate=function(now=Date.now()){const d=new Date(now);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
E.migrateRuins=function(s){
 const r=s.ruins;if(!r||r.version===2)return;
 // Settle the old weekly run once before replacing its incompatible format.
 if(r.status==='active'){
  const b={player:r.members,pi:0,logs:[],logRounds:[],round:0};
  E.grantTeamXP(s,b,r.pot,true);
  s.ruinsMigrationNotice='A Ruína semanal foi encerrada na atualização. Os '+r.pot+' XP acumulados foram entregues aos participantes.';
 }
 if(s.battle?.mode==='ruins')s.battle=null;
 s.ruins=null;
};
E.enterRuins=function(s,ids,now=Date.now(),atOwnLevel=false){
 if(s.battle||s.ruins?.status==='active'||s.lastRuinsDate===E.ruinsDate(now)||!Array.isArray(ids)||ids.length!==1||ids.some(id=>!s.owned.some(m=>m.uid===id)||E.lockReason(s,id)))return false;
 const members=ids.map(id=>E.combatMon(s.owned.find(m=>m.uid===id)));
 s.lastRuinsDate=E.ruinsDate(now);
 const startLevel=atOwnLevel?members[0].level:1;
 s.ruins={version:2,status:'active',date:s.lastRuinsDate,floor:startLevel-1,currentLevel:startLevel,pot:startLevel,members,opponents:[],etherUsed:[]};
 E.storeUnavailable(s);E.startRuinsFloor(s);return true;
};
E.cashRuins=function(s,loss=false,complete=false){
 const r=s.ruins;if(!r||r.status!=='active'||s.battle&&!s.battle.done)return false;
 r.status=complete?'complete':loss?'lost':'retired';
 const amount=loss?0:r.currentLevel,b={player:r.members,pi:0,logs:[],logRounds:[],round:0};
 if(amount)E.grantTeamXP(s,b,amount,true);
 r.awards=b.teamXPAwards||[];r.paid=amount;
 r.resultText=loss?'Ruína encerrada sem XP.':(complete?'Nível 100 vencido! ':'Ruína encerrada. ')+amount+' XP para o seu Mon.';
 return true;
};
E.startRuinsFloor=function(s){
 const r=s.ruins;if(s.battle||r?.status!=='active'||r.floor>=100)return false;
 const team=r.members.filter(m=>s.owned.some(o=>o.uid===m.uid));
 if(!team.some(m=>m.hp>0&&E.moveUsesRemaining(m)>0)){E.cashRuins(s,true);return false;}
 const level=r.floor+1;
 if(!r.opponents[r.floor]){const enemy=E.randomEnemy(level,true);enemy.stone=E.enemyEquipment(level);r.opponents[r.floor]=[enemy];}
 r.currentLevel=level;r.pot=level;
 const b=E.createBattle('ruins',team,r.opponents[r.floor],{title:'Ruínas · Nível '+level,ruinsFloor:r.floor});
 b.player=team.map(m=>{const c=E.combatMon(m);c.hp=m.hp;c.pp={...m.pp};return c;});
 b.pi=0;b.done=false;b.result=null;b.forcePlayer=false;E.resolve(b);s.battle=b;return true;
};
E.endRuins=function(s){
 const b=s.battle,r=s.ruins;
 if(!b||b.mode!=='ruins'||b.done||r?.status!=='active'||b.player[0].hp<=0)return false;
 r.members=E.clone(b.player);b.done=true;b.result='retired';b.ruinsSettled=true;
 E.cashRuins(s);b.rewardText=r.resultText;return true;
};
E.settleRuins=function(s,b){
 if(b.ruinsSettled)return true;b.ruinsSettled=true;
 const r=s.ruins;if(!r||r.status!=='active'||r.floor!==b.ruinsFloor){b.rewardText=r?.resultText||'Encontro já contabilizado.';return true;}
 r.members=b.player.map(m=>{const c=E.clone(m);E.restoreCopiedMoves(c);c.status={};c.blocked=[];c.blockTargets=[];return c;});
 if(b.result==='win'&&r.members[0]?.hp>0&&E.moveUsesRemaining(r.members[0])>0){
  r.floor++;r.etherUsed=[];
  if(r.floor===100)E.cashRuins(s,false,true);
  b.rewardText=r.status==='complete'?r.resultText:'Nível '+r.floor+' vencido! Encerre por '+r.currentLevel+' XP ou prepare-se para o próximo adversário.';
 }else{E.cashRuins(s,true);b.rewardText=r.resultText;}
 return true;
};
E.ruinsItem=function(s,uid,id){
 const r=s.ruins,i=E.items.find(i=>i.id===id),m=r?.members.find(m=>m.uid===uid);
 if(s.battle||r?.status!=='active'||r.floor===0||!m||!i||!s.items[id]||m.hp<=0)return false;
 if(i.kind==='potion'){if(m.hp>=m.stats.hp)return false;m.hp=Math.min(m.stats.hp,m.hp+i.value);}
 else if(i.kind==='ether'){if(r.etherUsed.includes(uid)||m.moves.every(id=>m.pp[id]>=E.byMove[id].pp))return false;for(const id of m.moves)m.pp[id]=Math.min(E.byMove[id].pp,m.pp[id]+i.value);r.etherUsed.push(uid);}
 else return false;
 s.items[id]--;return true;
};
const validate=E.validateAdventure;
E.validateAdventure=function(s){
 validate(s);const r=s.ruins;if(!r)return;
 const daily=r.version===2,limit=daily?100:7;
 if(!['active','lost','retired','complete'].includes(r.status)||!Number.isInteger(r.floor)||r.floor<0||r.floor>limit||!Number.isSafeInteger(r.pot)||r.pot<0||!Array.isArray(r.members)||r.members.length>(daily?1:3)||r.status==='active'&&r.members.length===0||!Array.isArray(r.opponents)||!Array.isArray(r.etherUsed))throw Error('Ruínas inválidas');
 if(daily&&(!Number.isInteger(r.currentLevel)||r.currentLevel<1||r.currentLevel>100||typeof r.date!=='string'||r.pot!==r.currentLevel||r.floor>r.currentLevel||r.currentLevel>r.floor+1))throw Error('Nível das Ruínas inválido');
 for(const m of r.members)if(!E.byId[m.species]||!Number.isFinite(m.hp)||m.hp<0||!m.stats||!Array.isArray(m.moves)||m.moves.some(id=>!E.byMove[id]||!Number.isInteger(m.pp?.[id])||m.pp[id]<0)||r.status==='active'&&!s.owned.some(o=>o.uid===m.uid))throw Error('Participante das Ruínas inválido');
};
})(window.FMX);
(function(){
const original=window.createAdventureUI;
window.createAdventureUI=function(C){
 const A=original(C),E=window.FMX,{esc,button,sprite,modal,close,changed,toast}=C,S=C.state;
 A.ruins=function(){
  const s=S(),r=s.ruins;
  return '<div class="mode-hero" style="--scene:url(\''+E.D.scenes.ruins+'\')"><div><span class="eyebrow">AVENTURA DIÁRIA</span><h2>Ruínas</h2><p>Um Mon. Cem níveis. Até onde você consegue chegar?</p></div></div><section class="panel activity-panel"><p>Uma entrada por dia. Vida e usos dos movimentos persistem entre adversários. Ao encerrar, seu Mon recebe XP igual ao nível do adversário atual. Derrota ou empate não concede XP.</p>'+
   (s.ruinsMigrationNotice?'<p class="legend">'+esc(s.ruinsMigrationNotice)+'</p>':'')+
   (r?.status==='active'?'<h2>Nível '+r.floor+' vencido</h2><p>Encerrar agora: <b>'+r.currentLevel+' XP</b> · Próximo adversário: <b>Nível '+(r.floor+1)+'</b></p><div class="tournament-team">'+r.members.map(m=>'<article class="tournament-mon">'+sprite(m.species)+'<h3>'+esc(E.byId[m.species].name)+'</h3><p>'+Math.ceil(m.hp)+' / '+m.stats.hp+' HP</p><small>'+m.moves.map(id=>esc(E.byMove[id].name)+': '+m.pp[id]+'/'+E.byMove[id].pp).join('<br>')+'</small>'+button('Usar itens','ruins-items','data-uid="'+m.uid+'"')+'</article>').join('')+'</div><p>Poções e um Éter por intervalo entre adversários.</p><div class="detail-actions">'+button('Encerrar Ruína','ruins-exit')+button('Continuar · Nível '+(r.floor+1),'ruins-next','','primary')+'</div>':
   (r?.resultText?'<p class="legend">'+esc(r.resultText)+'</p>':'')+(s.lastRuinsDate===E.ruinsDate()?'<p>A entrada de hoje já foi utilizada. Volte amanhã.</p>':'<p>Selecione um Mon e escolha começar no nível 1 ou no nível dele.</p><div class="activity-picker">'+s.owned.filter(m=>!E.lockReason(s,m.uid)).map(m=>'<label class="activity-mon"><input type="radio" name="ruins-members" value="'+m.uid+'">'+sprite(m.species)+'<span>'+esc(E.byId[m.species].name)+' · Nv. '+m.level+'</span></label>').join('')+'</div>'+'<div class="detail-actions">'+button('Começar no nível 1','ruins-enter','data-start="one"','primary')+button('Começar no nível do Mon','ruins-enter','data-start="own"')+'</div>'))+ '</section>';
 };
 const action=A.action;A.action=async function(a,el){
  const s=S();if(!a.startsWith('ruins-'))return action(a,el);
  if(a==='ruins-enter'){const ids=[...document.querySelectorAll('input[name="ruins-members"]:checked')].map(x=>x.value);if(E.enterRuins(s,ids,Date.now(),el.dataset.start==='own')){C.battleStarted();}else toast('Selecione um Mon disponível. Uma entrada por dia.');}
  if(a==='ruins-next'){if(E.startRuinsFloor(s))C.battleStarted();else{changed();toast('Mon sem vida ou movimentos disponíveis.');}}
  if(a==='ruins-exit')modal('<h2>Encerrar a Ruína?</h2><p>Seu Mon receberá '+(s.ruins?.currentLevel||0)+' XP. A entrada de hoje continuará utilizada.</p>'+button('Encerrar e receber XP','ruins-cash','','primary')+button('Voltar','close'));
  if(a==='ruins-cash'){const ok=s.battle?E.endRuins(s):E.cashRuins(s);if(ok){close();changed();}}
  if(a==='ruins-items'){const uid=el.dataset.uid;modal('<h2>Preparação para o próximo nível</h2>'+E.items.filter(i=>['potion','ether'].includes(i.kind)).map(i=>button(i.name+' · '+(s.items[i.id]||0),'ruins-use','data-uid="'+uid+'" data-id="'+i.id+'" '+(s.items[i.id]?'':'disabled'))).join(''));}
  if(a==='ruins-use'){if(E.ruinsItem(s,el.dataset.uid,el.dataset.id)){close();changed();toast('Item aplicado.');}else toast('Item sem efeito ou limite do intervalo atingido.');}
  return true;
 };return A;
};
})();

