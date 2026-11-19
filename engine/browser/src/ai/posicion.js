/* ════════════════════════════════════════════════════════════════
   LEER LA POSICIÓN — en qué punto va la partida y qué se guarda

   E, 17-09: «que entienda cómo se encuentra el tablero, y en base a la
   win condition de su mazo, su mano y su campo, discurra qué tiene que
   hacer para ganar… guardándose las cartas para cuando hagan falta».

   Esto es esa lectura, y se hace UNA VEZ por decisión, antes de puntuar
   nada. Sale un objeto con números, no con intuiciones:

     · relojMio   turnos que aguanto si el rival pega con lo que tiene
     · relojSuyo  turnos que tardo en matarle con lo que tengo
     · ventaja    cartas mías menos cartas suyas (mano + mesa)
     · amenaza    su monstruo que más duele, y si tengo respuesta
     · piezas     si tengo en mano/mesa con qué gana este mazo
     · postura    qué toca hacer este turno, con su motivo
     · reservas   qué cartas NO se gastan todavía y para qué se guardan

   Las RESERVAS son la parte que faltaba. Un jugador no activa Sakuretsu
   Armor contra el primer bicho que le atacan: la guarda para el 1900 que
   sabe que va a salir. Hasta ahora cada carta se puntuaba sola y por eso
   parecía que el bot «tiraba las cartas por tirarlas». Ahora cada carta
   reactiva lleva una condición de gasto, y mientras no se cumpla su nota
   se capa —salvo que el reloj diga que no hay futuro que guardar.

   Es heurística, no simulación: la simulación vive en `pensar.js` y
   decide entre jugadas concretas. Las dos se usan a la vez: esta pone el
   criterio, aquella comprueba el resultado.
   ════════════════════════════════════════════════════════════════ */
import { atk, def, poder, valorCarta, infoDe, ventaja, atkEnCombate } from "./evaluar.js";
import { canon } from "./knowledge.js";

/* Daño por turno que puede hacerme lo que tiene EN LA MESA, contando que
   mis monstruos boca arriba bloquean al que pueden bloquear. Prudente a
   propósito: las tapadas suyas no se cuentan (no se sabe qué son) y las
   mías sí bloquean. */
export function dañoPorTurno(v){
  const suyos = v.monstruosRival.filter(c => !c.bocaAbajo && !c.defensa).map(c => atk(c)).sort((a,b)=>b-a);
  const mios  = v.monstruos.filter(c => !c.bocaAbajo).map(c => poder(c)).sort((a,b)=>b-a);
  let daño = 0;
  for(const a of suyos){
    const bloquea = mios.length ? mios.shift() : null;
    if(bloquea == null) daño += a;                       // ataque directo
    else if(a > bloquea) daño += (a - bloquea);          // le pasa por encima
  }
  return daño;
}

/* Y lo que puedo hacerle yo con lo que tengo boca arriba. */
export function dañoQueHago(v){
  const mios  = v.monstruos.filter(c => !c.bocaAbajo && !c.defensa).map(c => atk(c)).sort((a,b)=>b-a);
  const suyos = v.monstruosRival.map(c => c.bocaAbajo ? 1500 : poder(c)).sort((a,b)=>b-a);
  let daño = 0;
  for(const a of mios){
    const enfrente = suyos.length ? suyos.shift() : null;
    if(enfrente == null) daño += a;
    else if(a > enfrente) daño += (a - enfrente);
  }
  return daño;
}

const turnosPara = (lp, porTurno) => porTurno <= 0 ? 99 : Math.ceil(lp / porTurno);

/* ── PARA QUÉ SE GUARDA CADA COSA ──
   Cada entrada dice cuándo SÍ se gasta. Sale de las guías del formato:
   la remoción puntual es para lo que no matas en combate, las trampas de
   batalla para el monstruo que de verdad duele, y las masivas para
   cuando hay dos cuerpos o uno grande enfrente. */
