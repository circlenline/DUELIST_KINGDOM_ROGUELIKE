/* ════════════════════════════════════════════════════════════════
   EL TORNEO SUIZO CON TOP 16 — solo las reglas, sin pantalla

   32 jugadores (E y 31 bots en experto), 5 rondas suizas al mejor de
   tres y corte a un top 16 eliminatorio: octavos, cuartos, semifinal y
   final. Con 32 y 5 rondas el corte cae justo: un 5-0, cinco 4-1 y diez
   3-2 son 16, así que un 3-2 entra y los desempates solo ordenan el
   cuadro.

   E juega SU mesa de verdad (el Bo3 de `torneo.js`). Las otras quince se
   resuelven con la tabla de cruces 20×20 (`data/cruces.json`, medida con
   `medir-cruces.mjs`): la probabilidad de que un mazo gane una partida a
   otro, con los dados de la semilla del torneo. Es instantáneo,
   reproducible y respeta qué mazo gana a cuál.

   Todo vive en un objeto que se puede guardar en localStorage tal cual,
   el azar incluido: recargar la página no cambia ni un emparejamiento.
   Lo prueba `check-suizo.mjs`.
   ════════════════════════════════════════════════════════════════ */

export const SUIZO_VERSION = 1;
export const JUGADORES = 32, RONDAS_SUIZAS = 5, CORTE = 16;
export const NOMBRES_CORTE = ["Octavos", "Cuartos", "Semifinal", "Final"];

/* ── Los mazos de los bots: aleatorios pero con el peso del meta ──
   Los pesos salían de lo que se juega de verdad (en los replays
   importados Warrior sale 190 veces, Chaos Turbo 139 y Chaos Control 86,
   frente a 17 de Gate y 8 de Burn), y con 12 a cada tier S la mitad de
   los bots eran Goat Control o Chaos. La comunidad lo dijo claro (19-11):
   «demasiadas variaciones de Chaos Control; debería haber aggro,
   control, combo, midrange». Ahora el tier S pesa la mitad, entran
   cuatro mazos más (Earth Aggro, Warrior Aggro, Umi, Relinquished) y el
   aggro sale en uno de cada cuatro bots. */
export const PESOS = {
  "Goat Control · Worlds 2020": 5, "Chaos Turbo · Worlds 2020": 5,
  "Chaos Control": 4, "Warrior Goat Control": 5,
  "Emissary Goat Control": 3, "Horus Goat Control": 3,
  "Phoenix Goat Control": 3, "Zombie Goat Control": 3,
  "Bazoo Return · Worlds": 2, "Monarch": 3, "Clown Control": 2,
  "Cat Control": 2, "Burn Goat Control": 2,
  "PACMAN · DGz Live 212": 2, "Beastdown": 3, "Gravekeeper": 2, "Empty Jar": 1,
  "Reasoning Gate OTK": 2, "Final Countdown": 1, "Library FTK": 1,
  "Earth Aggro": 4, "Warrior Aggro": 3, "Umi · Water Aggro": 2, "Relinquished Control": 2,
};
export const pesoDe = nombre => PESOS[nombre] ?? 1;

/* Nombres de jugador inventados, de foro. Ninguno es una persona real. */
export const NICKS = [
  "GoatKeeper", "ScapegoatSam", "MirrorForce88", "SakuretsuSol", "NoblemanNico",
  "TurtleTamer", "BookOfMoonlit", "DustDevilDan", "PotOfGreedy", "MorphJarMara",
  "LusterLina", "ReaperRae", "FlipFlopper", "WabokuWanda", "TorrentialTom",
  "BreakerBea", "SanganSaint", "FaithfulMage", "DecreeDealer", "GraveGus",
  "NimbleMomo", "AirknightAce", "MetamorphMia", "JinzoJunkie", "ThunderTed",
  "TributeTina", "SwordsOfLight", "SnatchSteve", "PrematurePia", "CallTheHaunt",
  "DelinquentDuo", "GracefulGabe", "HeavyStormHal", "RingOfRuth", "ChaosChloe",
  "TsukuyomiTay", "SpyGravekeep", "CyberJarCal", "LilyLover", "DDLadyDora",
];

