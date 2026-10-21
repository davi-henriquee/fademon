/* Catalog migration is deterministic, name-mapped and safe to repeat.
   No ownership, currency, equipment, history or reward is created here. */
(function(E){
'use strict';
function migrateCatalog(s){
 if(s.catalogRevision===3)return false;
 if(s.catalogRevision>3)throw Error('Este save pertence a uma versão mais nova.');
 if(s.version!==1||!Array.isArray(s.owned)||!Array.isArray(s.discovered))throw Error('Save inválido para conversão.');
 const remap=id=>{const mapped=E.D.legacySpecies[id];if(!mapped||!E.byId[mapped])throw Error(`Espécie antiga sem correspondência: ${id}`);return mapped;};
 const migrateMon=(m,recalculate=true)=>{
  m.species=remap(m.species);
  const d=E.byId[m.species],oldLevel=m.level,oldHP=m.stats?.hp,ratio=oldHP>0?m.hp/oldHP:0;
  if(!Number.isInteger(oldLevel)||oldLevel<1||oldLevel>100||!Number.isInteger(m.xp??0)||(m.xp??0)<0)throw Error('Nível/XP inválido no save.');
  if(m.totalXP===undefined)m.totalXP=d.rarity==='Lendário'?0:(oldLevel-1)*(oldLevel+8)/2+(m.xp||0);
  if(!Number.isSafeInteger(m.totalXP)||m.totalXP<0)throw Error('XP vitalício inválido.');
  if(d.rarity==='Lendário'){m.level=100;m.xp=0;}
  else if(recalculate){
   let remaining=m.totalXP,level=1;while(level<100&&remaining>=level+4){remaining-=level+4;level++;}
   m.level=level;m.xp=level===100?0:remaining;
   // Preserve already learned moves; only add a choice if a missing level is recovered.
   m.pending=(m.pending||0)+Math.max(0,Math.floor(level/5)-Math.floor(oldLevel/5));
  }
  if(m.stats){m.stats=E.equippedStats(m);m.hp=Math.min(m.stats.hp,Math.max(0,Math.ceil(ratio*m.stats.hp)));}
  if(m.pp){
   const oldLimits={fruit:2,hyper:1,gale:1,cloud:1};
   for(const id of m.moves){const move=E.byMove[id];if(!move)throw Error('Movimento desconhecido: '+id);const oldMax=oldLimits[id]??(move.kind==='attack'?20:10),spent=Math.max(0,oldMax-(m.pp[id]||0));m.pp[id]=Math.max(0,({hydrate:3,lightheal:5}[id]??move.pp)-spent);}
  }
  if(m.status?.rest===true)m.status.rest=1;
 };
 // Work on a copy so a missing correspondence never partially mutates the input.
 const result=E.clone(s);
 for(const m of result.owned)migrateMon(m);
 result.discovered=[...new Set(result.discovered.map(remap))];
 for(const entries of Object.values(result.bossMoves||{}))for(const m of entries)m.species=remap(m.species);
 if(result.tournament){
  for(const m of result.tournament.members)migrateMon(m);
  for(const m of result.tournament.opponents.flat())migrateMon(m,false);
 }
 if(result.battle){
  const b=result.battle;
  for(const side of ['player','enemy'])for(const m of b[side])migrateMon(m,side==='player');
  b.sideEffects={player:{},enemy:{}};
  for(const side of ['player','enemy'])for(const m of b[side]){
   if(m.status.cloud){b.sideEffects[side].cloud={starts:m.status.cloud};b.sideEffects[side].used={...b.sideEffects[side].used,cloud:true};delete m.status.cloud;}
   if(m.status.seed){b.sideEffects[side].seed={damage:m.status.seed,sourceUid:m.status.seedSourceUid};const other=side==='player'?'enemy':'player';b.sideEffects[other].used={...b.sideEffects[other].used,seed:true};delete m.status.seed;delete m.status.seedSourceUid;}
  }
  for(const side of ['player','enemy'])for(const m of b[side])for(const id of ['seed','cloud'])if(b.sideEffects[side].used?.[id]&&m.pp[id]!==undefined)m.pp[id]=0;
  b.abilityRevision=3;delete b.events;
 }
 result.catalogRevision=3;
 Object.assign(s,result);
 return true;
}
E.migrateCatalog=migrateCatalog;
})(window.FMX);
