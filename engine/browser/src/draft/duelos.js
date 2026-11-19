/* ══════════════════════════════════════════════════════════════════
   LAS MESAS DE BOTS SE JUEGAN DE VERDAD

   En el suizo de Goat las otras mesas se tiraban con una tabla de cruces
   medida (20 mazos conocidos). Con mazos de draft no hay tabla posible:
   cada mazo es nuevo. Así que cada partida entre dos bots se juega con el
   motor de reglas y los dos cerebros, cada uno con el plan con el que se
   construyó su mazo. Sin pantalla, sin pensar en mundos (eso es para
   jugar contra ti), con la misma maquinaria que `torneo.mjs`.

   Un duelo que llega al tope de turnos NO es una derrota por deck-out:
   se marca como `corte` (técnico) y se decide por LP, igual que el
   reloj de la ronda. El deck-out de verdad lo declara el motor.
   ══════════════════════════════════════════════════════════════════ */
const barajarCon = (a, r) => { const b = [...a]; for(let i = b.length - 1; i > 0; i--){ const j = (r() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
function xorshift(s){ let x = (s >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }

/* deps = { lib, X, GoatDuel, crearCerebro, trivial, generico, db, names, scriptReader }
   a, b = { main:[ids], extra:[ids], plan } */
export async function dueloDeBots(deps, a, b, { semilla = 1, empieza = 0, maxTurnos = 50, maxPasos = 20000, ceder = null } = {}){
  const { lib, X, GoatDuel, crearCerebro, trivial, generico, db, names, scriptReader } = deps;
  let ganador = null, motivo = null;
  const errores = [];
  const duel = new GoatDuel({ lib, X, cardDb: db, scriptReader,
    onEvent: e => { if(e.t === "win"){ ganador = e.player; motivo = e.reason; }
                    else if(e.t === "coreError") errores.push(String(e.text ?? "")); } });
  const r = xorshift(semilla);
  /* lado 0 empieza: si empieza b, se cambian los asientos */
  const L = empieza === 0 ? [a, b] : [b, a];
  await duel.create({ deck0: barajarCon(L[0].main, r), deck1: barajarCon(L[1].main, r),
    extra0: L[0].extra ?? [], extra1: L[1].extra ?? [], seed: GoatDuel.semillaMotor ? GoatDuel.semillaMotor(semilla) : [BigInt(semilla), 7n, 13n, 29n] });
  const cerebros = {
    0: crearCerebro({ X, duel, db, names, nivel: "experto", yo: 0, planFijo: L[0].plan ?? null }),
    1: crearCerebro({ X, duel, db, names, nivel: "experto", yo: 1, planFijo: L[1].plan ?? null }),
  };
  let ultima = null, intento = 0, corte = false;
  for(let paso = 0; paso < maxPasos; paso++){
    const q = await duel.run();
    if(duel.finished || !q) break;
    if(q !== ultima){ ultima = q; intento = 0; }
    const resp = trivial(q) ?? cerebros[q.player](q, intento) ?? generico(q, intento);
    intento++;
    if(!resp) break;
    duel.respond(resp);
    if(duel.turnCount > maxTurnos){ corte = true; break; }
    if(ceder && paso % 200 === 199) await ceder();
  }
  const lp = [duel.lp[0], duel.lp[1]];
  /* liberar el duelo en el motor: sin esto, tras ~1000 duelos en el mismo
     núcleo wasm se acaba la memoria («table index is out of bounds») */
  try{ if(duel.handle) lib.destroyDuel(duel.handle); }catch(e){}
  if(ganador === null){
    corte = true;
    ganador = lp[0] === lp[1] ? null : lp[0] > lp[1] ? 0 : 1;
  }
  /* devolver en términos de a / b */
  const gana = ganador === null ? null : (empieza === 0 ? ganador : 1 - ganador) === 0 ? "a" : "b";
  return { gana, motivo, corte, turnos: duel.turnCount, lp: empieza === 0 ? lp : [lp[1], lp[0]], desyncs: duel.desyncs ?? 0, errores };
}

/* Un match al mejor de `bo` (3): empieza el que pierde la anterior; la
   primera, al azar con la semilla. Un corte técnico decidido por LP cuenta
   como partida ganada; un empate a LP, como partida empatada. */
export async function matchDeBots(deps, a, b, { semilla = 1, bo = 3, ...op } = {}){
  const necesita = Math.ceil(bo / 2);
  let ga = 0, gb = 0, empates = 0, cortes = 0;
  const partidas = [];
  let empieza = (semilla % 2);
  for(let g = 0; g < bo + 2 && ga < necesita && gb < necesita; g++){
    const r = await dueloDeBots(deps, a, b, { semilla: semilla * 31 + g * 7919, empieza, ...op });
    partidas.push(r);
    if(r.corte) cortes++;
    if(r.gana === "a"){ ga++; empieza = 1; }
    else if(r.gana === "b"){ gb++; empieza = 0; }
    else { empates++; if(empates >= 2) break; }
  }
  return { ga, gb, empates, cortes, partidas };
}
