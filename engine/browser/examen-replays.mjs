/* ════════════════════════════════════════════════════════════════
   EXAMEN CONTRA LOS PROS · ¿la IA haría lo mismo que el jugador?

   E, 14-11: «todas estas replays son de pro players… aprende todo lo
   que puedas». `comparar-replays.mjs` mide HÁBITOS (cuántas veces se usa
   cada carta en cada fase) y sirve para ver diferencias grandes. Esto es
   otra cosa: pone a la IA EN LA MISMA POSICIÓN en la que estaba el
   jugador, montada en el motor de verdad, y le pregunta qué haría.

     1. De cada decisión del replay se saca el estado justo antes
        (decisiones.jsonl), desde el punto de vista del que juega.
     2. Se monta en ocgcore con `createFromLayout`: las dos manos, las
        dos mesas (con las tapadas reales), cementerios, desterradas y un
        mazo con lo que queda de su lista. La IA juega en el lado 0 y la
        frontera (`ai/view.js`) le sigue tapando lo que no ve.
     3. Se le hace UNA pregunta —la de la Main Phase o la de la batalla—
        con las opciones que da el motor, recortadas a lo que el jugador
        ya no podía hacer ese turno (invocación normal gastada, monstruos
        que ya atacaron o se giraron).
     4. Se compara con lo que hizo el jugador.

   Además de las jugadas, hay DOS PREGUNTAS DE «PASAR»: al acabar el
   jugador su Main Phase 1 y al acabar sus ataques se le pregunta a la
   IA desde ese estado. Si ella quiere jugar algo más, es una carta que el
   pro se guardó (o un ataque que no hizo).

   Lo que esto NO es: la jugada del pro no es «la correcta». Es un jugador
   de top cut. Una coincidencia alta dice que la IA juega como ellos; una
   discrepancia que se repite es un sitio donde mirar, no un error
   demostrado (INCREMENTO-1 §7). Cada una se mira en el replay antes de
   escribir una regla, y la regla va con su posición en el banco.

   Uso:
     node examen-replays.mjs [max] [opciones]
       --pensar           la IA completa (heurística + simulación en la M1),
                          como en el juego. Lento: ~1-3 s por pregunta.
       --mundos N         mundos de la simulación (12 en el juego)
       --solo <tipos>     invocar,colocar_monstruo,colocar_mt,activar,
                          efecto,voltear,cambiar_pos,especial,atacar,pasar_m1,
                          pasar_bp (separados por comas)
       --muestra K        una de cada K preguntas (repartidas por todo)
       --salida <dir>     por defecto ../replays/out
     GOAT_AI_OFF=<flag>   igual que en el resto de herramientas
   Escribe examen.jsonl (una línea por pregunta) y examen.md (el informe).
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
/* --cerebro <ruta/brain.js>: examinar otra versión (para comparar) */
const RUTA_CEREBRO = (() => { const i = process.argv.indexOf("--cerebro"); return i >= 0 ? process.argv[i + 1] : "./src/ai/brain.js"; })();
const { crearCerebro } = await import(RUTA_CEREBRO.startsWith("/") ? RUTA_CEREBRO : new URL(RUTA_CEREBRO, import.meta.url).href);
const { crearPensador } = await import(new URL(RUTA_CEREBRO.replace(/brain\.js$/, "pensar.js"), RUTA_CEREBRO.startsWith("/") ? "file://" : import.meta.url).href);
import { canon } from "./src/ai/knowledge.js";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MAX = Number(args.find(a => /^\d+$/.test(a)) ?? Infinity);
const PENSAR = args.includes("--pensar");
const MUNDOS = Number(opt("--mundos", 6));
const SOLO = opt("--solo", null)?.split(",") ?? null;
const MUESTRA = Number(opt("--muestra", 1));
const ENTRADA = opt("--entrada", "../replays/out");
const SALIDA = opt("--salida", ENTRADA);
const SUFIJO = opt("--sufijo", "");
const TRAZA = !!process.env.EXAMEN_TRAZA;

const T = X.OcgMessageType, R = X.OcgResponseType, IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
const LOC = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
const POS = { ATK:0x1, DEF:0x4, TAPADA_DEF:0x8, TAPADA:0x8 };

/* ── cartas ── */
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race:BigInt(c.race) }); }
const POOL = new Set(JSON.parse(readFileSync("../data/goat-pool.json", "utf-8")).map(Number));
const base = n => String(n ?? "").replace(/\s*\((GOAT|Pre-Errata|Pre-errata|Anime|Action Field)\)\s*$/i, "").trim().toLowerCase();
const PORNOMBRE = new Map();
for(const code in names){
  const n = names[code]?.name; if(!n) continue;
  if(!db.has(+code)) continue;
  for(const clave of new Set([n.toLowerCase(), base(n)])){
    const previo = PORNOMBRE.get(clave);
    if(previo === undefined || (!POOL.has(previo) && POOL.has(+code))) PORNOMBRE.set(clave, +code);
  }
}
const FICHA = PORNOMBRE.get("sheep token") ?? null;
const cod = n => n === "Token" ? FICHA : (PORNOMBRE.get(String(n).toLowerCase()) ?? PORNOMBRE.get(base(n)) ?? null);
const nom = c => names[c]?.name ?? ("#" + c);
const mismo = (a, b) => a != null && b != null && canon(base(a)) === canon(base(b));
const esMonstruo = c => !!((db.get(c)?.type ?? 0) & 1);
const esExtra = c => !!((db.get(c)?.type ?? 0) & (0x40 | 0x2000));

