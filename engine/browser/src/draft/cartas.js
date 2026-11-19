/* ══════════════════════════════════════════════════════════════════
   LAS 101 CARTAS DE RETRO PACK 2, LEÍDAS COMO LAS LEE UN JUGADOR DE LIMITADO

   Esto NO es una tier list. Cada carta lleva:

     base     lo que vale la carta EN JUEGO, sola, en un mazo de limitado
              de 20 (0-10). Es el «prior»: el mazo la multiplica por lo que
              de verdad puede hacer allí (acceso, plan, conflictos). Nunca
              se suma dos veces y nunca rescata una carta que no se puede
              jugar: si su ruta no existe, vale 0 la nota que tenga.
     roles    para qué sirve en un mazo (lo usa la evaluación del mazo).
     rutas    lo que necesita para salir al campo o para hacer algo, en
              AND (piezas) / OR (alguna) / cuenta (n monstruos de un tipo).
              Se resuelve contra el pool autorizado en `rutas.js`, no aquí:
              si otro modo cambia el pool, las conclusiones cambian solas.
     quema    daño que puede hacer a lo largo de una partida (plan burn).
     bloqueo  cuánto frena los ataques del rival (plan burn / bind).
     nota     por qué tiene ese valor; sale en las explicaciones.

   Los textos son los del motor (versión GOAT cuando existe: ver
   engine/draft/importar-rp02.mjs). Los juicios siguen el brief de E
   (prompt_draft_retro_pack_2.md, §4 y §8) y se han contrastado con el
   texto de cada carta; los rulings que importan se preguntan al motor en
   `check-draft-cartas.mjs`, no se suponen.

   Los valores son de partida y se pueden afinar sin tocar el código:
   todo lo que decide sale de esta tabla.
   ══════════════════════════════════════════════════════════════════ */

export const RAZA = { guerrero:1, lanzador:2, hada:4, demonio:8, zombi:16, maquina:32, aqua:64,
                      piro:128, roca:256, bestiaAlada:512, planta:1024, insecto:2048, trueno:4096,
                      dragon:8192, bestia:16384, bestiaGuerrero:32768, dinosaurio:65536, serpienteMarina:262144 };
export const TIPO = { monstruo:1, magia:2, trampa:4, normal:16, efecto:32, fusion:64, ritual:128,
                      spirit:512, flip:0x200000, continua:0x20000, equipo:0x40000, campo:0x80000,
                      contra:0x100000, rapida:0x10000, soloEspecial:0x2000000 };
export const ATRIB = { tierra:1, agua:2, fuego:4, viento:8, luz:16, oscuridad:32 };

const MSG = ['Spirit Message "I"','Spirit Message "N"','Spirit Message "A"','Spirit Message "L"'];
const GUERREROS_4 = ["Goblin Attack Force","Gearfried the Iron Knight","Don Zaloog","Obnoxious Celtic Guard"];

/* ── LA TABLA ──
   Roles que entiende la evaluación:
     atacante  cuerpo que presiona sin tributo     grande   2300+ que pasa muros de 2000
     muro      aguanta (DEF alta o se protege)     remocion quita un monstruo
     remSet    responde a monstruos boca abajo     remMT    quita magias/trampas
     antiBind  responde a un Gravity Bind ya puesto (no a uno por venir)
     bloqueo   frena ataques                       dano     fuente de daño de efecto
     amplif    multiplica el daño de otras         bajoBind ataca con Gravity Bind (nivel ≤3)
     ventaja   gana cartas                         revivir  saca del cementerio
     proteccion protege lo tuyo                    disrupcion rompe la mano/el plan rival
     side      carta de side (sube entre partidas según lo visto)
     simetrica afecta a los dos jugadores: no es ventaja gratis
     permanente se queda en tu campo (choca con Gorz, Destiny Board, zonas) */
