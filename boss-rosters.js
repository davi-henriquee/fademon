/* Fixed, varied teams. Species IDs stay unchanged; no ownership migration. */
(function(D){
const teams=[
 ['Zunico','Marulino','Vulcarume','Camarol','Serafiz','Mentim'],
 ['Faíxim','Gotilho','Fagulino','Brotico','Trapiu','Natu'],
 ['Voltagrão','Wartortle','Faguraz','Ramaflor','Kirlia','Onirante'],
 ['Fulguravis','Hidrogálio','Furagante','Florastelo','Luminúmbra','Oramentis'],
 ['Gyrados','Zebstrika','Ninetales','Lianara','Togekiss','Mantalma'],
 ['Raizelo','Blastoise','Fulgoraz','Torcoal','Celestárion','Dusknoir'],
 ['Gengar','Empíreus','Electrode','Chamarro','Xatu','Dragapult'],
 ['Salamence','Luxray','Arcanine','Maremundo','Sceptile','Hypno'],
 ['Garchomp','Escamarca','Swampert','Leafon','Centelino','Divinélio'],
 ['Asteragon','Darkrai','Veluza','Raijuba','Charizard','Mismagius'],
 ['Dragonite','Wyrmélio','Tyranitar','Alakazam','Gardevoir','Solfaro']
];
const descriptions=[
 'Uma patrulheira que apresenta seis tipos diferentes. Seus parceiros básicos exigem atenção às vantagens elementares desde a primeira batalha.',
 'Um caçador de troféus com seis parceiros raros. Trouxe novos talentos para testar sua equipe antes das primeiras evoluções.',
 'Uma estudiosa que combina seis tipos e primeiras evoluções. A pressão psíquica faz parte de sua estratégia.',
 'O sentinela das ruínas reúne segundas evoluções, incluindo novos parceiros aquáticos, vegetais, sombrios e psíquicos.',
 'Uma capitã que reuniu uma equipe mista em suas viagens. Gyrados lidera, apoiado por aliados de cinco outros tipos.',
 'O mestre do jardim combina resistência e variedade. Raizelo, Blastoise e Dusknoir dividem espaço com novos aliados.',
 'A dama do eclipse combina Gengar e Dragapult com quatro outros tipos. Sua formação pune equipes dependentes de um único parceiro.',
 'O comandante do cume traz Salamence e cinco outros tipos. Velocidade e escolhas de troca serão decisivas.',
 'A regente das cinzas mantém dois Dragões e quatro ameaças de tipos distintos na reta final da carreira.',
 'O herdeiro do abismo reúne seis épicos de tipos diferentes. É a última prova antes da batalha decisiva.',
 'A lenda caída reúne seis épicos: dois Dragões e quatro aliados de tipos diferentes, todos no nível 100.'
];
D.bosses.forEach((boss,i)=>{
 boss.team=teams[i].map(name=>{const mon=D.mons.find(m=>m.name===name);if(!mon)throw Error('Mon de boss desconhecido: '+name);return mon.id;});
 boss.description=descriptions[i];
});
D.bossRosterRevision=1;
})(window.FMX_DATA);
