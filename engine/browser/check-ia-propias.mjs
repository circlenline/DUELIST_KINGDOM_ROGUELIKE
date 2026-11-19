/* ════════════════════════════════════════════════════════════════
   ¿LA IA SE DISPARA EN EL PIE?

   Todas estas comprobaciones existen porque un jugador reportó la
   jugada, no porque se nos ocurriera a nosotros:

     · "el bot ha volado su propio Snatch Steal con Heavy Storm y me
        ha devuelto el monstruo"
     · "ha tumbado su propio Dekoichi recién invocado con Book of Moon"
     · "pagó media vida con Solemn Judgment para negar una tontería"
     · "Thousand-Eyes Restrict se quedó plantado sin atacar nunca"

   No monta un duelo entero: le pone al cerebro un tablero exacto y una
   pregunta concreta, y comprueba QUÉ RESPONDE. Un duelo real tardaría
   cientos de partidas en volver a producir la situación, y aun así no
   sabrías si la evitó por criterio o por azar.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { crearCerebro } from "./src/ai/brain.js";
import { planDe } from "./src/ai/plan.js";

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const POOL  = new Set(JSON.parse(readFileSync("../data/goat-pool.json","utf-8")).map(Number));
const db = new Map();
for(const k in raw){ const c=raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }

/* Mismo truco que en escenario.mjs: muchas cartas existen dos veces en la
   base (normal y "(GOAT)"/"(Pre-Errata)") y solo la del pool lleva script.
   Coger la otra da una carta muda que hace que la prueba mienta. */
const base = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime|Action Field)\)\s*$/i,"").trim();
const PORNOMBRE = new Map();
for(const code in names){
  const n = names[code]?.name; if(!n) continue;
  for(const clave of new Set([n, base(n)])){
    const previo = PORNOMBRE.get(clave);
    if(previo===undefined || (!POOL.has(previo) && POOL.has(+code))) PORNOMBRE.set(clave, +code);
  }
}
const cod = n => { const c = PORNOMBRE.get(n) ?? PORNOMBRE.get(base(n));
                   if(!c) throw new Error(`no existe "${n}"`); return c; };

const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
const P = { ATK:1, DEF:4, SET:8 };
const T = X.OcgMessageType, R = X.OcgResponseType;
const IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;

/* ── espejo de mentira, con la misma forma que GoatDuel ──
   El cerebro solo usa zones, lp, turnPlayer, turnCount, phase, cadena,
   atacante, cards, at() y resolve(). Con eso basta para preguntarle. */
let uid = 0;
const carta = (nombre, controller, location, sequence, position=P.ATK, extra={}) => ({
  uid:++uid, code:cod(nombre), controller, location, sequence, position, ...extra });

function mesa({ mios={}, suyos={}, lp=[8000,8000], turno=5, turnPlayer=0, fase=0x4 }={}){
  const lado = () => ({ [L.DECK]:[], [L.HAND]:[], [L.GRAVE]:[], [L.REMOVED]:[],
    [L.EXTRA]:[], [L.MZONE]:new Array(5).fill(null), [L.SZONE]:new Array(6).fill(null) });
  const zones = { 0:lado(), 1:lado() };
  const cards = new Map();
  const meter = (p, spec) => {
    for(const [clave, loc] of [["campo",L.MZONE],["mt",L.SZONE],["mano",L.HAND],
                               ["gy",L.GRAVE],["extra",L.EXTRA]]){
      (spec[clave] ?? []).forEach((e,i)=>{
        const o = typeof e==="string" ? {carta:e} : e;
        const c = carta(o.carta, p, loc, i, o.pos ?? (loc===L.MZONE?P.ATK:P.SET),
                        o.atkReal!=null ? {atkReal:o.atkReal, defReal:o.defReal ?? 0} : {});
        if(loc===L.MZONE || loc===L.SZONE) zones[p][loc][i] = c; else zones[p][loc].push(c);
        cards.set(c.uid, c);
      });
    }
  };
  meter(0, mios); meter(1, suyos);
  return { zones, cards, lp:{0:lp[0],1:lp[1]}, turnPlayer, turnCount:turno, phase:fase,
           cadena:[], atacante:null, finished:false,
           at:(c,l,s)=>zones[c]?.[l]?.[s] ?? null,
           resolve:(l)=>zones[l.controller]?.[l.location]?.[l.sequence] ?? null };
}
const ref = c => ({ code:c.code, controller:c.controller,
                    location:c.location, sequence:c.sequence, position:c.position });