export const ANOTACIONES = {
  /* ═════ MONSTRUOS SIN TRIBUTO ═════ */
  "Gemini Elf":            { base:5.6, roles:["atacante"], nota:"1900 sin tributo: gana casi todos los combates de nivel 4" },
  "Kycoo the Ghost Destroyer":{ base:5.4, roles:["atacante","disrupcion"], nota:"1800 y apaga los destierros de cementerio del rival" },
  "Opticlops":             { base:5.3, roles:["atacante"], paquete:"demonio", nota:"1800/1700 sin tributo; Demonio (cuenta para Necrofear y Ha Des)" },
  "Spear Dragon":          { base:5.0, roles:["atacante"], nota:"1900 con perforación, pero se queda en defensa con 0 DEF tras atacar" },
  "Goblin Attack Force":   { base:5.2, roles:["atacante","grande"], nota:"2300 sin tributo, pero queda expuesta en defensa con 0 DEF un turno" },
  "Gearfried the Iron Knight":{ base:5.0, roles:["atacante"], conflictoEquipo:true, nota:"1800/1600 sólido; destruye las equipaciones (mala pareja de Premature Burial)" },
  "Mad Sword Beast":       { base:3.4, roles:["atacante"], nota:"1400 con perforación: poco cuerpo" },
  "Bazoo the Soul-Eater":  { base:4.5, roles:["atacante","grande"], usaCementerio:"destierro", nota:"1600 que sube destarrando del cementerio: compite con la resurrección y no dura" },
  "Newdoria":              { base:5.4, roles:["remocion"], paquete:"demonio", nota:"muere y destruye un monstruo: interacción pegada a un cuerpo" },
  "Dark Jeroid":           { base:5.0, roles:["remocion"], paquete:"demonio", nota:"−800 a un monstruo al salir: resuelve umbrales de combate" },
  "Don Zaloog":            { base:4.4, roles:["atacante","disrupcion"], nota:"1400; descarte al azar si conecta" },
  "Obnoxious Celtic Guard":{ base:4.6, roles:["muro"], nota:"no muere en combate contra 1900+; sigue cayendo ante 1500-1800 y ante efectos" },
  "Kaiser Sea Horse":      { base:4.4, roles:["atacante"], dobleTributoLuz:true, nota:"1700/1650; vale por dos tributos para un monstruo LUZ" },
  "Alpha The Magnet Warrior":{ base:3.6, roles:["muro"], paquete:"iman", nota:"1400/1700 normal; pieza de Valkyrion" },
  "Beta The Magnet Warrior": { base:4.4, roles:["atacante"], paquete:"iman", nota:"1700/1600 normal; pieza de Valkyrion" },
  "Gamma The Magnet Warrior":{ base:4.0, roles:["muro"], paquete:"iman", nota:"1500/1800 normal; pieza de Valkyrion" },
  "Melchid the Four-Face Beast":{ base:3.0, roles:[], paquete:"demonio", nota:"1500 normal; Demonio" },
  "Revival Jam":           { base:4.2, roles:["muro"], usaCementerio:"mover", nota:"vuelve si muere en combate pagando 1000" },
  "Asura Priest":          { base:5.0, roles:["atacante"], spirit:true, nota:"1700 que ataca a todos; vuelve a la mano (Spirit)" },
  "Gravekeeper's Spy":     { base:4.8, roles:["muro","ventaja"], paquete:"gravekeeper", nota:"1200/2000 en defensa y saca otro Gravekeeper's ≤1500 del mazo si queda objetivo" },
  "Gravekeeper's Assailant":{ base:3.6, roles:["atacante"], paquete:"gravekeeper", nota:"1500; cambia posiciones solo con Necrovalley" },
  "Gilasaurus":            { base:4.4, roles:["atacante","bajoBind"], nota:"1400 de nivel 3 que sale gratis, pero el rival revive uno" },
  "Injection Fairy Lily":  { base:7.0, roles:["atacante","bajoBind","grande"], nota:"nivel 3 que pega como 3400 pagando 2000: gana casi cualquier combate y ataca bajo Gravity Bind" },
  "4-Starred Ladybug of Doom":{ base:5.6, roles:["remocion","bajoBind"], flip:true, nota:"destruye todos los nivel 4 del rival al voltearse (no toca tributos)" },
  "Morphing Jar":          { base:4.2, roles:["simetrica"], flip:true, nota:"reinicio simétrico: ventaja según manos, gasta mazo" },
  "Parasite Paracide":     { base:2.2, roles:[], flip:true, nota:"1000 de daño diferido; poca cosa" },
  "Yata-Garasu":           { base:4.0, roles:["bajoBind","disrupcion"], spirit:true, nota:"200 de ATK: solo vale si conecta (y bajo Bind)" },
  "Thousand-Eyes Idol":    { base:0.4, roles:[], nota:"0/0 normal; no habilita Thousand-Eyes Restrict en este pool" },

  /* ═════ MONSTRUOS DE UN TRIBUTO ═════ */
  "Dark Ruler Ha Des":     { base:7.6, roles:["atacante","grande"], paquete:"demonio", noRevivible:true,
                             nota:"2450 de un tributo: supera a Jinzo y anula los efectos de lo que mata un Demonio tuyo; no se revive del cementerio" },
  "Jinzo":                 { base:7.8, roles:["atacante","grande","antiBind"], anulaTrampas:true,
                             nota:"2400 de un tributo y apaga todas las trampas (también las tuyas)" },
  "Airknight Parshath":    { base:5.8, roles:["atacante","ventaja"], nota:"1900 de un tributo; roba si conecta, pero no pasa una Spy en defensa" },
  "Freed the Matchless General":{ base:6.0, roles:["atacante","grande","ventaja"], buscaGuerrero:true, nota:"2300 de un tributo; busca guerreros de nivel ≤4 en vez de robar" },
  "Guardian Sphinx":       { base:6.2, roles:["muro","remocion"], nota:"2400 DEF y, si vuelve a voltearse por Invocación por Volteo, devuelve el campo rival a la mano (no al voltearse por ataque ni por Taiyou)" },
  "Archfiend of Gilfer":   { base:5.4, roles:["atacante","muro"], paquete:"demonio", usaCementerio:"mover", nota:"2200/2500 de un tributo; al morir se equipa con −500" },
  "Helpoemer":             { base:4.8, roles:["atacante","disrupcion"], paquete:"demonio", noRevivible:true, nota:"2000 de un tributo; descarte si muere en combate" },
  "Gravekeeper's Chief":   { base:4.2, roles:["atacante"], paquete:"gravekeeper", ignoraNV:true, nota:"1900 de un tributo; revive un Gravekeeper's" },
  "The Legendary Fisherman":{ base:3.2, roles:["atacante"], nota:"1850 de un tributo; con Umi no se le puede atacar" },

  /* ═════ MONSTRUOS DE DOS TRIBUTOS (O MÁS) ═════ */
  "Tyrant Dragon":         { base:6.2, roles:["atacante","grande"], nota:"2900 que ataca dos veces; cuesta dos tributos" },
  "Light and Darkness Dragon":{ base:6.0, roles:["atacante","grande"], noRevivible:true,
                             nota:"2800, niega activaciones futuras (también las tuyas); no quita un Gravity Bind ya resuelto" },
  "Buster Blader":         { base:4.8, roles:["atacante","grande"], nota:"2600 de dos tributos" },
  "Yamata Dragon":         { base:4.8, roles:["atacante","grande","ventaja"], spirit:true, nota:"2600/3100 Spirit: vuelve a la mano; roba hasta 5 si conecta" },
  "Hino-Kagu-Tsuchi":      { base:5.2, roles:["atacante","grande","disrupcion"], spirit:true, nota:"2800 Spirit: si conecta, el rival descarta su mano" },
  "Swift Gaia the Fierce Knight":{ base:5.2, roles:["atacante","grande"], gaia:true, nota:"2300; sin tributo solo si es tu única carta en mano" },
  "Harpie's Pet Dragon":   { base:3.0, roles:["muro"], nota:"2000/2500 de dos tributos; no hay Harpie Lady en el pool" },
  "Insect Queen":          { base:3.0, roles:["grande"], nota:"dos tributos y además tributa para atacar" },
  "Dreadscythe Harvester": { base:2.4, roles:[], nota:"2300 de dos tributos: caro para lo que hace" },
  "Green Baboon, Defender of the Forest":{ base:3.8, roles:["atacante","grande"],
                             nota:"2600 de dos tributos; su invocación especial pide una Bestia tuya destruida (solo Bazoo)" },
  "Victory Dragon":        { base:5.0, roles:["grande"],
                             rutas:[{ cuenta:{ raza:"dragon", n:3, enCampo:true }, nota:"pide tributar 3 Dragones" }],
                             nota:"tres tributos que tienen que ser Dragones" },

  /* ═════ INVOCACIÓN ESPECIAL CON CONDICIONES ═════ */
  "Dark Necrofear":        { base:6.6, roles:["atacante","muro","remocion"], paquete:"demonio", usaCementerio:"destierro",
                             rutas:[{ cuenta:{ raza:"demonio", n:3, enCementerio:true }, nota:"destierra 3 Demonios de tu cementerio" }],
                             nota:"2200/2800 que roba un monstruo al morir; depende de cuántos Demonios caigan" },
  "Lava Golem":            { base:4.8, roles:["remocion","dano"], quema:2500, regalo:true,
                             rutas:[{ condicion:true, acceso:0.7, nota:"el rival tiene que controlar 2 monstruos" }],
                             nota:"quita dos monstruos rivales a cambio de darle un 3000 que le quema 1000 por turno; ese turno no invocas" },
  "Gorz the Emissary of Darkness":{ base:6.0, roles:["atacante","grande","muro"], gorz:true,
                             nota:"2700 gratis si recibes daño sin cartas en el campo; choca con tus permanentes" },
  "Valkyrion the Magna Warrior":{ base:8.0, roles:["atacante","grande"],
                             rutas:[{ piezas:["Alpha The Magnet Warrior","Beta The Magnet Warrior","Gamma The Magnet Warrior"], aLaVez:true,
                                      nota:"tributar Alpha, Beta y Gamma a la vez" }],
                             nota:"3500/3850, pero reunir los tres imanes a la vez es difícil" },
  "The Masked Beast":      { base:6.4, roles:["atacante","grande"], paquete:"ritual",
                             rutas:[{ piezas:["Curse of the Masked Beast"], aLaVez:true, tributosNivel:8, nota:"ritual con Curse + 8 niveles" }],
                             nota:"3200, pero cuesta el ritual, la bestia y 8 niveles de tributos" },
  "Blue-Eyes Shining Dragon":{ base:7.0, roles:["grande"],
                             rutas:[{ piezas:["Blue-Eyes Ultimate Dragon"], enCampo:true, nota:"tributar Blue-Eyes Ultimate Dragon" }],
                             nota:"necesita Blue-Eyes Ultimate Dragon, que no está en el pool" },
  "Thousand-Eyes Restrict":{ base:8.0, roles:["remocion"], extra:true,
                             rutas:[{ piezas:["Relinquished","Thousand-Eyes Idol","Polymerization"], nota:"fusión de Relinquished + Thousand-Eyes Idol" }],
                             nota:"fusión sin Relinquished ni Polymerization en el pool" },
  "Dragon Master Knight":  { base:9.0, roles:["grande"], extra:true,
                             rutas:[{ piezas:["Black Luster Soldier","Blue-Eyes Ultimate Dragon","Polymerization"], nota:"fusión de Black Luster Soldier + Blue-Eyes Ultimate Dragon" }],
                             nota:"fusión sin ninguna pieza en el pool" },

  /* ═════ MAGIAS ═════ */
  "Nobleman of Crossout":  { base:6.8, roles:["remocion","remSet"], nota:"respuesta premium a monstruos boca abajo; si era de volteo, destierra también las copias de su mazo (y del tuyo)" },
  "Premature Burial":      { base:6.0, roles:["revivir"], revive:"premature", nota:"revive el mejor objetivo legal por 800; vale lo que valgan tus objetivos" },
  "Swords of Revealing Light":{ base:6.8, roles:["bloqueo","remSet"], bloqueo:2.0, nota:"tres turnos sin ataques y voltea lo tapado" },
  "Book of Moon":          { base:5.4, roles:["proteccion","tempo"], nota:"rápida: frena un ataque, salva lo tuyo o prepara un Flip Summon (tempo, no remoción)" },
  "Book of Taiyou":        { base:2.0, roles:[], taiyou:true, nota:"voltea boca arriba: activa efectos FLIP (Ladybug, Spy, Jar), no el de Sphinx" },
  "Creature Swap":         { base:4.0, roles:["remocion"], swap:true, nota:"cambio simétrico: cada uno elige el suyo; bueno con Spirits que vuelven a tu mano" },
  "Lightning Blade":       { base:3.2, roles:["equipo"], equipo:true, rutas:[{ alguna:[...GUERREROS_4,"Freed the Matchless General","Swift Gaia the Fierce Knight","Buster Blader","The Legendary Fisherman"], nota:"solo a un Guerrero" }],
                             nota:"+800 a un Guerrero; 2 por 1 si te lo quitan" },
  "United We Stand":       { base:5.0, roles:["equipo","grande"], equipo:true, nota:"+800 por monstruo: resuelve umbrales, arriesga dos cartas" },
  "Mage Power":            { base:3.8, roles:["equipo"], equipo:true, nota:"+500 por magia/trampa; arriesga dos cartas" },
  "Limiter Removal":       { base:2.0, roles:[], rutas:[{ alguna:["Jinzo"], nota:"solo dobla Máquinas: Jinzo" }], nota:"solo Jinzo es Máquina en el pool" },
  "Insect Imitation":      { base:1.2, roles:[], rutas:[{ alguna:["4-Starred Ladybug of Doom","Parasite Paracide","Insect Queen","Dreadscythe Harvester"], nota:"busca un Insecto un nivel más alto" }],
                             nota:"cambia un monstruo por un Insecto de un nivel más" },
  "Necrovalley":           { base:3.0, roles:["permanente"], necrovalley:true, nota:"+500 a Gravekeeper's y cierra el cementerio (también el tuyo, salvo con Chief)" },
  "A Legendary Ocean":     { base:1.2, roles:["permanente"], nota:"cuenta como Umi; casi nada en el pool lo aprovecha" },
  "Dark Room of Nightmare":{ base:1.0, roles:["amplif","permanente"], amplif:300, nota:"+300 por cada daño de efecto: no es una fuente de daño" },
  "Emergency Provisions":  { base:1.4, roles:[], nota:"LP a cambio de cartas: solo para alargar en burn" },
  "Infinite Cards":        { base:0.2, roles:["permanente"], nota:"sin efecto útil en limitado" },
  "Card of Safe Return":   { base:0.8, roles:["permanente"], rutas:[{ alguna:["Premature Burial","Call of the Haunted","Revival Jam","Gilasaurus"], nota:"roba cuando revives" }], nota:"roba solo si revives a menudo" },
  "Curse of the Masked Beast":{ base:0, roles:[], paquete:"ritual",
                             rutas:[{ piezas:["The Masked Beast"], nota:"solo invoca a The Masked Beast" }],
                             nota:"ritual: sin The Masked Beast no hace nada" },
  'Spirit Message "I"':    { base:0, roles:[], mensaje:true, rutas:[{ piezas:["Destiny Board"], nota:"solo la coloca Destiny Board" }], nota:"solo con Destiny Board" },
  'Spirit Message "N"':    { base:0, roles:[], mensaje:true, rutas:[{ piezas:["Destiny Board"], nota:"solo la coloca Destiny Board" }], nota:"solo con Destiny Board" },
  'Spirit Message "A"':    { base:0, roles:[], mensaje:true, rutas:[{ piezas:["Destiny Board"], nota:"solo la coloca Destiny Board" }], nota:"solo con Destiny Board" },
  'Spirit Message "L"':    { base:0, roles:[], mensaje:true, rutas:[{ piezas:["Destiny Board"], nota:"solo la coloca Destiny Board" }], nota:"solo con Destiny Board" },

  /* ═════ TRAMPAS ═════ */
  "Torrential Tribute":    { base:6.6, roles:["remocion"], nota:"barre el campo cuando el rival invoca: castiga sobreextenderse" },
  "Ring of Destruction":   { base:6.4, roles:["remocion","dano"], quema:800, nota:"quita un boca arriba en el turno rival; el daño va para los dos" },
  "Bottomless Trap Hole":  { base:6.2, roles:["remocion"], nota:"destierra lo que invoque con 1500+" },
  "Dust Tornado":          { base:6.0, roles:["remMT","antiBind"], nota:"quita un permanente: la respuesta a Gravity Bind, Swords o Wheel" },
  "Call of the Haunted":   { base:5.6, roles:["revivir","permanente"], revive:"call", nota:"revive en ataque; si cae la trampa, cae el monstruo" },
  "Magic Cylinder":        { base:5.6, roles:["bloqueo","dano"], quema:1600, bloqueo:0.6, nota:"niega un ataque y devuelve su ATK como daño" },
  "Mirror Wall":           { base:4.2, roles:["bloqueo","permanente"], bloqueo:1.0, nota:"(GOAT) mitad de ATK a los atacantes; 2000 LP por turno para mantenerla" },
  "Gravity Bind":          { base:4.8, roles:["bloqueo","permanente"], bloqueo:2.4, bind:true, nota:"nivel 4+ no ataca (los tuyos tampoco): bloqueo, no fuente de daño" },
  "Nightmare Wheel":       { base:5.2, roles:["bloqueo","dano","permanente"], quema:1500, bloqueo:0.8, nota:"inmoviliza un monstruo y quema 500 por turno" },
  "Ceasefire":             { base:3.6, roles:["dano","remSet"], quema:1000, nota:"500 por monstruo de efecto y voltea lo tapado sin activar FLIP" },
  "Skull Invitation":      { base:2.4, roles:["dano","simetrica","permanente"], quema:700, nota:"simétrica: 300 al dueño de cada carta que va al cementerio, también a ti" },
  "Barrel Behind the Door":{ base:1.8, roles:["side"], quema:600, nota:"devuelve un daño de efecto: solo contra burn" },
  "Dark Spirit of the Silent":{ base:3.4, roles:["bloqueo"], bloqueo:0.4, nota:"redirige un ataque" },
  "Magic Drain":           { base:3.8, roles:["disrupcion"], nota:"niega una magia salvo que el rival descarte otra" },
  "Magical Hats":          { base:2.8, roles:["proteccion"], nota:"(GOAT) esconde un monstruo entre dos señuelos" },
  "Chain Destruction":     { base:2.4, roles:["disrupcion","side"], nota:"limpia las copias de un monstruo de ≤2000 en mano y mazo" },
  "Mask of Restrict":      { base:2.4, roles:["side","permanente"], nota:"nadie tributa: castiga mazos de tributos (y a ti)" },
  "Royal Decree":          { base:2.6, roles:["antiBind","side","permanente"], anulaTrampas:true, nota:"apaga todas las demás trampas, también las tuyas" },
  "Reckless Greed":        { base:3.2, roles:["ventaja"], nota:"adelanta dos robos a cambio de saltarte dos" },
  "Appropriate":           { base:0.3, roles:["permanente"], nota:"pide que el rival robe fuera de la Draw Phase" },
  "Jam Defender":          { base:1.8, roles:["proteccion","permanente"], rutas:[{ piezas:["Revival Jam"], nota:"redirige a Revival Jam" }], nota:"sin Revival Jam no hace nada" },
  "Tornado Wall":          { base:0.6, roles:["bloqueo","permanente"], bloqueo:0.6, rutas:[{ piezas:["A Legendary Ocean"], nota:"necesita Umi en el campo" }], nota:"necesita Umi" },
  "Destiny Board":         { base:5.0, roles:["permanente"], tablero:true,
                             rutas:[{ piezas:MSG, enMazo:true, nota:"las cuatro letras distintas en el mazo" }],
                             nota:"gana el duelo si aguantas cuatro turnos con el tablero y las cuatro letras" },
};

