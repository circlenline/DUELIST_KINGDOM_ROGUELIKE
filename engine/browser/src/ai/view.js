/* ══════════════════════════════════════════════════════════════════
   VISTA LEGAL DEL BOT — juega limpio.

   La IA corre en el mismo proceso que tú, así que técnicamente podría
   leerte la mano. Este módulo es la frontera: recorta el estado a lo
   que un jugador honesto ve desde su silla. Si algún día quieres un
   bot tramposo, se cambia aquí y en ningún otro sitio.
   ══════════════════════════════════════════════════════════════════ */
const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
const bocaAbajo = p => !!(p & 0x0a);

/* ══════════════════════════════════════════════════════════════════
   SISTEMA F · MEMORIA DE LO QUE YA SE HA VISTO

   Dos reportes de E que son el mismo agujero visto por sus dos caras:

     · atacó a un monstruo en defensa cuya defensa ya había visto y
       sabía que no podía superar;
     · y NO atacó a otro en defensa cuya defensa ya había visto y sí
       podía superar.

   Un jugador humano se acuerda. El bot no: en cuanto la carta volvía
   boca abajo, `vistaDe` la ocultaba entera y el evaluador de combate se
   quedaba adivinando con un valor genérico.

   Recordar lo que se ha ENSEÑADO no es hacer trampas —es justo lo que
   distingue a un jugador atento— así que esto vive aquí, en la frontera
   que impide ver lo oculto, y no en el cerebro. La regla es estricta:
   solo entra en la memoria lo que ha estado boca arriba delante de sus
   ojos. Lo que nunca se ha visto sigue siendo una incógnita.

   La memoria cuelga del propio duelo y es POR JUGADOR: cada uno se
   acuerda de lo que ha visto él. Así se borra sola al empezar otro
   duelo y no hay estado global que limpiar.
   ══════════════════════════════════════════════════════════════════ */
function memoriaDe(duel, yo){
  if(!duel.__memoriaIA) duel.__memoriaIA = { 0:new Map(), 1:new Map() };
  return duel.__memoriaIA[yo] ?? (duel.__memoriaIA[yo] = new Map());
}
function apuntarLoVisible(duel, yo, db, names){
  const mem = memoriaDe(duel, yo);
  for(const p of [0,1]){
    for(const loc of [L.MZONE, L.SZONE, L.GRAVE, L.REMOVED]){
      for(const c of (duel.zones[p][loc] ?? [])){
        if(!c || c.code == null) continue;
        /* Boca abajo en el campo del RIVAL no cuenta: eso no se ha visto.
           En el cementerio y el destierro todo es público. */
        const oculta = (loc === L.MZONE || loc === L.SZONE)
                       && bocaAbajo(c.position) && c.controller !== yo;
        if(oculta) continue;
        const d = db.get(c.code) ?? null;
        mem.set(c.uid, { code:c.code, nombre:names[c.code]?.name ?? null, datos:d,
                         atk:d?.attack ?? null, def:d?.defense ?? null });
      }
    }
  }
  return mem;
}

/* Lo que `yo` recuerda de la carta que ocupa (controlador, zona, índice),
   o null. Para las listas del motor, que traen cartas tapadas del rival:
   si ya la vi boca arriba, la recuerdo; si no, es una incógnita. */
export function recordadaEnSitio(duel, yo, controller, location, sequence){
  const c = duel.at?.(controller, location, sequence ?? 0);
  return c ? (memoriaDe(duel, yo).get(c.uid) ?? null) : null;
}

/* ══════════════════════════════════════════════════════════════════
   EL MENSAJE DEL MOTOR TAMBIÉN PASA POR LA FRONTERA

   ocgcore no filtra por jugador: eso lo hace el servidor de EDOPro antes
   de mandar nada. Aquí no hay servidor, así que una pregunta como «elige
   un objetivo» llegaba con el CÓDIGO REAL de las cartas boca abajo del
   rival. Medido con `check-frontera.mjs`: 6 decisiones de 2.687 cambiaban
   al cambiar solo ese código, todas eligiendo objetivo (MST, remoción,
   ataques) sobre cartas tapadas. Es decir, el bot las veía.

   Se borra el código de toda carta del rival boca abajo en su campo. Las
   de su MANO o su MAZO que aparecen en una lista sí se dejan: si el motor
   te pide elegir entre ellas es porque un efecto te las enseña
   (Confiscation, un registro de mazo público). Lo mío tapado lo conozco.
   Devuelve una copia; el mensaje original sigue intacto para responder.
   ══════════════════════════════════════════════════════════════════ */