const RESERVAS = {
  trapRemoval: { para:"un atacante de 1700 o más", umbralAtk:1700 },
  trapMass:    { para:"dos monstruos suyos o uno de 1900+", cuerpos:2, umbralAtk:1900 },
  removal:     { para:"algo que no mato en combate", umbralAtk:1600 },
  /* `pideMomento`: en SU turno tampoco vale quemarla en cuanto empieza.
     E, torneo 2 ronda 1: «turno 4 book of moon gastado para nada, puedo
     voltear de nuevo». El bot la encadenaba en la DRAW PHASE del rival
     contra un Ryu Kokki de 2400: girarlo boca abajo ahí no cuesta nada
     —se vuelve a voltear en la Main Phase y ataca igual—. Book of Moon
     vale cuando hay un ataque declarado (el ataque se cae) o cuando hay
     algo a lo que responder. */
  trick:       { para:"el turno del rival", soloTurnoRival:true, pideMomento:true },
  stall:       { para:"el turno del rival", soloTurnoRival:true },
  counter:     { para:"una carta que decida la partida", valor:1.5 },
  spellRemoval:{ para:"un equipo o una reanimación suya", rolObjetivo:["equipSteal","revival","lock","muroGlobal","campo"] },
};

/* ══════════════════════════════════════════════════════════════════
   EL ATRIBUTO QUE LE FALTA AL CHAOS

   De la guía de E (§5.1 y patrón P11): «antes de una destrucción, simular
   el Cementerio rival posterior. Si la amenaza actual es tolerable y su
   muerte activa un Chaos que no se puede responder, generar una
   alternativa». En Goat esto decide partidas: Black Luster Soldier y
   Chaos Sorcerer piden desterrar un LIGHT y un DARK del propio
   cementerio, así que MATARLE un monstruo puede ser regalarle la mitad
   del coste.

   Aquí no se adivina su mazo: se mira lo que es público —su cementerio y
   sus desterradas— y si se le ha VISTO un Chaos. Sin haber visto ninguno
   el aviso sigue existiendo pero pesa menos: en este formato casi todo el
   mundo los juega, y aun así una sospecha no es un hecho.
   ══════════════════════════════════════════════════════════════════ */
const LIGHT = 16, DARK = 32;
/* `side.js` ya tiene su propia lista con el mismo nombre y todo esto
   acaba en el mismo IIFE del bundle: por eso este se llama distinto. */
const MONSTRUOS_CHAOS = new Set(["Black Luster Soldier - Envoy of the Beginning",
                                "Chaos Sorcerer", "Chaos Emperor Dragon - Envoy of the End"]);
const atributoDe = c => Number(c?.datos?.attribute) || 0;

/* Cuántos LIGHT y DARK tiene ya en el cementerio, y si le hemos visto un
   Chaos en cualquier sitio público (cementerio, desterradas, mesa). */
export function combustibleChaos(v){
  let luz = 0, oscuro = 0;
  for(const c of (v.cementerioRival ?? [])){
    const a = atributoDe(c);
    if(a & LIGHT) luz++;
    if(a & DARK) oscuro++;
  }
  const publicas = [...(v.cementerioRival ?? []), ...(v.desterradasRival ?? []),
                    ...(v.monstruosRival ?? []).filter(c => !c.bocaAbajo)];
  const visto = publicas.some(c => c?.nombre && MONSTRUOS_CHAOS.has(canon(c.nombre)));
  return { luz, oscuro, visto,
           /* Le falta el atributo del que no tiene NINGUNO. Con los dos
              cubiertos ya no hay nada que regalar; con ninguno tampoco
              basta un solo monstruo. */
           falta: luz === 0 && oscuro > 0 ? LIGHT : oscuro === 0 && luz > 0 ? DARK : 0 };
}

/* ¿Mandar ESTE monstruo suyo a SU cementerio le completa el Chaos?
   Devuelve cuánto pesa (0 si no). Se usa como penalización, no como veto:
   si esa amenaza va a matarme, sobrevivir manda. */