let ok=0, mal=0;
const comprueba = (titulo, cond, detalle="") => {
  if(cond){ ok++; console.log(`  ✓ ${titulo}`); }
  else    { mal++; console.log(`  ✗ ${titulo}${detalle?"  → "+detalle:""}`); }
};
const cerebro = (duel, nivel="experto") =>
  crearCerebro({ X, duel, db, names, nivel, yo:0 });
const FICHA = 73915052;   // Sheep Token, lo que deja Scapegoat

console.log("═══ LA IA Y SUS PROPIAS CARTAS ═══\n");

/* ── 1. Objetivo: si hay algo del rival, lo mío no se toca ────────── */
/* La carta buena es la MÍA a propósito: ordenando por "lo más valioso",
   como hacía la versión anterior, la respuesta correcta salía por accidente
   siempre que el rival tuviera la carta mejor. Aquí, si no mira de quién es
   cada una, se lleva por delante su propio Snatch Steal. */
{
  const d = mesa({ mios:{ mt:[{carta:"Snatch Steal", pos:P.ATK}] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor", pos:P.ATK}] } });
  const mio = d.zones[0][L.SZONE][0], suyo = d.zones[1][L.SZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_CARD, player:0, min:1, max:1,
                            selects:[ref(mio), ref(suyo)] }, 0);
  comprueba("destruir M/T elige la del rival aunque la mía valga más",
    resp && resp.indicies?.[0] === 1, `eligió el índice ${resp?.indicies?.[0]}`);
}
/* Lo mismo con monstruos, que es por donde llegó el reporte. */
{
  const d = mesa({ mios:{ campo:["Airknight Parshath"] },
                   suyos:{ campo:["Dekoichi the Battlechanted Locomotive"] } });
  const mio = d.zones[0][L.MZONE][0], suyo = d.zones[1][L.MZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_CARD, player:0, min:1, max:1,
                            selects:[ref(mio), ref(suyo)] }, 0);
  comprueba("Book of Moon / Ring eligen al rival, no a mi propio monstruo",
    resp && resp.indicies?.[0] === 1, `eligió el índice ${resp?.indicies?.[0]}`);
}

/* ── 2. Heavy Storm con mi propio Snatch Steal puesto ─────────────── */
{
  const d = mesa({ mios:{ mano:["Heavy Storm"], mt:[{carta:"Snatch Steal", pos:P.ATK}],
                          campo:["Airknight Parshath"] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor"},{carta:"Mirror Force"}] } });
  const storm = d.zones[0][L.HAND][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(storm)],
    to_bp:true, to_ep:true }, 0);
  comprueba("no activa Heavy Storm si su Snatch Steal está boca arriba",
    !(resp?.action === IA.SELECT_ACTIVATE), JSON.stringify(resp));
}
/* ── 2b. …pero sin nada propio que perder, sí la usa ──────────────── */
{
  const d = mesa({ mios:{ mano:["Heavy Storm"], campo:["Airknight Parshath"] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor"},{carta:"Mirror Force"},
                               {carta:"Torrential Tribute"}] } });
  const storm = d.zones[0][L.HAND][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(storm)],
    to_bp:true, to_ep:true }, 0);
  comprueba("con tres tapadas suyas y ninguna mía, sí activa Heavy Storm",
    resp?.action === IA.SELECT_ACTIVATE, JSON.stringify(resp));
}

/* ── 3. Book of Moon es rápida: no se quema en tu propia Main Phase ─ */
{
  const d = mesa({ mios:{ mano:["Book of Moon"], campo:["Airknight Parshath"] },
                   suyos:{ campo:["Magician of Faith"] } });
  const bom = d.zones[0][L.HAND][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[{...ref(bom)}], pos_changes:[], activates:[ref(bom)],
    to_bp:true, to_ep:true }, 0);
  comprueba("Book of Moon se coloca, no se activa sin nada que desbloquear",
    resp?.action === IA.SELECT_SPELL_SET, JSON.stringify(resp));
}
/* EL REPORTE, tal cual: la Book of Moon YA está puesta, así que colocarla
   no es una opción y lo único que ofrece el motor es activarla. Enfrente
   solo hay tapadas, o sea que el único objetivo legal sería mi propio
   monstruo recién invocado. La respuesta correcta es no hacer nada. */
{
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon"}],
                          campo:["Dekoichi the Battlechanted Locomotive"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.SET}] } });
  const bom = d.zones[0][L.SZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(bom)],
    to_bp:true, to_ep:true }, 0);
  comprueba("con la Book of Moon ya puesta y solo mi monstruo como objetivo, pasa",
    resp?.action !== IA.SELECT_ACTIVATE, JSON.stringify(resp));
}

