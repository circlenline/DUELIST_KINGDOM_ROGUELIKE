/* ════════════════════════════════════════════════════════════════
   PENSAR · la IA simula antes de jugar

   E, 17-09: «no hay método de pararse a analizar las posiciones… el
   objetivo de la IA no es jugar cartas, sino ganar la partida». La
   heurística de brain.js puntúa cada carta por separado con reglas
   escritas a mano; eso no ve la jugada entera ni lo que el rival puede
   contestar.

   Esto hace lo que hace un jugador: antes de comprometer el turno, se
   imagina cada opción y lo que pasaría después.

     1. Toma SOLO lo que el bot puede saber: su mano, su mazo (lo que le
        queda), todo lo que está boca arriba, cementerios y desterradas,
        cuántas cartas tiene el rival en mano y cuántas tapadas, y lo que
        ya ha visto de esas tapadas.
     2. Imagina MUNDOS: rellena lo oculto del rival con una muestra
        plausible. El mazo del rival se deduce de lo que ha enseñado
        (qué mazo meta encaja mejor con sus cartas vistas) y de ahí salen
        su mano, sus tapadas y su mazo. Nunca se mira la partida real.
     3. En cada mundo monta el tablero en el MOTOR real (reglas, cadenas,
        Lua) y juega cada opción: su jugada, el resto de su turno y el
        turno entero del rival, con los dos lados jugando con la
        heurística de experto.
     4. Puntúa cómo queda: vida, cartas en mano, lo que hay en la mesa y,
        por encima de todo, si alguien ha ganado.
     5. Elige la opción que mejor queda EN MEDIA de todos los mundos. Los
        mundos son los mismos para todas las opciones, para compararlas
        en igualdad.

   Se usa en la Main Phase 1, para cada jugada. Si algo falla, devuelve
   null y juega la heurística de siempre.

   Límites conocidos (medidos o sabidos):
     · el mundo reconstruido no trae enganches (Snatch Steal, Premature),
       contadores de turno ni efectos "una vez por turno" ya gastados;
     · el rival imaginado juega con la heurística, no como un humano;
     · cuesta tiempo: cada mundo es un duelo nuevo en el motor.
   ════════════════════════════════════════════════════════════════ */
import { vistaDe, recordadaEnSitio } from "./view.js";
import { valorCarta } from "./evaluar.js";
import { canon } from "./knowledge.js";

const LOCP = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
const tapadaP = pos => !!(pos & 0x0a);
const xorshiftP = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
const barajarP = (a, r) => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

