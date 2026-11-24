/* Weekly ruins: persistent runs and rewards. */
(function(E){
'use strict';
E.D.scenes.ruins='assets/scenes/ruins.png';
E.ruinsWeek=function(now=Date.now()){const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
E.enterRuins=function(s,ids,now=Date.now()){
 if(s.battle||s.ruins?.status==='active'||s.lastRuinsWeek===E.ruinsWeek(now)||!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||ids.some(id=>!s.owned.some(m=>m.uid===id)||E.lockReason(s,id)))return false;
 const members=ids.map(id=>E.combatMon(s.owned.find(m=>m.uid===id))),levels=members.map(m=>m.level),base=Math.min(100,Math.max(Math.ceil(levels.reduce((a,b)=>a+b,0)/3),Math.ceil(Math.max(...levels)*.75)));
 const opponents=Array.from({length:7},(_,i)=>Array.from({length:i===6?3:2},()=>{const level=Math.min(100,Math.max(1,Math.round(base*(.8+i*.07)))),m=E.randomEnemy(level,true);m.stone=E.enemyEquipment(level);return m;}));
 s.lastRuinsWeek=E.ruinsWeek(now);s.ruins={status:'active',week:s.lastRuinsWeek,floor:0,base,pot:0,members,opponents,etherUsed:[],restoreUsed:false};E.storeUnavailable(s);return true;
};
E.cashRuins=function(s,loss=false,complete=false){
 const r=s.ruins;if(!r||r.status!=='active')return false;
 r.status=complete?'complete':loss?'lost':'retired';
 const amount=Math.floor(r.pot*(complete?1.5:loss?.5:1)),b={player:r.members,pi:0,logs:[],logRounds:[],round:0};
 E.grantTeamXP(s,b,amount,true);
 r.awards=b.teamXPAwards;r.paid=amount;
 if(complete){r.prize='potion-'+Math.min(4,Math.ceil(r.base/25));s.items[r.prize]=(s.items[r.prize]||0)+1;}
 r.resultText=(complete?'Guardião vencido! ':loss?'A aventura terminou. ':'Resgate concluído. ')+amount+' XP divididos entre os participantes'+(complete?' e uma '+E.items.find(i=>i.id===r.prize).name+'.':'.');
 return true;
};
E.startRuinsFloor=function(s){
 const r=s.ruins;if(s.battle||r?.status!=='active'||r.floor>=7)return false;
 const team=r.members.filter(m=>s.owned.some(o=>o.uid===m.uid));
 if(!team.some(m=>m.hp>0&&E.moveUsesRemaining(m)>0)){E.cashRuins(s,true);return false;}
 const b=E.createBattle('ruins',team,r.opponents[r.floor],{title:r.floor===6?'Ruínas · Guardião':'Ruínas · Andar '+(r.floor+1),ruinsFloor:r.floor});
 b.player=team.map(m=>{const c=E.combatMon(m);c.hp=m.hp;c.pp={...m.pp};return c;});b.pi=b.player.findIndex(m=>m.hp>0&&E.moveUsesRemaining(m)>0);b.done=false;b.result=null;b.forcePlayer=false;E.resolve(b);s.battle=b;return true;
};
E.settleRuins=function(s,b){
 if(b.ruinsSettled)return true;b.ruinsSettled=true;
 const r=s.ruins;if(!r||r.status!=='active'||r.floor!==b.ruinsFloor){b.rewardText=r?.resultText||'Andar já contabilizado.';return true;}
 r.members=b.player.map(m=>{const c=E.clone(m);E.restoreCopiedMoves(c);c.status={};c.blocked=[];c.blockTargets=[];return c;});
 if(b.result==='win'){r.floor++;r.pot+=r.base*r.floor;r.etherUsed=[];r.restoreUsed=false;if(r.floor===7)E.cashRuins(s,false,true);b.rewardText=r.status==='complete'?r.resultText:'Andar vencido! '+r.pot+' XP acumulados. Continue ou resgate nas Ruínas.';}
 else {E.cashRuins(s,true);b.rewardText=r.resultText;}
 return true;
};
E.ruinsItem=function(s,uid,id){
 const r=s.ruins,i=E.items.find(i=>i.id===id),m=r?.members.find(m=>m.uid===uid);
 if(s.battle||r?.status!=='active'||r.floor===0||!m||!i||!s.items[id])return false;
 if(i.kind==='potion'){if(m.hp<=0||m.hp>=m.stats.hp)return false;m.hp=Math.min(m.stats.hp,m.hp+i.value);}
 else if(i.kind==='ether'){if(r.etherUsed.includes(uid)||m.moves.every(id=>m.pp[id]>=E.byMove[id].pp))return false;for(const id of m.moves)m.pp[id]=Math.min(E.byMove[id].pp,m.pp[id]+i.value);r.etherUsed.push(uid);}
 else if(i.kind==='restore'){if(m.hp>0||r.restoreUsed)return false;m.hp=Math.ceil(m.stats.hp*.3);for(const id of m.moves)m.pp[id]=Math.min(E.byMove[id].pp,m.pp[id]+1);r.restoreUsed=true;}
 else return false;s.items[id]--;return true;
};
const validate=E.validateAdventure;
E.validateAdventure=function(s){validate(s);const r=s.ruins;if(!r)return;
 if(!['active','lost','retired','complete'].includes(r.status)||!Number.isInteger(r.floor)||r.floor<0||r.floor>7||!Number.isInteger(r.base)||r.base<1||r.base>100||!Number.isSafeInteger(r.pot)||r.pot<0||!Array.isArray(r.members)||r.members.length>3||new Set(r.members.map(m=>m.uid)).size!==r.members.length||!Array.isArray(r.opponents)||r.opponents.length!==7||!Array.isArray(r.etherUsed))throw Error('Ruínas inválidas');
 for(const m of r.members){if(!E.byId[m.species]||!Number.isFinite(m.hp)||m.hp<0||!m.stats||!Array.isArray(m.moves)||m.moves.some(id=>!E.byMove[id]||!Number.isInteger(m.pp?.[id])||m.pp[id]<0)||r.status==='active'&&!s.owned.some(o=>o.uid===m.uid))throw Error('Participante das Ruínas inválido');}
};
})(window.FMX);
(function(){
const original=window.createAdventureUI;
window.createAdventureUI=function(C){
 const A=original(C),E=window.FMX,{esc,button,sprite,modal,close,changed,toast}=C,S=C.state;
 A.ruins=function(){const s=S(),r=s.ruins;return '<section class="panel activity-panel"><span class="eyebrow">AVENTURA SEMANAL</span><h2>Ruínas dos Sete Guardiões</h2><p>Três Mons. Sete andares. Uma entrada por semana, renovada na segunda-feira.</p><p>Vida e usos persistem. Resgatar entrega todo o XP acumulado; derrota ou empate entrega metade. O último andar concede +50% de XP e uma Poção. O XP é dividido entre todos os participantes.</p>'+
 (r?.status==='active'?'<p>Andares vencidos: <b>'+r.floor+'/7</b> · XP acumulado: <b>'+r.pot+'</b> · Próximo andar: +'+r.base*(r.floor+1)+' XP</p><div class="tournament-team">'+r.members.map(m=>'<article class="tournament-mon">'+sprite(m.species)+'<h3>'+esc(E.byId[m.species].name)+'</h3><p>'+Math.ceil(m.hp)+' / '+m.stats.hp+' HP</p><small>'+m.moves.map(id=>esc(E.byMove[id].name)+': '+m.pp[id]+'/'+E.byMove[id].pp).join('<br>')+'</small>'+button('Usar item','ruins-items','data-uid="'+m.uid+'" '+(r.floor?'':'disabled'))+'</article>').join('')+'</div><p>Poções livres entre andares; um Éter por Mon e uma Restauração por equipe em cada intervalo.</p>'+button('Enfrentar andar '+(r.floor+1),'ruins-next','','primary')+button('Resgatar e sair','ruins-exit'):
 (r?.resultText?'<p class="legend">'+esc(r.resultText)+'</p>':'')+(s.lastRuinsWeek===E.ruinsWeek()?'<p>A entrada desta semana já foi utilizada.</p>':'<p>Selecione exatamente três Mons disponíveis. A dificuldade considera a média dos níveis, com piso de 75% do nível do mais forte.</p><div class="activity-picker">'+s.owned.filter(m=>!E.lockReason(s,m.uid)).map(m=>'<label class="activity-mon"><input type="checkbox" name="ruins-members" value="'+m.uid+'">'+sprite(m.species)+'<span>'+esc(E.byId[m.species].name)+' · Nv. '+m.level+'</span></label>').join('')+'</div>'+button('Iniciar aventura','ruins-enter','','primary')))+ '</section>';};
 const action=A.action;A.action=async function(a,el){
 const s=S();if(!a.startsWith('ruins-'))return action(a,el);
 if(a==='ruins-enter'){const ids=[...document.querySelectorAll('input[name="ruins-members"]:checked')].map(x=>x.value);if(E.enterRuins(s,ids)){changed();}else toast('Selecione exatamente três Mons disponíveis. Uma entrada por semana.');}
 if(a==='ruins-next'){if(E.startRuinsFloor(s))C.battleStarted();else {changed();toast('Nenhum Mon com vida e movimentos disponíveis.');}}
 if(a==='ruins-exit')modal('<h2>Encerrar a aventura?</h2><p>Receberá '+(s.ruins?.pot||0)+' XP divididos. A entrada desta semana continuará utilizada.</p>'+button('Confirmar resgate','ruins-cash','','primary')+button('Continuar explorando','close'));
 if(a==='ruins-cash'&&!s.battle){if(E.cashRuins(s)){close();changed();}}
 if(a==='ruins-items'){const uid=el.dataset.uid;modal('<h2>Preparação entre andares</h2>'+E.items.filter(i=>i.kind!=='stone').map(i=>button(i.name+' · '+(s.items[i.id]||0),'ruins-use','data-uid="'+uid+'" data-id="'+i.id+'" '+(s.items[i.id]?'':'disabled'))).join(''));}
 if(a==='ruins-use'){if(E.ruinsItem(s,el.dataset.uid,el.dataset.id)){close();changed();toast('Item aplicado.');}else toast('Item sem efeito ou limite do intervalo atingido.');}
 return true;
 };return A;
};
})();