/* ── mazos meta: de dónde sale lo que queda en el mazo ── */
const MAZOS = JSON.parse(readFileSync("../data/mazos.json", "utf-8")).filter(m => !m.aviso && m.main.length >= 40)
  .map(m => ({ nombre:m.nombre, main:m.main.map(Number), extra:(m.extra ?? []).map(Number) }));

/* ── datos del importador ── */
const lee = f => readFileSync(join(ENTRADA, f), "utf-8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const PARTIDAS = lee("partidas.jsonl");
const DECIS = lee("decisiones.jsonl");
const fiable = new Set(PARTIDAS.filter(p => (p.fiabilidad ?? 0) >= 0.9).map(p => `${p.replay}#${p.partida}`));

/* ── el estado desde el punto de vista de un jugador ──
   Las decisiones guardan el estado desde quien decide. Para las
   preguntas de «pasar» hace falta el de la decisión SIGUIENTE, que puede
   ser del rival: se le da la vuelta. */
function estadoDesde(d, p){
  const v = d.estado.vista, o = d.estado.oculto;
  const rellenar = (campo, tapadas) => campo.map(x => {
    if(x.carta) return x;
    const t = tapadas.find(t => t.zona === x.zona);
    return t ? { ...x, carta:t.carta } : x;
  });
  if(d.actor === p) return {
    turno:v.turno, fase:v.fase, lp:[...v.lp], mazo:[...v.mazo],
    mano:[...v.mano], manoRival:[...(o.mano_rival ?? [])],
    campo:v.campo, campoRival:rellenar(v.campo_rival, o.tapadas_rival ?? []),
    gy:[...v.cementerio], ban:[...v.desterradas],
  };
  return {
    turno:v.turno, fase:v.fase, lp:[v.lp[1], v.lp[0]], mazo:[v.mazo[1], v.mazo[0]],
    mano:[...(o.mano_rival ?? [])], manoRival:[...v.mano],
    campo:rellenar(v.campo_rival, o.tapadas_rival ?? []), campoRival:v.campo,
    gy:[v.cementerio[1], v.cementerio[0]], ban:[v.desterradas[1], v.desterradas[0]],
  };
}

/* Lo que se ha visto de cada jugador en el duelo entero, para su lista. */
function vistasDelDuelo(ds){
  const visto = [new Map(), new Map()];
  const apuntar = (p, lista) => {
    const cuenta = new Map();
    for(const n of lista){ const c = cod(n); if(c == null || c === FICHA) continue; cuenta.set(c, (cuenta.get(c) ?? 0) + 1); }
    for(const [c, k] of cuenta) visto[p].set(c, Math.max(visto[p].get(c) ?? 0, Math.min(3, k)));
  };
  for(const d of ds){
    for(const p of [0, 1]){
      const e = estadoDesde(d, p);
      apuntar(p, [...e.mano, ...e.campo.map(x => x.carta).filter(Boolean), ...e.gy[0], ...e.ban[0]]);
    }
  }
  return visto;
}
/* La lista: el mazo meta que más se parece a lo visto, con lo visto dentro. */
function listaDe(visto){
  let mejor = MAZOS[0], max = -1;
  for(const m of MAZOS){
    const s = new Set(m.main); let k = 0;
    for(const c of visto.keys()) if(s.has(c)) k++;
    if(k > max){ max = k; mejor = m; }
  }
  const main = [...mejor.main];
  const cuenta = c => main.filter(x => x === c).length;
  for(const [c, k] of visto){
    if(esExtra(c)) continue;
    while(cuenta(c) < k){
      /* sale lo que el jugador no ha enseñado nunca, del final de la lista */
      const i = main.map((x, j) => [x, j]).reverse().find(([x]) => !visto.has(x))?.[1];
      if(i == null){ main.push(c); break; }
      main.splice(i, 1, c);
    }
  }
  const extra = [...mejor.extra];
  for(const [c] of visto) if(esExtra(c) && !extra.includes(c)) extra.push(c);
  return { nombre:mejor.nombre, main, extra };
}

/* ── montar ── */
const zonaSeq = z => { const m = /^([MSF])-(\d)/.exec(z); if(!m) return null;
  return m[1] === "F" ? { loc:LOC.SZONE, seq:5 } : { loc:m[1] === "M" ? LOC.MZONE : LOC.SZONE, seq:+m[2] - 1 }; };

function layoutDe(e, listas){
  const lado = (campo, mano, gy, ban, lista, nMazo) => {
    const L = { monstruos:[], mt:[], mano:[], gy:[], ban:[], deck:[], extra:[] };
    const fuera = [];
    for(const x of campo){
      const z = zonaSeq(x.zona); if(!z) continue;
      const c = cod(x.carta); if(c == null) return null;          // tapada sin identificar
      if(z.loc === LOC.MZONE){
        const pos = x.abajo ? POS.TAPADA_DEF : x.pos === "DEF" ? POS.DEF : POS.ATK;
        L.monstruos.push({ code:c, seq:z.seq, pos, desde:x.desde, ficha:!!x.ficha });
      } else L.mt.push({ code:c, seq:z.seq, pos:x.abajo ? POS.TAPADA : POS.ATK, desde:x.desde });
      if(!x.ficha) fuera.push(c);
    }
    for(const n of mano){ const c = cod(n); if(c == null) return null; L.mano.push(c); fuera.push(c); }
    for(const n of gy){ const c = cod(n); if(c != null){ L.gy.push(c); fuera.push(c); } }
    for(const n of ban){ const c = cod(n); if(c != null){ L.ban.push(c); fuera.push(c); } }
    /* el mazo: su lista menos lo que ya ha salido, al tamaño de verdad */
    const resto = [...lista.main];
    for(const c of fuera){ const i = resto.indexOf(c); if(i >= 0) resto.splice(i, 1); }
    const n = Math.max(0, nMazo ?? resto.length);
    while(resto.length < n) resto.push(lista.main[resto.length % lista.main.length]);
    L.deck = resto.slice(0, n);
    L.extra = [...lista.extra];
    for(const x of L.monstruos.filter(m => esExtra(m.code))){ const i = L.extra.indexOf(x.code); if(i >= 0) L.extra.splice(i, 1); }
    return L;
  };
  const l0 = lado(e.campo, e.mano, e.gy[0], e.ban[0], listas[0], e.mazo[0]);
  const l1 = lado(e.campoRival, e.manoRival, e.gy[1], e.ban[1], listas[1], e.mazo[1]);
  if(!l0 || !l1) return null;
  return { 0:l0, 1:l1 };
}

/* ── preguntas ── */
const COMPARABLES = new Set(["invocar", "colocar_monstruo", "colocar_mt", "activar", "efecto", "voltear",
                             "cambiar_pos", "especial", "atacar", "atacar_directo"]);
const FASES = new Set(["M1", "M2", "BP"]);

function preguntasDelDuelo(ds){
  const out = [];
  /* el turno de cada decisión y de quién es */
  const dueñoTurno = d => d.su_turno ? d.actor : 1 - d.actor;
  const porTurno = new Map();
  ds.forEach((d, i) => { const k = d.turno; if(!porTurno.has(k)) porTurno.set(k, []); porTurno.get(k).push(i); });
  for(const [turno, idx] of porTurno){
    const p = dueñoTurno(ds[idx[0]]);
    /* En la Battle Phase solo los ataques: DuelingBook deja colocar o
       invocar en mitad de la batalla (es manual) y eso no es una jugada
       que el motor ofrezca. */
    const propias = idx.filter(i => ds[i].actor === p && ds[i].su_turno && FASES.has(ds[i].accion.fase ?? ds[i].fase)
                                   && COMPARABLES.has(ds[i].accion.tipo)
                                   /* «responde a» lo deduce el importador por el orden; una
                                      colocación o una invocación no responden a nada */
                                   && (ds[i].responde_a == null || !["activar", "efecto"].includes(ds[i].accion.tipo))
                                   && ((ds[i].accion.fase ?? ds[i].fase) !== "BP" || ds[i].accion.tipo.startsWith("atacar")));
    const previas = [];
    for(const i of propias){
      const d = ds[i], fase = d.accion.fase ?? d.fase;
      const resto = propias.filter(j => j > i && (ds[j].accion.fase ?? ds[j].fase) === fase).map(j => ds[j].accion);
      const luego = propias.filter(j => j > i && (ds[j].accion.fase ?? ds[j].fase) !== fase).map(j => ds[j].accion);
      out.push({ id:d.id, turno, p, fase, tipo:d.accion.tipo, pro:d.accion, previas:[...previas], resto, luego,
                 estado:estadoDesde(d, p), nombre:d.nombre, mazo:d.mazo, mazoRival:d.mazo_rival });
      previas.push(d.accion);
    }
    /* «pasar»: el estado justo después de su última jugada de la fase */
    const ultimaDe = f => [...propias].reverse().find(i => (ds[i].accion.fase ?? ds[i].fase) === f);
    const siguiente = i => ds[i + 1] ?? null;
    const atacó = propias.some(i => ds[i].accion.tipo.startsWith("atacar"));
    for(const [f, tipo] of [["M1", "pasar_m1"], ["BP", "pasar_bp"]]){
      const u = ultimaDe(f); if(u == null) continue;
      const s = siguiente(u); if(!s) continue;
      /* si lo siguiente es OTRA jugada suya de la misma fase, no pasó */
      if(s.actor === p && s.su_turno && (s.accion.fase ?? s.fase) === f) continue;
      const hechas = propias.filter(i => i <= u).map(i => ds[i].accion);
      out.push({ id:s.id + "~" + tipo, turno, p, fase:f, tipo,
                 pro:{ tipo: f === "M1" ? (atacó ? "a_batalla" : "terminar") : "fin_batalla" },
                 previas:hechas, resto:[], luego:propias.filter(i => i > u).map(i => ds[i].accion), estado:estadoDesde(s, p), nombre:ds[u].nombre, mazo:ds[u].mazo, mazoRival:ds[u].mazo_rival,
                 /* para la de M1: ¿atacó luego? */
                 atacoLuego: atacó });
    }
  }
  return out;
}

/* ── la IA ── */
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const FLAGS = (BigInt(X.OcgDuelMode.MODE_GOAT) & ~BigInt(X.OcgDuelMode.FIRST_TURN_DRAW))
            | BigInt(X.OcgDuelMode.ATTACK_FIRST_TURN) | BigInt(X.OcgDuelMode.PSEUDO_SHUFFLE);
let libP = null, usos = 0;
const lib = async () => { if(!libP || ++usos % 120 === 0) libP = X.default({ sync:true }); return libP; };
const pensador = PENSAR ? crearPensador({ X, crearLib: () => X.default({ sync:true }), GoatDuel, crearCerebro, db, names,
  scriptReader, mazosMeta: MAZOS, mundos: MUNDOS, maxCandidatos: 6 }).conPilotos(trivial, generico) : null;

const LISTAS = [["summons", IA.SELECT_SUMMON], ["special_summons", IA.SELECT_SPECIAL_SUMMON],
  ["pos_changes", IA.SELECT_POS_CHANGE], ["monster_sets", IA.SELECT_MONSTER_SET],
  ["spell_sets", IA.SELECT_SPELL_SET], ["activates", IA.SELECT_ACTIVATE]];

/* ¿qué es, en el idioma del replay, la opción `l` de la lista `campo`? */
function tipoDeOpcion(campo, l, duel){
  const c = duel.resolve(l, l.code);
  switch(campo){
    case "summons": return "invocar";
    case "special_summons": return "especial";
    case "monster_sets": return "colocar_monstruo";
    case "spell_sets": return "colocar_mt";
    case "pos_changes": return (c && (c.position & 0x0a)) ? "voltear" : "cambiar_pos";
    case "activates": return l.location === LOC.MZONE ? "efecto" : "activar";
  }
  return "?";
}
/* Familias para comparar: activar desde la mano o colocada, y declarar
   un efecto, son «usar la carta». */
const familia = t => ({ efecto:"activar", atacar_directo:"atacar" })[t] ?? t;

/* ¿el pro hizo algo que el motor ofrece? */
function opcionDelPro(q, pro, duel){
  if(q.type === T.SELECT_IDLECMD){
    for(const [campo] of LISTAS) for(const [i, l] of (q[campo] ?? []).entries()){
      if(familia(tipoDeOpcion(campo, l, duel)) !== familia(pro.tipo)) continue;
      if(mismo(nom(l.code), pro.carta)) return { campo, i };
    }
    return null;
  }
  return null;
}

async function examinar(P, listas){
  const layout = layoutDe(P.estado, listas);
  if(!layout) return { estado:"sin_montar", motivo:"carta sin identificar" };
  const L = await lib();
  let ganador = null;
  const duel = new GoatDuel({ lib:L, X, cardDb:db, scriptReader, onEvent: e => { if(e.t === "win") ganador = e.player; } });
  const turnoReal = P.turno;
  try{
    await duel.createFromLayout({ layout, flags:FLAGS, seed:[BigInt(1000 + (P.turno|0)), 3n, 5n, 7n],
                                  lp0:P.estado.lp[0] || 8000, lp1:P.estado.lp[1] || 8000,
                                  decklist:{ 0:[...listas[0].main], 1:[...listas[1].main] } });
  }catch(e){ return { estado:"sin_montar", motivo:"motor: " + e.message }; }
  const cer = [0, 1].map(p => crearCerebro({ X, duel, db, names, nivel:"experto", yo:p, log: (TRAZA && p === 0) ? (t => console.log("   ·", typeof t === "string" ? t : JSON.stringify(t))) : undefined, rng:(() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })() }));
  /* Lo que el replay sabe del turno: quién entró, qué se puso, quién atacó. */
  const yaAtacaron = P.previas.filter(a => a.tipo.startsWith("atacar")).map(a => a.atacante ?? a.carta);
  const yaGirados = P.previas.filter(a => a.tipo === "cambiar_pos" || a.tipo === "voltear").map(a => a.carta);
  const invocoYa = P.previas.some(a => a.tipo === "invocar" || a.tipo === "colocar_monstruo");
  let marcado = false;
  const marcarTurno = () => {
    if(marcado) return; marcado = true;
    duel.turnCount = turnoReal;
    const consumir = (lista) => { const r = [...lista]; return n => { const i = r.findIndex(x => mismo(x, n)); if(i < 0) return false; r.splice(i, 1); return true; }; };
    const atac = consumir(yaAtacaron);
    for(const x of layout[0].monstruos){
      const c = duel.zones[0][LOC.MZONE][x.seq]; if(!c) continue;
      if(x.desde != null) c.entroTurno = x.desde;
      if(atac(nom(c.code))) c.atacoTurno = turnoReal;
    }
    for(const x of layout[0].mt){ const c = duel.zones[0][LOC.SZONE][x.seq]; if(c && x.desde != null) c.puestaTurno = x.desde; }
    for(const x of layout[1].monstruos){ const c = duel.zones[1][LOC.MZONE][x.seq]; if(c && x.desde != null) c.entroTurno = x.desde; }
    for(const x of layout[1].mt){ const c = duel.zones[1][LOC.SZONE][x.seq]; if(c && x.desde != null) c.puestaTurno = x.desde; }
  };
  /* recorta la pregunta a lo que el jugador aún podía hacer */
  const recortarIdle = q => {
    const r = { ...q };
    if(invocoYa){ r.summons = []; r.monster_sets = []; }
    const giro = consumirDe(yaGirados);
    r.pos_changes = (q.pos_changes ?? []).filter(l => {
      const c = duel.resolve(l, l.code);
      if(c?.entroTurno === turnoReal) return false;           // entró este turno
      if(c?.atacoTurno === turnoReal) return false;           // ya atacó
      return !giro(nom(l.code));
    });
    if(P.fase === "M2" || turnoReal === 1) r.to_bp = false;
    if(P.fase === "M2") r.to_ep = true;
    return r;
  };
  const recortarBatalla = q => {
    const ya = consumirDe(yaAtacaron);
    const quitados = [];
    const attacks = (q.attacks ?? []).filter(l => { if(ya(nom(l.code))){ quitados.push(l); return false; } return true; });
    return { ...q, attacks };
  };
  const res = { estado:"ok" };
  let ultimo = null, intento = 0, fase = "idle", eligioAtaque = null;
  try{
    for(let paso = 0; paso < 400 && !duel.finished; paso++){
      const q = await duel.run();
      if(!q || duel.finished){ res.estado = "sin_pregunta"; break; }
      if(q !== ultimo){ ultimo = q; intento = 0; }
      marcarTurno();
      let resp = null;
      if(q.player === 0 && q.type === T.SELECT_IDLECMD && fase === "idle"){
        const pr = recortarIdle(q);
        if(P.tipo === "atacar" || P.tipo === "atacar_directo" || P.tipo === "pasar_bp"){
          if(!q.to_bp){ res.estado = "sin_batalla"; break; }
          fase = "batalla"; resp = { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };
        } else {
          /* la pregunta de verdad */
          let r = cer[0](pr, 0);
          if(PENSAR && P.fase === "M1"){
            try{ const pz = await pensador.pensarIdle(duel, 0, pr, cer[0], { semilla: 77 }); if(pz) r = pz; }catch(e){}
          }
          res.ia = leerIdle(pr, r, duel);
          res.opciones = resumenIdle(pr, duel);
          if(P.tipo !== "pasar_m1"){
            const o = opcionDelPro(pr, P.pro, duel);
            res.proLegal = !!o;
          } else res.proLegal = true;
          res.plan = (cer[0].ultimoPlan?.() ?? []).slice(0, 8).map(x => ({ p:+x.puntos.toFixed(2), por:x.por }));
          break;
        }
      } else if(q.player === 0 && q.type === T.SELECT_BATTLECMD && fase === "batalla"){
        const pr = recortarBatalla(q);
        const r = cer[0](pr, 0);
        if(r?.type === R.SELECT_BATTLECMD && r.action === BA.SELECT_BATTLE){
          const l = pr.attacks[r.index];
          eligioAtaque = { atacante:nom(l.code) };
          res.ia = { tipo:"atacar", carta:nom(l.code), atacante:nom(l.code) };
          res.opciones = { ataques:pr.attacks.map(l => nom(l.code)) };
          cer[0].fijarAtaque?.(pr, r.index);
          fase = "objetivo"; resp = r;
        } else {
          res.ia = { tipo:"fin_batalla" };
          res.opciones = { ataques:pr.attacks.map(l => nom(l.code)) };
          break;
        }
        res.proLegal = P.tipo === "pasar_bp" || pr.attacks.some(l => mismo(nom(l.code), P.pro.atacante ?? P.pro.carta));
      } else if(q.player === 0 && fase === "objetivo" && (q.type === T.SELECT_CARD || q.type === T.SELECT_UNSELECT_CARD)){
        const r = cer[0](q, intento) ?? generico(q, intento);
        const lista = q.selects ?? q.select_cards ?? [];
        const i = r?.indicies?.[0] ?? r?.index ?? 0;
        const l = lista[i];
        if(l){ const c = duel.resolve(l, l.code);
          res.ia.objetivo = { carta: c && !(c.position & 0x0a) ? nom(c.code) : (c ? nom(c.code) : null), tapada: !!(c && (c.position & 0x0a)), seq:l.sequence }; }
        break;
      } else if(fase === "objetivo" && (q.type === T.SELECT_BATTLECMD || q.type === T.SELECT_IDLECMD)){
        res.ia.objetivo = res.ia.objetivo ?? { directo:true };
        break;
      } else if(q.player === 1 || fase !== "idle" || q.type !== T.SELECT_IDLECMD){
        /* el rival no hace nada: el estado tiene que quedarse como estaba */
        if(q.type === T.SELECT_CHAIN && !q.forced) resp = { type:R.SELECT_CHAIN, index:null };
        else resp = trivial(q) ?? cer[q.player](q, intento) ?? generico(q, intento);
      }
      if(fase === "objetivo" && !resp) {
        /* ataque directo: el motor no pregunta objetivo */
        res.ia.objetivo = { directo:true }; break;
      }
      intento++;
      if(!resp || intento > 12){ res.estado = res.ia ? "ok" : "atasco"; break; }
      duel.respond(resp);
      if(fase === "objetivo"){
        /* tras declarar: si el motor no pregunta objetivo y hay daño o batalla, era directo */
      }
    }
  }catch(e){ res.estado = "error"; res.motivo = String(e?.message ?? e).slice(0, 160); }
  try{ L.destroyDuel?.(duel.handle); }catch(e){}
  if(res.ia && res.ia.tipo === "atacar" && !res.ia.objetivo) res.ia.objetivo = { directo:true };
  return res;
}
function consumirDe(lista){ const r = [...lista]; return n => { const i = r.findIndex(x => mismo(x, n)); if(i < 0) return false; r.splice(i, 1); return true; }; }

