/* Fade Mon X — rules and battle engine, independent of the interface. */
(function(root){
'use strict';
const D=root.FMX_DATA, byId=Object.fromEntries(D.mons.map(m=>[m.id,m]));
const config={bossRewards:[250,500,1000,2000,3500,5500,8500,12500,17500,25000,35000],maxTeam:6,boxCount:5,boxSize:100};
function requiredGrunts(index){return index===D.bosses.length-1?0:10;}
function careerReward(index,mode='boss'){const total=config.bossRewards[index];if(!Number.isInteger(index)||!total||!['boss','career'].includes(mode))return {coins:0,xp:0};if(mode==='boss')return {coins:total,xp:total/5};const amount=index===10?200:(index+1)*10;return {coins:amount,xp:amount*2};}
function careerAvailable(state,index){return Number.isInteger(index)&&!!state.career[index]&&!state.career[index].cleared&&(index===0||state.career[index-1].cleared)&&(root.FMX.readyTeam?root.FMX.readyTeam(state).length:state.team.length)>0&&state.lastCareer!==today();}
function grantTeamXP(state,b,amount,split=false,remainderUid=null){
 const awards=[],ids=[...new Set(b.player.map(m=>m.uid))].filter(id=>state.owned.some(m=>m.uid===id)),base=split?Math.floor(amount/ids.length):amount,remainder=split?amount%ids.length:0,extra=ids.includes(remainderUid)?remainderUid:ids.includes(b.player[b.pi]?.uid)?b.player[b.pi].uid:ids[0];
 if(!ids.length)return awards;
 for(const id of ids){const mon=state.owned.find(m=>m.uid===id);if(!mon)continue;const before=mon.level,earned=grantXP(mon,base+(id===extra?remainder:0)),fighter=b.player.find(m=>m.uid===id);fighter.xp=mon.xp;fighter.level=mon.level;fighter.pending=mon.pending;
  if(mon.level!==before){const updated=equippedStats(mon),delta=updated.hp-fighter.stats.hp;fighter.stats=updated;if(fighter.hp>0)fighter.hp+=delta;log(b,`${byId[mon.species].name} subiu para o nível ${mon.level}!`);}
  awards.push({uid:id,xp:earned});if(earned)log(b,`${byId[mon.species].name} ${serial(mon)} recebeu ${earned} XP pela vitória.`);
 }
 b.teamXPAwards=awards;return awards;
}
const pick=a=>a[Math.floor(Math.random()*a.length)], shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
const today=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const moves=[];
function add(type,id,name,kind,desc,effect,extra={}){moves.push({type,id,name,kind,desc,effect,pp:kind==='attack'?20:8,...extra});}
add('Normal','accelerate','Aceleração','skill','Aumenta a velocidade em 50%.','speed',{factor:1.5});
add('Normal','intimidate','Intimidação','skill','Reduz a velocidade adversária em 50%.','slow');
add('Normal','protect','Proteção','skill','Reduz em 25% os próximos 2 ataques.','shield',{factor:.75});
add('Normal','headbutt','Cabeçada','attack','Causa 1,3× ataque.','damage',{power:1.3});
add('Normal','tackle','Investida','attack','1× ataque; 40% de crítico.','damage',{power:1,crit:.4});
add('Normal','advance','Avanço','attack','Moeda: 0,6× ou 2× ataque.','damage',{coins:[.6,2]});
add('Elétrico','shockwave','Onda de choque','skill','50% de chance de paralisar. A cada ação, moeda para sair.','paralyze',{chance:.5});
add('Elétrico','charge','Carregar','skill','Dobra o dano do próximo ataque.','charge');
add('Elétrico','fry','Fritar','skill','Dobra a velocidade por 4 rodadas.','fry');
add('Elétrico','shock','Raio de choque','attack','1,2× ataque; 50% de crítico.','damage',{power:1.2,crit:.5});
add('Elétrico','electrocannon','Eletrocanhão','attack','1,8× ataque, sem crítico.','damage',{power:1.8});
add('Elétrico','electrify','Eletrização','attack','1,2× ataque e 50% de chance de paralisar.','damage',{power:1.2,paralysis:.5});
add('Água','freeze','Pancada congelada','skill','Paralisa por até 2 ações; moeda para sair antes.','paralyze',{duration:2});
add('Água','hydrate','Hidratação','skill','Cura 30% do HP máximo. 2 usos por batalha.','heal',{percent:.3,pp:2});
add('Água','hydrocharge','Hidro-carga','skill','Dano ×1,5 por 3 rodadas.','hydro');
add('Água','waterjet','Jato de água','attack','1,5× ataque; 60% de crítico.','damage',{power:1.5,crit:.6});
add('Água','projectile','Projétil de água','attack','2,5× ataque, sem crítico.','damage',{power:2.5});
add('Água','waterspout','Tromba aquática','attack','4 moedas: 1,3× ataque por cara.','damage',{tosses:4,power:1.3});
add('Fogo','spark','Fagulha fervente','skill','Queima por 4 rodadas: 0,4× ataque por rodada.','burn');
add('Fogo','flame','Labareda incendiária','skill','Após ativar, devolve 0,6× ataque quando atingido, por 2 rodadas de proteção. Não afeta ataques anteriores.','flame');
add('Fogo','firewall','Barreira de fogo','skill','Reduz em 50% os próximos 2 ataques.','shield',{factor:.5});
add('Fogo','flameadvance','Avanço flamejante','attack','5,5× ataque, sem crítico natural. Descansa nas próximas 2 rodadas, sem poder trocar.','damage',{power:5.5,rest:2,lockSwitch:true});
add('Fogo','flamecannon','Canhão de chamas','attack','2,2× ataque; 15% de crítico.','damage',{power:2.2,crit:.15});
add('Fogo','vortex','Vórtice explosivo','attack','Moeda: 1,5× ou 3,5× ataque.','damage',{coins:[1.5,3.5]});
add('Planta','seed','Semente venenosa','skill','0,2× ataque do usuário por rodada no adversário ativo, até o fim da batalha. 1 uso por equipe.','seed',{pp:1,teamLimit:true});
add('Planta','fruit','Fruto saudável','skill','Cura 60% do HP máximo. 2 usos por batalha.','heal',{percent:.6,pp:2});
add('Planta','tree','Árvore acolhedora','skill','Cura 15% do HP máximo de toda a equipe viva. 2 usos por batalha.','teamheal',{pp:2});
add('Planta','absorb','Absorção','attack','1,2× ataque; cura metade do dano efetivamente causado.','damage',{power:1.2,drain:true});
add('Planta','solar','Raio solar','attack','1,8× ataque, sem crítico.','damage',{power:1.8});
add('Planta','leaves','Lâminas de folhas','attack','3 moedas: 1,6× ataque por cara.','damage',{tosses:3,power:1.6});
add('Angelical','flight','Voo seguro','skill','Após ativar, ignora ataques por 2 rodadas de proteção; habilidades ainda afetam. 3 usos.','flight',{pp:3});
add('Angelical','lightheal','Cura luminosa','skill','Cura 2× seu ataque. 2 usos por batalha.','heal',{power:2,pp:2});
add('Angelical','reflect','Defesa impenetrável','skill','Na próxima rodada, bloqueia ataques e devolve o dobro.','reflect');
add('Angelical','cloud','Nuvem dourada','skill','A partir da próxima rodada, cura 5% da vida máxima do Mon ativo, inclusive após trocas, até o fim da batalha. 1 uso por equipe.','cloud',{pp:1,teamLimit:true});
add('Angelical','light','Luz angelical','attack','1× ataque; 25% de crítico.','damage',{power:1,crit:.25});
add('Angelical','heaven','Raio dos céus','attack','1,5× ataque.','damage',{power:1.5});
add('Escuridão','abyss','Olhar abissal','skill','Bloqueia um ataque adversário até o fim da batalha. 1 uso.','block',{targetKind:'attack',pp:1});
add('Escuridão','nightmare','Pesadelo terrível','skill','Sono por até 2 ações, com moeda para acordar. Ao sair, imunidade a sono por 3 rodadas.','sleep');
add('Escuridão','shadows','Sombras massivas','skill','Força troca adversária; o adversário escolhe quem entra.','force');
add('Escuridão','night','Investida Noturna','attack','1,4× ataque; 85% de crítico.','damage',{power:1.4,crit:.85});
add('Escuridão','darkclaw','Garra das trevas','attack','1,2× ataque; moeda: cara também causa sono por até 2 ações. Ao sair, imunidade a sono por 3 rodadas.','damage',{power:1.2,sleep:.5});
add('Escuridão','spin','Ataque giratório','attack','1,9× ataque; 10% de crítico.','damage',{power:1.9,crit:.1});
add('Dragão','hyper','Hiper-raio','skill','Cura todo o HP; descansa na próxima rodada. 1 uso.','heal',{percent:1,rest:true,pp:1});
add('Dragão','gale','Vendaval de dragão','skill','Escolhe qual Mon adversário entra. 1 uso.','force',{choose:true,pp:1});
add('Dragão','portal','Dragoportal','skill','Troca de Mon e cura os dois em 35% do HP máximo. 2 usos por batalha.','portal',{pp:2});
add('Dragão','dragonclaw','Garra de dragão','attack','Causa dano igual a 50% do HP atual do alvo.','damage',{fraction:.5});
add('Dragão','dive','Rasante estrondoso','attack','3× ataque; 50% de chance de sofrer metade do dano nominal.','damage',{power:3,recoil:true});
add('Dragão','tail','Cauda aniquiladora','attack','2× ataque em toda a equipe adversária; descansa depois.','damage',{power:2,all:true,rest:true});
add('Psíquico','mindcontrol','Controle mental','skill','Bloqueia uma habilidade adversária até o fim da batalha. 2 usos.','block',{targetKind:'skill',pp:2});
add('Psíquico','psychicshadow','Sombra psíquica','skill','Copia um movimento adversário e seus usos restantes até o fim da batalha. Não copia outra Sombra nem recupera usos já gastos.','copy');
add('Psíquico','confusion','Confusão cerebral','skill','Na próxima ação: coroa causa 10% do próprio HP máximo ao alvo em vez de agir; cara permite agir. Depois, imunidade à confusão por 3 rodadas.','confuse',{pp:5});
add('Psíquico','deepsleep','Sono profundo','skill','Sono por até 2 ações; moeda antes de cada ação para acordar. Depois, imunidade ao sono por 3 rodadas.','sleep',{pp:5});
add('Psíquico','psychicray','Raio psíquico','attack','1,8× ataque; 15% de crítico.','damage',{power:1.8,crit:.15});
add('Psíquico','psychicsphere','Esfera psíquica','attack','1,2× ataque; 60% de crítico.','damage',{power:1.2,crit:.6});
const byMove=Object.fromEntries(moves.map(m=>[m.id,m]));
function stats(species,level=1){
 const m=byId[species];if(!m)throw Error('Mon desconhecido');
 level=Math.min(100,Math.max(1,level));
 if(m.rarity==='Lendário')return {...m.base};
 const f=m.line.map(id=>byId[id]),result={...f[0].base};
 for(let n=2;n<=level;n++){let stage=n<=15?0:n<=30?Math.min(1,f.length-1):f.length-1;for(const k of ['atk','hp','speed'])result[k]+=f[stage].growth[k];}
 return result;
}
function growthNext(mon){if(mon.level>=100||byId[mon.species].rarity==='Lendário')return {hp:0,atk:0,speed:0};const now=stats(mon.species,mon.level),next=stats(mon.species,mon.level+1);return Object.fromEntries(['hp','atk','speed'].map(k=>[k,next[k]-now[k]]));}
function equippedStats(mon){const result=stats(mon.species,mon.level),item=root.FMX?.items?.find(x=>x.id===mon.stone);if(item?.stat&&item.stat!=='crit')result[item.stat]+=item.value;return result;}
function available(type){return moves.filter(m=>m.type==='Normal'||m.type===type);}
function initialMoves(type,wild=false){
 const normal=shuffle(moves.filter(m=>m.type==='Normal'&&m.kind==='attack'));
 const result=[normal[0].id,pick(moves.filter(m=>m.type==='Normal'&&m.id!==normal[0].id)).id];
 if(wild)result.push(pick(moves.filter(m=>m.type===type)).id);return result;
}
function enemyMoves(type,level){
 const normalAttack=pick(moves.filter(m=>m.type==='Normal'&&m.kind==='attack'));
 const normalSkill=pick(moves.filter(m=>m.type==='Normal'&&m.kind==='skill'));
 const element=shuffle(moves.filter(m=>m.type===type));
 let chosen;
 if(level<5)chosen=[normalAttack,normalSkill];
 else if(level<10)chosen=[normalAttack,normalSkill,...element.slice(0,1)];
 else if(level<15)chosen=[normalAttack,normalSkill,...element.slice(0,2)];
 else if(level<20)chosen=[normalAttack,...element.slice(0,3)];
 else chosen=element.slice(0,4);
 return shuffle(chosen).map(m=>m.id);
}
function createMon(id,level=1,wild=false){const m=byId[id];return {uid:uid(),species:id,level:m.rarity==='Lendário'?100:level,totalXP:m.rarity==='Lendário'?0:(level-1)*(level+8)/2,xp:0,moves:m.rarity==='Lendário'?moves.filter(a=>a.type===m.type).map(a=>a.id):wild?enemyMoves(m.type,m.rarity==='Lendário'?100:level):initialMoves(m.type),pending:0,learnChoices:[]};}
function grantXP(mon,amount){if(!Number.isSafeInteger(amount)||amount<0)return 0;const before={level:mon.level,xp:mon.xp,totalXP:lifetimeXP(mon)};root.FMX.learningQueue?.(mon);mon.totalXP=lifetimeXP(mon)+amount;const received=amount;if(byId[mon.species].rarity==='Lendário')mon.level=100;while(amount-->0&&mon.level<100){mon.xp++;if(mon.xp>=mon.level+4){mon.xp-=mon.level+4;mon.level++;if(mon.level%5===0){mon.pending++;(mon.learnChoices??=[]).push(byId[mon.species].type==='Dragão'&&[25,50].includes(mon.level)?'any':'element');}}}if(mon.level===100)mon.xp=0;if(received)root.FMX.onMonXP?.(mon,before,received);return received;}
function canEvolve(mon){const d=byId[mon.species];return !!d.next&&mon.level>=(d.stage===0?15:30);}
function lifetimeXP(mon){return mon.totalXP??(byId[mon.species].rarity==='Lendário'?0:(mon.level-1)*(mon.level+8)/2+mon.xp);}
function overallScore(mon){const s=equippedStats(mon);return (s.atk*10+s.hp)/100;}
function overall(mon){return Math.min(100,Math.max(0,Math.ceil(overallScore(mon))));}
function serial(mon){return '#'+String(mon.serial).padStart(4,'0');}
function normalizeOwnership(state){
 const used=new Set;let next=Math.max(1,Number.isSafeInteger(state.nextSerial)?state.nextSerial:1);
 for(const m of state.owned)if(Number.isSafeInteger(m.serial)&&m.serial>0&&!used.has(m.serial)){used.add(m.serial);next=Math.max(next,m.serial+1);}else delete m.serial;
 for(const m of state.owned)if(!m.serial)m.serial=next++;
 state.nextSerial=next;
}
function saleBase(mon){const d=byId[mon.species];return d.price??byId[d.line[0]].price;}
function saleValue(mon){const price=saleBase(mon);return price===null?null:price/2+lifetimeXP(mon);}
function removeOwned(state,id){if(state.battle)return null;const m=state.owned.find(x=>x.uid===id);if(!m)return null;state.owned=state.owned.filter(x=>x.uid!==id);state.team=state.team.filter(x=>x!==id);state.boxes=state.boxes.map(x=>x===id?null:x);if(root.FMX.onRemove)root.FMX.onRemove(state,m);return m;}
function sell(state,id){const m=state.owned.find(x=>x.uid===id);if(!m||state.battle||root.FMX.lockReason?.(state,id)||!state.boxes.includes(id))return null;const value=saleValue(m);if(value===null)return null;removeOwned(state,id);state.coins+=value;return value;}
function strongest(state){return [...state.owned].sort((a,b)=>overallScore(b)-overallScore(a)||lifetimeXP(b)-lifetimeXP(a)||a.serial-b.serial)[0]||null;}
function yesterday(reference=today()){const d=new Date(reference+'T12:00:00');d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function editableDate(date){return date===today()||date===yesterday();}
function fall(state,date,id){if(state.battle||!editableDate(date)||state.calendar[date]?.fall)return null;const target=strongest(state);if(!target||target.uid!==id)return null;const day=state.calendar[date]??={tasks:{},claimed:[],star:false};if(day.star)task(state,date,'star',false);day.fall={serial:target.serial,name:byId[target.species].name};day.star=false;return removeOwned(state,id);}
function wildRarity(date=today()){if(date.slice(5)==='01-01')return 'Lendário';const day=Number(date.slice(-2));return day===1?'Épico':day%5===0?'Raro':'Comum';}
function wildEncounter(date=today()){
 const rarity=wildRarity(date),species=pick(D.mons.filter(m=>m.rarity===rarity&&(rarity==='Lendário'||m.stage===0)));
 return createMon(species.id,rarity==='Lendário'?1:1+Math.floor(Math.random()*5),true);
}
function newSave(){return {version:1,welcomeSeen:false,rulesV11:1,catalogRevision:D.catalogVersion||2,coins:500,xp:0,owned:[],team:[],boxes:Array(500).fill(null),discovered:[],calendar:{},career:D.bosses.map(()=>({wins:0,cleared:false})),lastCareer:null,lastWild:null,battle:null,settings:{sound:false},created:today()};}
function addOwned(state,mon,origin='obtained'){let slot=state.boxes.indexOf(null);if(state.owned.length>=506||state.owned.some(m=>m.uid===mon.uid)||state.team.length>=6&&slot<0)return false;normalizeOwnership(state);mon.history??=newMonHistory(origin);mon.serial=state.nextSerial++;state.owned.push(mon);if(state.team.length<6)state.team.push(mon.uid);else state.boxes[slot]=mon.uid;if(!state.discovered.includes(mon.species))state.discovered.push(mon.species);return true;}
function task(state,date,key,value){
 if(state.battle||!editableDate(date))return false;
 const keys=['devotional','study','sleep','water','diet','workout'];
 if(key!=='star'&&!keys.includes(key))return false;
 const day=state.calendar[date]??={tasks:{},claimed:[],star:false};
 // Preserve legacy rewards; old coins were never deducted on uncheck.
 day.xpActive??=Object.fromEntries(day.claimed.map(k=>[k,true]));
 day.coinActive??=Object.fromEntries(day.claimed.map(k=>[k,true]));
 day.starPaid??=false;
 day.bonusAmount??=day.bonusClaimed?9:0;
 if(key==='star'){
  value=!!value;if(value&&day.fall||!!day.star===value)return false;
  day.star=value;
  if(value){state.xp+=2;state.coins+=2;day.starPaid=true;}
  else if(day.starPaid){state.xp-=2;state.coins-=2;day.starPaid=false;}
 }
 else {
  const previous=!!day.tasks[key];value=!!value;
  if(previous===value)return false;
  day.tasks[key]=value;
  if(key==='workout'&&!value)day.workoutRest=false;
  if(value){if(!day.claimed.includes(key))day.claimed.push(key);if(!day.coinActive[key]){state.coins++;day.coinActive[key]=true;}if(!day.xpActive[key]){state.xp++;day.xpActive[key]=true;}}
  else {state.xp--;state.coins--;day.xpActive[key]=false;day.coinActive[key]=false;}
 }
 const perfect=day.star&&keys.every(k=>day.tasks[k]);
 if(!perfect&&day.bonusClaimed){state.xp-=day.bonusAmount;state.coins-=day.bonusAmount;day.bonusClaimed=false;}
 if(perfect&&!day.bonusClaimed){day.bonusClaimed=true;day.bonusAmount=day.bonusAmount||12;state.xp+=day.bonusAmount;state.coins+=day.bonusAmount;}
 return true;
}
function weekStart(date){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function weeklyRests(state,date){const week=weekStart(date);return Object.entries(state.calendar).filter(([key,day])=>day.workoutRest&&day.tasks?.workout&&weekStart(key)===week).length;}
function restWorkout(state,date){if(state.battle||!editableDate(date)||state.calendar[date]?.tasks?.workout||weeklyRests(state,date)>=2)return false;if(!task(state,date,'workout',true))return false;state.calendar[date].workoutRest=true;return true;}
function newMonHistory(origin='unknown',legacy=false){return {victories:0,knockouts:0,expeditions:0,trackedFrom:today(),partial:legacy,obtainedOn:legacy?null:today(),capturedOn:origin==='capture'?today():null,origin};}
function ensureMonHistory(mon){return mon.history??=newMonHistory('unknown',true);}
function prepareHistory(state){for(const m of state.owned)ensureMonHistory(m);const b=state.battle;if(b&&b.historyRevision!==1){b.historyRevision=1;b.historyKOs={};b.historyAppliedKOs={};b.historyVictoryApplied=!!b.done;}}
function syncMonHistory(state,b){
 if(!b||!['career','boss','wild','suburb','tournament'].includes(b.mode)||b.historyRevision!==1)return;
 b.historyAppliedKOs??={};
 for(const [id,total] of Object.entries(b.historyKOs||{})){const m=state.owned.find(x=>x.uid===id),delta=total-(b.historyAppliedKOs[id]||0);if(m&&Number.isSafeInteger(delta)&&delta>0)ensureMonHistory(m).knockouts+=delta;b.historyAppliedKOs[id]=total;}
 if(b.done&&!b.historyVictoryApplied){b.historyVictoryApplied=true;if(b.result==='win'&&!b.settled)for(const id of new Set(b.player.map(m=>m.uid))){const m=state.owned.find(m=>m.uid===id);if(m)ensureMonHistory(m).victories++;}}
}
function healthColor(hp,max){const p=max>0?Math.max(0,Math.min(100,hp/max*100)):0;return p>75?'#39a95b':p>50?'#e3bd32':p>25?'#ed842f':'#de424c';}
function effectiveness(actor,target,move=null){if(move&&(move.kind!=='attack'||move.fraction))return 1;const type=byId[actor.species].type;if(advantage(type,byId[target.species].type)!==2)return 1;return move&&move.type===type&&move.type!=='Normal'?3:2;}
function combatMon(mon){const c=clone(mon);restoreCopiedMoves(c);c.stats=equippedStats(c);c.hp=c.stats.hp;c.pp=Object.fromEntries(c.moves.map(id=>[id,byMove[id].pp]));c.ppSpent={};c.status={};c.blocked=[];c.blockTargets=[];c.koAwarded=false;return c;}
function restoreCopiedMoves(m){if(m.originalMoves){m.moves=m.originalMoves;const pp={...m.pp};for(const id of m.moves)pp[id]=m.originalPP?.[id]??m.pp?.[id]??byMove[id].pp;m.pp=pp;delete m.originalMoves;delete m.originalPP;}delete m.ppSpent;}
function normalizeCloudPP(m,legacy=false){if(m.moves?.includes('cloud')&&m.pp){const pp=m.pp.cloud||0;m.pp.cloud=legacy?(pp>=10&&!m.status?.cloud?1:0):Math.min(1,Math.max(0,pp));}}
function upgradeBattle(b){if(!Array.isArray(b.logRounds)||b.logRounds.length!==b.logs.length)b.logRounds=b.logs.map(()=>-1);const changed=b.cloudRevision!==1;if(changed){for(const m of [...b.player,...b.enemy])normalizeCloudPP(m,true);b.cloudRevision=1;}if(b.rulesVersion===2){if(changed&&!b.done)resolve(b);return;}for(const m of [...b.player,...b.enemy]){for(const id of m.moves)if(byMove[id]?.kind==='attack')m.pp[id]=Math.min(byMove[id].pp,(m.pp[id]||0)+10);delete m.pp.struggle;}b.rulesVersion=2;delete b.events;if(!b.done)resolve(b);}
function enemyMon(id,level){const m=createMon(id,level);if(byId[id].rarity!=='Lendário')m.moves=enemyMoves(byId[id].type,m.level);return m;}
function createBattle(mode,player,enemies,options={}){if(['boss','career','tournament','rematch'].includes(mode)&&root.FMX.enemyEquipment)enemies=enemies.map(m=>({...m,stone:m.stone||root.FMX.enemyEquipment(m.level)}));const b={mode,player:player.map(combatMon),enemy:enemies.map(combatMon),pi:0,ei:0,round:0,logs:['O encontro começou. Escolha seu movimento!'],logRounds:[0],done:false,result:null,forcePlayer:false,rulesVersion:2,abilityRevision:3,sideEffects:{player:{},enemy:{}},cloudRevision:1,historyRevision:1,historyKOs:{},historyAppliedKOs:{},historyVictoryApplied:false,...options};resolve(b);return b;}
function log(b,s){b.logRounds??=b.logs.map(()=>-1);b.logs.push(s);b.logRounds.push(b.round||0);if(b.logs.length>60){b.logs=b.logs.slice(-60);b.logRounds=b.logRounds.slice(-60);}}
// Frames contain no event queue, so recorded animations cannot grow recursively.
function frame(b){return clone({mode:b.mode,title:b.title,player:b.player,enemy:b.enemy,pi:b.pi,ei:b.ei,round:b.round,sideEffects:b.sideEffects,roundInProgress:!!b.roundInProgress,actionSerial:b.actionSerial||0,logs:b.logs,logRounds:b.logRounds,done:b.done,result:b.result,forcePlayer:b.forcePlayer});}
function event(b,data){(b.events??=[]).push({...data,frame:frame(b)});}
function coin(b,m,label){const heads=Math.random()<.5;event(b,{kind:'coin',heads,label,actor:name(m)});log(b,`${name(m)} · ${label}: ${heads?'cara':'coroa'}.`);return heads;}
const name=m=>byId[m.species].name;
const active=(b,side)=>b[side][side==='player'?b.pi:b.ei];
const alive=(b,side)=>b[side].map((m,i)=>({m,i})).filter(x=>x.m.hp>0);
function benchCount(b,side='enemy'){const index=side==='player'?b.pi:b.ei;return Math.min(5,b[side].filter((m,i)=>i!==index&&m.hp>0).length);}
const other=s=>s==='player'?'enemy':'player';
// Each action commits before the next begins. Defenses store their activation
// boundary as well as their expiry, including across saved battles.
function defenseActive(b,m,key){const start=m.status.defenseStarts?.[key];return m.status[key]>=b.round&&(!start||b.round>start.round||b.round===start.round&&(b.actionSerial||0)>=start.action);}
function defenseCounters(m,b){
 if(m.hp<=0)return [];
 const counters=[],round=b.round+(b.roundInProgress?0:1);
 for(const key of ['flame','flight','reflect']){
  const start=m.status.defenseStarts?.[key],first=Math.max(round,start?.round||0),remaining=m.status[key]-first+1;
  if(remaining>0)counters.push({key,label:byMove[key].name,remaining,unit:'rodadas',prepared:!defenseActive(b,m,key)});
 }
 if(m.status.shield?.hits>0)counters.push({key:'shield',label:m.status.shield.factor===.5?'Barreira de fogo':'Proteção',remaining:m.status.shield.hits,unit:'ataques',prepared:(m.status.shield.afterAction||0)>(b.actionSerial||0)});
 return counters;
}
function activateDefense(b,m,key,duration,nextRound=false){
 const alreadyActive=defenseActive(b,m,key);
 const start={round:b.round+(nextRound?1:0),action:nextRound?0:(b.actionSerial||0)+1};
 m.status.defenseStarts??={};
 if(!alreadyActive)m.status.defenseStarts[key]=start;
 // Acting first protects against the remaining action now; acting second
 // starts counting the two protected rounds from the following round.
 m.status[key]=nextRound?b.round+duration:b.round+duration-(b.actionIndex===0?1:0);
 log(b,`${name(m)} preparou ${byMove[key].name}: ${nextRound?'a partir da próxima rodada':'somente contra ataques posteriores'}, até a rodada ${m.status[key]}.`);
}
function speed(m,round){return m.stats.speed*(m.status.speed||1)*(m.status.fry>=round?2:1);}
function advantage(type,target){return {Elétrico:'Água',Água:'Fogo',Fogo:'Planta',Planta:'Elétrico',Angelical:'Escuridão',Escuridão:'Psíquico',Psíquico:'Angelical'}[type]===target?2:1;}
function heal(b,m,hp){if(m.hp<=0)return;let n=Math.min(m.stats.hp-m.hp,Math.round(hp));if(n>0){event(b,{kind:'heal',amount:n,actor:name(m),side:b.player.includes(m)?'player':'enemy'});m.hp+=n;log(b,`${name(m)} recuperou ${n} HP.`);}}
function damage(b,target,amount,reason,sourceUid=null){const dealt=Math.min(target.hp,Math.max(0,Math.floor(amount)));if(dealt>0){const side=b.player.includes(target)?'player':'enemy';event(b,{kind:'damage',side,targetUid:target.uid,actor:name(target),before:target.hp,after:target.hp-dealt,maxHP:target.stats.hp,amount:dealt,reason});target.hp-=dealt;if(target.hp===0)event(b,{kind:'faint',side,targetUid:target.uid,actor:name(target)});if(b.enemy.includes(target)&&b.player.some(m=>m.uid===sourceUid)){b.lastPlayerDamageUid=sourceUid;if(target.hp===0&&b.historyRevision===1){b.historyKOs??={};b.historyKOs[sourceUid]=(b.historyKOs[sourceUid]||0)+1;}}}return dealt;}
function hit(b,actor,target,amount,attack=true,reason='Efeito contínuo',sourceUid=attack?actor.uid:null){if(target.hp<=0)return 0;amount=Math.max(0,Math.floor(amount));const targetSide=b.player.includes(target)?'player':'enemy';if(attack&&defenseActive(b,target,'flight')){event(b,{kind:'defense',side:targetSide,actor:name(target),defense:byMove.flight.name,mode:'block',detail:'Dano bloqueado'});log(b,`${name(target)} está protegido pelo Voo seguro.`);return 0;}if(attack&&defenseActive(b,target,'reflect')){event(b,{kind:'defense',side:targetSide,actor:name(target),defense:byMove.reflect.name,mode:'reflect',detail:'Ataque refletido'});const reflected=damage(b,actor,amount*2,'Reflexão',target.uid);log(b,`${name(target)} refletiu ${reflected} de dano!`);return 0;}if(attack&&target.status.shield?.hits>0&&(target.status.shield.afterAction??0)<=(b.actionSerial||0)){const original=amount,label=target.status.shield.factor===.5?'Barreira de fogo':'Proteção';amount=Math.floor(amount*target.status.shield.factor);event(b,{kind:'defense',side:targetSide,actor:name(target),defense:label,mode:'reduce',detail:`Dano reduzido de ${original} para ${amount}`});target.status.shield.hits--;}
 const dealt=damage(b,target,amount,attack?'Ataque':reason,sourceUid);if(dealt)log(b,`${name(target)} perdeu ${dealt} HP${attack?'':` por ${reason}`}.`);
 if(attack&&dealt&&defenseActive(b,target,'flame')){event(b,{kind:'defense',side:targetSide,actor:name(target),defense:byMove.flame.name,mode:'reflect',detail:'Contra-ataque defensivo'});const reflected=damage(b,actor,Math.round(target.stats.atk*.6),'Labareda incendiária',target.uid);log(b,`Labareda já ativa devolveu ${reflected} de dano.`);}return dealt;
}
function hasControl(m){return !!(m.status.paralysis||m.status.sleep||m.status.confusion);}
function applyControl(b,m,kind,duration){const immune={paralysis:'immune',sleep:'sleepImmune',confusion:'confusionImmune'}[kind];if(m.status[immune]>=b.round){log(b,`${name(m)} está imune a esse efeito.`);return;}if(hasControl(m)){log(b,`${name(m)} já possui uma condição de controle.`);return;}m.status[kind]=duration;if(kind==='sleep')m.status.sleepEnd=b.round+(b.actionIndex===0?1:2);log(b,`${name(m)} ${kind==='sleep'?'adormeceu':kind==='confusion'?'ficou confuso':'ficou paralisado'}!`);}
function paralyze(b,m,duration=999){applyControl(b,m,'paralysis',duration);}
function restoreControl(b,m){delete m.status.paralysis;delete m.status.flinch;m.status.immune=b.round+3;log(b,`${name(m)} recuperou o controle. Imunidade por 3 rodadas.`);}
function mayAct(b,m){
 let allowed=true;
 if(m.status.paralysis){if(coin(b,m,'Sair da paralisia'))restoreControl(b,m);else {m.status.paralysis--;allowed=false;log(b,`${name(m)} não conseguiu agir.`);if(!m.status.paralysis)restoreControl(b,m);}}
 else if(m.status.sleep){if(coin(b,m,'Acordar do sono')){delete m.status.sleep;delete m.status.sleepEnd;m.status.sleepImmune=b.round+3;log(b,`${name(m)} acordou e pode agir.`);}else {m.status.sleep--;allowed=false;log(b,`${name(m)} continua dormindo.`);if(!m.status.sleep){delete m.status.sleep;delete m.status.sleepEnd;m.status.sleepImmune=b.round+3;}}}
 else if(m.status.confusion){delete m.status.confusion;m.status.confusionImmune=b.round+3;if(!coin(b,m,'Sair da confusão')){damage(b,m,m.stats.hp*.1,'Confusão');allowed=false;log(b,`${name(m)} se feriu em vez de agir.`);}}
 if(m.status.flinch){restoreControl(b,m);allowed=false;}
 if(m.status.rest){m.status.rest=Math.max(0,Number(m.status.rest)-1);if(!m.status.rest)delete m.status.switchLocked;log(b,`${name(m)} precisa descansar.`);return false;}
 return allowed;
}
function canSwitch(mon){return !mon.status?.switchLocked||!mon.status.rest||mon.hp<=0;}
function targetMoves(b,side,move,m=active(b,side),foe=active(b,other(side))){
 return foe.moves.filter(id=>byMove[id]&&(move.effect==='copy'?id!=='psychicshadow'&&!m.moves.includes(id)&&(foe.pp[id]||0)>0:!foe.blocked.includes(id)&&byMove[id].kind===move.targetKind));
}
function attackUsesRemaining(mon){return mon.moves.filter(id=>byMove[id]?.kind==='attack').reduce((total,id)=>total+Math.max(0,mon.pp[id]||0),0);}
function moveUsesRemaining(mon){return mon.moves.reduce((total,id)=>total+(byMove[id]?Math.max(0,mon.pp[id]||0):0),0);}
function usableFor(b,side,m){const foes=alive(b,other(side));return m.moves.filter(id=>m.pp[id]>0&&!m.blocked.includes(id)&&!(byMove[id].teamLimit&&b.sideEffects?.[side]?.used?.[id])&&(!['block','copy'].includes(byMove[id].effect)||foes.some(x=>targetMoves(b,side,byMove[id],m,x.m).length)));}
function usable(b,side){const m=active(b,side);return usableFor(b,side,m).filter(id=>!['block','copy'].includes(byMove[id].effect)||targetMoves(b,side,byMove[id]).length);}
function ineffectiveReason(b,side,id){const move=byMove[id];if(move?.effect==='portal'&&(alive(b,side).length<2||!canSwitch(active(b,side))))return 'Sem outro Mon disponível para trocar.';if(move?.effect==='force'&&(alive(b,other(side)).length<2||!canSwitch(active(b,other(side)))))return 'O adversário não pode ser trocado nesta rodada.';return '';}
function resolveStalemate(b){
 if(b.done)return;
 if(['player','enemy'].every(side=>!alive(b,side).some(x=>usableFor(b,side,x.m).length))){b.done=true;b.result='draw';b.forcePlayer=false;log(b,'Empate: as duas equipes ficaram sem movimentos possíveis. Usos bloqueados não são consumidos.');}
}
function conditions(mon,round,b=null){const s=mon.status||{},result=[];if(mon.hp<=0)return result;const side=b?.player.includes(mon)?'player':'enemy',isActive=b&&active(b,side)===mon,effects=isActive?b.sideEffects?.[side]:null;if(s.burn?.end>=round)result.push({code:'QUE',label:'Queimado'});if(s.paralysis>0)result.push({code:'PAR',label:'Paralisado'});if(s.sleep)result.push({code:'SON',label:'Dormindo'});if(s.confusion)result.push({code:'CONF',label:'Confuso'});if(s.seed||effects?.seed)result.push({code:'ENV',label:'Envenenado · Semente venenosa'});if(effects?.cloud)result.push({code:'+',label:'Nuvem dourada · cura contínua'});if(s.rest)result.push({code:'DES',label:`Descansando · ${Number(s.rest)} rodada(s)`});return result;}
function ai(b){const m=active(b,'enemy');if(m.status.rest)return {pass:true};const all=usable(b,'enemy'),effective=all.filter(id=>!ineffectiveReason(b,'enemy',id)),list=effective.length?effective:all;if(!list.length){const reserve=alive(b,'enemy').find(x=>x.m!==m&&usableFor(b,'enemy',x.m).length);return reserve&&canSwitch(m)?{switch:reserve.i}:{pass:true};}const healMove=list.find(id=>['heal','portal'].includes(byMove[id].effect));if(m.hp<m.stats.hp*.4&&healMove)return {move:healMove};const attacks=list.filter(id=>byMove[id].kind==='attack');return {move:attacks.length&&Math.random()<.8?pick(attacks):pick(list)};}
function use(b,side,action){let actor=active(b,side),foe=active(b,other(side)),team=b[side];if(actor.hp<=0)return;
 if(action.switch!==undefined){const idx=action.switch;if(!team[idx]||team[idx].hp<=0||team[idx]===actor||!canSwitch(actor))return;b[side==='player'?'pi':'ei']=idx;log(b,`${name(actor)} voltou. ${name(team[idx])}, vai!`);return;}
 if(action.pass){if(!usable(b,side).length||actor.status.rest){mayAct(b,actor);log(b,`${name(actor)} aguardou esta rodada.`);}return;}
 const move=byMove[action.move];if(!move||!usable(b,side).includes(move.id))return;
 if(['block','copy'].includes(move.effect)&&action.targetMove!==undefined&&!targetMoves(b,side,move).includes(action.targetMove))return;
 if(!mayAct(b,actor))return;actor.pp[move.id]--;actor.ppSpent??={};actor.ppSpent[move.id]=(actor.ppSpent[move.id]||0)+1;
 if(actor.originalMoves?.includes(move.id))actor.originalPP[move.id]=actor.pp[move.id];
 log(b,`${name(actor)} usou ${move.name}!`);
 b.sideEffects??={player:{},enemy:{}};const sideEffects=b.sideEffects[side];
 if(move.teamLimit){sideEffects.used??={};sideEffects.used[move.id]=true;for(const m of team)if(m.pp[move.id]!==undefined)m.pp[move.id]=0;}
 const st=actor.status,enemySide=other(side);
 if(move.kind==='skill')event(b,{kind:'skill',side,actor:name(actor),move:move.name,type:move.type});
 const ineffective=ineffectiveReason(b,side,move.id);if(ineffective){log(b,ineffective+' Um uso foi gasto, sem efeito.');return;}
 switch(move.effect){
 case 'speed': st.speed=(st.speed||1)*1.5;break;
 case 'slow':foe.status.speed=(foe.status.speed||1)*.5;break;
 case 'shield':st.shield={hits:2,factor:move.factor,afterAction:(b.actionSerial||0)+1};log(b,`${move.name} preparada para os próximos 2 ataques recebidos após esta ação.`);break;
 case 'paralyze':if(!move.chance||coin(b,actor,move.name))paralyze(b,foe,move.duration);else log(b,'A moeda não favoreceu o movimento.');break;
 case 'sleep':applyControl(b,foe,'sleep',2);break;
 case 'confuse':applyControl(b,foe,'confusion',1);break;
 case 'charge':st.charge=true;break;
 case 'fry':st.fry=b.round+4;break;
 case 'hydro':st.hydro=b.round+3;break;
 case 'heal':heal(b,actor,move.percent?actor.stats.hp*move.percent:actor.stats.atk*move.power);break;
 case 'teamheal':team.filter(m=>m.hp>0).forEach(m=>heal(b,m,m.stats.hp*.15));break;
 case 'burn':foe.status.burn={damage:actor.stats.atk*.4,end:b.round+3,sourceUid:actor.uid};break;
 case 'seed':b.sideEffects[enemySide].seed={damage:actor.stats.atk*.2,sourceUid:actor.uid};break;
 case 'flame':activateDefense(b,actor,'flame',2);break;
 case 'flight':activateDefense(b,actor,'flight',2);break;
 case 'reflect':activateDefense(b,actor,'reflect',1,true);break;
 case 'cloud':sideEffects.cloud={starts:b.round+1};break;
 case 'block':{const id=action.targetMove||targetMoves(b,side,move)[0];if(id){foe.blocked.push(id);log(b,`${byMove[id].name} foi bloqueado até o fim da batalha.`);}break;}
 case 'copy':{const id=action.targetMove||pick(targetMoves(b,side,move));if(id){actor.originalMoves??=[...actor.moves];actor.originalPP??={...actor.pp};const remaining=Math.max(0,byMove[id].pp-(actor.ppSpent[id]||0));actor.moves[actor.moves.indexOf(move.id)]=id;actor.pp[id]=Math.min(foe.pp[id],remaining,actor.pp[id]??Infinity);if(byMove[id].teamLimit&&sideEffects.used?.[id])actor.pp[id]=0;log(b,`${name(actor)} copiou ${byMove[id].name} com ${actor.pp[id]} usos.`);}break;}
 case 'force':{const options=alive(b,enemySide).filter(x=>x.m!==foe);if(options.length){if(side==='enemy'&&!move.choose){b.forcePlayer=true;log(b,'Escolha um Mon para entrar.');}else {let selected=options.find(x=>x.i===action.target)??pick(options);b[enemySide==='player'?'pi':'ei']=selected.i;log(b,`${name(selected.m)} foi trazido à batalha.`);}}break;}
 case 'portal':{const options=alive(b,side).filter(x=>x.m!==actor);if(options.length){let selected=options.find(x=>x.i===action.target)??pick(options);heal(b,actor,actor.stats.hp*.35);heal(b,selected.m,selected.m.stats.hp*.35);b[side==='player'?'pi':'ei']=selected.i;log(b,`${name(selected.m)} atravessou o portal.`);}break;}
 case 'damage':{
  let power=move.coins?move.coins[coin(b,actor,move.name)?1:0]:move.power;if(move.tosses){let heads=0;for(let i=0;i<move.tosses;i++)if(coin(b,actor,`${move.name} · moeda ${i+1}/${move.tosses}`))heads++;power*=heads;log(b,`${heads} de ${move.tosses} moedas deram cara.`);}
  const applyParalysis=move.paralysis&&coin(b,actor,move.name),applySleep=move.sleep&&coin(b,actor,move.name),applyRecoil=move.recoil&&!coin(b,actor,move.name);
  const crit=Math.random()<Math.min(1,(move.crit||0)+(root.FMX.items?.find(x=>x.id===actor.stone&&x.stat==='crit')?.value||0));if(crit)log(b,'Acerto crítico!');const mult=(crit?2:1)*(st.charge?2:1)*(st.hydro>=b.round?1.5:1);delete st.charge;
  event(b,{kind:'attack',side,actor:name(actor),move:move.name,type:move.type,critical:crit});
  const targets=move.all?b[enemySide].filter(m=>m.hp>0):[foe];let total=0;
  // Species advantage gives 2x; a matching elemental attack gives 3x total.
  // Percentage attacks are exempt; area attacks evaluate each target separately.
  for(const t of targets){const adv=effectiveness(actor,t,move);if(adv>1)log(b,'É super eficaz!');let dmg=move.fraction?t.hp*move.fraction:actor.stats.atk*power;total+=hit(b,actor,t,dmg*mult*adv);}
  if(move.drain)heal(b,actor,total*.5);if(applyParalysis&&foe.hp>0)paralyze(b,foe);
  if(applySleep&&foe.hp>0)applyControl(b,foe,'sleep',2);
  if(applyRecoil){const recoil=damage(b,actor,actor.stats.atk*3*.5,'Recuo');log(b,`${name(actor)} sofreu ${recoil} de recuo.`);}break;
 }}
 if(move.rest){st.rest=Number(move.rest);if(move.lockSwitch)st.switchLocked=true;}
}
function resolve(b){
 b.xpAwards??=[];
 for(const m of [...b.player,...b.enemy])if(m.hp>0&&moveUsesRemaining(m)===0){damage(b,m,m.hp,'Todos os movimentos esgotados');m.exhausted=true;log(b,`${name(m)} esgotou os usos de todos os ataques e habilidades e foi derrotado.`);}
 for(const m of b.enemy)if(m.hp<=0&&!m.koAwarded){m.koAwarded=true;const winner=active(b,'player');if(b.mode==='wild')b.xpAwards.push(winner.uid);log(b,`${name(m)} foi derrotado!`);}
 const p=alive(b,'player'),e=alive(b,'enemy');if(!p.length||!e.length){b.done=true;b.result=!p.length&&!e.length?'draw':p.length?'win':'loss';log(b,b.result==='win'?'Vitória!':b.result==='draw'?'Empate.':'Sua equipe foi derrotada.');return;}
 if(active(b,'enemy').hp<=0){b.ei=e[0].i;log(b,`O adversário enviou ${name(e[0].m)}.`);}
 if(active(b,'player').hp<=0)b.forcePlayer=true;
}
function turn(b,action){if(b.done||b.forcePlayer)return b;b.events=[];b.xpAwards??=[];resolve(b);resolveStalemate(b);if(b.done||b.forcePlayer)return b;
 if(action.switch!==undefined){if(action.switch===b.pi||!b.player[action.switch]||b.player[action.switch].hp<=0||!canSwitch(active(b,'player')))return b;}
 else if(action.pass){if(usable(b,'player').length&&!active(b,'player').status.rest)return b;}
 else if(!usable(b,'player').includes(action.move))return b;
 else if(['block','copy'].includes(byMove[action.move].effect)&&action.targetMove!==undefined&&!targetMoves(b,'player',byMove[action.move]).includes(action.targetMove))return b;
 b.round++;b.roundInProgress=true;const enemyAction=ai(b),pUid=active(b,'player').uid,eUid=active(b,'enemy').uid;
 const speeds={player:speed(active(b,'player'),b.round),enemy:speed(active(b,'enemy'),b.round)};
 const order=action.switch!==undefined||speeds.player>=speeds.enemy?['player','enemy']:['enemy','player'];
 event(b,{kind:'order',speeds,first:order[0],actor:name(active(b,order[0])),switching:action.switch!==undefined});
 for(const [index,side] of order.entries()){if(b.done)break;const original=side==='player'?pUid:eUid;if(active(b,side).uid!==original)continue;if(side==='player'&&b.forcePlayer)continue;b.actionIndex=index;b.actionSerial=(b.actionSerial||0)+1;use(b,side,side==='player'?action:enemyAction);resolve(b);event(b,{kind:'step'});}
 delete b.actionIndex;
 if(!b.done){for(const side of ['player','enemy']){const m=active(b,side),effects=b.sideEffects?.[side];if(m.hp<=0)continue;if(m.status.burn?.end>=b.round)hit(b,m,m,m.status.burn.damage,false,'Queimadura (Fagulha fervente)',m.status.burn.sourceUid);if(effects?.seed)hit(b,m,m,effects.seed.damage,false,'Semente venenosa',effects.seed.sourceUid);if(m.status.seed)hit(b,m,m,m.status.seed,false,'Semente venenosa',m.status.seedSourceUid);if((effects?.cloud?.starts<=b.round||m.status.cloud<=b.round)&&m.hp>0)heal(b,m,m.stats.hp*.05);}for(const m of [...b.player,...b.enemy])if(m.status.burn?.end<=b.round)delete m.status.burn;resolve(b);resolveStalemate(b);}
 for(const m of [...b.player,...b.enemy])if(m.status.sleep&&m.status.sleepEnd<=b.round){delete m.status.sleep;delete m.status.sleepEnd;m.status.sleepImmune=b.round+3;log(b,`${name(m)} acordou após o limite de duas rodadas.`);}
 delete b.roundInProgress;return b;
}
function forceSwitch(b,index){if(!b.forcePlayer||b.done||index===b.pi||!b.player[index]||b.player[index].hp<=0)return false;b.pi=index;b.forcePlayer=false;log(b,`${name(active(b,'player'))} entrou em campo.`);return true;}
function capture(b){const foe=active(b,'enemy');if(b.mode!=='wild'||b.done||b.forcePlayer||foe.hp<=0||foe.hp>=foe.stats.hp*.1)return null;b.done=true;b.result='capture';log(b,`${name(foe)} foi capturado!`);const m=clone(foe);restoreCopiedMoves(m);m.history=newMonHistory('capture');for(const k of ['hp','pp','status','stats','blocked','blockTargets','koAwarded'])delete m[k];return m;}
// Also used by migration and regression tests.
root.FMX_EXT={weekStart,weeklyRests,restWorkout,canSwitch,targetMoves,restoreCopiedMoves};
root.FMX={D,byId,newMonHistory,ensureMonHistory,prepareHistory,syncMonHistory,healthColor,effectiveness,config,requiredGrunts,careerReward,careerAvailable,grantTeamXP,attackUsesRemaining,moveUsesRemaining,enemyMoves,growthNext,conditions,ineffectiveReason,resolveStalemate,moves,byMove,stats,equippedStats,combatMon,available,createMon,enemyMon,grantXP,canEvolve,newSave,addOwned,removeOwned,task,createBattle,turn,forceSwitch,capture,active,alive,usable,today,clone,pick,shuffle,uid,resolve,frame,upgradeBattle,normalizeCloudPP,lifetimeXP,overall,overallScore,serial,normalizeOwnership,saleBase,saleValue,sell,strongest,yesterday,editableDate,fall,wildRarity,wildEncounter,benchCount,defenseActive,defenseCounters};
Object.assign(root.FMX,root.FMX_EXT);delete root.FMX_EXT;
})(typeof window==='undefined'?globalThis:window);
