/* ══════════════════════════════════════════════════════════════════
   LEER LA CARTA — para las 1.576 que nadie ha programado.

   POR QUÉ EXISTE ESTE MÓDULO.

   `knowledge.js` tiene 109 cartas escritas a mano. El pool de Goat son
   1.685. Las otras 1.576 caían en el `default` del cerebro, que valía
   1.2 — y el umbral para jugar una carta es 0.8. O sea que la regla
   efectiva era: **si no te suena la carta, juégala en cuanto puedas**,
   y el objetivo lo elegía el criterio genérico de "lo más valioso".

   De ahí salen, todos con la misma causa, los "misplays" reportados:
     · Breaker rompiendo una tapada cualquiera en vez del Premature
       Burial que sostenía un Jinzo   (se activaba con nota 1.2)
     · Skull Lair sobre su propio monstruo   (nota 2 en la cadena)
     · Raigeki Break sobre su propio monstruo
     · Ring of Destruction quemándose sus propios puntos de vida

   No son cuatro bugs: es una línea. Y arreglarlos uno a uno no escala,
   porque el mazo siguiente traerá cartas nuevas.

   Lo que hace este módulo es leer el TEXTO de la carta —que ya viaja
   dentro del HTML, las 2.157— y sacar un modelo aproximado de qué hace
   y qué necesita para hacerlo. Con eso, cualquier carta del pool tiene
   una valoración razonable sin que nadie la haya programado, y el
   defecto pasa a ser el correcto: **si no consigue nada, no se juega**.

   No sustituye a `knowledge.js`: la tabla sigue mandando cuando existe,
   porque una carta escrita a mano siempre sabrá más que un regex. Esto
   es el suelo, no el techo.
   ══════════════════════════════════════════════════════════════════ */

/* Cada regla: qué busca en el texto, qué necesita en la mesa para que
   sirva de algo, y cuánto vale cuando se cumple. Los valores están en
   la misma escala que el resto del cerebro (el umbral de jugar es 0.8).

   El orden importa: gana la primera que encaja, así que lo específico
   va antes que lo genérico. */