/* ── 4. Thousand-Eyes Restrict ataca con el ATK que tiene de verdad ─ */
{
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", atkReal:1900, defReal:1500}] },
                   suyos:{ campo:["Magician of Faith"] } });
  const ter = d.zones[0][L.MZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_BATTLECMD, player:0,
    attacks:[ref(ter)], activates:[], to_m2:true, to_ep:true }, 0);
  comprueba("TER con 1900 absorbidos ataca (con su 0 impreso no atacaba)",
    resp?.action === BA.SELECT_BATTLE, JSON.stringify(resp));
}
{
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", atkReal:0, defReal:0}] },
                   suyos:{ campo:["Airknight Parshath"] } });
  const ter = d.zones[0][L.MZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_BATTLECMD, player:0,
    attacks:[ref(ter)], activates:[], to_m2:true, to_ep:true }, 0);
  comprueba("…y sin absorber nada no se suicida contra un 1900",
    resp?.action !== BA.SELECT_BATTLE, JSON.stringify(resp));
}

/* ── 5. Solemn Judgment cuesta media vida: solo por algo que decida ─ */
{
  const monta = (negando) => {
    const d = mesa({ mios:{ mt:[{carta:"Solemn Judgment"}] }, turnPlayer:1 });
    const sj = d.zones[0][L.SZONE][0];
    d.cadena = [{ code:cod(negando), controller:1, uid:999 }];
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(sj)] }, 0);
  };
  comprueba("no paga media vida por negar un Book of Moon",
    monta("Book of Moon")?.index == null);
  comprueba("sí la paga por un Black Luster Soldier - Envoy of the Beginning",
    monta("Black Luster Soldier - Envoy of the Beginning")?.index === 0);
}

/* ── 6. Sakuretsu Armor: por un atacante que duela ────────────────── */
{
  const monta = (atacante) => {
    const d = mesa({ mios:{ mt:[{carta:"Sakuretsu Armor"}] },
                     suyos:{ campo:[atacante] }, turnPlayer:1, fase:0x10 });
    const sak = d.zones[0][L.SZONE][0], atk = d.zones[1][L.MZONE][0];
    d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(sak)] }, 0);
  };
  comprueba("no gasta Sakuretsu Armor en un Sinister Serpent de 300",
    monta("Sinister Serpent")?.index == null);
  comprueba("sí la gasta contra un Airknight Parshath",
    monta("Airknight Parshath")?.index === 0);
}

/* ── 7. Scapegoat: al final del turno rival, no en su Main Phase 1 ── */
{
  const monta = (fase, mano = []) => {
    const d = mesa({ mios:{ mt:[{carta:"Scapegoat"}], mano }, turnPlayer:1, fase });
    const sg = d.zones[0][L.SZONE][0];
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(sg)] }, 0);
  };
  comprueba("no quema Scapegoat en la Main Phase 1 del rival",
    monta(0x4)?.index == null);
  /* 19-11 (E: «la IA usa Scapegoat demasiado pronto»): en su End Phase solo
     si en mi turno voy a usar las fichas. */
  comprueba("la encadena en la End Phase rival si tengo uso para las fichas (Metamorphosis)",
    monta(0x200, ["Metamorphosis"])?.index === 0);
  comprueba("y sin uso para las fichas, la guarda para el ataque directo",
    monta(0x200)?.index == null);
  /* 02-10 (Warrior, G1 T2): en batalla solo con el ataque directo ya
     declarado; abrir la Battle Phase no basta. */
  const directo = () => {
    const d = mesa({ mios:{ mt:[{carta:"Scapegoat"}] }, suyos:{ campo:["Airknight Parshath"] },
                     turnPlayer:1, fase:0x10 });
    const sg = d.zones[0][L.SZONE][0], atk = d.zones[1][L.MZONE][0];
    d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(sg)] }, 0);
  };
  comprueba("y también para cortar un ataque directo",
    directo()?.index === 0);
  comprueba("pero no al abrir su Battle Phase sin ataque declarado",
    monta(0x10)?.index == null);
}