/* ── Azar con estado guardable (mulberry32) ── */
function azar(s){
  return () => {
    s.azar = (s.azar + 0x6D2B79F5) >>> 0;
    let t = s.azar;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const semillaNum = txt => { let h = 2166136261 >>> 0;
  for(const ch of String(txt)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0; };
const barajar = (a, r) => { const b = [...a];
  for(let i=b.length-1;i>0;i--){ const j = Math.floor(r()*(i+1)); [b[i],b[j]] = [b[j],b[i]]; } return b; };
function sortearPeso(nombres, r){
  const total = nombres.reduce((t, n) => t + pesoDe(n), 0);
  let x = r() * total;
  for(const n of nombres){ x -= pesoDe(n); if(x < 0) return n; }
  return nombres[nombres.length - 1];
}

/* ══ CREAR ══
   `mazos`: los nombres de los mazos meta disponibles (los bots salen de
   ahí). `miMazo`: el nombre del mazo de E, que puede ser uno suyo. */
export function nuevoSuizo({ semilla = String(Date.now()), miNombre = "Tú", miMazo, mazos, avatares = [], miAvatar = null }){
  const s = { v: SUIZO_VERSION, semilla: String(semilla), azar: semillaNum(semilla),
              fase: "suizo", ronda: 0, jugadores: [], rondas: [], cuadro: [], abandono: false };
  const r = azar(s);
  const nicks = barajar(NICKS, r).slice(0, JUGADORES - 1);
  s.jugadores.push({ id: 0, nombre: miNombre, mazo: miMazo, yo: true, sorteo: r(), avatar: miAvatar });
  nicks.forEach((n, k) => s.jugadores.push({ id: k + 1, nombre: n, mazo: sortearPeso(mazos, r), yo: false, sorteo: r() }));
  /* ══ CADA BOT CON SU CARA (19-11) ══
     La comunidad: «siempre eres Yugi y el rival siempre Fake Kaiba o
     Roland». Las caras se reparten con un azar APARTE (otra semilla), para
     que los emparejamientos y los mazos de una semilla sigan siendo los de
     siempre. Ni la tuya ni la de Roland, que es el que reparte en el duelo
     libre; si no hay bastantes, se repiten. */
  const libres = avatares.filter(a => a !== miAvatar && a !== "roland");
  if(libres.length){
    const rA = azar({ azar: semillaNum(s.semilla + "·caras") });
    const orden = barajar(libres, rA);
    s.jugadores.filter(j => !j.yo).forEach((j, k) => { j.avatar = orden[k % orden.length]; });
  }
  emparejar(s);
  return s;
}
/* La cara de un jugador; los torneos guardados antes de que existieran
   las caras sacan una fija de su número. */
export function avatarDe(s, j, avatares = []){
  if(j?.avatar) return j.avatar;
  const libres = avatares.filter(a => a !== "roland");
  return libres.length ? libres[(Number(j?.id) || 0) % libres.length] : null;
}

/* ══ RESULTADOS ══ */
const partidosDe = (s, id) => s.rondas.flat().filter(m => m.res && (m.a === id || m.b === id));
export function registro(s, id){
  let g = 0, p = 0, gj = 0, pj = 0;
  for(const m of partidosDe(s, id)){
    const soyA = m.a === id;
    const mios = soyA ? m.res.ga : m.res.gb, suyos = soyA ? m.res.gb : m.res.ga;
    gj += mios; pj += suyos;
    if(mios > suyos) g++; else p++;
  }
  return { ganados: g, perdidos: p, puntos: 3 * g, juegosG: gj, juegosP: pj };
}
const rivalesDe = (s, id) => partidosDe(s, id).map(m => m.a === id ? m.b : m.a);
const pctMatch = (s, id) => { const r = registro(s, id), n = r.ganados + r.perdidos;
  return n ? Math.max(1/3, r.ganados / n) : 1/3; };
const pctJuegos = (s, id) => { const r = registro(s, id), n = r.juegosG + r.juegosP;
  return n ? Math.max(1/3, r.juegosG / n) : 1/3; };
const media = a => a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0;

/* La clasificación del suizo: puntos, porcentaje de victorias de los
   rivales (con el suelo de un tercio de los torneos de verdad), porcentaje
   de partidas ganadas y porcentaje de partidas de los rivales. */
export function clasificacion(s){
  const filas = s.jugadores.map(j => {
    const r = registro(s, j.id), riv = rivalesDe(s, j.id);
    return { ...j, ...r, omw: media(riv.map(x => pctMatch(s, x))),
             gw: pctJuegos(s, j.id), ogw: media(riv.map(x => pctJuegos(s, x))) };
  });
  filas.sort((a, b) => b.puntos - a.puntos || b.omw - a.omw || b.gw - a.gw || b.ogw - a.ogw || a.sorteo - b.sorteo);
  filas.forEach((f, i) => f.puesto = i + 1);
  return filas;
}

/* ══ EMPAREJAR UNA RONDA SUIZA ══
   Ronda 1 al azar. Después, por puntos de arriba abajo, cada uno con el
   más cercano de la tabla con el que no haya jugado todavía. Con
   vuelta atrás: si al final de la lista quedan dos que ya se cruzaron, se
   deshace y se prueba el siguiente. 32 es par: nunca hay bye. */
export function emparejar(s){
  const r = azar(s);
  s.ronda += 1;
  let orden;
  if(s.ronda === 1) orden = barajar(s.jugadores.map(j => j.id), r);
  else {
    /* Dentro del mismo grupo de puntos, el orden es al azar (como en los
       torneos de verdad); entre grupos manda la puntuación. */
    const ruido = new Map(s.jugadores.map(j => [j.id, r()]));
    orden = s.jugadores.map(j => j.id)
      .sort((a, b) => registro(s, b).puntos - registro(s, a).puntos || ruido.get(a) - ruido.get(b));
  }
  const jugado = (a, b) => s.rondas.flat().some(m => (m.a === a && m.b === b) || (m.a === b && m.b === a));
  const parejas = [];
  const libres = [...orden];
  const intentar = () => {
    if(!libres.length) return true;
    const a = libres.shift();
    for(let k = 0; k < libres.length; k++){
      const b = libres[k];
      if(jugado(a, b)) continue;
      libres.splice(k, 1); parejas.push([a, b]);
      if(intentar()) return true;
      parejas.pop(); libres.splice(k, 0, b);
    }
    libres.unshift(a);
    return false;
  };
  if(!intentar()) throw new Error("no hay emparejamiento sin repetir rival");
  s.rondas.push(parejas.map(([a, b], i) => ({ mesa: i + 1, a, b, res: null })));
  return s.rondas[s.rondas.length - 1];
}

/* La ronda en juego (suiza o del cuadro) y mi mesa en ella. */
export function rondaActual(s){
  if(s.fase === "suizo") return s.rondas[s.rondas.length - 1] ?? [];
  if(s.fase === "corte") return s.cuadro[s.cuadro.length - 1] ?? [];
  return [];
}
export function miMesa(s){
  if(s.abandono) return null;
  const yo = s.jugadores.find(j => j.yo)?.id ?? 0;
  return rondaActual(s).find(m => (m.a === yo || m.b === yo) && !m.res) ?? null;
}
export const jugador = (s, id) => s.jugadores.find(j => j.id === id);
export const rivalEn = (s, mesa) => { const yo = s.jugadores.find(j => j.yo).id; return jugador(s, mesa.a === yo ? mesa.b : mesa.a); };

/* Mi match, jugado de verdad. */
export function apuntarMiMatch(s, { gane, juegosMios, juegosSuyos }){
  const m = miMesa(s);
  if(!m) return null;
  const yo = s.jugadores.find(j => j.yo).id;
  const mios = juegosMios ?? (gane ? 2 : 0), suyos = juegosSuyos ?? (gane ? 0 : 2);
  m.res = m.a === yo ? { ga: mios, gb: suyos } : { ga: suyos, gb: mios };
  return m;
}

/* ══ LAS MESAS DE LOS BOTS ══
   `probPartida(mazoA, mazoB)` → probabilidad de que A gane UNA partida.
   El Bo3 se tira partida a partida hasta las dos victorias, así el
   marcador (2-0 o 2-1) cuenta para el porcentaje de partidas. */
export function bo3(p, r){
  let a = 0, b = 0;
  while(a < 2 && b < 2){ if(r() < p) a++; else b++; }
  return { ga: a, gb: b };
}
export function resolverResto(s, probPartida){
  const r = azar(s);
  for(const m of rondaActual(s)){
    if(m.res) continue;
    const A = jugador(s, m.a), B = jugador(s, m.b);
    if(A.yo || B.yo){
      /* La mía se juega, no se tira. Si me he retirado, la pierdo 0-2:
         así el rival suma su victoria y el torneo sigue entero. */
      if(s.abandono) m.res = A.yo ? { ga: 0, gb: 2 } : { ga: 2, gb: 0 };
      continue;
    }
    m.res = bo3(probPartida(A.mazo, B.mazo), r);
  }
}
export const rondaCompleta = s => rondaActual(s).length > 0 && rondaActual(s).every(m => m.res);

/* ══ PASAR DE RONDA ══ */
const ORDEN_CUADRO = [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
export function siguienteRonda(s){
  if(!rondaCompleta(s)) return false;
  if(s.fase === "suizo"){
    if(s.ronda < RONDAS_SUIZAS){ emparejar(s); return true; }
    /* Corte: el cuadro sembrado (el 1 contra el 16…), de forma que el 1 y
       el 2 solo se pueden cruzar en la final. */
    const top = clasificacion(s).slice(0, CORTE);
    s.top = top.map(f => f.id);
    s.fase = "corte";
    s.cuadro.push(ORDEN_CUADRO.map(([x, y], i) => ({ mesa: i + 1, a: top[x-1].id, b: top[y-1].id, res: null, semilla:[x, y] })));
    return true;
  }
  if(s.fase === "corte"){
    const ult = s.cuadro[s.cuadro.length - 1];
    const ganadores = ult.map(m => m.res.ga > m.res.gb ? m.a : m.b);
    if(ganadores.length === 1){ s.fase = "fin"; s.campeon = ganadores[0]; return true; }
    const nueva = [];
    for(let i = 0; i < ganadores.length; i += 2) nueva.push({ mesa: i/2 + 1, a: ganadores[i], b: ganadores[i+1], res: null });
    s.cuadro.push(nueva);
    return true;
  }
  return false;
}

/* ¿Sigo vivo? En el suizo siempre (aunque no pueda entrar en el corte,
   las cinco rondas se juegan). En el cuadro, mientras no haya perdido. */
export function sigoDentro(s){
  const yo = s.jugadores.find(j => j.yo).id;
  if(s.abandono) return false;
  if(s.fase === "suizo") return true;
  if(s.fase === "corte") return rondaActual(s).some(m => (m.a === yo || m.b === yo)
    && (!m.res || (m.a === yo ? m.res.ga > m.res.gb : m.res.gb > m.res.ga)));
  return false;
}

/* Sin mí en el torneo (fuera del corte, eliminado o retirado), el resto
   se juega solo hasta el final. */
export function simularHastaElFinal(s, probPartida){
  let vueltas = 0;
  while(s.fase !== "fin" && vueltas++ < 20){
    if(miMesa(s)) return false;          // aún me toca jugar
    resolverResto(s, probPartida);
    siguienteRonda(s);
  }
  return s.fase === "fin";
}

export function retirarme(s){ s.abandono = true; }

/* ══ EL FINAL ══
   Mi puesto: en el cuadro, por la ronda en que caí (1, 2, 3-4, 5-8,
   9-16); fuera del corte, mi puesto en el suizo. */
export function resultado(s){
  const yo = s.jugadores.find(j => j.yo).id;
  const tabla = clasificacion(s);
  let puesto = tabla.find(f => f.id === yo)?.puesto ?? null, rango = null;
  if(s.top?.includes(yo)){
    const rangos = ["9-16", "5-8", "3-4", "2"];
    const caida = s.cuadro.findIndex(r => r.some(m => (m.a === yo || m.b === yo) && m.res
                      && ((m.a === yo) ? m.res.ga < m.res.gb : m.res.gb < m.res.ga)));
    rango = s.campeon === yo ? "1" : caida >= 0 ? rangos[caida] : null;
  }
  /* El récord del cuadro va aparte: el del suizo es el que ordena. */
  const miCorte = { ganados: 0, perdidos: 0 };
  for(const m of s.cuadro.flat()) if(m.res && (m.a === yo || m.b === yo))
    ((m.a === yo) ? m.res.ga > m.res.gb : m.res.gb > m.res.ga) ? miCorte.ganados++ : miCorte.perdidos++;
  const desglose = {};
  for(const id of (s.top ?? [])){ const m = jugador(s, id).mazo; desglose[m] = (desglose[m] ?? 0) + 1; }
  return { campeon: s.campeon != null ? jugador(s, s.campeon) : null, puestoSuizo: puesto, rango,
           enCorte: !!s.top?.includes(yo), desglose,
           miRegistro: registro(s, yo), miCorte };
}

/* ══ LA TABLA DE CRUCES ══
   `cruces` = { mazos:[nombres], cruces:{ "i-j":{gana,tablas,n} } }, i<j:
   partidas que gana el mazo i. Un empate cuenta medio, y se tira un poco
   hacia el 50 % (5 partidas de cada) para que un cruce medido con pocas
   partidas no salga 0 % o 100 %. Mazo desconocido (uno propio): 50 %. */
export function probDesdeCruces(cruces){
  const idx = new Map((cruces?.mazos ?? []).map((n, i) => [n, i]));
  return (A, B) => {
    if(A === B) return 0.5;
    const i = idx.get(A), j = idx.get(B);
    if(i == null || j == null) return 0.5;
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const c = cruces.cruces?.[k];
    if(!c) return 0.5;
    const pi = (c.gana + 0.5 * (c.tablas ?? 0) + 5) / (c.n + 10);
    return i < j ? pi : 1 - pi;
  };
}

/* Para guardar: lo que venga de localStorage se comprueba antes de usar. */
export function sanearSuizo(s){
  if(!s || s.v !== SUIZO_VERSION || !Array.isArray(s.jugadores) || s.jugadores.length !== JUGADORES) return null;
  if(!Array.isArray(s.rondas) || !Array.isArray(s.cuadro)) return null;
  return s;
}