const REGLAS = [
  /* El verbo primero, el alcance después. La primera versión buscaba
     "destroy .{0,60}monster", que no encaja con cómo está escrita media
     baraja: "Discard 1 card, then target 1 card on the field; destroy
     it." (Raigeki Break) o "Target 1 Spell/Trap your opponent controls;
     destroy that target." (Dust Tornado). Los textos de esta época
     separan el objetivo del verbo con un punto y coma. */

  // ── ganar cartas ─────────────────────────────────────────────────
  { que:/\bDraw (2|two|3|three)\b/i,       necesita:"mazoPropio",     vale:4.6 },
  { que:/\bDraw 1 card\b/i,                necesita:"mazoPropio",     vale:2.4 },
  { que:/add (it|1|that card|them) .{0,50}to (your|the) hand/i,
                                           necesita:"mazoPropio",     vale:3.2 },

  // ── reanimar / poner cosas propias (ANTES que la remoción: si no,
  //    "target 1 monster in your Graveyard" se leía como remoción) ──
  { que:/Special Summon (that target|it|1 monster).{0,60}(from your|in your) (Graveyard|GY)/i,
                                           necesita:"monstruoEnCementerio", vale:3.6 },
  { que:/target 1 monster in your (Graveyard|GY)/i,
                                           necesita:"monstruoEnCementerio", vale:3.4 },
  { que:/Special Summon/i,                 necesita:"ninguna",        vale:2.8 },

  // ── barrer el campo ──────────────────────────────────────────────
  { que:/[Dd]estroy all (monsters|cards)/,  necesita:"campoRivalGanador", vale:5.2 },
  { que:/[Dd]estroy all .{0,30}(Spell|Trap)/, necesita:"backrowRival", vale:4.0 },

  // ── remoción con objetivo: el alcance sale del texto del objetivo ──
  { que:/(Spell\/Trap|Spell or Trap) .{0,30}(your opponent controls|on the field)/i,
                                           necesita:"backrowRival",   vale:3.0 },
  { que:/(destroy|banish|[Rr]emove from play).{0,80}monster your opponent controls/i,
                                           necesita:"monstruoRivalUtil", vale:3.4 },
  /* "monster on the field" NO es lo mismo que "card on the field": lo
     primero necesita un monstruo suyo que merezca la pena, y con la
     condición floja (`algoDelRival`) Skull Lair se disparaba teniendo
     el rival solo backrow — y acababa destruyendo su propio monstruo,
     que es justo el reporte. */
  { que:/(destroy|banish|[Rr]emove from play).{0,80}monster on the field/i,
                                           necesita:"monstruoRivalUtil", vale:3.2 },
  { que:/(destroy|banish|[Rr]emove from play).{0,80}card on the field/i,
                                           necesita:"algoDelRival",   vale:3.2 },
  { que:/target 1 card on the field/i,     necesita:"algoDelRival",   vale:3.0 },
  { que:/target 1 monster on the field/i,  necesita:"monstruoRivalUtil", vale:3.0 },
  { que:/return that target to the hand/i, necesita:"monstruoRivalUtil", vale:2.6 },
  { que:/take control of/i,                necesita:"monstruoRivalUtil", vale:4.4 },
  { que:/change .{0,40}battle position/i,  necesita:"monstruoRival",  vale:1.6 },

  // ── daño y negación ──────────────────────────────────────────────
  { que:/inflict .{0,40}damage to your opponent/i, necesita:"ninguna", vale:2.6,
                                                   quema:true },
  { que:/Negate/i,                         necesita:"cadenaRival",    vale:3.6 },

  // ── estorbar sin objetivo ────────────────────────────────────────
  { que:/cannot (attack|be destroyed|declare an attack)/i,
                                           necesita:"ninguna",        vale:2.2 },
  { que:/(Set|equip) .{0,40}from your hand/i, necesita:"ninguna",     vale:1.4 },

  // ── lo que quedaba fuera y sale mucho en este formato ─────────────
  { que:/(gains?|increase).{0,30}\d{3,4} ATK/i,  necesita:"monstruoPropio", vale:1.8 },
  { que:/equip(ped)? .{0,40}monster/i,           necesita:"monstruoPropio", vale:1.6 },
  { que:/(Set|Special Summon) .{0,40}from your (Deck|Graveyard)/i,
                                                 necesita:"mazoPropio",  vale:2.6 },
  /* ══ LOS BUSCADORES ESTABAN MUDOS ══
     "Add 1 Level 4 or lower Warrior-Type monster from your Deck to your
     hand" no encajaba en ninguna regla, así que Reinforcement of the
     Army —y con ella TODA la familia de buscadores del formato: Sangan,
     Senju, Manju, Sonic Bird, Mystic Tomato…— salía con `hace:null`, o
     sea "no sé qué consigue", que es un cero. Por eso el bot la colocaba
     boca abajo en vez de jugarla: colocar puntuaba 1.4 y activar 0.
     Buscar una carta concreta es de lo mejor que se puede hacer en un
     turno, así que va alto. */
  { que:/[Aa]dd 1 .{0,80}from your (Deck|Graveyard|GY) to your hand/i,
                                                 necesita:"mazoPropio",  vale:3.2 },
  { que:/[Aa]dd .{0,60}from your (Deck|Graveyard|GY) to (your )?hand/i,
                                                 necesita:"mazoPropio",  vale:2.8 },
  { que:/shuffle .{0,40}into the Deck/i,         necesita:"algoDelRival", vale:2.4 },
  { que:/(flip|change) .{0,40}face-down/i,       necesita:"monstruoRival", vale:1.8 },
  { que:/your opponent.{0,40}(discard|sends?) /i, necesita:"manoRival",  vale:2.8 },
  { que:/(cannot be targeted|is unaffected|protect)/i, necesita:"monstruoPropio", vale:1.5 },
  { que:/gain \d+ Life Points/i,                 necesita:"ninguna",     vale:0.9 },
  { que:/During each .{0,20}Standby Phase/i,     necesita:"ninguna",     vale:1.6 },
];