/* ── 8. Torrential Tribute: solo si le duele más a él ─────────────── */
{
  const monta = (mios, suyos) => {
    const d = mesa({ mios:{ mt:[{carta:"Torrential Tribute"}], campo:mios },
                     suyos:{ campo:suyos }, turnPlayer:1 });
    const tt = d.zones[0][L.SZONE][0];
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(tt)] }, 0);
  };
  comprueba("no activa Torrential con más campo propio que rival",
    monta(["Airknight Parshath","Breaker the Magical Warrior"], ["Sangan"])?.index == null);
  comprueba("sí lo activa con el campo rival lleno y el suyo vacío",
    monta([], ["Airknight Parshath","Jinzo"])?.index === 0);
}

/* ══════════════════════════════════════════════════════════════════
   LO QUE E REPORTÓ EL 11 DE AGOSTO: "juega cartas por jugar"
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── jugar cartas por jugar ──");

/* 9. Snatch Steal sobre una ficha de Scapegoat. Palabras de E: "¿para qué
      hace Snatch Steal a un token de Scapegoat? Eso no le gana la partida". */
{
  const monta = (loQueTiene) => {
    const d = mesa({ mios:{ mano:["Snatch Steal"] }, suyos:{} });
    // las fichas no están en la base por nombre: se meten a mano
    d.zones[1][L.MZONE][0] = { uid:900, code:loQueTiene, controller:1,
                               location:L.MZONE, sequence:0, position:P.ATK };
    const ss = d.zones[0][L.HAND][0];
    return cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
      monster_sets:[], spell_sets:[ref(ss)], pos_changes:[], activates:[ref(ss)],
      to_bp:true, to_ep:true }, 0);
  };
  comprueba("no gasta Snatch Steal en una ficha de Scapegoat",
    monta(FICHA)?.action !== IA.SELECT_ACTIVATE, JSON.stringify(monta(FICHA)));
  comprueba("sí la gasta en un Airknight Parshath",
    monta(cod("Airknight Parshath"))?.action === IA.SELECT_ACTIVATE);
}

/* 10. Remoción sobre una ficha: cambiar una carta por nada. */
{
  const d = mesa({ mios:{ mano:["Smashing Ground"] }, suyos:{} });
  d.zones[1][L.MZONE][0] = { uid:901, code:FICHA, controller:1,
                             location:L.MZONE, sequence:0, position:P.ATK };
  const sg = d.zones[0][L.HAND][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(sg)],
    to_bp:true, to_ep:true }, 0);
  comprueba("no gasta remoción en una ficha", resp?.action !== IA.SELECT_ACTIVATE);
}

/* 11. Remoción sobre un muro: Gravekeeper's Spy está en el campo justamente
       para que gastes ahí el Smashing Ground. */
{
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy", pos:P.DEF}] } });
  const sg = d.zones[0][L.HAND][0];
  const resp = cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(sg)],
    to_bp:true, to_ep:true }, 0);
  comprueba("no gasta remoción en un muro en defensa", resp?.action !== IA.SELECT_ACTIVATE);
}

/* 12. Thunder Dragon. E: "le he visto descartar el Thunder Dragon para
       robar otro, y después activar esos dos sin quedarle ninguno". */
{
  const monta = (copiasEnMazo) => {
    const td = cod("Thunder Dragon");
    const d = mesa({ mios:{ mano:["Thunder Dragon"] } });
    // la decklist lleva 3; lo visto sale de las zonas, así que se rellena el gy
    d.decklist = { 0:[td,td,td], 1:[] };
    for(let i=0;i<3-copiasEnMazo-1;i++)
      d.zones[0][L.GRAVE].push({ uid:950+i, code:td, controller:0,
                                 location:L.GRAVE, sequence:i, position:P.ATK });
    const c = d.zones[0][L.HAND][0];
    return cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
      monster_sets:[ref(c)], spell_sets:[], pos_changes:[], activates:[ref(c)],
      to_bp:true, to_ep:true }, 0);
  };
  comprueba("Thunder Dragon con copias en el mazo sí se activa",
    monta(2)?.action === IA.SELECT_ACTIVATE, JSON.stringify(monta(2)));
  comprueba("sin copias en el mazo, no lo tira a la basura",
    monta(0)?.action !== IA.SELECT_ACTIVATE, JSON.stringify(monta(0)));
}

/* 13. Book of Moon encadenada a su propia invocación: 234 veces en 300
       partidas con el cerebro anterior, la jugada más repetida del escáner. */
{
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon"}], campo:["Asura Priest"] },
                   suyos:{}, turnPlayer:0 });
  const bom = d.zones[0][L.SZONE][0];
  const resp = cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(bom)] }, 0);
  comprueba("no encadena Book of Moon a su propia invocación",
    resp?.index == null, JSON.stringify(resp));
}

