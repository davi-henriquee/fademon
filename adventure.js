/* Persistent activities, equipment and tournament rules. No DOM dependencies. */
(function(E){
'use strict';
const hours=60*60*1000, find=(s,id)=>s.owned.find(m=>m.uid===id);
const items=[];
for(const [stat,label,values,offset,slug] of [
 ['hp','vida',[50,250,1500],1,'Pedra-da-Vida'],['atk','ataque',[5,25,150],4,'Pedra-de-Ataque'],
 ['crit','crítico',[.1,.2,.35],7,'Pedra-do-Critico'],['speed','velocidade',[5,25,150],10,'Pedra-da-Velocidade']]){
 values.forEach((value,i)=>{const tier=['I','II','III'][i];items.push({id:`${stat}-${i+1}`,kind:'stone',stat,value,tier:i+1,name:`Pedra de ${label} ${tier}`,price:[200,1000,5000][i],image:`assets/items/${String(offset+i).padStart(2,'0')}-${slug}-${tier}.png`,desc:stat==='crit'?`+${Math.round(value*100)} pontos percentuais de crítico (máximo 100%).`:`+${value} de ${label}.`});});
}
for(const [kind,name,values,prices,offset,slug] of [['potion','Poção',[50,125,350,1000],[50,100,200,500],13,'Pocao'],['ether','Éter',[3,6,9,20],[50,100,200,500],17,'Eter']])values.forEach((value,i)=>{const tier=['I','II','III','IV'][i];items.push({id:`${kind}-${i+1}`,kind,value,name:`${name} ${tier}`,price:prices[i],image:`assets/items/${offset+i}-${slug}-${tier}.png`,desc:kind==='potion'?`Restaura ${value} HP de um Mon vivo.`:`Restaura ${i===3?'todos os':value} usos de cada ataque e habilidade. Um Éter por Mon por intervalo.`});});
items.push({id:'restore',kind:'restore',value:.3,name:'Restauração',price:1000,image:'assets/items/21-Restauracao.png',desc:'Revive com 30% do HP e recupera 1 uso de cada movimento. Uma por equipe por intervalo.'});
const leagues=[['Bronze',20,1,10,'07-Bronze'],['Prata',40,11,25,'06-Prata'],['Ouro',80,26,40,'05-Ouro'],['Platina',160,41,55,'04-Platina'],['Diamante',320,56,70,'03-Diamante'],['Mestre',640,71,85,'02-Mestre'],['Lendário',1500,86,100,'01-Lendario']].map(([name,fee,min,max,img])=>({name,fee,min,max,image:`assets/leagues/${img}.png`}));
const phases=['1ª Fase','2ª Fase','Semifinal','Final'];
const recoverySaves=5,recoveryDays=10,datePattern=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
function monthKey(now=Date.now()){const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function addDays(date,amount){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+amount);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function isPerfect(day){return !!day?.star&&['devotional','study','sleep','water','diet','workout'].every(key=>day.tasks?.[key]);}
function migrateRecovery(s,date=E.today()){
 const year=Number(date.slice(0,4));
 if(!s.recovery||typeof s.recovery!=='object'||Array.isArray(s.recovery))s.recovery={version:1,year,remaining:recoverySaves,eggs:0,critical:null};
 const r=s.recovery;r.version=1;r.year=Number.isInteger(r.year)?r.year:year;r.remaining=Number.isSafeInteger(r.remaining)?Math.max(0,Math.min(recoverySaves,r.remaining)):recoverySaves;r.eggs=Number.isSafeInteger(r.eggs)&&r.eggs>=0?r.eggs:0;r.critical??=null;
 return r;
}
function recoveryProgress(s,date=E.today()){
 const r=migrateRecovery(s,date),c=r.critical;if(!c)return null;
 let clean=0,perfect=0;
 for(let i=1;i<=recoveryDays;i++){const key=addDays(c.startedDate,i),day=s.calendar?.[key];if(day?.star)clean++;if(isPerfect(day))perfect++;}
 const elapsed=Math.max(0,Math.min(recoveryDays,Math.floor((new Date(date+'T12:00:00')-new Date(c.startedDate+'T12:00:00'))/86400000)));
 return {...c,clean,perfect,elapsed,daysLeft:Math.max(0,recoveryDays-elapsed)};
}
function detachFromActivities(s,m){onRemove(s,m);s.team=s.team.filter(id=>id!==m.uid);if(!s.boxes.includes(m.uid)){let slot=s.boxes.indexOf(null);if(slot<0&&s.boxes.length<506){slot=s.boxes.length;s.boxes.push(null);}if(slot>=0)s.boxes[slot]=m.uid;}}
function rollRecoveryYear(s,date=E.today()){
 const r=migrateRecovery(s,date),year=Number(date.slice(0,4));let changed=false;
 while(r.year<year){r.eggs+=r.remaining;r.year++;r.remaining=recoverySaves;changed=true;}
 return changed;
}
function refreshRecovery(s,date=E.today()){
 let changed=rollRecoveryYear(s,date);const r=s.recovery,c=r.critical;if(!c)return changed;
 const m=find(s,c.uid);if(!m){r.critical=null;return true;}
 detachFromActivities(s,m);const p=recoveryProgress(s,date);
 if(date>=c.endsDate&&p.clean===recoveryDays&&p.perfect>=5){r.critical=null;r.notice={type:'recovered',species:m.species,name:E.byId[m.species].name};return true;}
 if(date>addDays(c.endsDate,1)){const removed=E.removeOwned(s,m.uid);r.critical=null;if(removed)r.notice={type:'lost',species:removed.species,name:E.byId[removed.species].name};return true;}
 return changed;
}
function recordFall(s,date,id){
 if(s.battle||!E.editableDate(date)||s.calendar[date]?.fall)return null;
 rollRecoveryYear(s,date);const r=s.recovery,day=s.calendar[date]??={tasks:{},claimed:[],star:false},before={xp:s.xp,coins:s.coins};
 if(r.critical&&date<=r.critical.startedDate)return null;
 if(day.star)E.task(s,date,'star',false);day.star=false;
 if(r.critical){const critical=find(s,r.critical.uid);if(!critical)return null;day.fall={serial:critical.serial,name:E.byId[critical.species].name,outcome:'critical-lost'};const removed=E.removeOwned(s,critical.uid);r.critical=null;return removed&&{kind:'critical-lost',mon:removed,remaining:r.remaining,deltaXP:s.xp-before.xp,deltaCoins:s.coins-before.coins};}
 const target=E.strongest(s);if(!target||target.uid!==id)return null;
 if(r.remaining>0){const beforeRemaining=r.remaining;r.remaining--;r.critical={uid:target.uid,serial:target.serial,species:target.species,name:E.byId[target.species].name,startedDate:date,endsDate:addDays(date,recoveryDays)};day.fall={serial:target.serial,name:E.byId[target.species].name,outcome:'critical'};detachFromActivities(s,target);return {kind:'critical',mon:target,beforeRemaining,remaining:r.remaining,deltaXP:s.xp-before.xp,deltaCoins:s.coins-before.coins};}
 day.fall={serial:target.serial,name:E.byId[target.species].name,outcome:'lost'};const removed=E.removeOwned(s,target.uid);return removed&&{kind:'lost',mon:removed,remaining:0,deltaXP:s.xp-before.xp,deltaCoins:s.coins-before.coins};
}
function hatchEpicEgg(s){
 const r=migrateRecovery(s);if(s.battle||r.eggs<1)return null;
 const pool=E.D.mons.filter(m=>m.rarity==='Épico'&&m.stage===0),species=E.pick(pool);if(!species)return null;
 const mon=E.createMon(species.id,1);if(!E.addOwned(s,mon,'hatch'))return null;r.eggs--;return mon;
}
function migrateAdventure(s){
 migrateBossTeams(s);
 E.prepareHistory(s);
 normalizeExpeditions(s);
 s.bossMoves??={};
 const battle=s.battle,boss=E.D.bosses[battle?.bossIndex];if(boss&&['boss','rematch'].includes(battle.mode)&&!s.bossMoves[battle.bossIndex]&&battle.enemy.length===boss.team.length&&battle.enemy.every((m,i)=>m.species===boss.team[i]))s.bossMoves[battle.bossIndex]=battle.enemy.map(m=>({species:m.species,moves:[...m.moves]}));
 if(s.enemyMoveRevision!==2){
  // Preserve a fight already in progress, but rebuild every future opponent
  // with the level brackets introduced in enemy move revision 2.
  s.bossMoves={};
  for(const m of s.tournament?.opponents?.flat()||[])m.moves=E.byId[m.species].rarity==='Lendário'?E.moves.filter(a=>a.type===E.byId[m.species].type).map(a=>a.id):E.enemyMoves(E.byId[m.species].type,m.level);
  s.enemyMoveRevision=2;
 }
 s.welcomeSeen??=true;s.items??={};s.league??=0;s.suburb??={date:null,attempts:0,lost:false};s.lastTournamentMonth??=null;
 for(const m of s.owned){m.totalXP??=E.lifetimeXP(m);if(E.byId[m.species].rarity==='Lendário'){m.level=100;m.xp=0;}}
 if(s.battle)for(const m of [...s.battle.player,...s.battle.enemy])if(E.byId[m.species].rarity==='Lendário')m.level=100;
 for(const m of s.tournament?.members||[])E.normalizeCloudPP(m,s.cloudRevision!==1);
 s.cloudRevision=1;s.adventureVersion=2;
 const reached=Math.max(s.league,Number.isInteger(s.tournament?.league)?s.tournament.league:0);
 s.leagueChampions??=[];
 for(let i=0;i<Math.min(reached,7);i++)if(!s.leagueChampions.includes(i))s.leagueChampions.push(i);
 if(s.tournament?.status==='champion'&&!s.leagueChampions.includes(s.tournament.league))s.leagueChampions.push(s.tournament.league);
 migrateRecovery(s);refreshRecovery(s);
}
function refreshActivities(s,now=Date.now()){
 let changed=refreshRecovery(s,E.today());changed=storeUnavailable(s,now)||changed;
 const t=s.tournament;if(t?.status==='active'&&t.month!==monthKey(now)){
  t.status='expired';s.league=Math.max(0,t.league-1);t.resultText='Prazo encerrado na virada do mês. Liga rebaixada (mínimo Bronze).';
  if(s.battle?.mode==='tournament'){s.battle.done=true;s.battle.result='loss';s.battle.settled=true;s.battle.rewardText=t.resultText;}
  return true;
 }return changed;
}
function migrateBossTeams(s){
 if(s.bossRosterRevision===E.D.bossRosterRevision)return false;
 // Keep ongoing fights intact. Only obsolete cached future lineups are retired.
 for(const [key,team] of Object.entries(s.bossMoves||{})){
  const boss=E.D.bosses[key];
  if(boss&&Array.isArray(team)&&team.some((m,i)=>m.species!==boss.team[i]))delete s.bossMoves[key];
 }
 s.bossRosterRevision=E.D.bossRosterRevision;return true;
}
function storeUnavailable(s,now=Date.now()){
 let changed=false;
 for(const id of [...s.team]){
  if(!lockReason(s,id,'',now))continue;
  if(!s.boxes.includes(id)){
   let slot=s.boxes.indexOf(null);
   // Six overflow slots preserve a completely full collection without losing a Mon.
   if(slot<0){slot=s.boxes.length;if(slot>=506)continue;s.boxes.push(null);}
   s.boxes[slot]=id;
  }
  s.team=s.team.filter(uid=>uid!==id);changed=true;
 }
 return changed;
}
function availability(s,id,now=Date.now()){
 const reason=lockReason(s,id,'',now);if(!reason)return null;
 if(reason==='Estado Crítico'){const p=recoveryProgress(s);return {label:`Estado Crítico · ${p.clean}/10 dias limpos · ${p.perfect}/5 dias perfeitos`,until:null};}
 if(reason==='Inscrito no torneio')return {label:'Inscrito em torneio',until:null};
 const until=reason==='Em expedição'?expeditionForMember(s,id)?.ends:find(s,id).lockedUntil;
 const minutes=Math.ceil(Math.max(0,until-now)/60000);
 return {until,label:reason==='Em expedição'&&minutes===0?'Expedição concluída · aguardando resgate':`${reason} · ${Math.floor(minutes/60)}h ${minutes%60}min restantes`};
}
function lockReason(s,id,context='',now=Date.now()){
 const m=find(s,id);if(!m)return 'Mon não encontrado';
 if(s.recovery?.critical?.uid===id)return 'Estado Crítico';
 if(m.lockedUntil>now)return 'Recuperação do Subúrbio';
 if(expeditionForMember(s,id))return 'Em expedição';
 if(s.tournament?.status==='active'&&s.tournament.members.some(x=>x.uid===id)&&!['tournament','evolve','equipment'].includes(context))return 'Inscrito no torneio';
 return '';
}
function readyTeam(s){return s.team.map(id=>find(s,id)).filter(m=>m&&!lockReason(s,m.uid));}
function validMembers(s,ids,min,max){return Array.isArray(ids)&&ids.length>=min&&ids.length<=max&&new Set(ids).size===ids.length&&ids.every(id=>find(s,id)&&!lockReason(s,id));}
function expeditionSlotPrice(slot){return Number.isSafeInteger(slot)&&slot>=2&&slot<=10?50*2**(slot-2):0;}
function expeditionCost(count){if(!Number.isSafeInteger(count)||count<1||count>10)return null;let total=0;for(let slot=2;slot<=count;slot++)total+=expeditionSlotPrice(slot);return total;}
function expeditionForMember(s,id){return (s.expeditions||[]).find(x=>x.members.some(m=>m.uid===id))||(s.expedition?.members.some(m=>m.uid===id)?s.expedition:null);}
function normalizeExpeditions(s){
 s.expeditions=Array.isArray(s.expeditions)?s.expeditions:[];
 if(s.expedition){
  const legacy=s.expedition,used=new Set(s.expeditions.map(x=>x.slot)),members=Array.isArray(legacy.members)?legacy.members:[];
  for(let i=0;i<members.length;i+=3){let slot=1;while(used.has(slot)&&slot<=10)slot++;if(slot>10)break;used.add(slot);s.expeditions.push({slot,kind:legacy.kind,fee:0,started:Number.isFinite(legacy.started)?legacy.started:legacy.ends-48*hours,ends:legacy.ends,members:members.slice(i,i+3)});}
  delete s.expedition;
 }
 const previouslyUsed=s.expeditions.map(x=>x.slot);if(Number.isSafeInteger(s.lastExpedition?.slot))previouslyUsed.push(s.lastExpedition.slot);
 const saved=Array.isArray(s.expeditionSlots)?s.expeditionSlots:Number.isSafeInteger(s.expeditionSlots)?Array.from({length:s.expeditionSlots},(_,i)=>i+1):[];
 s.expeditionSlots=[...new Set([1,...saved,...previouslyUsed].filter(slot=>Number.isSafeInteger(slot)&&slot>=1&&slot<=10))].sort((a,b)=>a-b);
 for(const x of s.expeditions){if(x.fee===undefined)x.fee=0;if(!Number.isFinite(x.started)&&Number.isFinite(x.ends))x.started=x.ends-48*hours;}
 s.expeditions.sort((a,b)=>a.slot-b.slot);
}
function buyExpeditionSlot(s,slot){
 normalizeExpeditions(s);const price=expeditionSlotPrice(slot);
 if(s.battle||!Number.isSafeInteger(slot)||slot<2||slot>10||s.expeditionSlots.includes(slot)||s.coins<price)return false;
 s.coins-=price;s.expeditionSlots.push(slot);s.expeditionSlots.sort((a,b)=>a-b);return true;
}
function startExpedition(s,ids,kind,now=Date.now(),slot=1){
 normalizeExpeditions(s);
 if(s.battle||!Number.isSafeInteger(slot)||slot<1||slot>10||!s.expeditionSlots.includes(slot)||s.expeditions.some(x=>x.slot===slot)||!['collect','inform','scout'].includes(kind)||!validMembers(s,ids,1,3))return false;
 s.expeditions.push({slot,kind,fee:0,started:now,ends:now+48*hours,members:ids.map(id=>({uid:id,level:find(s,id).level}))});s.expeditions.sort((a,b)=>a.slot-b.slot);storeUnavailable(s,now);return true;
}
function claimExpedition(s,now=Date.now(),slot=1){
 normalizeExpeditions(s);const index=s.expeditions.findIndex(x=>x.slot===slot),x=s.expeditions[index];if(s.battle||!x||now<x.ends)return null;const result={slot,coins:0,awards:[]};
 // Remove the pending mission before payout: reloads cannot claim it again.
 s.expeditions.splice(index,1);
 for(const member of x.members){const m=find(s,member.uid);if(!m)continue;E.ensureMonHistory(m).expeditions++;const half=Math.floor(member.level/2);
  result.coins+=x.kind==='collect'?member.level:x.kind==='scout'?half:0;
  const xp=x.kind==='inform'?member.level:x.kind==='scout'?half:0;if(xp)E.grantXP(m,xp);result.awards.push({uid:m.uid,xp});
 }s.coins+=result.coins;s.lastExpedition=result;return result;
}
function enemyEquipment(level){const tier=level<=10?0:level<=40?1:level<=70?2:3;return tier?E.pick(items.filter(x=>x.kind==='stone'&&x.tier===tier)).id:null;}
function enemyPool(level,legendary=false){
 return E.D.mons.filter(m=>(m.rarity!=='Lendário'||legendary&&level===100)&&(m.stage===0||m.stage===1&&level>=15||m.stage===2&&level>=30)&&(!m.next||level<(m.stage===0?15:30)));
}
function randomEnemy(level,legendary=false){
 return E.enemyMon(E.pick(enemyPool(level,legendary)).id,level);
}
function startSuburb(s,id,date=E.today(),now=Date.now()){
 if(s.battle||lockReason(s,id,'',now))return null;const m=find(s,id);
 if(s.suburb.date!==date)s.suburb={date,attempts:0,lost:false};
 if(s.suburb.attempts>=2||s.suburb.lost||s.coins<m.level)return null;
 const b=E.createBattle('suburb',[m],[randomEnemy(m.level)],{title:'Duelo clandestino',stake:m.level});
 s.coins-=m.level;s.suburb.attempts++;s.battle=b;return b;
}
function bossOpponents(s,index){
 migrateBossTeams(s);
 const boss=E.D.bosses[index];if(!boss)throw Error('Boss inválido');s.bossMoves??={};
 if(!s.bossMoves[index])s.bossMoves[index]=boss.team.map(id=>({species:id,moves:E.enemyMoves(E.byId[id].type,E.byId[id].rarity==='Lendário'?100:boss.level)}));
 return s.bossMoves[index].map(entry=>({...E.createMon(entry.species,boss.level),moves:[...entry.moves]}));
}
function startRematch(s,index){
 if(s.battle||!s.career[index]?.cleared)return null;const players=readyTeam(s);if(!players.length)return null;
 const boss=E.D.bosses[index];s.battle=E.createBattle('rematch',players,bossOpponents(s,index),{title:'Revanche · '+boss.trainer,bossIndex:index});return s.battle;
}
function enterTournament(s,ids,now=Date.now()){
 refreshActivities(s,now);const month=monthKey(now),league=leagues[s.league];
 if(s.battle||s.tournament?.status==='active'||s.lastTournamentMonth===month||!validMembers(s,ids,1,3)||s.coins<league.fee)return false;
 const opponents=phases.map(()=>Array.from({length:3},()=>{const n=league.min+Math.floor(Math.random()*(league.max-league.min+1)),m=randomEnemy(n,true);m.stone=enemyEquipment(m.level);return m;}));
 s.coins-=league.fee;s.lastTournamentMonth=month;
 s.tournament={status:'active',month,league:s.league,phase:0,fee:league.fee,members:ids.map(id=>E.combatMon(find(s,id))),opponents,etherUsed:[],restoreUsed:false};storeUnavailable(s,now);return true;
}
function syncTournamentMember(s,id){
 const t=s.tournament,m=find(s,id),fighter=t?.members.find(x=>x.uid===id);if(!m||!fighter||t.status!=='active')return;
 fighter.species=m.species;fighter.level=m.level;fighter.stone=m.stone;fighter.stats=E.equippedStats(m);fighter.hp=Math.min(fighter.hp,fighter.stats.hp);
}
function startTournamentPhase(s,now=Date.now()){
 refreshActivities(s,now);const t=s.tournament;if(s.battle||t?.status!=='active'||t.phase>3)return null;
 for(const m of t.members)syncTournamentMember(s,m.uid);
 if(!t.members.some(m=>m.hp>0&&E.moveUsesRemaining(m)>0))return null;
 const team=t.members.filter(m=>find(s,m.uid));if(!team.length)return null;
 const b=E.createBattle('tournament',team,t.opponents[t.phase],{title:`${leagues[t.league].name} · ${phases[t.phase]}`,tournamentPhase:t.phase});
 b.player=team.map(m=>{const fresh=E.combatMon(m);fresh.hp=m.hp;fresh.pp={...m.pp};return fresh;});
 b.pi=Math.max(0,b.player.findIndex(m=>m.hp>0&&E.moveUsesRemaining(m)>0));b.done=false;b.result=undefined;b.forcePlayer=false;E.resolve(b);s.battle=b;return b;
}
function settleAdventure(s,b,now=Date.now()){
 if(!['suburb','rematch','tournament'].includes(b.mode))return false;
 if(b.mode==='rematch'){b.rewardText='Revanche concluída. Sem XP, moedas ou consumo da carreira diária.';return true;}
 if(b.mode==='suburb'){
  if(b.result==='win'){s.coins+=b.stake*2;b.rewardText=`Vitória! Aposta devolvida e lucro de ¥ ${b.stake}.`;}
  else if(b.result==='draw'){s.coins+=b.stake;b.rewardText='Empate: aposta devolvida. Tentativa conta como ganha, sem bloqueio.';}
  else {s.suburb.lost=true;const m=find(s,b.player[0].uid);if(m)m.lockedUntil=now+24*hours;b.rewardText=`Derrota: ¥ ${b.stake} perdidos. Este Mon ficará bloqueado por 24 horas.`;}
  storeUnavailable(s,now);return true;
 }
 const t=s.tournament;if(!t||t.status!=='active'){b.rewardText=t?.resultText||'Torneio encerrado.';return true;}
 t.members=b.player.map(m=>{const c=E.clone(m);E.restoreCopiedMoves(c);c.status={};c.blocked=[];c.blockTargets=[];return c;});
 if(b.result==='win'){
  t.phase++;t.etherUsed=[];t.restoreUsed=false;
  if(t.phase===4){t.status='champion';s.leagueChampions??=[];if(!s.leagueChampions.includes(t.league))s.leagueChampions.push(t.league);s.coins+=t.fee*6;s.league=Math.min(6,t.league+1);t.resultText=`Campeão da liga ${leagues[t.league].name}! Prêmio: ¥ ${t.fee*6}.`;}
  b.rewardText=t.status==='champion'?t.resultText:'Fase vencida! Vida e usos mantidos. Prepare sua equipe antes da próxima fase.';
 }else{t.status='lost';if(t.phase===0)s.league=Math.max(0,t.league-1);t.resultText='Eliminado deste torneio. Uma nova inscrição será permitida no próximo mês.';b.rewardText=t.resultText;}
 return true;
}
function buyItem(s,id,quantity=1){const item=items.find(x=>x.id===id);if(s.battle||!item||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||s.coins<item.price*quantity)return false;s.coins-=item.price*quantity;s.items[id]=(s.items[id]||0)+quantity;return true;}
function equipStone(s,uid,id){
 const m=find(s,uid),item=items.find(x=>x.id===id);if(s.battle||!m||lockReason(s,uid,'equipment')||!item||item.kind!=='stone'||!Number.isSafeInteger(s.items[id])||s.items[id]<1||m.stone===id)return false;
 s.items[id]--;m.stone=id;syncTournamentMember(s,uid);return true;
}
function useTournamentItem(s,uid,id){
 const t=s.tournament,item=items.find(x=>x.id===id),m=t?.members.find(x=>x.uid===uid);
 if(s.battle||t?.status!=='active'||t.phase<1||t.phase>3||!m||!find(s,uid)||!item||item.kind==='stone'||!s.items[id])return false;
 syncTournamentMember(s,uid);
 if(item.kind==='potion'){if(m.hp<=0||m.hp>=m.stats.hp)return false;m.hp=Math.min(m.stats.hp,m.hp+item.value);}
 if(item.kind==='ether'){if(t.etherUsed.includes(uid)||m.moves.every(move=>m.pp[move]>=E.byMove[move].pp))return false;for(const move of m.moves)m.pp[move]=Math.min(E.byMove[move].pp,m.pp[move]+item.value);t.etherUsed.push(uid);}
 if(item.kind==='restore'){if(m.hp>0||t.restoreUsed)return false;m.hp=Math.max(1,Math.ceil(m.stats.hp*.3));for(const move of m.moves)m.pp[move]=Math.min(E.byMove[move].pp,m.pp[move]+1);t.restoreUsed=true;}
 s.items[id]--;return true;
}
function abandonTournament(s){if(s.battle||s.tournament?.status!=='active')return false;const t=s.tournament;t.status='lost';if(t.phase===0)s.league=Math.max(0,t.league-1);t.resultText='Torneio encerrado por desistência. Inscrição mensal consumida.';return true;}
function onRemove(s,m){
 normalizeExpeditions(s);for(const x of s.expeditions)x.members=x.members.filter(member=>member.uid!==m.uid);s.expeditions=s.expeditions.filter(x=>x.members.length);
 const t=s.tournament;if(t?.status==='active'){t.members=t.members.filter(x=>x.uid!==m.uid);if(!t.members.length){t.status='lost';if(t.phase===0)s.league=Math.max(0,t.league-1);t.resultText='Torneio encerrado: equipe removida.';}}
}
function validateAdventure(s){
 if(s.leagueChampions!==undefined&&(!Array.isArray(s.leagueChampions)||new Set(s.leagueChampions).size!==s.leagueChampions.length||s.leagueChampions.some(i=>!Number.isInteger(i)||i<0||i>=leagues.length)))throw Error('Histórico de ligas inválido');
 for(const m of s.owned)if(m.history!==undefined){const h=m.history;if(!h||typeof h!=='object'||Array.isArray(h)||['victories','knockouts','expeditions'].some(k=>!Number.isSafeInteger(h[k])||h[k]<0)||typeof h.partial!=='boolean'||![h.trackedFrom,h.obtainedOn,h.capturedOn].every(d=>d===null||typeof d==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d))||!['unknown','obtained','purchase','capture','hatch'].includes(h.origin))throw Error('Histórico inválido');}
 if(s.recovery!==undefined){const r=s.recovery;if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==1||!Number.isInteger(r.year)||!Number.isSafeInteger(r.remaining)||r.remaining<0||r.remaining>recoverySaves||!Number.isSafeInteger(r.eggs)||r.eggs<0)throw Error('Recuperação anual inválida');if(r.critical){const c=r.critical;if(!find(s,c.uid)||typeof c.uid!=='string'||!datePattern.test(c.startedDate)||!datePattern.test(c.endsDate)||c.endsDate!==addDays(c.startedDate,recoveryDays))throw Error('Estado Crítico inválido');}}
 if(s.battle?.historyRevision!==undefined){const b=s.battle;if(b.historyRevision!==1||typeof b.historyVictoryApplied!=='boolean')throw Error('Histórico de batalha inválido');for(const map of [b.historyKOs,b.historyAppliedKOs])if(!map||typeof map!=='object'||Array.isArray(map)||Object.entries(map).some(([id,n])=>!b.player.some(m=>m.uid===id)||!Number.isSafeInteger(n)||n<0||n>b.enemy.length))throw Error('Nocautes inválidos');for(const [id,n] of Object.entries(b.historyAppliedKOs))if(n>(b.historyKOs[id]||0))throw Error('Nocautes já contabilizados inválidos');}

 if(s.bossMoves!==undefined){
  if(!s.bossMoves||typeof s.bossMoves!=='object'||Array.isArray(s.bossMoves))throw Error('Movimentos de bosses inválidos');
  for(const [key,team] of Object.entries(s.bossMoves)){const boss=E.D.bosses[key];if(!/^(0|[1-9][0-9]*)$/.test(key)||!boss||!Array.isArray(team)||team.length!==boss.team.length||team.some((m,i)=>!m||m.species!==boss.team[i]||!Array.isArray(m.moves)||m.moves.length<1||m.moves.length>4||new Set(m.moves).size!==m.moves.length||m.moves.some(id=>!E.byMove[id])))throw Error('Equipe fixa de boss inválida');}
 }
 if(s.items&&(typeof s.items!=='object'||Array.isArray(s.items)||Object.entries(s.items).some(([k,v])=>!items.some(x=>x.id===k)||!Number.isSafeInteger(v)||v<0)))throw Error('Inventário inválido');
 if(s.league!==undefined&&(!Number.isInteger(s.league)||s.league<0||s.league>6))throw Error('Liga inválida');
 for(const m of s.owned){if(m.totalXP!==undefined&&(!Number.isSafeInteger(m.totalXP)||m.totalXP<0))throw Error('XP vitalício inválido');if(m.stone&&!items.some(x=>x.id===m.stone&&x.kind==='stone'))throw Error('Pedra inválida');if(m.lockedUntil!==undefined&&(!Number.isFinite(m.lockedUntil)||m.lockedUntil<0))throw Error('Bloqueio inválido');}
 if(s.expedition){const x=s.expedition;if(!['collect','inform','scout'].includes(x.kind)||!Number.isFinite(x.ends)||!Array.isArray(x.members)||x.members.length<1||x.members.length>10||x.members.some(m=>!find(s,m.uid)||!Number.isInteger(m.level)||m.level<1||m.level>100)||new Set(x.members.map(m=>m.uid)).size!==x.members.length||x.fee!==undefined&&(!Number.isSafeInteger(x.fee)||x.fee<0||x.fee!==expeditionCost(x.members.length)))throw Error('Expedição legada inválida');}
 if(s.expeditionSlots!==undefined&&(!Array.isArray(s.expeditionSlots)||!s.expeditionSlots.includes(1)||new Set(s.expeditionSlots).size!==s.expeditionSlots.length||s.expeditionSlots.some(slot=>!Number.isSafeInteger(slot)||slot<1||slot>10)))throw Error('Slots de expedição inválidos');
 if(s.expeditions!==undefined){if(!Array.isArray(s.expeditions)||s.expeditions.length>10)throw Error('Expedições inválidas');const slots=new Set,participants=new Set;for(const x of s.expeditions){if(!x||!Number.isSafeInteger(x.slot)||x.slot<1||x.slot>10||slots.has(x.slot)||s.expeditionSlots!==undefined&&!s.expeditionSlots.includes(x.slot)||!['collect','inform','scout'].includes(x.kind)||!Number.isFinite(x.started)||!Number.isFinite(x.ends)||x.ends<=x.started||!Array.isArray(x.members)||x.members.length<1||x.members.length>3||!Number.isSafeInteger(x.fee)||![0,expeditionSlotPrice(x.slot)].includes(x.fee))throw Error('Expedição paralela inválida');slots.add(x.slot);for(const m of x.members){if(!find(s,m.uid)||participants.has(m.uid)||!Number.isInteger(m.level)||m.level<1||m.level>100)throw Error('Participante de expedição inválido');participants.add(m.uid);}}}
 if(s.suburb&&(!Number.isInteger(s.suburb.attempts)||s.suburb.attempts<0||s.suburb.attempts>2))throw Error('Subúrbio inválido');
 if(s.tournament){const t=s.tournament;if(!['active','lost','expired','champion'].includes(t.status)||!leagues[t.league]||!Number.isInteger(t.phase)||t.phase<0||t.phase>4||!Array.isArray(t.members)||t.members.length>3||!Array.isArray(t.opponents)||t.opponents.length!==4||!Array.isArray(t.etherUsed)||typeof t.month!=='string'||t.fee!==leagues[t.league].fee)throw Error('Torneio inválido');
  for(const m of [...t.members,...t.opponents.flat()])if(!E.byId[m.species]||!Array.isArray(m.moves)||m.moves.some(id=>!E.byMove[id])||!Number.isInteger(m.level)||m.level<1||m.level>100)throw Error('Equipe de torneio inválida');
  for(const m of t.members)if(!Number.isFinite(m.hp)||m.hp<0||!m.pp||m.moves.some(id=>!Number.isInteger(m.pp[id])||m.pp[id]<0||m.pp[id]>(id==='cloud'&&s.cloudRevision!==1?10:E.byMove[id].pp))||t.status==='active'&&!find(s,m.uid))throw Error('Estado de torneio inválido');
 }
}
Object.assign(E,{items,leagues,phases,monthKey,migrateBossTeams,storeUnavailable,availability,migrateAdventure,refreshActivities,lockReason,readyTeam,expeditionSlotPrice,expeditionCost,buyExpeditionSlot,startExpedition,claimExpedition,enemyEquipment,enemyPool,randomEnemy,startSuburb,bossOpponents,startRematch,enterTournament,syncTournamentMember,startTournamentPhase,settleAdventure,buyItem,equipStone,useTournamentItem,abandonTournament,onRemove,validateAdventure,migrateRecovery,recoveryProgress,refreshRecovery,recordFall,hatchEpicEgg,recoverySaves});
const originalNewSave=E.newSave;E.newSave=()=>{const s=originalNewSave();migrateAdventure(s);return s;};
})(window.FMX);