function leerIdle(q, r, duel){
  if(!r || r.type !== R.SELECT_IDLECMD) return { tipo:"?" };
  if(r.action === IA.TO_BP) return { tipo:"a_batalla" };
  if(r.action === IA.TO_EP) return { tipo:"terminar" };
  const par = LISTAS.find(([, a]) => a === r.action);
  if(!par) return { tipo:"?" };
  const l = q[par[0]]?.[r.index];
  if(!l) return { tipo:"?" };
  return { tipo:tipoDeOpcion(par[0], l, duel), carta:nom(l.code) };
}
function resumenIdle(q, duel){
  const o = {};
  for(const [campo] of LISTAS) for(const l of (q[campo] ?? [])){
    const t = tipoDeOpcion(campo, l, duel); (o[t] ??= []).push(nom(l.code));
  }
  o.batalla = !!q.to_bp;
  return o;
}

/* ── ¿coincide? ── */
function veredicto(P, res){
  const ia = res.ia, pro = P.pro;
  if(!ia) return "sin_respuesta";
  if(P.tipo === "pasar_m1"){
    const pasa = ia.tipo === "a_batalla" || ia.tipo === "terminar";
    if(!pasa) return P.luego.some(a => familia(a.tipo) === familia(ia.tipo) && mismo(a.carta, ia.carta)) ? "lo_hace_antes" : "ia_juega_mas";
    if(pro.tipo === "a_batalla" && ia.tipo === "terminar" && res.opciones?.batalla) return "ia_no_ataca";
    return "igual";
  }
  if(P.tipo === "pasar_bp") return ia.tipo === "fin_batalla" ? "igual" : "ia_ataca_mas";
  if(P.tipo === "atacar" || P.tipo === "atacar_directo"){
    if(ia.tipo !== "atacar") return "ia_no_ataca";
    const mismoAtacante = mismo(ia.atacante, pro.atacante ?? pro.carta);
    const dirPro = pro.tipo === "atacar_directo", dirIa = !!ia.objetivo?.directo;
    let mismoObjetivo;
    if(dirPro || dirIa) mismoObjetivo = dirPro === dirIa;
    else if(pro.objetivo?.tapada || ia.objetivo?.tapada) mismoObjetivo = !!pro.objetivo?.tapada === !!ia.objetivo?.tapada
      && (!pro.objetivo?.carta || !ia.objetivo?.carta || mismo(pro.objetivo.carta, ia.objetivo.carta));
    else mismoObjetivo = mismo(pro.objetivo?.carta, ia.objetivo?.carta);
    if(mismoAtacante && mismoObjetivo) return "igual";
    /* el mismo ataque que el pro hace luego en esta batalla: otro orden */
    const luegoAtaca = P.resto.some(a => a.tipo.startsWith("atacar") && mismo(ia.atacante, a.atacante ?? a.carta)
      && ((a.tipo === "atacar_directo") === dirIa)
      && (dirIa || !a.objetivo?.carta || !ia.objetivo?.carta || mismo(a.objetivo.carta, ia.objetivo.carta) || (a.objetivo?.tapada && ia.objetivo?.tapada)));
    if(luegoAtaca) return "otro_orden";
    if(mismoObjetivo) return "otro_atacante";
    if(mismoAtacante) return "otro_objetivo";
    return "otro_ataque";
  }
  if(familia(ia.tipo) === familia(pro.tipo) && mismo(ia.carta, pro.carta)) return "igual";
  if(ia.tipo === "a_batalla" || ia.tipo === "terminar") return "ia_pasa";
  if(P.resto.some(a => familia(a.tipo) === familia(ia.tipo) && mismo(a.carta, ia.carta))) return "otro_orden";
  if(P.luego.some(a => familia(a.tipo) === familia(ia.tipo) && mismo(a.carta, ia.carta))) return "lo_hace_antes";
  if(mismo(ia.carta, pro.carta)) return "misma_carta_otra_forma";     // invocar/colocar, activar/colocar
  return "otra_jugada";
}