/* 14. El plan: cada mazo se juega con su condición de victoria. */
{
  const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
  const busca = re => MAZOS.find(m=>re.test(m.nombre ?? m.name));
  const plan = m => planDe(m.main, names).nombre;
  comprueba("reconoce el mazo de Burn como Burn (no como Goat Control)",
    plan(busca(/^Burn Goat/)) === "Burn", plan(busca(/^Burn Goat/)));
  comprueba("reconoce Final Countdown como mazo de aguantar",
    planDe(busca(/^Final Countdown/).main, names).aguanta === true);
  comprueba("reconoce Chaos Turbo como Chaos",
    plan(busca(/^Chaos Turbo/)) === "Chaos", plan(busca(/^Chaos Turbo/)));
  comprueba("y Goat Control sigue siendo Goat Control",
    plan(busca(/^Goat Control/)) === "Goat Control", plan(busca(/^Goat Control/)));
}

/* ══════════════════════════════════════════════════════════════════
   REPORTADO EN REDDIT — el vocabulario que EDOPro tiene y no teníamos
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── lo que reportaron en Reddit ──");

/* 15. "Normal summoned Asura Priest turn one". Asura Priest es un espíritu:
       vuelve a la mano en tu End Phase. En el turno 1 no hay Battle Phase,
       así que la invocación del turno se tira entera. */
{
  const monta = (conBatalla) => {
    const d = mesa({ mios:{ mano:["Asura Priest"] }, suyos:{} });
    const ap = d.zones[0][L.HAND][0];
    return cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[ref(ap)],
      special_summons:[], monster_sets:[ref(ap)], spell_sets:[], pos_changes:[],
      activates:[], to_bp:conBatalla, to_ep:true }, 0);
  };
  comprueba("no invoca Asura Priest en un turno sin Battle Phase",
    monta(false)?.action !== IA.SELECT_SUMMON, JSON.stringify(monta(false)));
  comprueba("con Battle Phase y el campo rival vacío, sí lo invoca",
    monta(true)?.action === IA.SELECT_SUMMON, JSON.stringify(monta(true)));
}

/* 16. "Used premature burial to bring back Hand of Nephthys even if they
       already summoned Phoenix... destroyed both their monster for nothing". */
{
  const monta = (phoenixFuera) => {
    const d = mesa({ mios:{ mt:[{carta:"Hand of Nephthys", pos:P.ATK}],
                            campo:["Magician of Faith"] } });
    if(phoenixFuera)
      d.zones[0][L.MZONE][1] = { uid:960, code:cod("Sacred Phoenix of Nephthys"),
        controller:0, location:L.MZONE, sequence:1, position:P.ATK };
    d.decklist = { 0:[cod("Sacred Phoenix of Nephthys")], 1:[] };
    const hn = d.zones[0][L.SZONE][0];
    return cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
      monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(hn)],
      to_bp:true, to_ep:true }, 0);
  };
  comprueba("no usa Hand of Nephthys con el Phoenix ya en el campo",
    monta(true)?.action !== IA.SELECT_ACTIVATE, JSON.stringify(monta(true)));
  comprueba("sin Phoenix fuera, sí lo usa",
    monta(false)?.action === IA.SELECT_ACTIVATE, JSON.stringify(monta(false)));
}

/* 17. Combate: la cuenta de ataque no vale contra todo. */
{
  const ataca = (contra) => {
    const d = mesa({ mios:{ campo:["Airknight Parshath"] }, suyos:{ campo:[contra] } });
    const mio = d.zones[0][L.MZONE][0];
    const r = cerebro(d)({ type:T.SELECT_BATTLECMD, player:0,
      attacks:[ref(mio)], activates:[], to_m2:true, to_ep:true }, 0);
    return r?.action === BA.SELECT_BATTLE;
  };
  comprueba("ataca a un Breaker de 1600 (le gana limpio)", ataca("Breaker the Magical Warrior"));
  comprueba("no ataca a Spirit Reaper (no muere en combate)", !ataca("Spirit Reaper"));
  comprueba("no se lanza contra D.D. Warrior Lady (destierra a los dos)",
    !ataca("D.D. Warrior Lady"));
}

/* 18. Los candados van primero: mientras esté puesto, tu mazo no funciona. */
{
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:[{carta:"Jinzo", pos:P.ATK},
                                  {carta:"Airknight Parshath", pos:P.ATK}] } });
  const sg = d.zones[0][L.HAND][0];
  const objetivos = d.zones[1][L.MZONE].filter(Boolean).map(ref);
  cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
    monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(sg)],
    to_bp:true, to_ep:true }, 0);
  const resp = cerebro(d)({ type:T.SELECT_CARD, player:0, min:1, max:1,
                            selects:objetivos }, 0);
  comprueba("la remoción va al Jinzo antes que al Airknight",
    resp?.indicies?.[0] === 0, JSON.stringify(resp));
}