export function mensajeLegal(m, duel, yo){
  if(!m || typeof m !== "object") return m;
  let tocado = false;
  const limpiar = l => {
    if(!l || typeof l !== "object" || !("code" in l) || l.controller == null) return l;
    if(l.controller === yo || !(l.location === L.MZONE || l.location === L.SZONE)) return l;
    const pos = l.position ?? duel.at?.(l.controller, l.location, l.sequence ?? 0)?.position ?? 0;
    if(!bocaAbajo(pos) || !l.code) return l;
    tocado = true;
    return { ...l, code:0, position:pos };
  };
  const copia = { ...m };
  for(const [k, v] of Object.entries(m))
    if(Array.isArray(v) && v.some(x => x && typeof x === "object" && "code" in x))
      copia[k] = v.map(limpiar);
  return tocado ? copia : m;
}

export function vistaDe(duel, yo, db, names){
  const rival = 1-yo;
  const memoria = apuntarLoVisible(duel, yo, db, names);
  const carta = (c, oculta) => c && ({
    uid:c.uid, code: oculta ? null : c.code,
    nombre: oculta ? null : (names[c.code]?.name ?? null),
    datos: oculta ? null : db.get(c.code) ?? null,
    /* ATK/DEF del TABLERO, no de la ficha de la carta. El adaptador se los
       pregunta al motor en cada decisión. Sin esto, Thousand-Eyes Restrict
       valía 0 para la IA aunque hubiera absorbido un 1900, y un monstruo
       equipado o robado seguía valiendo su ataque impreso.
       OJO: van dentro de `oculta`. El motor contesta también por las cartas
       tapadas del rival, y dejarlas pasar aquí convertiría este módulo
       —que existe justo para que el bot juegue limpio— en un chivato. */
    /* PRESTADO: un monstruo que controlo pero que es SUYO —se lo he
       robado con Change of Heart o Snatch Steal—. Se sabe por el DUEÑO
       que apunta el espejo (`owner`, fijo desde que la carta entra al
       duelo), no por la decklist del rival: eso fallaba en el espejo
       —si los dos llevan la carta nunca era prestada— y leía una lista
       que el bot no tiene por qué conocer. Sin `owner` (tableros montados
       a mano) no se presume nada.
       OJO, límite conocido: prestado no dice CUÁNTO dura. Change of Heart
       vuelve al acabar el turno; Snatch Steal dura mientras siga el
       equipo; Creature Swap es para siempre. */
    prestado: c.controller===yo && c.owner!=null && c.owner!==yo,
    /* Y al revés: un monstruo MÍO que controla él (me lo robó). */
    mioRobado: c.controller!==yo && c.owner!=null && c.owner===yo,
    atkReal: oculta ? null : (c.atkReal ?? null),
    defReal: oculta ? null : (c.defReal ?? null),
    equipado: oculta ? false : !!c.equipado,
    /* A quién apunta una continua boca arriba (Spellbinding Circle):
       público, se ve la línea en la mesa. Lo pregunta el adaptador al
       motor (`refrescarVinculos`). */
    vinculadoA: (oculta || bocaAbajo(c.position)) ? null : (c.vinculadoA ?? null),
    /* ══ UNA CONTINUA QUE YA NO HACE NADA ══
       Reddit, día 2: el bot usó Breaker para romper un Call of the
       Haunted boca arriba que no tenía monstruo, «solo me liberó la
       mesa». Un Call of the Haunted boca arriba sin
       nada enganchado es una carta muerta: romperla no quita nada. Es
       público (se ve que no tiene línea). */
    muerta: continuaMuerta(c, oculta, names),
    /* Turnos en que entró, se volteó o atacó: todo público (ver duel.mjs). */
    entroTurno: c.entroTurno ?? null, volteoTurno: c.volteoTurno ?? null, atacoTurno: c.atacoTurno ?? null,
    puestaTurno: c.puestaTurno ?? null,
    equipadoA: oculta ? null : (c.equipadoA ?? null),
    pos:c.position, bocaAbajo:bocaAbajo(c.position),
    defensa: !!(c.position & 0x0c), mia: c.controller===yo,
    sec:c.sequence,
    /* Lo que RECUERDO de esta carta si ya la he visto antes. Va en un
       campo aparte a propósito: `code` y `nombre` siguen siendo null
       para lo que está tapado, así que ningún camino existente empieza
       de pronto a tratar una tapada como si estuviera destapada. Quien
       quiera usar la memoria tiene que pedirla. */
    conocida: (oculta && memoria.has(c.uid)) ? memoria.get(c.uid) : null,
  });
  const lista = (p, loc, oculta=false) =>
    (duel.zones[p][loc] ?? []).filter(Boolean).map(c=>carta(c,oculta));
  const campo = (p, loc) => (duel.zones[p][loc] ?? [])
    .map(c => c ? carta(c, bocaAbajo(c.position) && c.controller!==yo) : null);

  const v = {
    yo, rival,
    lp: { mio: duel.lp[yo], rival: duel.lp[rival] },
    turnoMio: duel.turnPlayer===yo,
    turno: duel.turnCount,
    fase: duel.phase,
    mano:        lista(yo, L.HAND),
    manoRival:   { cuantas: (duel.zones[rival][L.HAND]??[]).length },  // solo el número
    monstruos:   campo(yo, L.MZONE).filter(Boolean),
    monstruosRival: campo(rival, L.MZONE).filter(Boolean),
    backrow:     campo(yo, L.SZONE).filter(Boolean),
    backrowRival:campo(rival, L.SZONE).filter(Boolean),
    // el backrow tapado del rival: sabemos que existe, no qué es
    tapadasRival: (duel.zones[rival][L.SZONE]??[]).filter(c=>c&&bocaAbajo(c.position)).length,
    cementerio:      lista(yo, L.GRAVE),
    cementerioRival: lista(rival, L.GRAVE),
    desterradas:      lista(yo, L.REMOVED),
    desterradasRival: lista(rival, L.REMOVED),
    extra: lista(yo, L.EXTRA),
    deckRestante: (duel.zones[yo][L.DECK]??[]).length,
    deckRestanteRival: (duel.zones[rival][L.DECK]??[]).length,   // público: se ve el taco
    /* QUÉ ME QUEDA EN EL MAZO. No se puede leer del espejo: al robar se
       reasignan los códigos, así que lo que queda ahí dentro es ficción.
       Se calcula restándole a la decklist original todo lo que ya se ha
       visto (mano, campo, cementerio, desterradas). Es información
       legítima —un jugador se sabe su mazo—, y sin ella el bot descartaba
       Thunder Dragon para buscar copias que ya no existían. */
    mazo: contarMazo(duel, yo),
    /* La carta de arriba de MI mazo cuando es pública o la he puesto yo
       a la vista (Convulsion of Nature, Feather of the Phoenix). null si
       no se sabe. Ver `cimaMazo` en duel.mjs. */
    cimaMazo: duel.cimaMazo?.[yo] ?? null,
    /* Lo que el rival ha RESUELTO este turno (público). Con Waboku ya
       resuelta, este turno sus monstruos no mueren en batalla y él no
       recibe daño de batalla: atacar no consigue nada. */
    resueltasRivalTurno: (duel.resueltasTurno?.turno === duel.turnCount
      ? duel.resueltasTurno.lista.filter(x => x.controller === rival).map(x => names?.[x.code]?.name ?? "")
      : []),
  };
  /* ══ UN MONSTRUO ATADO NO ES UNA AMENAZA ══
     E, 03-10 (Reino, Weevil, T4): la IA giró su Insect Knight a defensa
     «porque de frente le regalo 400» y, a continuación, ató con
     Spellbinding Circle al único monstruo que le pegaba. Un monstruo bajo
     Spellbinding Circle (o Shadow Spell) no ataca ni cambia de posición:
     mientras siga atado no cuenta para lo que me pega. La línea de la
     atadura es pública (`vinculadoA`). */
  const ATAN = /^(Spellbinding Circle|Shadow Spell)/;
  const marca = (monstruos, backrow) => {
    for(const mo of monstruos)
      mo.atado = backrow.some(b => !b.bocaAbajo && b.vinculadoA === mo.uid && ATAN.test(b.nombre ?? ""));
  };
  marca(v.monstruosRival, v.backrow);
  marca(v.monstruos, v.backrowRival);
  return v;
}