export function regalaChaos(v, carta){
  if(!carta || carta.bocaAbajo || carta.mia) return 0;
  const comb = combustibleChaos(v);
  if(!comb.falta) return 0;
  if(!(atributoDe(carta) & comb.falta)) return 0;
  return comb.visto ? 1.6 : 0.7;
}

/* ══════════════════════════════════════════════════════════════════
   ¿GANO ESTE TURNO ATACANDO?

   Guía, caso C29 y patrón P05: «BLS gana atacando. Ataque de 2000 y
   segundo ataque directo consecutivo de 3000 ganan. Prohibido: desterrar
   automáticamente». El bot veía «puedo desterrar su monstruo con el
   efecto» y lo hacía, que le quita el ataque a BLS ese turno y deja la
   partida viva.

   Es un CERTIFICADO modesto, como pide P22: cuenta la batalla con lo que
   se ve. No mira las trampas colocadas (no se puede: son ocultas), y las
   tapadas suyas se cuentan como un bloqueo que se come el ataque más
   flojo sin hacer daño. Si con eso llega, atacar gana; si no llega, no
   se afirma nada.
   ══════════════════════════════════════════════════════════════════ */
const BLS = "Black Luster Soldier - Envoy of the Beginning";
export function letalEnBatalla(v){
  const mios = (v.monstruos ?? [])
    .filter(c => !c.bocaAbajo && !c.defensa && !c.yaAtaco)
    .map(c => ({ atk: atk(c), doble: canon(c.nombre ?? "") === BLS }))
    .sort((a,b) => a.atk - b.atk);                // de menos a más
  if(!mios.length) return false;
  /* Sus monstruos, de más fácil a más difícil de quitar. */
  let suyos = (v.monstruosRival ?? []).map(c => c.bocaAbajo
      ? { tapada:true, valor:Infinity }
      : { tapada:false, ataque:!c.defensa, valor: c.defensa ? def(c) : atk(c) })
    .sort((a,b) => a.valor - b.valor);
  let daño = 0;
  const pendientes = [...mios];
  /* Primero se despeja: cada monstruo suyo se lo lleva el atacante más
     flojo que pueda con él. Una tapada se come al más flojo sin más. */
  for(const s2 of [...suyos]){
    const i = s2.tapada ? 0 : pendientes.findIndex(a => a.atk > s2.valor);
    if(i < 0 || !pendientes.length) break;               // esta ya no la quito
    const a = pendientes.splice(i, 1)[0];
    if(!s2.tapada && s2.ataque) daño += a.atk - s2.valor;
    suyos = suyos.filter(x => x !== s2);
    /* BLS: si destruye en batalla, ataca otra vez seguido. */
    if(a.doble && !s2.tapada) pendientes.push({ atk:a.atk, doble:false });
  }
  /* Directo solo si ya no le queda nada delante. */
  if(!suyos.length) for(const a of pendientes) daño += a.atk;
  return daño >= (v.lp?.rival ?? Infinity);
}

/* ══════════════════════════════════════════════════════════════════
   QUITAR UN JINZO TAMBIÉN LE DEVUELVE SUS TRAMPAS

   Guía, patrón P16 y caso C22 (y V14): «retirar un Jinzo puede activar
   Mirror Force rival; el efecto de quitar una amenaza puede ser
   negativo». Jinzo apaga TODAS las trampas del campo, las suyas también.
   Si tiene más trampas colocadas que yo, su Jinzo le está atando más a
   él que a mí: quitárselo —absorberlo con un TER, destruirlo— le suelta
   el backrow justo antes de que yo ataque.
   Devuelve cuánto pesa (0 si no aplica). Con un Snatch Steal el Jinzo
   sigue en el campo y sigue apagándolo todo: ahí no hay nada que pesar.
   ══════════════════════════════════════════════════════════════════ */
export function quitarJinzoLeAyuda(v, carta){
  if(!carta || carta.bocaAbajo || carta.mia) return 0;
  if(canon(carta.nombre ?? "") !== "Jinzo") return 0;
  const suyas = (v.backrowRival ?? []).filter(c => c.bocaAbajo).length;
  const mias  = (v.backrow ?? []).filter(c => c.bocaAbajo && ((Number(c.datos?.type)||0) & 0x4)).length;
  return suyas > mias ? 1.2 + 0.4 * (suyas - mias) : 0;
}