/* 19. "They mystical space typhooned their own magic/trap card on every
       game I played" (AyeRye). En la ventana de cadena la carta no tenía
       ninguna condición: si el rival no tiene backrow, el único objetivo
       legal es el tuyo. */
{
  const monta = (rivalTieneBackrow) => {
    const d = mesa({ mios:{ mt:[{carta:"Mystical Space Typhoon"},
                               {carta:"Torrential Tribute"}] },
                     suyos: rivalTieneBackrow ? { mt:[{carta:"Snatch Steal", pos:P.ATK}] } : {},
                     turnPlayer:1 });
    const mst = d.zones[0][L.SZONE][0];
    return cerebro(d)({ type:T.SELECT_CHAIN, player:0, forced:false, selects:[ref(mst)] }, 0);
  };
  comprueba("no encadena MST sin backrow rival (se volaría el suyo)",
    monta(false)?.index == null, JSON.stringify(monta(false)));
  comprueba("sí la encadena sobre una Snatch Steal del rival",
    monta(true)?.index === 0, JSON.stringify(monta(true)));
}

/* ══════════════════════════════════════════════════════════════════
   EL PLAN DE CADA MAZO, CONTRASTADO CON SU GUÍA
   Los datos de `plan.js` salen de las guías de goatformat.com. Esto
   comprueba que la tabla sigue diciendo lo que dicen las guías y que
   ningún mazo se queda sin reconocer al tocar la tabla.
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── el plan de cada mazo ──");
{
  const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
  const de = re => { const m = MAZOS.find(x=>re.test(x.nombre ?? x.name));
                     return planDe(m.main, names); };

  /* Cada línea es lo que dice la guía del mazo, no lo que nos parece. */
  const esperado = [
    [/^Goat Control/,   "Goat Control",   "control"],
    [/^Burn Goat/,      "Burn",           "quema"],
    [/^Horus Goat/,     "Horus",          "beatdown"],
    [/^Phoenix Goat/,   "Phoenix",        "control"],
    [/^Zombie Goat/,    "Zombie",         "beatdown"],
    [/^Chaos Turbo/,    "Chaos",          "beatdown"],
    [/^Bazoo Return/,   "Bazoo Return",   "combo"],
    [/^PACMAN/,         "PACMAN",         "control"],
    [/^Clown Control/,  "Clown Control",  "control"],
    [/^Cat Control/,    "Cat Control",    "control"],
    [/^Monarch/,        "Monarcas",       "beatdown"],
    [/^Beastdown/,      "Beastdown",      "beatdown"],
    [/^Gravekeeper/,    "Gravekeeper",    "beatdown"],
    [/^Empty Jar/,      "Empty Jar",      "deckout"],
    [/^Reasoning Gate/, "Reasoning Gate", "combo"],
    [/^Final Countdown/,"Final Countdown","reloj"],
    [/^Library FTK/,    "Library FTK",    "combo"],
  ];
  const fallan = esperado.filter(([re,nom,obj])=>{
    const p = de(re); return p.nombre!==nom || p.objetivo!==obj; });
  comprueba(`los ${esperado.length} mazos reconocidos se corresponden con su guía`,
    !fallan.length, fallan.map(([re,n])=>`${n} → ${de(re).nombre}`).join(" · "));

  /* Ningún mazo debería quedarse sin plan por un cambio en la tabla. */
  const sinPlan = MAZOS.filter(m=>m.main?.length>=40 && !m.aviso)
    .filter(m=>planDe(m.main,names).nombre==="Beatdown" && !/^Beastdown/.test(m.nombre??m.name));
  comprueba("ningún mazo se queda sin reconocer",
    sinPlan.length===0, sinPlan.map(m=>m.nombre??m.name).join(", "));

  /* Las cartas con las que se gana están pesadas, no marcadas a ojo. */
  const gc = de(/^Goat Control/);
  comprueba("Thousand-Eyes Restrict pesa más que Metamorphosis en Goat Control",
    gc.peso("Thousand-Eyes Restrict") > gc.peso("Metamorphosis"),
    `${gc.peso("Thousand-Eyes Restrict")} vs ${gc.peso("Metamorphosis")}`);
  const fc = de(/^Final Countdown/);
  comprueba("Final Countdown ES la partida de su mazo (peso máximo)",
    fc.peso("Final Countdown")===3 && fc.aguanta===true);
  comprueba("el mazo de Burn sostiene la Wave-Motion Cannon en el campo",
    de(/^Burn Goat/).sostiene("Wave-Motion Cannon"));
  comprueba("el de Gravekeeper sostiene Necrovalley",
    de(/^Gravekeeper/).sostiene("Necrovalley"));
  comprueba("y cada mazo trae su guion escrito",
    esperado.every(([re])=>de(re).pasos.length >= 3));
}