/* Los monstruos que NO pueden salir del cementerio (no son objetivo de
   resurrección), leídos del texto: Spirits, «Cannot be Special Summoned»
   y los de invocación especial obligatoria. La anotación lo confirma. */
/* ══ LA NOTA, CALIBRADA CON PARTIDAS ══
   `rp02.calibracion` (calibrar-draft.mjs + ajustar-notas.py) dice cuánto
   suma cada carta a ganar en miles de duelos de bots con mazos al azar.
   No sustituye a la nota: la corrige AJUSTE_MEDIDO puntos por desviación
   típica, y solo en cartas que se juegan solas (las de rutas dependen del
   mazo, y en mazos al azar casi nunca tienen sus piezas). Medido así, las
   de cero tributos pesan más de lo que dice la teoría y los tributos de
   dos, menos: en parte es el piloto, en parte que un mazo al azar se
   atasca con ellos (eso ya lo castiga el mazo, por eso el ajuste es suave). */
export const AJUSTE_MEDIDO = 0.7;
function ajusteMedido(rp02){
  const med = rp02.calibracion?.cartas;
  if(!med) return () => 0;
  const elegibles = rp02.cartas.filter(c => { const a = ANOTACIONES[c.nombre]; return a && a.base > 0.5 && !a.rutas && med[c.nombre] !== undefined; });
  const xs = elegibles.map(c => med[c.nombre]);
  const media = xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - media) ** 2, 0) / xs.length) || 1;
  const ok = new Set(elegibles.map(c => c.nombre));
  return nombre => ok.has(nombre) ? AJUSTE_MEDIDO * (med[nombre] - media) / sd : 0;
}