/* ══ LA QUEMA TAMBIÉN ES UN RELOJ (14-11) ══
   Pendiente del incremento 21: contra Burn el reloj solo contaba sus
   monstruos, así que una Wave-Motion Cannon con tres turnos encima no
   apuraba a nadie. Lo que se ve boca arriba y quema cada turno: la Cannon
   (1000 más por turno, y lo cargado se cobra cuando quiera), Minor Goblin
   Official (500 en mi Standby) y una Lava Golem que me hayan regalado. */
export function quemaQueMeHacen(v){
  let porTurno = 0, cargada = 0;
  for(const c of v.backrowRival ?? []){
    if(c.bocaAbajo) continue;
    const n = canon(c.nombre ?? "");
    if(n === "Wave-Motion Cannon"){ porTurno += 1000; cargada += 1000 * (Number(c.cuenta) || 0); }
    else if(n === "Minor Goblin Official") porTurno += 500;
  }
  for(const c of v.monstruos ?? []) if(!c.bocaAbajo && canon(c.nombre ?? "") === "Lava Golem") porTurno += 1000;
  return { porTurno, cargada };
}

export function leerPosicion(v, PLAN){
  const dPT = dañoPorTurno(v), dQH = dañoQueHago(v);
  const quema = quemaQueMeHacen(v);
  const relojMio  = (quema.porTurno || quema.cargada)
    ? (quema.cargada >= v.lp.mio ? 1 : turnosPara(v.lp.mio - quema.cargada, dPT + quema.porTurno))
    : turnosPara(v.lp.mio, dPT);
  const relojSuyo = turnosPara(v.lp.rival, dQH);
  const dif = ventaja(v);
  const caraArriba = v.monstruosRival.filter(c => !c.bocaAbajo);
  const amenaza = caraArriba.slice().sort((a,b) => poder(b) - poder(a))[0] ?? null;
  const cuerposSuyos = v.monstruosRival.length;
  const piezas = [...v.mano, ...v.monstruos, ...v.backrow]
    .filter(c => c.nombre && (PLAN.esClave(c.nombre) || PLAN.esMotor(c.nombre)))
    .map(c => c.nombre);

  /* La postura: qué toca. Los nombres son los de siempre —el cerebro los
     usa para inclinar la nota de cada carta— pero ahora salen del reloj
     y no de una suma de cartas. */
  let postura, razon;
  if(!cuerposSuyos && dQH >= v.lp.rival){ postura = "rematar"; razon = `le quito ${dQH} y tiene ${v.lp.rival}`; }
  else if(relojSuyo <= 1){ postura = "rematar"; razon = "muere este turno"; }
  else if(relojMio <= 1){ postura = "estabilizar"; razon = `me mata este turno (${dPT + quema.porTurno} por turno${quema.cargada ? ` y ${quema.cargada} de quema cargada` : ""}, tengo ${v.lp.mio})`; }
  else if(relojMio <= 2 || dif <= -2){ postura = "estabilizar"; razon = relojMio <= 2 ? `aguanto ${relojMio} turnos` : `voy ${-dif} cartas por detrás`; }
  else if(dif >= 1 && dQH > dPT){ postura = "presionar"; razon = `voy ${dif} cartas por delante y pego más`; }
  else if(!piezas.length && v.mano.length >= 2){ postura = "buscar"; razon = `sin piezas de ${PLAN.nombre}`; }
  else { postura = "construir"; razon = "igualados"; }

  /* Prisa: cuánto vale el futuro. Con el reloj corto, guardar cartas es
     perderlas; con la partida abierta, gastarlas es regalarlas. */
  const emergencia = relojMio <= 1 || postura === "rematar";
  const apuro = emergencia ? 1 : relojMio <= 2 ? 0.7 : dif < 0 ? 0.45 : v.turno >= 12 ? 0.35 : 0.15;

  return {
    dañoPorTurno: dPT, dañoQueHago: dQH, relojMio, relojSuyo, ventaja: dif, quema,
    amenaza, cuerposSuyos, piezas, postura, razon, emergencia, apuro,
    manoRival: v.manoRival.cuantas, tapadasRival: v.tapadasRival,
    texto: `reloj ${relojMio}/${relojSuyo}${quema.porTurno || quema.cargada ? ` (quema ${quema.cargada} cargada + ${quema.porTurno}/turno)` : ""} · cartas ${dif >= 0 ? "+" : ""}${dif} · ` +
           `amenaza ${amenaza ? `${amenaza.nombre} (${poder(amenaza)})` : "ninguna"} · ${postura} (${razon})`,
  };
}