/* ── LA ESCALERA DE CONOCIMIENTO ──
   Lo que E pidió: el experto sigue todos los pasos de la guía y los de
   abajo van perdiendo capacidades de una en una. */
console.log("\n── qué sabe cada nivel de su propio mazo ──");
{
  const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
  const pac = MAZOS.find(m=>/PACMAN/.test(m.nombre ?? m.name));
  const trazasDe = nivel => {
    const lineas = [];
    const d = mesa({});
    d.decklist = { 0:pac.main, 1:[] };
    crearCerebro({ X, duel:d, db, names, nivel, yo:0, log:e=>lineas.push(e.msg) });
    return lineas;
  };
  const pasos = n => trazasDe(n).filter(l=>/^ {2}paso /.test(l)).length;
  const sabeMazo = n => trazasDe(n).some(l=>/voltear un bicho/.test(l));
  comprueba("el experto se sabe el guion entero", pasos("experto") >= 4, `${pasos("experto")} pasos`);
  comprueba("duro conoce el mazo pero no sigue el guion",
    pasos("duro")===0 && sabeMazo("duro"));
  comprueba("normal tampoco sigue el guion", pasos("normal")===0);
  comprueba("novato no sabe ni con qué gana su mazo", !sabeMazo("novato"));
}

/* ══════════════════════════════════════════════════════════════════
   LEER LA CARTA — la cobertura, no los casos sueltos

   `knowledge.js` tiene 109 cartas escritas a mano; el pool son 1.685.
   Las otras 1.576 caían en `default: p = 1.2`, por encima del umbral de
   0.8, así que el bot jugaba a ciegas todo lo que no conocía. Es la
   causa común de los "misplays" reportados: Breaker rompiendo una tapada
   cualquiera, Skull Lair sobre su propio monstruo, Raigeki Break sobre
   lo suyo. Esto comprueba que el suelo es el correcto —sin justificación,
   no se juega— y que las cartas de los reportes quedan cubiertas.
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── leer la carta en vez de tener un caso escrito ──");
{
  const { leerCarta, utilidadLeida } = await import("./src/ai/lectura.js");
  const texto = nom => { const c = cod(nom); return names[c]?.desc ?? ""; };
  const dat   = nom => db.get(cod(nom)) ?? null;

  /* Cartas concretas de los reportes de E: el lector tiene que saber al
     menos QUÉ necesitan para conseguir algo. */
  const casos = [
    ["Skull Lair",        "monstruoRivalUtil"],
    /* Raigeki Break dice "target 1 card on the field": puede ir a un
       backrow, así que `algoDelRival` es lo correcto. Lo que no puede
       es dispararse sin nada del rival, y eso se comprueba abajo. */
    ["Raigeki Break",     "algoDelRival"],
    ["Smashing Ground",   "monstruoRivalUtil"],
    ["Dust Tornado",      "backrowRival"],
    ["Pot of Greed",      "mazoPropio"],
    ["Premature Burial",  "monstruoEnCementerio"],
  ];
  const fallan = casos.filter(([n,esp])=> leerCarta(texto(n), dat(n)).hace !== esp);
  comprueba("el lector saca de su texto qué necesita cada carta",
    !fallan.length,
    fallan.map(([n,e])=>`${n}: esperado ${e}, salió ${leerCarta(texto(n),dat(n)).hace}`).join(" · "));

  /* Y el suelo: sin objetivo, nota CERO, no 1.2. */
  const vacio = { monstruosRival:[], monstruos:[], backrowRival:[], backrow:[],
                  cementerio:[], mano:[], deckRestante:0,
                  manoRival:{cuantas:0}, lp:{mio:8000,rival:8000} };
  const sinNada = ["Skull Lair","Raigeki Break","Smashing Ground","Dust Tornado"]
    .map(n => utilidadLeida(texto(n), dat(n), vacio, {}).p);
  comprueba("sin nada a lo que apuntar, la nota es cero (antes era 1.2)",
    sinNada.every(p=>p===0), sinNada.join(", "));

  /* Con objetivo, sí se juegan: el suelo no puede dejar al bot mudo. */
  const conAlgo = { ...vacio, deckRestante:30,
                    monstruosRival:[{nombre:"Airknight Parshath", datos:dat("Airknight Parshath"),
                                     bocaAbajo:false, defensa:false}],
                    backrowRival:[{nombre:"Snatch Steal", datos:dat("Snatch Steal"), bocaAbajo:false}] };
  const ayuda = { objetivoBueno: conAlgo.monstruosRival[0] };
  const conObjetivo = [["Skull Lair",1],["Smashing Ground",1],["Dust Tornado",1],["Pot of Greed",1]]
    .map(([n]) => utilidadLeida(texto(n), dat(n), conAlgo, ayuda).p);
  comprueba("con objetivo en la mesa, sí se juegan",
    conObjetivo.every(p=>p>0.8), conObjetivo.map(p=>p.toFixed(1)).join(", "));

  /* Cobertura sobre el pool entero: cuántas cartas dejan de ser un
     misterio para el bot. No tiene que ser el 100% —hay cartas cuyo
     texto no dice nada valorable— pero sí la mayoría. */
  /* La cobertura se mide sobre MÁGICAS Y TRAMPAS, que es lo que juzga la
     rama del `default`: un monstruo se invoca, no se "activa", y su valor
     sale de sus stats. Pedir cobertura sobre el pool entero mezclaba las
     vainillas y daba un número que no significaba nada. */
  const POOL = JSON.parse(readFileSync("../data/goat-pool.json","utf-8")).map(Number);
  const mt = POOL.filter(c => { const d = db.get(c); return d && (d.type & 0x6); });
  const conModelo = mt.filter(c => leerCarta(names[c]?.desc, db.get(c)).hace).length;
  const pct = Math.round(conModelo/mt.length*100);
  /* No llega al 100% y no pasa nada: lo que no se sabe leer se queda en
     "no la juegues", que es el lado seguro. Antes era "juégala siempre". */
  comprueba(`el lector cubre la mayoría de las mágicas y trampas (${pct}% de ${mt.length})`,
    pct >= 50, `${conModelo} con modelo`);
}