export function crearPensador({ X, crearLib, GoatDuel, crearCerebro, db, names, scriptReader,
                                mazosMeta = [], mundos = 4, maxCandidatos = 6, maxPasos = 2500,
                                margen = 0.35, traza = null, presupuestoMs = Infinity,
                                ceder = null, maxPorTurno = 8, recicladaCada = 150 }){
  const R = X.OcgResponseType, T = X.OcgMessageType, IA = X.SelectIdleCMDAction;
  const M = X.OcgDuelMode;
  const FLAGS = (BigInt(M.MODE_GOAT) & ~BigInt(M.FIRST_TURN_DRAW)) | BigInt(M.ATTACK_FIRST_TURN) | BigInt(M.PSEUDO_SHUFFLE);
  const nombreDe = code => names[code]?.name ?? "";
  const carta = code => ({ code, nombre:nombreDe(code), datos:db.get(code) ?? null });
  const esMonstruo = code => !!((db.get(code)?.type ?? 0) & 0x1);
  const esExtra = code => !!((db.get(code)?.type ?? 0) & (0x40 | 0x2000));   // fusión / sincro
  const nivelDe = code => db.get(code)?.level ?? 0;

  /* ── 1 · lo que el bot sabe ── */
  function observar(duel, yo){
    const v = vistaDe(duel, yo, db, names);
    const riv = 1 - yo;
    const lado = p => duel.zones[p];
    const campo = (p, loc) => (lado(p)[loc] ?? []).map((c, seq) => c ? { c, seq } : null).filter(Boolean);
    const mio = {
      mano: (lado(yo)[LOCP.HAND] ?? []).map(c => c.code),
      monstruos: campo(yo, LOCP.MZONE).map(({c,seq}) => ({ code:c.code, seq, pos:c.position, owner: c.owner === riv ? 1 : 0 })),
      mt: campo(yo, LOCP.SZONE).map(({c,seq}) => ({ code:c.code, seq, pos:c.position, owner: c.owner === riv ? 1 : 0 })),
      gy: (lado(yo)[LOCP.GRAVE] ?? []).map(c => c.code),
      ban: (lado(yo)[LOCP.REMOVED] ?? []).map(c => c.code),
      extra: (lado(yo)[LOCP.EXTRA] ?? []).map(c => c.code),
      mazo: v.mazo, mazoCuantas: (lado(yo)[LOCP.DECK] ?? []).length,
    };
    const suyoCampo = loc => campo(riv, loc).map(({c,seq}) => {
      const oculta = tapadaP(c.position);
      const sabida = oculta ? recordadaEnSitio(duel, yo, riv, loc, seq)?.code ?? null : c.code;
      return { code: sabida, seq, pos:c.position, owner: c.owner === yo ? 0 : 1 };
    });
    const suyo = {
      monstruos: suyoCampo(LOCP.MZONE), mt: suyoCampo(LOCP.SZONE),
      gy: (lado(riv)[LOCP.GRAVE] ?? []).map(c => c.code),
      ban: (lado(riv)[LOCP.REMOVED] ?? []).map(c => c.code),
      manoCuantas: (lado(riv)[LOCP.HAND] ?? []).length,
      mazoCuantas: (lado(riv)[LOCP.DECK] ?? []).length,
      extraCuantas: (lado(riv)[LOCP.EXTRA] ?? []).length,
    };
    return { yo, mio, suyo, lp:[duel.lp[yo], duel.lp[riv]] };
  }

  /* ── 2 · qué mazo puede ser el suyo ── */
  function mazosProbables(obs){
    const vistos = new Map();
    const ver = code => { if(!code) return; const k = canon(nombreDe(code)); vistos.set(k, (vistos.get(k) ?? 0) + 1); };
    obs.suyo.gy.forEach(ver); obs.suyo.ban.forEach(ver);
    obs.suyo.monstruos.forEach(x => ver(x.code)); obs.suyo.mt.forEach(x => ver(x.code));
    const pesos = mazosMeta.map(mz => {
      const cuenta = new Map();
      for(const c of mz.main) { const k = canon(nombreDe(c)); cuenta.set(k, (cuenta.get(k) ?? 0) + 1); }
      let encajan = 0, noEncajan = 0;
      for(const [k, n] of vistos){
        const hay = cuenta.get(k) ?? 0;
        encajan += Math.min(n, hay); noEncajan += Math.max(0, n - hay);
      }
      return Math.exp(1.2 * encajan - 0.8 * noEncajan);
    });
    return { vistos, pesos };
  }

  function sacar(bolsa, r, filtro){
    const idx = [];
    bolsa.forEach((c, i) => { if(!filtro || filtro(c)) idx.push(i); });
    if(!idx.length) return null;
    const i = idx[(r() * idx.length) | 0];
    return bolsa.splice(i, 1)[0];
  }

  /* ── 2b · un mundo ── */
  function muestrearMundo(obs, r, probables){
    const tot = probables.pesos.reduce((a,b)=>a+b, 0);
    let u = r() * tot, elegido = mazosMeta[0];
    for(let i=0;i<mazosMeta.length;i++){ u -= probables.pesos[i]; if(u <= 0){ elegido = mazosMeta[i]; break; } }
    // la bolsa: su mazo menos lo que ya ha enseñado
    const bolsa = [...(elegido?.main ?? [])];
    const quitar = new Map(probables.vistos);
    for(let i = bolsa.length - 1; i >= 0; i--){
      const k = canon(nombreDe(bolsa[i]));
      if((quitar.get(k) ?? 0) > 0){ quitar.set(k, quitar.get(k) - 1); bolsa.splice(i, 1); }
    }
    const baraja = barajarP(bolsa, r);
    const relleno = () => baraja.length ? baraja.pop() : (elegido?.main?.[(r() * elegido.main.length) | 0]);
    const suyo = { monstruos:[], mt:[], gy:[...obs.suyo.gy], ban:[...obs.suyo.ban], mano:[], deck:[], extra:[] };
    for(const x of obs.suyo.monstruos){
      const code = x.code ?? sacar(baraja, r, c => esMonstruo(c) && nivelDe(c) <= 4) ?? relleno();
      suyo.monstruos.push({ code, seq:x.seq, pos:x.pos, owner:x.owner });
    }
    for(const x of obs.suyo.mt){
      const code = x.code ?? sacar(baraja, r, c => !esMonstruo(c)) ?? relleno();
      suyo.mt.push({ code, seq:x.seq, pos:x.pos, owner:x.owner });
    }
    for(let i=0;i<obs.suyo.manoCuantas;i++) suyo.mano.push(relleno());
    for(let i=0;i<obs.suyo.mazoCuantas;i++) suyo.deck.push(relleno());
    suyo.extra = (elegido?.extra ?? []).slice(0, obs.suyo.extraCuantas);
    const listaMazo = [];
    for(const [code, n] of (obs.mio.mazo ?? new Map())) for(let i=0;i<n;i++) listaMazo.push(code);
    let miDeck = barajarP(listaMazo, r).slice(0, obs.mio.mazoCuantas);
    while(miDeck.length < obs.mio.mazoCuantas && listaMazo.length) miDeck.push(listaMazo[(r()*listaMazo.length)|0]);
    const mio = { monstruos:obs.mio.monstruos, mt:obs.mio.mt, mano:obs.mio.mano, gy:obs.mio.gy,
                  ban:obs.mio.ban, extra:obs.mio.extra, deck:miDeck };
    return { layout:{ 0:mio, 1:suyo }, lp:obs.lp, mazoRival: elegido?.nombre ?? "?",
             decklist:{ 0:[...listaMazo, ...obs.mio.mano], 1:[...(elegido?.main ?? [])] } };
  }

  /* ── 4 · cómo de bien queda ── */
  function puntuar(sim, ganador){
    if(ganador === 0) return 100;
    if(ganador === 1) return -100;
    const lado = p => {
      const z = sim.zones[p];
      const mano = (z[LOCP.HAND] ?? []).length;
      let mesa = 0;
      for(const c of (z[LOCP.MZONE] ?? [])) if(c)
        mesa += valorCarta(carta(c.code)) + Math.max(0, (c.atkReal ?? db.get(c.code)?.attack ?? 0)) / 2000;
      for(const c of (z[LOCP.SZONE] ?? [])) if(c) mesa += 0.7 * valorCarta(carta(c.code));
      return { mano, mesa };
    };
    const a = lado(0), b = lado(1);
    const lp0 = sim.lp[0], lp1 = sim.lp[1];
    const vida = lp => lp / 1000 - (lp < 2500 ? (2500 - lp) / 1000 : 0);   // los últimos puntos valen más
    /* El reloj del mazo (guía C24): con pocas cartas en el taco, cada
       turno que pasa acerca la derrota por no poder robar. Sin esto la
       simulación no veía nunca que pasar gana cuando el mazo del rival se
       acaba antes, y le abría la mesa por tres puntos de ficha. */
    const reloj = p => { const d = (sim.zones[p][LOCP.DECK] ?? []).length; return d < 6 ? (6 - d) * 0.7 : 0; };
    return 0.8 * (vida(lp0) - vida(lp1)) + 0.9 * (a.mano - b.mano) + (a.mesa - b.mesa)
           + reloj(1) - reloj(0);
  }

  /* La misma jugada, encontrada en la pregunta del mundo simulado. */
  const LISTAS = [["summons", IA.SELECT_SUMMON], ["special_summons", IA.SELECT_SPECIAL_SUMMON],
                  ["pos_changes", IA.SELECT_POS_CHANGE], ["monster_sets", IA.SELECT_MONSTER_SET],
                  ["spell_sets", IA.SELECT_SPELL_SET], ["activates", IA.SELECT_ACTIVATE]];
  function candidatos(m){
    const out = [];
    for(const [campo, action] of LISTAS)
      (m[campo] ?? []).forEach((l, index) => out.push({ action, index, code:l.code, location:l.location,
                                                        sequence:l.sequence, campo, description:l.description }));
    if(m.to_bp) out.push({ action:IA.TO_BP, index:null });
    if(m.to_ep) out.push({ action:IA.TO_EP, index:null });
    return out;
  }
  function traducir(cand, q){
    if(cand.index == null) return (cand.action === IA.TO_BP ? q.to_bp : q.to_ep)
      ? { type:R.SELECT_IDLECMD, action:cand.action, index:null } : null;
    const lista = q[cand.campo] ?? [];
    const fijo = cand.location === LOCP.MZONE || cand.location === LOCP.SZONE;
    const i = lista.findIndex(l => l.code === cand.code && l.location === cand.location
                                 && (!fijo || l.sequence === cand.sequence)
                                 && (cand.description == null || l.description === cand.description));
    return i < 0 ? null : { type:R.SELECT_IDLECMD, action:cand.action, index:i };
  }

  const BA = X.SelectBattleCMDAction;
  function candidatosBatalla(m){
    const out = (m.attacks ?? []).map((l, index) => ({ action:BA.SELECT_BATTLE, index, code:l.code, sequence:l.sequence }));
    if(m.to_m2) out.push({ action:BA.TO_M2, index:null });
    if(m.to_ep) out.push({ action:BA.TO_EP, index:null });
    return out;
  }
  function traducirBatalla(cand, q){
    if(cand.index == null){
      const ok = cand.action === BA.TO_M2 ? q.to_m2 : q.to_ep;
      return ok ? { type:R.SELECT_BATTLECMD, action:cand.action, index:null } : null;
    }
    const i = (q.attacks ?? []).findIndex(l => l.code === cand.code && l.sequence === cand.sequence);
    return i < 0 ? null : { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:i };
  }

  /* ── 3 · jugar un mundo con una opción ── */
  async function jugar(mundo, cand, semilla, puedeInvocar, modo = "idle"){
    const lib = await libCompartida();
    let ganador = null;
    const sim = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent: e => { if(e.t === "win") ganador = e.player; } });
    await sim.createFromLayout({ layout:mundo.layout, flags:FLAGS, seed:[BigInt(semilla), 3n, 5n, 7n],
                                 lp0:mundo.lp[0], lp1:mundo.lp[1], decklist:mundo.decklist });
    let azar = xorshiftP(semilla * 7 + 1);
    const cerebros = [0,1].map(p => crearCerebro({ X, duel:sim, db, names, nivel:"experto", yo:p, rng:() => azar() }));
    const trivial = crearTrivial(), generico = crearGenerico();
    let aplicada = false, ultimo = null, intento = 0;
    for(let paso = 0; paso < maxPasos && !sim.finished; paso++){
      const q = await sim.run();
      if(!q || sim.finished) break;
      if(sim.turnCount >= 3) break;                     // vuelve a ser mi turno: se para aquí
      if(q !== ultimo){ ultimo = q; intento = 0; }
      let resp = null;
      if(!aplicada && modo === "idle" && q.player === 0 && q.type === T.SELECT_IDLECMD){
        resp = traducir(cand, q);
        if(!resp) return null;                           // esta jugada no existe en este mundo
        aplicada = true;
      } else if(!aplicada && modo === "batalla" && q.player === 0 && sim.turnCount === 1 && q.type === T.SELECT_IDLECMD && sim.phase === 4){
        // el mundo empieza en la Main Phase 1: se va directo a la batalla
        if(!q.to_bp) return null;
        resp = { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };
      } else if(!aplicada && modo === "batalla" && q.player === 0 && q.type === T.SELECT_BATTLECMD){
        resp = traducirBatalla(cand, q);
        if(!resp) return null;
        aplicada = true;
      } else {
        let preg = q;
        if(!puedeInvocar && q.player === 0 && sim.turnCount === 1 && q.type === T.SELECT_IDLECMD)
          preg = { ...q, summons:[], monster_sets:[] };
        resp = trivial(preg) ?? cerebros[q.player](preg, intento) ?? generico(preg, intento);
        if(resp && preg !== q && resp.type === R.SELECT_IDLECMD && resp.index != null){
          // re-traducir el índice de la lista recortada a la original
          const campo = LISTAS.find(([,a]) => a === resp.action)?.[0];
          const l = preg[campo]?.[resp.index];
          resp = { ...resp, index: (q[campo] ?? []).indexOf(l) };
        }
      }
      intento++;
      if(!resp || intento > 12) break;
      sim.respond(resp);
    }
    try{ lib.destroyDuel?.(sim.handle); }catch(e){}
    contarDuelo();
    return puntuar(sim, ganador);
  }
  let crearTrivial = null, crearGenerico = null;
  /* Un solo motor wasm para todas las simulaciones: crear uno por mundo
     cuesta más que el propio duelo. Cada mundo es un duelo nuevo dentro
     de él y se destruye al acabar. */
  let libPromesa = null, duelosSimulados = 0;
  const libCompartida = () => (libPromesa ??= Promise.resolve(crearLib()));
  /* ══ EL MOTOR SIMULADO SE JUBILA CADA TANTOS DUELOS ══
     `destroyDuel` libera dentro del montón de wasm, pero ese montón NO
     encoge: simulando miles de duelos seguidos la memoria del proceso
     sube sin parar (medido: 3 GB en una tanda larga). Cada N duelos se
     suelta la instancia entera y se crea otra; la vieja se la lleva el
     recolector con todo su montón. */
  function contarDuelo(){
    if(++duelosSimulados % recicladaCada === 0) libPromesa = null;
  }

  /* Juega todas las opciones en los mismos mundos y devuelve las medias. */
  async function compararOpciones(duel, yo, elegidos, semilla, puedeInvocar, modo){
    const obs = observar(duel, yo);
    const probables = mazosProbables(obs);
    const r = xorshiftP(semilla);
    const listaMundos = Array.from({ length:mundos }, () => muestrearMundo(obs, r, probables));
    const t0 = (globalThis.performance ?? Date).now();
    const acum = elegidos.map(cand => ({ cand, suma:0, n:0, porMundo:[] }));
    let mundosJugados = 0;
    for(let w = 0; w < listaMundos.length; w++){
      if(w >= 2 && (globalThis.performance ?? Date).now() - t0 > presupuestoMs) break;
      for(const a of acum){
        const s = await jugar(listaMundos[w], a.cand, semilla * 31 + w, puedeInvocar, modo);
        if(ceder) await ceder();
        a.porMundo[w] = s;
        if(s == null) continue;
        a.suma += s; a.n++;
      }
      mundosJugados++;
    }
    return { resultados: acum.filter(a => a.n).map(a => ({ cand:a.cand, media:a.suma / a.n, n:a.n, porMundo:a.porMundo })),
             mundos: listaMundos.slice(0, mundosJugados).map(x => x.mazoRival),
             ms: Math.round((globalThis.performance ?? Date).now() - t0) };
  }

  /* Lo que se sabe del turno en curso: si queda invocación normal. Lo
     dice la última pregunta de Main Phase que vio el bot. */
  let turnoVisto = -1, invocacionLibre = true;
  /* Tope de simulaciones por turno. Sin esto, una partida atascada —dos
     mazos de aguantar dándose vueltas— multiplica el turno por el número
     de decisiones y el bot se queda pensando eternamente. Pasado el tope,
     manda la heurística, que para eso está. */
  let idleTurno = -1, idlePensados = 0;
  function verIdle(duel, m){
    if(m?.type !== T.SELECT_IDLECMD) return;
    turnoVisto = duel.turnCount;
    invocacionLibre = ((m.summons?.length ?? 0) + (m.monster_sets?.length ?? 0)) > 0;
  }

  /* ── 5b · la batalla: a quién se ataca y si se ataca ──
     Solo en la PRIMERA pregunta de batalla del turno: el mundo imaginado
     no sabe qué monstruos han atacado ya. */
  async function pensarBatalla(duel, yo, m, cerebro, { semilla = 1, primeraDelTurno = false } = {}){
    if(m.type !== T.SELECT_BATTLECMD || !primeraDelTurno) return null;
    const todos = candidatosBatalla(m);
    if(!(m.attacks?.length) || todos.length <= 1) return null;
    const heurResp = cerebro ? cerebro(m, 0) : null;
    const puedeInvocar = turnoVisto === duel.turnCount ? invocacionLibre : false;
    const cmp = await compararOpciones(duel, yo, todos, semilla, puedeInvocar, "batalla");
    if(!cmp.resultados.length) return null;
    cmp.resultados.sort((a,b) => b.media - a.media);
    const mejor = cmp.resultados[0];
    const heur = heurResp && cmp.resultados.find(x => x.cand.action === heurResp.action
                                                   && (x.cand.index ?? null) === (heurResp.index ?? null));
    const escoge = (heur && mejor !== heur && mejor.media - heur.media < margen) ? heur : mejor;
    traza?.({ fase:"batalla", mundos:cmp.mundos, ms:cmp.ms, opciones: cmp.resultados.map(x => ({
      jugada: x.cand.index == null ? (x.cand.action === BA.TO_M2 ? "a Main 2" : "terminar") : `ataca con ${nombreDe(x.cand.code)}`,
      media:+x.media.toFixed(2) })), elige: escoge === heur ? "heurística" : "simulación" });
    return { type:R.SELECT_BATTLECMD, action:escoge.cand.action, index:escoge.cand.index };
  }

  /* ══════════════════════════════════════════════════════════════
     6 · PENSAR EN EL TURNO DEL RIVAL (la ventana de cadena)

     Aquí es donde se gastan mal las trampas, y aquí no se puede montar
     el mundo tal cual: el motor está a media resolución —ataque
     declarado, cadena abierta— y eso no se reconstruye colocando cartas.

     Así que se parte en dos: el TRAMO CORTO (lo que queda de esta
     batalla) se calcula a mano, con las reglas del combate, y a partir de
     ahí manda otra vez el motor: se monta el tablero resultante y se
     juega el turno propio siguiente. Las dos ramas —responder o no—
     pasan por el mismo modelo, así que el error del modelo se va en la
     resta y lo que queda es la comparación.

     Solo se piensa con cartas cuyo efecto en batalla se sabe escribir
     (la tabla de abajo). Con cualquier otra, manda la heurística.
     ══════════════════════════════════════════════════════════════ */
  const RESPUESTAS = {
    "Sakuretsu Armor":     { destruyeAtacante:true, cortaAtaque:true },
    "Mirror Force":        { destruyeTodosAtaque:true, cortaBatalla:true },
    "Ring of Destruction": { destruyeAtacante:true, cortaAtaque:true, dañoAmbos:"atacante" },
    "Magic Cylinder":      { cortaAtaque:true, dañoRival:"atacante" },
    "Waboku":              { cortaBatalla:true, sinDaño:true },
    /* Threatening Roar impide DECLARAR ataques: el que ya está declarado
       sigue (E, 25-09, PACMAN T4). Solo corta los que vienen detrás. */
    "Threatening Roar":    { cortaSiguientes:true },
    "Book of Moon":        { tapaAtacante:true, cortaAtaque:true },
    "Scapegoat":           { fichas:4 },
    "Dust Tornado":        { rompeBackrow:true },
    "Mystical Space Typhoon": { rompeBackrow:true },
  };

  const atkDe = c => c?.atkReal ?? db.get(c?.code)?.attack ?? 0;
  const defDe = c => c?.defReal ?? db.get(c?.code)?.defense ?? 0;

  /* El combate que queda, resuelto con las reglas de 2005: el que ataca
     contra el que defiende, y los demás atacantes después. Devuelve el
     tablero y los LP como quedarían. Nada de esto toca el motor. */
  function resolverBatalla(mundo, { atacanteSeq, objetivoSeq, efecto = {}, yaAtacaron = new Set() }){
    const mio = mundo.layout[0], suyo = mundo.layout[1];
    const lp = [...mundo.lp];
    const fuera = new Set();                 // seq de monstruos suyos destruidos
    const fueraMio = new Set();
    if(efecto.fichas){
      const libres = [0,1,2,3,4].filter(z => !mio.monstruos.some(m => m.seq === z));
      for(const z of libres.slice(0, efecto.fichas))
        mio.monstruos.push({ code: FICHA, seq:z, pos:4, owner:0, ficha:true });
    }
    if(efecto.rompeBackrow && suyo.mt.length) suyo.mt.pop();
    if(efecto.destruyeTodosAtaque)
      for(const c of suyo.monstruos) if(!tapadaP(c.pos) && c.pos === 1) fuera.add(c.seq);
    if(efecto.destruyeAtacante && atacanteSeq != null) fuera.add(atacanteSeq);
    if(efecto.tapaAtacante && atacanteSeq != null){
      const a = suyo.monstruos.find(c => c.seq === atacanteSeq); if(a) a.pos = 8;
    }
    if(efecto.dañoAmbos === "atacante" && atacanteSeq != null){
      const a = suyo.monstruos.find(c => c.seq === atacanteSeq);
      const d = atkDe(a); lp[0] -= d; lp[1] -= d;
    }
    if(efecto.dañoRival === "atacante" && atacanteSeq != null){
      const a = suyo.monstruos.find(c => c.seq === atacanteSeq);
      lp[1] -= atkDe(a);
    }
    /* Los ataques que quedan: el declarado (si sigue vivo y no se ha
       cortado) y después el resto de sus monstruos que pueden atacar. */
    const orden = [];
    if(!efecto.cortaBatalla){
      if(atacanteSeq != null && !efecto.cortaAtaque && !fuera.has(atacanteSeq)) orden.push(atacanteSeq);
      if(!efecto.cortaSiguientes) for(const c of suyo.monstruos)
        if(!fuera.has(c.seq) && c.seq !== atacanteSeq && !tapadaP(c.pos) && c.pos === 1 && !yaAtacaron.has(c.seq))
          orden.push(c.seq);
    }
    for(const seq of orden){
      const a = suyo.monstruos.find(c => c.seq === seq);
      if(!a) continue;
      const libres = mio.monstruos.filter(c => !fueraMio.has(c.seq));
      /* El primer ataque va contra el objetivo declarado; los demás,
         contra el monstruo que más estorba (así juega cualquiera). */
      let obj = null;
      if(seq === atacanteSeq && objetivoSeq != null) obj = libres.find(c => c.seq === objetivoSeq) ?? null;
      else obj = libres.slice().sort((x,y) => (tapadaP(y.pos)?1200:Math.max(atkDe(y),defDe(y))) - (tapadaP(x.pos)?1200:Math.max(atkDe(x),defDe(x))))[0] ?? null;
      let golpe = atkDe(a);
      /* Injection Fairy Lily: su dueño paga 2000 y pega con 3000 más
         (sin esto, la simulación creía que detrás venía un 400). */
      if(canon(nombreDe(a.code)) === "Injection Fairy Lily" && lp[1] > 2000){ golpe += 3000; lp[1] -= 2000; }
      if(!obj){ if(!efecto.sinDaño) lp[0] -= golpe; continue; }
      const defiende = tapadaP(obj.pos) || obj.pos === 4 || obj.pos === 8;
      const aguante = defiende ? defDe(obj) : atkDe(obj);
      if(golpe > aguante){
        fueraMio.add(obj.seq);
        if(!defiende && !efecto.sinDaño) lp[0] -= (golpe - aguante);
      } else if(golpe < aguante){
        /* Se estrella: si el mío estaba de frente, muere el suyo y el daño
           se lo lleva él; si estaba agachado, el rebote es para el que
           ataca (regla de 2005, sin perforación). */
        if(!defiende){ fuera.add(a.seq); if(!efecto.sinDaño) lp[1] -= (aguante - golpe); }
        else if(!efecto.sinDaño) lp[1] -= (aguante - golpe);
      } else if(!defiende){ fuera.add(a.seq); fueraMio.add(obj.seq); }
    }
    mio.monstruos = mio.monstruos.filter(c => !fueraMio.has(c.seq));
    suyo.monstruos = suyo.monstruos.filter(c => !fuera.has(c.seq));
    mundo.lp = [Math.max(0, lp[0]), Math.max(0, lp[1])];
    return mundo;
  }
  const FICHA = 73915052;     // Sheep Token

  function clonarMundo(m){
    return { layout:{ 0:{ ...m.layout[0], monstruos:m.layout[0].monstruos.map(x=>({...x})), mt:m.layout[0].mt.map(x=>({...x})), mano:[...m.layout[0].mano] },
                      1:{ ...m.layout[1], monstruos:m.layout[1].monstruos.map(x=>({...x})), mt:m.layout[1].mt.map(x=>({...x})), mano:[...m.layout[1].mano] } },
             lp:[...m.lp], mazoRival:m.mazoRival, decklist:m.decklist };
  }

  /* Juega el mundo YA resuelto el combate: el motor toma el relevo en el
     turno propio siguiente. */
  async function jugarDesde(mundo, semilla){
    const lib = await libCompartida();
    let ganador = null;
    if(mundo.lp[0] <= 0) return -100;
    if(mundo.lp[1] <= 0) return 100;
    const sim = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent: e => { if(e.t === "win") ganador = e.player; } });
    await sim.createFromLayout({ layout:mundo.layout, flags:FLAGS, seed:[BigInt(semilla), 3n, 5n, 7n],
                                 lp0:mundo.lp[0], lp1:mundo.lp[1], decklist:mundo.decklist });
    let azar = xorshiftP(semilla * 7 + 1);
    const cerebros = [0,1].map(p => crearCerebro({ X, duel:sim, db, names, nivel:"experto", yo:p, rng:() => azar() }));
    const trivial = crearTrivial(), generico = crearGenerico();
    let ultimo = null, intento = 0;
    for(let paso = 0; paso < maxPasos && !sim.finished; paso++){
      const q = await sim.run();
      if(!q || sim.finished) break;
      if(sim.turnCount >= 3) break;
      if(q !== ultimo){ ultimo = q; intento = 0; }
      const resp = trivial(q) ?? cerebros[q.player](q, intento) ?? generico(q, intento);
      intento++;
      if(!resp || intento > 12) break;
      sim.respond(resp);
    }
    try{ lib.destroyDuel?.(sim.handle); }catch(e){}
    contarDuelo();
    return puntuar(sim, ganador);
  }

  /* Cuántas veces se ha pensado ya en este turno y contra qué ataque: una
     ventana de cadena se repite después de cada eslabón, y pensar tres
     veces lo mismo solo alarga el turno. */
  let cadenaTurno = -1, cadenasPensadas = 0, ataquePensado = null, noRespondoA = null;
  async function pensarCadena(duel, yo, m, cerebro, { semilla = 1, maxPorTurno = 3 } = {}){
    if(m.type !== T.SELECT_CHAIN || m.forced) return null;
    const opciones = m.selects ?? [];
    if(!opciones.length) return null;
    const v = vistaDe(duel, yo, db, names);
    if(v.turnoMio) return null;                       // esto es para SU turno
    const atacante = duel.atacante && duel.atacante.controller !== yo ? duel.atacante : null;
    if(!atacante) return null;                        // de momento, solo la batalla
    if(cadenaTurno !== duel.turnCount){ cadenaTurno = duel.turnCount; cadenasPensadas = 0; ataquePensado = null; noRespondoA = null; }
    /* ══ LO QUE SE DECIDIÓ PARA ESTE ATAQUE VALE PARA SUS VENTANAS ══
       E, 02-10 (Zombie, p2, T6): la simulación dijo «no responder» al
       ataque de la D.D. Warrior Lady contra una ficha, y en la ventana
       siguiente del MISMO ataque la heurística tiró Book of Moon. Sin un
       eslabón nuevo en la cadena, el ataque es el mismo: se mantiene. */
    if(ataquePensado === atacante.uid){
      if(noRespondoA === atacante.uid && !(duel.cadena?.length)) return { type:R.SELECT_CHAIN, index:null };
      return null;                                     // ya pensado este ataque
    }
    if(cadenasPensadas >= maxPorTurno) return null;
    /* Solo las cartas cuyo efecto en batalla sabemos escribir. */
    /* Lo que la heurística veta, o lo que GUARDA para algo concreto (la
       Sakuretsu para un atacante de 1700, que puede ser la Lily que viene
       detrás), no lo gasta la simulación. */
    const vetos = new Set((cerebro?.puntosCadena?.() ?? []).filter(x => x.p <= -1 || x.guardada).map(x => x.index));
    const usables = opciones.map((l, index) => ({ index, l, nombre: canon(nombreDe(l.code)) }))
                            .filter(x => RESPUESTAS[x.nombre] && !vetos.has(x.index));
    if(!usables.length) return null;

    cadenasPensadas++; ataquePensado = atacante.uid;
    const obs = observar(duel, yo);
    const probables = mazosProbables(obs);
    const r = xorshiftP(semilla);
    /* Menos mundos que en la Main Phase: aquí se comparan dos o tres
       ramas, no diez jugadas, y el turno del rival no puede eternizarse. */
    const cuantos = Math.min(mundos, 6);
    const base = Array.from({ length:cuantos }, () => muestrearMundo(obs, r, probables));
    const atacanteSeq = duel.cards.get(atacante.uid)?.sequence ?? null;
    const objetivoSeq = duel.objetivoAtaque ? duel.cards.get(duel.objetivoAtaque.uid)?.sequence ?? null : null;
    const t0 = (globalThis.performance ?? Date).now();

    const ramas = [{ nombre:"no responder", index:null, efecto:{} },
                   ...usables.map(x => ({ nombre:nombreDe(x.l.code), index:x.index, efecto:RESPUESTAS[x.nombre],
                                          carta:{ code:x.l.code, location:x.l.location, sequence:x.l.sequence } }))];
    const acum = ramas.map(x => ({ rama:x, suma:0, n:0, porMundo:[] }));
    for(let w = 0; w < base.length; w++){
      if(w >= 2 && (globalThis.performance ?? Date).now() - t0 > Math.min(presupuestoMs, 2500)) break;
      for(const a of acum){
        const mundo = clonarMundo(base[w]);
        /* La carta que se gasta sale del tablero imaginado. */
        if(a.rama.carta){
          const c = a.rama.carta;
          if(c.location === LOCP.SZONE) mundo.layout[0].mt = mundo.layout[0].mt.filter(x => x.seq !== c.sequence);
          else if(c.location === LOCP.HAND){
            const i = mundo.layout[0].mano.indexOf(c.code);
            if(i >= 0) mundo.layout[0].mano.splice(i, 1);
          }
        }
        resolverBatalla(mundo, { atacanteSeq, objetivoSeq, efecto:a.rama.efecto });
        const s = await jugarDesde(mundo, semilla * 31 + w);
        if(ceder) await ceder();
        a.porMundo[w] = s;
        if(s == null) continue;
        a.suma += s; a.n++;
      }
    }
    const res = acum.filter(a => a.n).map(a => ({ ...a, media:a.suma / a.n }));
    if(res.length < 2) return null;
    res.sort((a,b) => b.media - a.media);
    const noHacerNada = res.find(x => x.rama.index == null);
    const mejor = res[0];
    let escoge = (mejor !== noHacerNada && mejor.media - noHacerNada.media < margen) ? noHacerNada : mejor;
    /* La misma regla del mundo raro que en la Main Phase: si lo que
       propone la simulación solo le gana a lo que haría la heurística por
       un mundo extremo, manda la heurística (medio turno de E, 25-09). */
    const sinMayoria = globalThis.GOAT_PENSAR_SIN_MAYORIA
      || (typeof process !== "undefined" && process.env?.GOAT_PENSAR_SIN_MAYORIA);
    const puntos = cerebro?.puntosCadena?.() ?? [];
    const suya = puntos.filter(x => x.p > 2.4).sort((a,b) => b.p - a.p)[0]?.index ?? null;
    const heur = res.find(x => (x.rama.index ?? null) === suya);
    if(!sinMayoria && heur && escoge !== heur && !sinElRaro(escoge, heur)) escoge = heur;
    noRespondoA = escoge.rama.index == null ? atacante.uid : null;
    traza?.({ fase:"cadena", ms:Math.round((globalThis.performance ?? Date).now() - t0),
              contra:nombreDe(atacante.code),
              opciones:res.map(x => ({ jugada:x.rama.nombre, media:+x.media.toFixed(2) })),
              elige: escoge.rama.nombre });
    return { type:R.SELECT_CHAIN, index: escoge.rama.index };
  }

  /* ¿`a` le sigue ganando a `b` si se quita el mundo más extremo? Los
     dos se jugaron en los mismos mundos, así que se compara mundo a mundo. */
  function sinElRaro(a, b){
    if(!a?.porMundo || !b?.porMundo) return true;
    const d = [];
    for(let w = 0; w < Math.max(a.porMundo.length, b.porMundo.length); w++){
      const x = a.porMundo[w], y = b.porMundo[w];
      if(x != null && y != null) d.push(x - y);
    }
    if(d.length < 3) return true;
    let k = 0; d.forEach((x, i) => { if(Math.abs(x) > Math.abs(d[k])) k = i; });
    const resto = d.filter((_, i) => i !== k);
    return resto.reduce((t, x) => t + x, 0) / resto.length > 0;
  }

  function golpeDirectoLibre(duel, yo){
    const suyos = (duel.zones[1-yo]?.[LOCP.MZONE] ?? []).filter(Boolean);
    if(suyos.length) return false;
    return (duel.zones[yo]?.[LOCP.MZONE] ?? []).some(c => c && !(c.position & 0x0e)
      && (c.atkReal ?? db.get(c.code)?.attack ?? 0) > 0);
  }

  /* ── 5 · la decisión ── */
  async function pensarIdle(duel, yo, m, cerebro, { semilla = 1 } = {}){
    if(m.type !== T.SELECT_IDLECMD) return null;
    verIdle(duel, m);
    if(idleTurno !== duel.turnCount){ idleTurno = duel.turnCount; idlePensados = 0; }
    if(idlePensados >= maxPorTurno) return null;
    idlePensados++;
    const plan = cerebro?.ultimoPlan?.() ?? [];
    const todos = candidatos(m);
    if(todos.length <= 1) return null;
    /* Lo que la heurística marca SEGURO (una razón de reglas, no de
       valoración) no se somete a votación: ver `seguro` en brain.js. */
    if(plan[0]?.seguro && plan[0].puntos > 0.8) return null;
    // la heurística ordena; se simulan las mejores y siempre pasar de fase
    const puntosDe = c => plan.find(p => p.action === c.action && p.index === c.index)?.puntos ?? -1;
    /* ══ LO QUE LA HEURÍSTICA VETA NO LO RESUCITA LA SIMULACIÓN ══
       E, 18-09: «turno 5 scapegoat tokens en atk, ¿por qué?». La
       heurística lo tenía vetado a 0.02 —una ficha en ataque es
       estrictamente peor: 0 de ataque y te comes el golpe entero— pero la
       simulación elige entre SUS candidatos, y con pocas cartas en la mano
       el giro de las fichas entraba en la lista y ganaba por ruido de
       cuatro mundos. Un veto de la heurística es una regla ("esto nunca"),
       no una opinión: lo que puntúa por debajo de 0.15 no se simula. */
    const vetada = c => { const pt = puntosDe(c); return pt !== -1 && pt < 0.15
      || plan.some(p => p.action === c.action && p.index === c.index && p.firme); };
    const ordenados = todos.filter(c => c.index != null && !vetada(c)).sort((a,b) => puntosDe(b) - puntosDe(a));
    /* Dos copias de la misma carta en la mano son la misma jugada: se
       simula una. */
    const vistas = new Set();
    const unicos = ordenados.filter(c => {
      const fijo = c.location === LOCP.MZONE || c.location === LOCP.SZONE;
      const k = `${c.campo}|${c.code}|${c.location}|${fijo ? c.sequence : ""}|${c.description ?? ""}`;
      if(vistas.has(k)) return false; vistas.add(k); return true;
    });
    const elegidos = [...unicos.slice(0, maxCandidatos), ...todos.filter(c => c.index == null)];
    const puedeInvocar = ((m.summons?.length ?? 0) + (m.monster_sets?.length ?? 0)) > 0;
    const cmp = await compararOpciones(duel, yo, elegidos, semilla, puedeInvocar, "idle");
    const resultados = cmp.resultados, listaMundos = cmp.mundos;
    if(!resultados.length) return null;
    resultados.sort((a,b) => b.media - a.media);
    const mejor = resultados[0];
    /* La heurística manda salvo que simular diga claramente otra cosa:
       con pocos mundos hay ruido, y cambiar por una décima es tirar una
       moneda. */
    /* Cuando la heurística no tiene jugada, lo que hace es IR A LA
       BATALLA (si puede), no «lo que la simulación ponga primero entre
       batalla y terminar». E, 19-09: robó un Tribe-Infecting Virus con
       Snatch Steal y no atacó a la tapada de 0 de defensa que tenía
       delante: terminar -1.24 contra a batalla -1.29, ruido puro. */
    const pasoDeFase = resultados.find(x => x.cand.index == null && x.cand.action === IA.TO_BP)
                    ?? resultados.find(x => x.cand.index == null);
    const heur = plan[0] && plan[0].puntos > 0.8
      ? resultados.find(x => x.cand.action === plan[0].action && x.cand.index === plan[0].index)
      : pasoDeFase;
    /* ══ LO QUE NO SE PUEDE SIMULAR NO PIERDE POR INCOMPARECENCIA ══
       Medido (exp-terminar.mjs, 22-09): si la jugada de la heurística no
       existe en el mundo imaginado —el Breaker con su contador, un
       efecto cuya descripción no casa— no entraba en `resultados`, y la
       simulación escogía la mejor de las DEMÁS, a menudo «a batalla» o
       «terminar». Sin con qué compararla, manda la heurística. */
    if(plan[0] && plan[0].puntos > 0.8 && !heur){
      traza?.({ mundos:listaMundos, ms:cmp.ms, opciones: resultados.map(x => ({
        jugada: x.cand.index == null ? (x.cand.action === IA.TO_BP ? "a batalla" : "terminar") : `${x.cand.campo} ${nombreDe(x.cand.code)}`,
        media:+x.media.toFixed(2) })), elige: "heurística (no simulable)" });
      return null;
    }
    /* ══════════════════════════════════════════════════════════════
       NO PASAR EL TURNO ENTERO PORQUE LA SIMULACIÓN LO DIGA

       E, torneo 2 ronda 2 partida 3: «no ha jugado nada, ¿ha brickeado?».
       No había brickeado. Tenía Graceful Charity, Delinquent Duo, MST y
       Book of Moon en la mano y la simulación decía, turno tras turno,
       que lo mejor era terminar: `terminar -4.09` contra `-4.81` para
       TODO lo demás, empatado hasta el segundo decimal.

       Por qué empata todo: después de aplicar la jugada candidata, el
       cerebro del rollout sigue jugando, y se vacía la mano igual da por
       cuál empieces. O sea que la comparación real no es «esta carta o
       aquella» sino «tener Main Phase o no tenerla». Y ahí `puntuar`
       paga 0.9 por CADA carta en la mano, así que no hacer nada puntúa
       como si guardar seis cartas fuera una jugada.

       Terminar el turno no es una jugada: es la ausencia de todas. Si la
       heurística —que sí compara cartas entre sí— tiene algo que hacer,
       la simulación necesita una diferencia GRANDE para convencer de que
       lo mejor es quedarse quieto. Con el margen normal, el bot se
       plantaba con la mano llena y perdía sin jugar. */
    const noEsJugada = x => x?.cand?.index == null && x?.cand?.action === IA.TO_EP;
    const heurJuega = heur && (heur.cand?.index != null || heur.cand?.action === IA.TO_BP);
    const margenReal = (heurJuega && noEsJugada(mejor)) ? margen * 6 : margen;
    let escoge = (heur && mejor !== heur && mejor.media - heur.media < margenReal) ? heur : mejor;
    /* ══ UN MUNDO RARO NO DECIDE POR LOS DEMÁS ══
       E, 25-09 (Reasoning Gate OTK, p2, T3): robó el Kycoo de E con Snatch
       Steal, el campo de E estaba vacío… y terminó el turno sin atacar.
       Repetida la decisión: en 11 de 12 mundos atacar salía igual o mejor;
       en UNO (un Clown Control imaginado) atacar perdía la partida, y ese
       −100 hundía la media de todo lo demás. Con doce mundos, una derrota
       en uno pesa 8 puntos: más que cualquier diferencia real.
       Para que la simulación le lleve la contraria a la heurística tiene
       que seguir ganándole sin ese mundo: se quita el mundo con la
       diferencia más extrema y se mira la media del resto. (Se probó antes
       «ganar en la mayoría de mundos»: cambiaba más decisiones de las que
       debía; esto solo toca el caso del mundo raro.) */
    const sinMayoria = globalThis.GOAT_PENSAR_SIN_MAYORIA
      || (typeof process !== "undefined" && process.env?.GOAT_PENSAR_SIN_MAYORIA);
    if(!sinMayoria && escoge !== heur && heur && !sinElRaro(escoge, heur)) escoge = heur;
    /* ══ CON EL CAMPO RIVAL VACÍO, A LA BATALLA ══
       Terminar la Main Phase 1 teniendo monstruos que pueden pegar
       directo no es una jugada: la heurística de batalla decide luego si
       ataca (y con qué), pero renunciar a la batalla entera por lo que diga
       la media de unos mundos imaginados, no. */
    if(noEsJugada(escoge) && m.to_bp && golpeDirectoLibre(duel, yo)){
      const bp = resultados.find(x => x.cand.index == null && x.cand.action === IA.TO_BP);
      if(bp) escoge = bp;
    }
    /* ══ A LA BATALLA SIN NADA QUE ATAQUE NO SE VA ══
       E, 02-10 (Warrior, p2, T13): «¿por qué ha invocado en la Main
       Phase 2 en lugar de la 1? Así pierde la Battle Phase». Y la p1, T11:
       Pot of Greed en la Main Phase 2. Sin un monstruo mío boca arriba en
       ataque, la batalla está vacía: «a batalla» y luego jugar en la Main
       Phase 2 es lo mismo que jugar ahora… salvo que lo que robo o invoco
       ahora sí puede atacar. La simulación lo veía igual o mejor por ruido
       (o porque su piloto atacaba mal después); la jugada de la heurística
       se hace en la Main Phase 1. */
    const sinAtacantes = !(duel.zones[yo]?.[LOCP.MZONE] ?? []).some(c => c && !(c.position & 0x0e)
      && (c.atkReal ?? db.get(c.code)?.attack ?? 0) > 0);
    if(escoge?.cand?.index == null && escoge?.cand?.action === IA.TO_BP && sinAtacantes
       && heur && heur.cand?.index != null && plan[0]?.puntos > 0.8)
      escoge = heur;
    /* ══ CON EL CAMPO RIVAL VACÍO, PRIMERO SE LEVANTA LO QUE PEGA ══
       E, 03-10 (Reino, Weevil, T26): la heurística quería voltear su
       Basic Insect para pegar directo y la simulación dijo «a batalla»;
       luego lo volteó en la Main Phase 2, sin batalla. Con el campo rival
       vacío, levantar un monstruo antes de la batalla es daño seguro. */
    /* Y no solo frente a «a batalla»: también frente a «terminar».
       Reddit (Jekzie, 14-10): «si tiene monstruos de poco ataque los deja
       en defensa aunque pueda atacar y ganar, con mi campo vacío». Con
       todo en defensa no hay golpe directo libre, así que la regla de
       arriba no convertía «terminar» en «a batalla», y esta solo miraba
       «a batalla»: el bot pasaba el turno con la partida ganada. */
    if(escoge?.cand?.index == null && heur
       && heur.cand?.action === IA.SELECT_POS_CHANGE && plan[0]?.puntos > 0.8
       && !(duel.zones[1-yo]?.[LOCP.MZONE] ?? []).some(Boolean))
      escoge = heur;
    /* Y sin nada que ataque, «a batalla» es lo mismo que terminar con dos
       ventanas más de por medio (GitHub #13). */
    if(escoge?.cand?.index == null && escoge?.cand?.action === IA.TO_BP && sinAtacantes && m.to_ep){
      const fin = resultados.find(x => x.cand.index == null && x.cand.action === IA.TO_EP);
      if(fin) escoge = fin;
    }
    traza?.({ mundos:listaMundos, ms:cmp.ms, opciones: resultados.map(x => ({
      jugada: x.cand.index == null ? (x.cand.action === IA.TO_BP ? "a batalla" : "terminar") : `${x.cand.campo} ${nombreDe(x.cand.code)}`,
      media: +x.media.toFixed(2),
      ...(globalThis.GOAT_PENSAR_MUNDOS ? { porMundo: x.porMundo.map(v => v == null ? null : +v.toFixed(1)) } : {}) })),
      elige: escoge === heur ? "heurística" : "simulación" });
    return { type:R.SELECT_IDLECMD, action:escoge.cand.action, index:escoge.cand.index };
  }

  return {
    pensarIdle, pensarBatalla, pensarCadena, verIdle, observar, muestrearMundo, mazosProbables,
    conPilotos(trivial, generico){ crearTrivial = () => trivial; crearGenerico = () => generico; return this; },
  };
}