/* ¿Esta carta se guarda o se gasta AHORA?
   `contexto` = { atacante, objetivo, esTurnoMio, pos }  */
export function decidirReserva(carta, pos, contexto = {}){
  const inf = infoDe(carta);
  const regla = RESERVAS[inf.rol];
  if(!regla) return { guardar:false };
  if(pos.emergencia) return { guardar:false, motivo:"no hay futuro que guardar" };

  const { atacante = null, objetivo = null, esTurnoMio = true } = contexto;
  if(regla.soloTurnoRival && esTurnoMio && !contexto.desbloquea)
    return { guardar:true, para:regla.para };
  if(regla.pideMomento && !esTurnoMio && !atacante && !contexto.hayCadena)
    return { guardar:true, para:"un ataque o una carta a la que responder" };
  /* Contra cartas BOCA ABAJO no se puede tasar el golpe: ahí manda la
     regla concreta de la carta (Nobleman of Crossout existe para eso). */
  if(objetivo?.bocaAbajo) return { guardar:false };
  /* Una LLAVE del tablero (TER, Relinquished, Jinzo…) no se mide por su
     ATK: un Relinquished de 0 no llega a ningún umbral y es lo primero
     que hay que quitar (E, 19-11). */
  if(objetivo && infoDe(objetivo).prioritario && ((Number(objetivo.datos?.type) || 0) & 0x1))
    return { guardar:false, motivo:"es una llave del tablero" };
  /* Lo que flota si muere en combate no se mata atacando: ahí la remoción
     por efecto es la manera, mida lo que mida (ver `flotaEnCombate`). */
  if(regla.umbralAtk != null && contexto.flotaEnCombate) return { guardar:false };
  if(regla.umbralAtk != null){
    /* Injection Fairy Lily: 400 en la carta, 3400 pagando 2000 (E, 02-10:
       «la Sakuretsu hay que guardársela para Lily»). Con `lpRival` se mide
       lo que de verdad pega. */
    const golpe = atacante ? (contexto.lpRival != null ? atkEnCombate(atacante, contexto.lpRival) : atk(atacante))
                : objetivo ? poder(objetivo) : (pos.amenaza ? poder(pos.amenaza) : 0);
    if(golpe >= regla.umbralAtk) return { guardar:false };
    /* Y si lo que viene no llega al umbral pero me mata igual, se gasta:
       guardar una carta para un muerto no sirve de nada. */
    if(atacante && contexto.lpMio != null && atk(atacante) >= contexto.lpMio)
      return { guardar:false, motivo:"si no, me mata" };
    if(regla.cuerpos && pos.cuerposSuyos >= regla.cuerpos) return { guardar:false };
    return { guardar:true, para:regla.para, hay:golpe };
  }
  if(regla.valor != null){
    const vale = objetivo ? valorCarta(objetivo) : 0;
    return vale >= regla.valor ? { guardar:false } : { guardar:true, para:regla.para };
  }
  if(regla.rolObjetivo){
    const jugoso = objetivo ? regla.rolObjetivo.includes(infoDe(objetivo).rol) : false;
    return jugoso ? { guardar:false } : { guardar:true, para:regla.para };
  }
  return { guardar:false };
}

export const nombreCanon = canon;