/* Lo que la carta te COBRA por hacer lo suyo. Se resta del valor: una
   carta que descarta dos y destruye una tapada no compensa. */
const COSTES = [
  { que:/discard 2|discard two/i,          cuesta:2.0 },
  { que:/\bdiscard\b/i,                    cuesta:0.9 },
  { que:/Tribute 2|Tribute two/i,          cuesta:2.0 },
  { que:/\bTribute\b/i,                    cuesta:1.0 },
  { que:/[Pp]ay (\d+) Life Points/,        cuesta:0.5 },
  { que:/banish .{0,40}from your (Graveyard|GY)/i, cuesta:0.3 },
];

/* Cartas que pueden apuntar a lo TUYO. Es la diferencia entre "destroy
   1 monster your opponent controls" (seguro) y "destroy 1 monster on
   the field" (puede volarte lo tuyo). Se usa para no dejar que el bot
   se dispare en el pie con una carta que nadie ha programado. */
const APUNTA_A_CUALQUIERA = /on the field|1 face-up monster\b|1 monster\b(?!.{0,20}your opponent)/i;

/* ══════════════════════════════════════════════════════════════════
   CUÁNTO QUEMA, DE VERDAD

   La regla de arriba vale 2.6 diga la carta 300 o 2.000, y eso no es
   una lectura: es una constante con aspecto de lectura. Se saca el
   número del texto para poder compararlo con los puntos de vida que le
   quedan al rival — 500 sobre 8.000 es un 6% y no vale un cuerpo; 500
   sobre 400 es la partida.
   ══════════════════════════════════════════════════════════════════ */
const CUANTO_QUEMA = /inflict (\d+) damage/i;

export function leerCarta(texto, datos){
  const t = String(texto ?? "");
  const esMonstruo = !!((datos?.type ?? 0) & 0x1);
  const regla = REGLAS.find(r => r.que.test(t)) ?? null;
  let cuesta = 0;
  for(const c of COSTES) if(c.que.test(t)) { cuesta = Math.max(cuesta, c.cuesta); }
  return {
    /* Si el efecto quema, cuánto. `null` = el texto no lo dice (daño
       variable, "damage equal to…"), y entonces se queda el valor de
       siempre porque no hay nada que medir. */
    quema: regla?.quema ? (Number((t.match(CUANTO_QUEMA) ?? [])[1]) || null) : null,
    /* Y si lo que cobra es un TRIBUTO, para que el cerebro pueda poner
       el precio del cuerpo que va a entregar de verdad en vez del
       número redondo de la tabla. */
    tributa: /\bTribute\b/i.test(t),
    /* null = el texto no dice nada que sepamos valorar. NO es "vale
       poco": es "no tenemos ni idea", y ante la duda no se juega. */
    hace: regla?.necesita ?? null,
    valeSi: regla?.vale ?? 0,
    cuesta,
    puedeApuntarmeAMi: APUNTA_A_CUALQUIERA.test(t),
    esMonstruo,
  };
}

/* ══════════════════════════════════════════════════════════════════
   QUÉ PASA CUANDO ESTA CARTA PIERDE UN COMBATE (01-11)

   E: «la IA evalúa las acciones y sus beneficios inmediatos, pero no
   sus consecuencias». En el combate eso era literal: `valeAtacar`
   comparaba ATK con ATK, y lo que pasa DESPUÉS de ganar —Relinquished
   que no muere porque se rompe el equipo, Newdoria que se lleva otro
   monstruo, el buscador que repone la mano— vivía en parches por carta
   (`floater`, `peligroso`) que solo conocían las cartas escritas a mano.
   Las 95 cartas del pool con un efecto "al morir en combate" lo dicen en
   su texto, así que se lee igual que el resto de este módulo.

   Devuelve null si el texto no dice nada de eso.
     enCombate  solo si muere EN COMBATE (Giant Rat); false = al salir del
                campo como sea (Sangan)
     efecto     reemplazo · busca · roba · destruye · destruyeAtacante ·
                destierraAtacante · quema
     atkMax / defMax  el tope de lo que saca un reemplazo
   ══════════════════════════════════════════════════════════════════ */