/* ══════════════════════════════════════════════════════════════════
   EFECTOS OPCIONALES: son decisiones, no un "sí" automático
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── decidir los efectos opcionales ──");
{
  /* D.D. Warrior Lady: "when this card battles an opponent's monster:
     You can banish that monster, ALSO BANISH THIS CARD". Si le gana
     limpio, aceptar es cambiar tu monstruo vivo por uno ya muerto. */
  const pregunta = (contra) => {
    const d = mesa({ mios:{ campo:["D.D. Warrior Lady"] }, suyos:{ campo:[contra] } });
    return cerebro(d)({ type:T.SELECT_EFFECTYN, player:0,
                        code:cod("D.D. Warrior Lady"), description:0n }, 0);
  };
  comprueba("no se destierra a sí misma ganando el combate limpio",
    pregunta("Magician of Faith")?.yes === false);
  comprueba("pero sí contra algo que no puede matar",
    pregunta("Black Luster Soldier - Envoy of the Beginning")?.yes === true);
  comprueba("y sí contra un Spirit Reaper, que no muere en combate",
    pregunta("Spirit Reaper")?.yes === true);
}

/* Ring of Destruction hace el daño a LOS DOS jugadores. E la vio
   suicidarse con ella al final de una partida. */
{
  const monta = (misLP, susLP) => {
    const d = mesa({ mios:{ mano:["Ring of Destruction"] },
                     suyos:{ campo:["Airknight Parshath"] },
                     lp:[misLP, susLP] });
    const ring = d.zones[0][L.HAND][0];
    return cerebro(d)({ type:T.SELECT_IDLECMD, player:0, summons:[], special_summons:[],
      monster_sets:[], spell_sets:[], pos_changes:[], activates:[ref(ring)],
      to_bp:true, to_ep:true }, 0);
  };
  comprueba("no se mata a sí misma con Ring of Destruction",
    monta(1500, 1500)?.action !== IA.SELECT_ACTIVATE, JSON.stringify(monta(1500,1500)));
  comprueba("pero remata cuando le mata solo a él",
    monta(8000, 1500)?.action === IA.SELECT_ACTIVATE, JSON.stringify(monta(8000,1500)));
}

console.log(`\n${ok}/${ok+mal} comprobaciones pasan`);
process.exit(mal ? 1 : 0);
