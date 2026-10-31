/* v1.1 learning tickets and one-time compatibility for existing saves. */
(function(E){
const legendary=m=>E.byId[m.species]?.rarity==='Lendário';
E.moveSlots=m=>legendary(m)?6:4;
E.learningQueue=m=>{
 if(!Array.isArray(m.learnChoices)||m.learnChoices.length!==m.pending)m.learnChoices=Array(Math.max(0,m.pending||0)).fill('element');
 return m.learnChoices;
};
E.learnOptions=m=>legendary(m)?[]:(E.learningQueue(m).includes('any')?E.moves:E.available(E.byId[m.species].type));
E.learnMove=(m,id,index)=>{
 if(!m.pending||m.moves.includes(id)||!E.learnOptions(m).some(x=>x.id===id))return false;
 if(m.moves.length<E.moveSlots(m))m.moves.push(id);
 else {if(!Number.isInteger(index)||index<0||index>=m.moves.length)return false;m.moves[index]=id;}
 const special=m.learnChoices.indexOf('any');m.learnChoices.splice(special<0?0:special,1);m.pending--;return true;
};
E.migrateRules=s=>{
 let changed=false;
 const normalize=m=>{
  if(!m||!E.byId[m.species])return;
  if(m.pp)for(const [id,oldMax] of [['hydrate',3],['lightheal',5]])if(m.pp[id]!==undefined)m.pp[id]=Math.max(0,2-Math.max(0,oldMax-m.pp[id]));
  if(m.originalPP)for(const [id,oldMax] of [['hydrate',3],['lightheal',5]])if(m.originalPP[id]!==undefined)m.originalPP[id]=Math.max(0,2-Math.max(0,oldMax-m.originalPP[id]));
  if(legendary(m)){
   const arsenal=E.moves.filter(a=>a.type===E.byId[m.species].type).map(a=>a.id);
   const pp=m.pp;
   m.moves=arsenal;m.pending=0;m.learnChoices=[];
   if(pp)m.pp=Object.fromEntries(arsenal.map(id=>[id,pp[id]??E.byMove[id].pp]));
   if(m.originalMoves){m.originalMoves=[...arsenal];m.originalPP={...m.pp};}
  }else if(m.pending!==undefined)E.learningQueue(m);
 };
 if(s.rulesV11!==1){
  for(const m of s.owned||[])normalize(m);
  for(const m of [...(s.battle?.player||[]),...(s.battle?.enemy||[]),...(s.tournament?.members||[]),...(s.tournament?.opponents||[]).flat()])normalize(m);
  // A team-limited effect already used remains exhausted, including newly filled slots.
  for(const side of ['player','enemy'])for(const m of s.battle?.[side]||[])for(const id of ['seed','cloud'])if(s.battle.sideEffects?.[side]?.used?.[id]&&id in m.pp)m.pp[id]=0;
  s.rulesV11=1;changed=true;
 }
 if(s.dragonMovesRevision!==1){
  const limits={dragonclaw:4,dive:10,tail:10},adjust=pp=>{if(!pp)return;for(const [id,max] of Object.entries(limits))if(pp[id]!==undefined)pp[id]=Math.max(0,max-Math.max(0,20-pp[id]));};
  for(const m of [...(s.battle?.player||[]),...(s.battle?.enemy||[]),...(s.tournament?.members||[]),...(s.tournament?.opponents||[]).flat()]){adjust(m.pp);adjust(m.originalPP);}
  s.dragonMovesRevision=1;changed=true;
 }
 return changed;
};
})(window.FMX);
