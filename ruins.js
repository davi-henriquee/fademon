/* Daily ruins: one Mon, fully restored fighters and one entry per day. */
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
E.nextRuinsLevel=r=>Math.min(100,r.floor+1);
E.enterRuins=function(s,ids,now=Date.now(),halfLevel=false){
 if(s.battle||s.ruins?.status==='active'||s.lastRuinsDate===E.ruinsDate(now)||!Array.isArray(ids)||ids.length!==1||ids.some(id=>!s.owned.some(m=>m.uid===id)||E.lockReason(s,id)))return false;
 const members=ids.map(id=>E.combatMon(s.owned.find(m=>m.uid===id)));
 s.lastRuinsDate=E.ruinsDate(now);
 const startLevel=halfLevel?Math.max(1,Math.floor(members[0].level/2)):1;
 s.ruins={version:2,status:'active',date:s.lastRuinsDate,floor:startLevel-1,currentLevel:startLevel,pot:startLevel,members,opponents:[],etherUsed:[]};
 E.storeUnavailable(s);E.startRuinsFloor(s);return true;
};
E.cashRuins=function(s,loss=false,complete=false){
 const r=s.ruins;if(!r||r.status!=='active'||s.battle&&!s.battle.done||!loss&&!complete&&(s.battle||r.floor!==r.currentLevel))return false;
 r.status=complete?'complete':loss?'lost':'retired';
 const amount=loss?Math.floor(r.currentLevel/2):r.floor,b={player:r.members,pi:0,logs:[],logRounds:[],round:0};
 if(amount)E.grantTeamXP(s,b,amount,true);
 r.awards=b.teamXPAwards||[];r.paid=amount;
 r.resultText=(loss?'Desafio encerrado. ':complete?'Nível 100 vencido! ':'Ruína encerrada. ')+amount+' XP para o seu Mon.';
 return true;
};
E.startRuinsFloor=function(s){
 const r=s.ruins;if(s.battle||r?.status!=='active'||r.floor>=100)return false;
 const team=r.members.filter(m=>s.owned.some(o=>o.uid===m.uid)).map(E.combatMon);
 if(!team.some(m=>m.hp>0&&E.moveUsesRemaining(m)>0)){E.cashRuins(s,true);return false;}
 const level=E.nextRuinsLevel(r);
 if(!r.opponents[r.floor]||r.opponents[r.floor][0]?.level!==level){const enemy=E.randomEnemy(level,true);enemy.stone=E.enemyEquipment(level);r.opponents[r.floor]=[enemy];}
 r.currentLevel=level;r.pot=level;
 const b=E.createBattle('ruins',team,r.opponents[r.floor],{title:'Ruínas · Nível '+level,ruinsFloor:r.floor});
 b.player=team.map(E.combatMon);
 b.pi=0;b.done=false;b.result=null;b.forcePlayer=false;E.resolve(b);s.battle=b;return true;
};
E.endRuins=()=>false;
E.settleRuins=function(s,b){
 if(b.ruinsSettled)return true;b.ruinsSettled=true;
 const r=s.ruins;if(!r||r.status!=='active'||r.floor!==b.ruinsFloor){b.rewardText=r?.resultText||'Encontro já contabilizado.';return true;}
 r.members=b.player.map(m=>{const c=E.clone(m);E.restoreCopiedMoves(c);c.status={};c.blocked=[];c.blockTargets=[];return c;});
 if(b.result==='win'&&r.members[0]?.hp>0&&E.moveUsesRemaining(r.members[0])>0){
  r.floor=r.currentLevel;r.etherUsed=[];r.members=r.members.map(E.combatMon);
  if(r.floor===100)E.cashRuins(s,false,true);
  b.rewardText=r.status==='complete'?r.resultText:'Nível '+r.floor+' vencido! Encerre por '+r.currentLevel+' XP ou prepare-se para o próximo adversário.';
 }else{E.cashRuins(s,true);b.rewardText=r.resultText;}
 return true;
};
E.ruinsItem=()=>false;
const validate=E.validateAdventure;
E.validateAdventure=function(s){
 validate(s);const r=s.ruins;if(!r)return;
 const daily=r.version===2,limit=daily?100:7;
 if(!['active','lost','retired','complete'].includes(r.status)||!Number.isInteger(r.floor)||r.floor<0||r.floor>limit||!Number.isSafeInteger(r.pot)||r.pot<0||!Array.isArray(r.members)||r.members.length>(daily?1:3)||r.status==='active'&&r.members.length===0||!Array.isArray(r.opponents)||!Array.isArray(r.etherUsed))throw Error('Ruínas inválidas');
 if(daily&&(!Number.isInteger(r.currentLevel)||r.currentLevel<1||r.currentLevel>100||typeof r.date!=='string'||r.pot!==r.currentLevel||r.floor>r.currentLevel||r.currentLevel>r.floor+4))throw Error('Nível das Ruínas inválido');
 for(const m of r.members)if(!E.byId[m.species]||!Number.isFinite(m.hp)||m.hp<0||!m.stats||!Array.isArray(m.moves)||m.moves.some(id=>!E.byMove[id]||!Number.isInteger(m.pp?.[id])||m.pp[id]<0)||r.status==='active'&&!s.owned.some(o=>o.uid===m.uid))throw Error('Participante das Ruínas inválido');
};
})(window.FMX);
(function(){
const original=window.createAdventureUI;
window.createAdventureUI=function(C){
 const A=original(C),E=window.FMX,{esc,button,sprite,modal,close,changed,toast}=C,S=C.state;
 A.ruins=function(){
  const s=S(),r=s.ruins;
  return '<div class="mode-hero" style="--scene:url(\''+E.D.scenes.ruins+'\')"><div><span class="eyebrow">AVENTURA DIÁRIA</span><h2>Ruínas</h2><p>Um Mon. Do nível 1 ao 100. Até onde você consegue chegar?</p></div></div><section class="panel activity-panel"><p>Uma entrada por dia. Os adversários avançam um nível por vez. Seu Mon recupera toda a vida e os usos dos movimentos a cada desafio. Sem itens. Pare entre batalhas para receber o nível do último adversário vencido em XP. Derrota ou empate entrega metade do nível enfrentado em XP, arredondada para baixo.</p>'+
   (s.ruinsMigrationNotice?'<p class="legend">'+esc(s.ruinsMigrationNotice)+'</p>':'')+
   (r?.status==='active'?'<h2>Nível '+r.floor+' vencido</h2><p>Encerrar agora: <b>'+r.currentLevel+' XP</b> · Próximo adversário: <b>Nível '+E.nextRuinsLevel(r)+'</b></p><div class="tournament-team">'+r.members.map(m=>'<article class="tournament-mon">'+sprite(m.species)+'<h3>'+esc(E.byId[m.species].name)+'</h3><p>'+Math.ceil(m.hp)+' / '+m.stats.hp+' HP</p><small>'+m.moves.map(id=>esc(E.byMove[id].name)+': '+m.pp[id]+'/'+E.byMove[id].pp).join('<br>')+'</small>'+'</article>').join('')+'</div><p>Vida e movimentos restaurados para o próximo desafio.</p><div class="detail-actions">'+button('Parar','ruins-exit')+button('Continuar · Nível '+E.nextRuinsLevel(r),'ruins-next','','primary')+'</div>':
   (r?.resultText?'<p class="legend">'+esc(r.resultText)+'</p>':'')+(s.lastRuinsDate===E.ruinsDate()?'<p>A entrada de hoje já foi utilizada. Volte amanhã.</p>':'<p>Selecione um Mon. Comece no nível 1 ou na metade do nível dele (mínimo 1, arredondado para baixo).</p><div class="activity-picker">'+s.owned.filter(m=>!E.lockReason(s,m.uid)).map(m=>'<label class="activity-mon"><input type="radio" name="ruins-members" value="'+m.uid+'">'+sprite(m.species)+'<span>'+esc(E.byId[m.species].name)+' · Nv. '+m.level+'</span></label>').join('')+'</div>'+'<div class="detail-actions">'+button('Começar no nível 1','ruins-enter','data-start="one"','primary')+button('Começar na metade do nível do Mon','ruins-enter','data-start="half"')+'</div>'))+ '</section>';
 };
 const action=A.action;A.action=async function(a,el){
  const s=S();if(!a.startsWith('ruins-'))return action(a,el);
  if(['ruins-proceed','ruins-stop'].includes(a)&&s.battle?.mode==='ruins'&&s.battle.done&&s.battle.result==='win'&&s.ruins?.status==='active'){
   s.battle=null;
   if(a==='ruins-proceed'){if(E.startRuinsFloor(s))C.battleStarted();else changed();}
   else{E.cashRuins(s);C.ruinsFinished();}
  }
  if(a==='ruins-enter'){const ids=[...document.querySelectorAll('input[name="ruins-members"]:checked')].map(x=>x.value);if(E.enterRuins(s,ids,Date.now(),el.dataset.start==='half')){C.battleStarted();}else toast('Selecione um Mon disponível. Uma entrada por dia.');}
  if(a==='ruins-next'){if(E.startRuinsFloor(s))C.battleStarted();else{changed();toast('Mon sem vida ou movimentos disponíveis.');}}
  if(a==='ruins-exit'&&!s.battle)modal('<h2>Encerrar a Ruína?</h2><p>Seu Mon receberá '+(s.ruins?.floor||0)+' XP. A entrada de hoje continuará utilizada.</p>'+button('Encerrar e receber XP','ruins-cash','','primary')+button('Voltar','close'));
  if(a==='ruins-cash'&&!s.battle){const ok=E.cashRuins(s);if(ok){close();changed();}}
  return true;
 };return A;
};
})();