const AL_MORIR = /(destroyed by battle|destroyed (and sent to the (GY|Graveyard) )?as a result of battle|sent to the (GY|Graveyard) as a result of battle|sent from the field to the (GY|Graveyard))/i;
const _alMorir = new Map();
export function leerAlMorir(texto){
  const t = String(texto ?? "");
  if(_alMorir.has(t)) return _alMorir.get(t);
  const m = AL_MORIR.exec(t);
  let r = null;
  if(m){
    const tras = t.slice(m.index);
    const num = re => { const x = re.exec(tras); return x ? Number(x[1] ?? x[2]) : null; };
    r = { enCombate: !/sent from the field/i.test(m[0]), efecto:null, atkMax:null, defMax:null, quema:null };
    if(/Special Summon .{0,90}from (your|the) Deck/i.test(tras)){
      r.efecto = "reemplazo";
      r.atkMax = num(/ATK of (\d+) or less|(\d+) or less ATK/i);
      r.defMax = num(/DEF (?:of )?(\d+) or less|(\d+) or less DEF/i);
    }
    else if(/\badd .{0,90}to (your|the) hand/i.test(tras)) r.efecto = "busca";
    else if(/\bdraw\b/i.test(tras)) r.efecto = "roba";
    else if(/destroy the monster that destroyed this card/i.test(tras)) r.efecto = "destruyeAtacante";
    else if(/banish that monster/i.test(tras)) r.efecto = "destierraAtacante";
    else if(/(destroy that target|destroy 1 monster)/i.test(tras)) r.efecto = "destruye";
    else if(/inflict (\d+) (points of )?damage to your opponent/i.test(tras)){
      r.efecto = "quema"; r.quema = num(/inflict (\d+) (?:points of )?damage/i);
    }
    if(!r.efecto) r = null;
  }
  _alMorir.set(t, r);
  return r;
}

/* Lo que protege a un monstruo en combate aunque "pierda" la cuenta:
     sustituye  con un monstruo equipado, se rompe el equipo y él se queda
                (Relinquished, Thousand-Eyes Restrict)
     refleja    el daño de batalla que recibe su dueño lo recibe también
                el atacante (Relinquished)
     absorbe    se equipa monstruos del rival: si le rompes el equipo, el
                turno siguiente puede llevarse otro */
export function leerProteccion(texto){
  const t = String(texto ?? "");
  return {
    sustituye: /(equipped monster is destroyed instead|destroy that equipped monster instead)/i.test(t),
    refleja: /battle damage .{0,80}(also inflicted to your opponent|equal effect damage to your opponent)/i.test(t),
    absorbe: /equip (it|that target) to this card/i.test(t),
  };
}

/* ══ DAÑO DE EFECTO QUE SE PUEDE COBRAR AHORA ══
   Para sumar fuentes de quema (letal combinado): cuánto hace la carta
   con la mesa de ahora. Lee las tres formas del formato:
     "Inflict 800 damage"                         → fijo
     "500 damage … for each monster they control" → por monstruo suyo
     "200 damage … for each card in their hand and for each card they
      control"                                    → por carta suya
   Devuelve null si no es una carta de quemar que se pueda medir. */