export function catalogo(rp02){
  const mapa = new Map();
  const ajuste = ajusteMedido(rp02);
  for(const c of rp02.cartas){
    const a0 = ANOTACIONES[c.nombre];
    if(!a0) throw new Error(`draft: sin anotación para ${c.nombre}`);
    const aj = ajuste(c.nombre);
    const a = aj ? { ...a0, base: Math.max(0.2, Math.min(9, +(a0.base + aj).toFixed(2))), baseTeoria: a0.base, ajusteMedido: +aj.toFixed(2) } : a0;
    const esM = !!(c.tipo & TIPO.monstruo);
    const tributos = !esM ? 0 : (c.tipo & (TIPO.fusion|TIPO.ritual)) || (c.tipo & TIPO.soloEspecial) ? null
                   : c.nombre === "Gilasaurus" ? 0
                   : c.nombre === "Victory Dragon" ? 3
                   : c.nivel <= 4 ? 0 : c.nivel <= 6 ? 1 : 2;
    const texto = c.texto ?? "";
    const noSS = /cannot be special summoned(?! from the gy)/i.test(texto) || !!a.spirit;
    mapa.set(c.id, {
      ...c, ...a,
      roles: a.roles ?? [],
      rutas: a.rutas ?? [],
      esMonstruo: esM, esMagia: !!(c.tipo & TIPO.magia), esTrampa: !!(c.tipo & TIPO.trampa),
      continua: !!(c.tipo & (TIPO.continua|TIPO.equipo|TIPO.campo)),
      flip: !!(c.tipo & TIPO.flip) || !!a.flip,
      tributos,
      /* objetivo de Premature Burial / Call of the Haunted */
      revivible: esM && !a.extra && !noSS && !a.noRevivible && !(c.tipo & TIPO.soloEspecial) && !(c.tipo & TIPO.ritual),
      luz: c.atributo === ATRIB.luz,
      demonio: esM && c.raza === RAZA.demonio,
      dragon: esM && c.raza === RAZA.dragon,
      gravekeeper: /Gravekeeper's/.test(c.nombre),
      esPermanente: (a.roles ?? []).includes("permanente") && !a.mensaje && !a.tablero,
      esMuro: (a.roles ?? []).includes("muro"),
      esGrande: (a.roles ?? []).includes("grande"),
    });
  }
  return mapa;
}
export const NOMBRES_MENSAJES = MSG;