const MUERE_SOLA = /^Call of the Haunted/;   // Premature Burial se destruye sola si pierde el monstruo
export function continuaMuerta(c, oculta, names){
  if(!c || oculta || bocaAbajo(c.position)) return false;
  return MUERE_SOLA.test(names?.[c.code]?.name ?? "")
         && (c.vinculadoA ?? null) == null && (c.equipadoA ?? null) == null;
}
/* Multiconjunto {code → cuántas quedan} del mazo propio. */
function contarMazo(duel, yo){
  const quedan = new Map();
  for(const code of (duel.decklist?.[yo] ?? []))
    quedan.set(code, (quedan.get(code) ?? 0) + 1);
  for(const loc of [L.HAND, L.MZONE, L.SZONE, L.GRAVE, L.REMOVED])
    for(const c of (duel.zones[yo]?.[loc] ?? []))
      if(c && quedan.has(c.code)) quedan.set(c.code, quedan.get(c.code) - 1);
  /* Se recorre por CONTROLADOR, así que una carta mía que el rival me haya
     robado con Snatch Steal o Creature Swap deja de descontarse y la cuenta
     se pasa de uno. Es un caso raro y el error va del lado seguro (creer que
     queda una copia de más), así que se acepta y se recorta a cero. */
  for(const [code, n] of quedan) if(n <= 0) quedan.delete(code);
  return quedan;
}