export function quemaMedible(texto, v){
  const t = String(texto ?? "");
  const m = /inflict (\d+) (?:points of )?damage to your opponent/i.exec(t);
  if(!m) return null;
  const n = Number(m[1]);
  const resto = t.slice(m.index);
  if(/for each card in their hand and for each card they control/i.test(resto))
    return n * ((v.manoRival?.cuantas ?? 0) + v.monstruosRival.length + v.backrowRival.length);
  if(/for each monster they control/i.test(resto)) return n * v.monstruosRival.length;
  if(/for each Effect Monster on the field/i.test(resto))
    return n * [...v.monstruos, ...v.monstruosRival].filter(x => !x.bocaAbajo && (((x.datos?.type ?? 0) & 0x20) !== 0)).length;
  if(/for each card in (their|your opponent's) hand/i.test(resto)) return n * (v.manoRival?.cuantas ?? 0);
  if(/for each/i.test(resto)) return null;          // otra cuenta que no sé hacer
  return n;
}

/* ══ LO QUE ACABA EN EL CAMPO DEL RIVAL ══
   Lava Golem y Ojama Trio dicen "Special Summon … to your opponent's
   field". La regla genérica "Special Summon" de arriba las leía como
   reanimar algo propio (2,8) y el bot regalaba un 3000 sin nada que lo
   frenara. Devuelve null o { cuerpos, atk, nivel?, tributaSuyos } */
export function leerRegalo(texto, datos){
  const t = String(texto ?? "");
  if(!/to your opponent's (field|side of the field)/i.test(t) || !/Special Summon/i.test(t)) return null;
  const tokens = /Special Summon (\d|three|two) .{0,20}Tokens?/i.exec(t);
  const n = tokens ? ({ two:2, three:3 }[tokens[1]] ?? Number(tokens[1])) : 1;
  const atkTok = /ATK (\d+)/i.exec(t);
  return {
    cuerpos: n,
    atk: tokens ? Number(atkTok?.[1] ?? 0) : (datos?.attack ?? 0),
    nivel: tokens ? 2 : (datos?.level ?? 0),
    fichas: !!tokens,
    tributaSuyos: (/Tributing (\d|two) monsters they control/i.exec(t)?.[1] ?? null),
    /* "each time 1 is destroyed, its controller takes 300 damage" */
    quemaAlMorir: Number(/takes (\d+) damage/i.exec(t)?.[1] ?? 0),
    /* "Once per turn, during your Standby Phase: Take 1000 damage" */
    quemaPorTurno: Number(/Standby Phase: Take (\d+) damage/i.exec(t)?.[1] ?? 0),
  };
}

/* ¿Se cumple lo que la carta necesita para conseguir algo?
   `v` es la vista legal del bot; `ayuda` trae los cálculos que ya hace
   el cerebro (qué monstruo rival merece la pena) para no repetirlos. */
export function condicionCumplida(necesita, v, ayuda = {}){
  switch(necesita){
    case "ninguna":            return true;
    case "mazoPropio":         return (v.deckRestante ?? 0) > 0;
    case "backrowRival":       return v.backrowRival.some(b => !b.muerta);
    case "monstruoRival":      return v.monstruosRival.length > 0;
    case "monstruoRivalUtil":  return !!ayuda.objetivoBueno;
    case "campoRivalGanador":  return v.monstruosRival.length > v.monstruos.length;
    case "monstruoEnCementerio":
      return v.cementerio.some(c => (c.datos?.type ?? 0) & 0x1);
    case "monstruoPropio":     return v.monstruos.length > 0;
    case "manoRival":          return (v.manoRival?.cuantas ?? 0) > 0;
    case "algoDelRival":       return v.monstruosRival.length > 0 || v.backrowRival.some(b => !b.muerta);
    case "cadenaRival":        return !!ayuda.hayCadenaRival;
    default:                   return false;
  }
}

/* La nota de una carta que nadie ha programado. Devuelve 0 —o sea, no
   la juegues— cuando el texto no dice nada valorable o cuando lo que
   necesita no está en la mesa. Ese "0 por defecto" es el arreglo: antes
   era 1.2 y el bot jugaba a ciegas todo lo que no conocía. */
/* ══ LOS CAMPOS QUE SUBEN UN TIPO (Forest, Wasteland, Mountain…) ══
   GitHub #5 (Weevil): Neo Bug atacó y DESPUÉS jugó Forest. Su texto dice
   «monsters on the field», así que la puerta de «puede apuntarme a mí»
   lo dejaba a 0 en cuanto el campo rival estaba vacío, y con un monstruo
   delante valía lo mismo que cualquier otra cosa. Lo que vale de verdad
   es la cuenta: cuántos de los míos suben menos cuántos de los suyos. */
const RAZAS_TEXTO = [["Beast-Warrior",0x8000],["Winged Beast",0x200],["Sea Serpent",0x40000],
  ["Warrior",0x1],["Spellcaster",0x2],["Fairy",0x4],["Fiend",0x8],["Zombie",0x10],["Machine",0x20],
  ["Aqua",0x40],["Pyro",0x80],["Rock",0x100],["Plant",0x400],["Insect",0x800],["Thunder",0x1000],
  ["Dragon",0x2000],["Beast",0x4000],["Dinosaur",0x10000],["Fish",0x20000],["Reptile",0x80000]];
export function razasQueSuben(texto){
  const m = /^All ([^.]+?) monsters on the field gain \d+ ATK/i.exec(String(texto ?? ""));
  if(!m) return 0;
  let resto = m[1], bits = 0;
  for(const [n, b] of RAZAS_TEXTO) if(resto.includes(n)){ bits |= b; resto = resto.split(n).join(" "); }
  return bits;
}
function utilidadCampo(bits, v){
  const sube = x => !x.bocaAbajo && x.datos && (Number(BigInt(x.datos.race ?? 0) & BigInt(bits)) !== 0);
  const mios = v.monstruos.filter(sube).length, suyos = v.monstruosRival.filter(sube).length;
  return { mios, suyos, neto: mios - suyos };
}
export function utilidadLeida(texto, datos, v, ayuda){
  const lee = leerCarta(texto, datos);
  /* ══ FICHAS PARA EL RIVAL (Ojama Trio) ══
     La regla genérica "Special Summon" la leía como reanimar algo mío
     (2,8) y se activaba en cualquier ventana. Tres fichas de 0/1000 en
     SU campo valen por lo que le quitan: si le llenan las cinco zonas no
     puede invocar nada, y cada una que muere le quema. En una mesa
     cualquiera, poco (y le dan cuerpos para Metamorphosis). Cuando hace
     letal con Just Desserts o Secret Barrel lo decide el cerebro, que
     suma la quema entera (`planDeQuema`). */
  const rg = leerRegalo(texto, datos);
  if(rg?.fichas){
    const libres = 5 - v.monstruosRival.length;
    if(libres < rg.cuerpos) return { p:0, por:"no le caben las fichas", lee };
    const llena = libres === rg.cuerpos;
    const pegan = v.monstruos.filter(x => !x.bocaAbajo && !x.defensa && (x.atkReal ?? x.datos?.attack ?? 0) > 1000).length;
    const p = 0.2 + (llena ? 2.4 : 0) + Math.min(rg.cuerpos, pegan) * 0.25 * (rg.quemaAlMorir ? 1 : 0.5);
    return { p, por: llena ? "sus fichas le llenan el campo: no puede invocar" : "fichas para el rival sin más", lee };
  }
  const bits = ((datos?.type ?? 0) & 0x80000) ? razasQueSuben(texto) : 0;
  if(bits){
    const { mios, suyos, neto } = utilidadCampo(bits, v);
    if(neto <= 0) return { p:0, por:`sube ${mios} míos y ${suyos} suyos: no compensa`, lee };
    return { p: 1.4 + 0.4 * neto, por:`sube ${mios} míos y ${suyos} suyos`, lee, campoSube:mios };
  }
  if(!lee.hace) return { p:0, por:"no sé qué consigue esta carta aquí", lee };
  if(!condicionCumplida(lee.hace, v, ayuda))
    return { p:0, por:`no hay ${lee.hace}`, lee };
  /* Y la puerta que vale para TODAS: una carta cuyo texto dice "on the
     field" puede apuntar a lo tuyo. Si no hay un objetivo del rival que
     merezca la pena, el único blanco legal eres tú. Es la versión
     genérica de lo que arreglamos a mano para MST, Book of Moon y
     Heavy Storm, pero para las 1.576 cartas sin caso escrito. */
  let vale = lee.valeSi, cuesta = lee.cuesta, nota = "por lo que dice la carta";

  /* ══ LO QUE QUEMA SE MIDE CONTRA LO QUE LE QUEDA AL RIVAL ══
     500 de daño sobre 8.000 puntos es un 6%; sobre 400, es la partida.
     Con el valor plano de la tabla, las dos cosas puntuaban igual.
     VA ANTES QUE EL PORTÓN DE ABAJO A PROPÓSITO: cerrar la partida no
     lo discute ninguna otra regla. */
  if(lee.quema && (ayuda?.lpRival ?? 0) > 0){
    if(lee.quema >= ayuda.lpRival)
      return { p: 99, por:`${lee.quema} de quemadura y le quedan ${ayuda.lpRival}: es letal`, lee };
    /* Proporción sobre los LP que quedan, no sobre 8.000: quemar 500
       cuando está a 1.200 sí es un plan. */
    vale = 0.6 + 3.4 * Math.min(1, lee.quema / ayuda.lpRival);
    nota = `quema ${lee.quema} de los ${ayuda.lpRival} que le quedan`;
  }

  /* ══ Y UN TRIBUTO CUESTA EL CUERPO QUE SE ENTREGA ══
     E, log 20-56-49: el bot invocó un Cannon Soldier y se tributó a SÍ
     MISMO por 500 de daño. Dos veces. El coste de la tabla es 1.0 diga
     lo que diga el tablero, así que tributar una ficha de Scapegoat y
     tributar el 1400 que acabas de invocar valían lo mismo — y perder
     la propia máquina de quemar, también.
     El cerebro sabe exactamente qué cuerpo va a dar (el más barato que
     tenga) y lo manda en `ayuda.costeTributo`. Si no lo manda, se queda
     el número de la tabla y todo sigue como antes. */
  if(lee.tributa && typeof ayuda?.costeTributo === "number"){
    /* SUSTITUYE, no `Math.max`. Con el máximo, el precio real nunca
       podía bajar del 1.0 de la tabla y una ficha de Scapegoat seguía
       costando lo mismo que un monstruo de verdad: la mitad del arreglo
       se quedaba sin efecto. El número de la tabla es el respaldo para
       cuando el cerebro no sabe qué se va a entregar, no un suelo. */
    cuesta = ayuda.costeTributo;
    nota += `, y el tributo cuesta ${ayuda.costeTributo.toFixed(1)}`;
  }

  /* ══ Y AHORA SÍ, EL PORTÓN DE "PUEDE APUNTARME A MÍ" ══
     Estaba ARRIBA DEL TODO y se comía los dos cálculos de abajo. Peor:
     lo disparaba el propio COSTE. "You can Tribute 1 monster; inflict
     500 damage" lleva un "1 monster" que es lo que PAGAS, no a lo que
     apuntas, así que Cannon Soldier contaba como carta de remoción que
     solo puede volarme a mí y salía 0 — con lo cual las tres posiciones
     del banco daban el mismo resultado y la que reportó E pasaba por el
     motivo equivocado.
     El portón es para cartas de remoción, así que no se aplica a las que
     no necesitan NADA en la mesa para conseguir lo suyo: quemar, ganar
     vida o contar turnos no apunta a nadie. */
  if(lee.hace !== "ninguna" && lee.puedeApuntarmeAMi
     && !ayuda.objetivoBueno && !v.backrowRival.some(b => !b.muerta))
    return { p:0, por:"apunta a cualquiera y solo estoy yo", lee };

  return { p: Math.max(0, vale - cuesta), por: nota, lee };
}