/* ── programa ── */
const porDuelo = new Map();
for(const d of DECIS){ const k = `${d.replay}#${d.partida}`; if(!fiable.has(k)) continue; if(!porDuelo.has(k)) porDuelo.set(k, []); porDuelo.get(k).push(d); }
let todas = [];
const listasDe = new Map();
for(const [k, ds] of porDuelo){
  const visto = vistasDelDuelo(ds);
  listasDe.set(k, [listaDe(visto[0]), listaDe(visto[1])]);
  for(const P of preguntasDelDuelo(ds)) todas.push({ ...P, duelo:k });
}
const SOLO_ID = opt("--id", null);
if(SOLO_ID) todas = todas.filter(P => P.id === SOLO_ID);
if(SOLO) todas = todas.filter(P => SOLO.includes(P.tipo) || (SOLO.includes("atacar") && P.tipo === "atacar_directo"));
if(MUESTRA > 1) todas = todas.filter((_, i) => i % MUESTRA === 0);
todas = todas.slice(0, MAX);
console.log(`${porDuelo.size} duelos fiables · ${todas.length} preguntas${PENSAR ? ` · con simulación (${MUNDOS} mundos)` : " · heurística"}`);

const filas = [];
const t0 = performance.now();
for(const [n, P] of todas.entries()){
  const L = listasDe.get(P.duelo);
  const listas = [L[P.p], L[1 - P.p]];
  const res = await examinar(P, listas);
  const v = res.estado === "ok" && res.proLegal !== false ? veredicto(P, res) : (res.estado === "ok" ? "pro_no_legal" : res.estado);
  const fila = { id:P.id, duelo:P.duelo, turno:P.turno, fase:P.fase, tipo:P.tipo, jugador:P.nombre, mazo:P.mazo, rival:P.mazoRival,
                 lista:listas[0].nombre, pro:P.pro, ia:res.ia ?? null, v, opciones:res.opciones ?? null, motivo:res.motivo ?? null,
                 estado:{ lp:P.estado.lp, mano:P.estado.mano, campo:P.estado.campo.map(x => (x.abajo ? "↓" : "") + x.carta + (x.pos === "DEF" ? "(D)" : "")),
                          campoRival:P.estado.campoRival.map(x => (x.abajo ? "↓" : "") + (x.carta ?? "?") + (x.pos === "DEF" ? "(D)" : "")),
                          manoRival:P.estado.manoRival.length, gy:P.estado.gy } };
  filas.push(fila);
  if(TRAZA) console.log(n, P.id, P.tipo, JSON.stringify(P.pro?.carta ?? P.pro?.tipo), "→", JSON.stringify(res.ia), v, "\n   plan:", JSON.stringify(res.plan));
  if(n % 250 === 249) console.log(`  ${n + 1}/${todas.length} · ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(join(SALIDA, (PENSAR ? "examen-pensar" : "examen") + SUFIJO + ".jsonl"), filas.map(f => JSON.stringify(f)).join("\n") + "\n");

/* ── informe ── */
const val = filas.filter(f => !["sin_montar", "error", "atasco", "sin_pregunta", "pro_no_legal", "sin_batalla", "sin_respuesta"].includes(f.v));
const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)} %` : "—";
const L2 = [];
L2.push(`# Examen contra los pros${PENSAR ? " · IA completa (con simulación)" : " · heurística"}`, "");
L2.push(`${filas.length} preguntas de ${porDuelo.size} duelos fiables · ${val.length} comparables (` +
  Object.entries(filas.reduce((o, f) => (o[f.v] = (o[f.v] ?? 0) + 1, o), {})).filter(([k]) => !val.some(f => f.v === k)).map(([k, n]) => `${k} ${n}`).join(", ") + ").", "");
const igual = val.filter(f => f.v === "igual").length, orden = val.filter(f => f.v === "otro_orden").length;
L2.push(`**Coincidencia exacta: ${pct(igual, val.length)}** · contando «lo mismo en otro orden dentro de la fase»: ${pct(igual + orden, val.length)}.`, "");
L2.push(`La jugada del pro no es «la correcta»: es lo que hizo un jugador de top cut. Una discrepancia que se repite es un sitio donde mirar.`, "");
L2.push("## Por tipo de decisión", "", "| Decisión | n | igual | otro orden | antes de batalla (el pro, en la M2) | IA pasa | IA juega más | otra jugada | misma carta, otra forma | ataques: otro objetivo / atacante / no ataca |", "|---|---|---|---|---|---|---|---|---|---|");
const tipos = [...new Set(val.map(f => f.tipo))];
for(const t of tipos){
  const fs = val.filter(f => f.tipo === t), c = k => fs.filter(f => f.v === k).length;
  L2.push(`| ${t} | ${fs.length} | ${pct(c("igual"), fs.length)} | ${pct(c("otro_orden"), fs.length)} | ${pct(c("lo_hace_antes"), fs.length)} | ${pct(c("ia_pasa"), fs.length)} | ${pct(c("ia_juega_mas") + c("ia_ataca_mas"), fs.length)} | ${pct(c("otra_jugada"), fs.length)} | ${pct(c("misma_carta_otra_forma"), fs.length)} | ${c("otro_objetivo")} / ${c("otro_atacante")} / ${c("ia_no_ataca")} |`);
}
L2.push("");
/* por carta: cuando el pro jugó X (y era legal), ¿la IA jugó X? */
const porCarta = new Map();
for(const f of val){
  if(!f.pro?.carta || f.tipo.startsWith("pasar") || f.tipo.startsWith("atacar")) continue;
  const k = `${familia(f.pro.tipo)} · ${f.pro.carta}`;
  const e = porCarta.get(k) ?? { n:0, igual:0, orden:0, alt:new Map() };
  e.n++; if(f.v === "igual") e.igual++; if(f.v === "otro_orden") e.orden++;
  if(f.v !== "igual" && f.v !== "otro_orden"){ const a = f.ia ? `${f.ia.tipo}${f.ia.carta ? " " + f.ia.carta : ""}` : "?"; e.alt.set(a, (e.alt.get(a) ?? 0) + 1); }
  porCarta.set(k, e);
}
L2.push("## Lo que hizo el pro y la IA no (por carta, n ≥ 8)", "", "| El pro… | n | la IA igual | otro orden | lo que hizo la IA en su lugar |", "|---|---|---|---|---|");
for(const [k, e] of [...porCarta].filter(([, e]) => e.n >= 8).sort((a, b) => (a[1].igual + a[1].orden) / a[1].n - (b[1].igual + b[1].orden) / b[1].n)){
  const alt = [...e.alt].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, n]) => `${a} (${n})`).join(", ");
  L2.push(`| ${k} | ${e.n} | ${pct(e.igual, e.n)} | ${pct(e.orden, e.n)} | ${alt} |`);
}
L2.push("");
/* lo que la IA juega y el pro no */
const ext = new Map();
for(const f of val){
  if(!["ia_juega_mas", "otra_jugada", "misma_carta_otra_forma"].includes(f.v) || !f.ia?.carta) continue;
  const k = `${familia(f.ia.tipo)} · ${f.ia.carta}`;
  ext.set(k, (ext.get(k) ?? 0) + 1);
}
L2.push("## Lo que la IA juega y el pro no hizo en esa posición", "", "| La IA… | veces |", "|---|---|");
for(const [k, n] of [...ext].sort((a, b) => b[1] - a[1]).slice(0, 40)) L2.push(`| ${k} | ${n} |`);
L2.push("");
/* ataques */
const at = val.filter(f => f.tipo.startsWith("atacar"));
if(at.length){
  L2.push("## Ataques", "", `${at.length} ataques del pro · la IA hace el mismo: ${pct(at.filter(f => f.v === "igual").length, at.length)} · otro objetivo ${at.filter(f => f.v === "otro_objetivo").length} · otro atacante ${at.filter(f => f.v === "otro_atacante").length} · otro ataque ${at.filter(f => f.v === "otro_ataque").length} · no ataca ${at.filter(f => f.v === "ia_no_ataca").length}.`, "");
}
L2.push(`_Generado por \`examen-replays.mjs\` en ${((performance.now() - t0) / 1000).toFixed(0)} s._`);
writeFileSync(join(SALIDA, (PENSAR ? "examen-pensar" : "examen") + SUFIJO + ".md"), L2.join("\n") + "\n");
console.log(L2.slice(0, 30).join("\n"));
