/* ════════════════════════════════════════════════════════════════════
   ADAPTADOR: mensajes de ocgcore  →  eventos genéricos de vista.

   Esta es la pieza clave del proyecto. Ni la vista sabe qué es ocgcore,
   ni ocgcore sabe que existe una interfaz. El día que hagas tu propio
   juego, escribes otro adaptador que emita estos mismos eventos y toda
   la capa visual se reutiliza sin tocar una línea.

   Eventos emitidos:
     turn   {player, turn}          phase  {phase}
     draw   {player, cards[]}       move   {uid, from, to}
     summon {uid, kind}             flip   {uid}
     chain  {uid, code, link}       attack {uid, targetUid}
     damage {player, amount}        lp     {player, value}
     contador {uid, code, cuantos, clase, jugador}
     win    {player, reason}        prompt {kind, msg}
   ════════════════════════════════════════════════════════════════════ */

export const LOC = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32,
                     EXTRA:64, OVERLAY:128, FZONE:256, PZONE:512 };
export const POS = { FACEUP_ATTACK:1, FACEDOWN_ATTACK:2, FACEUP_DEFENSE:4,
                     FACEDOWN_DEFENSE:8 };
const SLOTTED = new Set([LOC.MZONE, LOC.SZONE, LOC.FZONE, LOC.PZONE]);
// OJO: las posiciones son máscaras de bits. Una M/T colocada llega como
// FACEDOWN (0x0a), que no es igual a FACEDOWN_DEFENSE — comparar por
// igualdad hacía que las cartas tapadas del rival se vieran boca arriba.
const isFaceDown = p => !!(p & 0x0a);
const isDefense  = p => !!(p & 0x0c);

export class GoatDuel {
  constructor({ lib, X, cardDb, scriptReader, onEvent }){
    this.lib = lib; this.X = X;
    this.cardDb = cardDb; this.scriptReader = scriptReader;
    this.onEvent = onEvent ?? (()=>{});
    this.handle = null;
    this.uid = 0;
    this.cards = new Map();          // uid -> {uid, code, position, controller, location, sequence}
    this.zones = { 0:this.emptySide(), 1:this.emptySide() };
    this.lp = { 0:8000, 1:8000 };
    this.turnPlayer = 0; this.turnCount = 0; this.phase = 0;
    this.pending = null;             // pregunta del core esperando respuesta
    this.desyncs = 0;                // veces que el espejo no cuadró con el core
    this.cadena = [];                // eslabones vivos: {code, controller, uid}
    /* A qué cartas apunta lo que se está resolviendo. Se llena con
       BECOME_TARGET y se vacía con CHAIN_END: es lo que permite saber
       que una carta mía está a punto de irse y conviene gastarla. */
    this.objetivosCadena = new Set();
    this.atacante = null;            // monstruo que ha declarado el ataque en curso
    this.objetivoAtaque = null;      // y contra qué (null = ataque directo)
    this.decklist = { 0:[], 1:[] };  // el mazo de cada uno tal cual entró
    /* ══ LA CARTA DE ARRIBA DEL MAZO, CUANDO SE SABE ══
       Con Convulsion of Nature los mazos están boca arriba y el motor
       manda DECK_TOP cada vez que cambia la de arriba: es público. Y
       A Feather of the Phoenix pone una carta del cementerio ENCIMA del
       mazo a la vista de todos. Library FTK vive de eso: Archfiend's
       Oath y Reversal Quiz solo valen sabiendo qué hay arriba. Se borra
       al robar, al sacar del mazo y al barajar. */
    this.cimaMazo = { 0:null, 1:null };
    this.finished = false;
  }
  /* ══ LA SEMILLA DEL MOTOR, MEZCLADA (reporte de Reddit, 10-10) ══
     «Con Fairy Box siempre sale cruz». Era verdad: 60 de 60. El motor usa
     xoshiro256**, y se le daban cuatro palabras casi vacías —[SEED, 7, 13,
     29], con SEED de cinco cifras—. Con un estado así el generador tarda en
     mezclar y el bit bajo, que es justo el que decide una moneda, salía
     siempre igual. Con la semilla pasada por splitmix64 (lo que recomienda
     el autor de xoshiro) sale 33 cara / 27 cruz en las mismas 60 pruebas.
     `check-moneda.mjs` lo vigila. Los logs nuevos llevan «rng: v2» para
     que `repetir-log` sepa qué semilla rehacer. */
  static semillaMotor(n){
    const M = 0xFFFFFFFFFFFFFFFFn;
    let x = BigInt(n) & M; const out = [];
    for(let i = 0; i < 4; i++){
      x = (x + 0x9E3779B97F4A7C15n) & M;
      let z = x;
      z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & M;
      z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & M;
      out.push(z ^ (z >> 31n));
    }
    return out;
  }
  emptySide(){
    /* La zona de M/T tiene SEIS huecos, no cinco: con las reglas de 2005 el
       Field Spell no vive en FZONE, vive en el puesto 5 de la propia zona de
       magias y trampas. Con cinco huecos, un Field Spell activado se salía
       del array y la vista lo pintaba en la esquina del tablero. */
    return { [LOC.DECK]:[], [LOC.HAND]:[], [LOC.GRAVE]:[], [LOC.REMOVED]:[],
             [LOC.EXTRA]:[], [LOC.MZONE]:new Array(5).fill(null),
             [LOC.SZONE]:new Array(6).fill(null), [LOC.FZONE]:new Array(1).fill(null) };
  }
  emit(t, data){ this.onEvent({ t, ...data }); }

  // ── construcción ────────────────────────────────────────────────
  /* `lp0`/`lp1` permiten dar puntos de vida distintos a cada lado. Lo
     pide el modo historia: los mandos de dificultad de un jefe final no
     pueden ser "que juegue mejor" —ya juega en experto— ni "que haga
     trampa". Los puntos de vida son el único que se entiende solo y no
     rompe ninguna regla de 2005. Por defecto, 8000 y 8000. */
  /* `mano0`/`mano1`: cuántas cartas roba cada lado al empezar. Lo pide el
     jefe final —Pegasus abre con SIETE: cinco normales más sus dos piezas
     Toon—, y el motor lo soporta desde siempre; solo estaba fijo a 5. */
  async create({ deck0, deck1, extra0=[], extra1=[], seed=[1n,2n,3n,4n],
                 lp=8000, lp0=null, lp1=null, mano0=5, mano1=5 }){
    const { OcgDuelMode, OcgLocation, OcgPosition } = this.X;
    this.handle = await this.lib.createDuel({
      flags: OcgDuelMode.MODE_GOAT, seed,
      team1:{ startingLP:lp0 ?? lp, startingDrawCount:mano0, drawCountPerTurn:1 },
      team2:{ startingLP:lp1 ?? lp, startingDrawCount:mano1, drawCountPerTurn:1 },
      cardReader: code => this.cardDb.get(code) ?? null,
      scriptReader: this.scriptReader,
      errorHandler: (type, text) => this.emit("coreError", { type, text:String(text) }),
    });
    if(!this.handle) throw new Error("ocgcore: createDuel devolvió null");
    /* La decklist de cada uno, tal cual entró. Un jugador conoce su propio
       mazo de memoria y la IA no podía: nuestro espejo del DECK reasigna
       códigos al robar, así que lo que queda ahí dentro es ficción. Con la
       lista original se puede restar lo visto y saber qué queda de verdad.
       Es información legítima —es TU mazo—, y sin ella el bot descartaba
       Thunder Dragon para buscar copias que ya no existían. */
    this.decklist = { 0:[...deck0], 1:[...deck1] };
    // el core no carga sus librerías solo; constant y utility arrastran el resto
    for(const name of ["constant.lua","utility.lua"])
      await this.lib.loadScript(this.handle, name, this.scriptReader(name));

    for(const [team, main, ex] of [[0,deck0,extra0],[1,deck1,extra1]]){
      for(const code of main)
        await this.lib.duelNewCard(this.handle,{ team, duelist:0, code, controller:team,
          location:OcgLocation.DECK, sequence:0, position:OcgPosition.FACEDOWN_DEFENSE });
      for(const code of ex)
        await this.lib.duelNewCard(this.handle,{ team, duelist:0, code, controller:team,
          location:OcgLocation.EXTRA, sequence:0, position:OcgPosition.FACEDOWN_DEFENSE });
    }
    // espejo local del estado: el core no nos dice qué hay en el deck
    for(const [team, main, ex] of [[0,deck0,extra0],[1,deck1,extra1]]){
      main.forEach(code => this.zones[team][LOC.DECK].push(this.newCard(code, team, LOC.DECK)));
      ex.forEach(code   => this.zones[team][LOC.EXTRA].push(this.newCard(code, team, LOC.EXTRA)));
    }
    /* ══ EL ESPEJO DE LP TIENE QUE SABER DE LOS LP POR LADO ══
       Esto ponía `lp` en los dos, y `lp` es el valor por defecto. Con
       Pegasus a 14000 el espejo empezaba en 8000: tras 8000 de daño la
       pantalla marcaba 0 LP y el duelo seguía —el motor tenía 6000— y así
       durante SEIS TURNOS hasta el `win` de verdad. En el log de E el
       rival llega a `lp:0` en el turno 21 y el `win` no aparece hasta el
       27. No era el motor ni el adaptador perdiendo el mensaje: era el
       espejo mintiendo. */
    this.lp[0] = lp0 ?? lp;
    this.lp[1] = lp1 ?? lp;
    await this.lib.startDuel(this.handle);
    this.emit("ready", { lp, lp0:this.lp[0], lp1:this.lp[1] });
  }
  /* ══ UN DUELO A PARTIR DE UN TABLERO ══
     Para que la IA PIENSE: monta en el motor un mundo concreto —el tablero
     que ve, y lo que no ve rellenado con una muestra plausible— y deja que
     se juegue hacia delante. Lo usa `ai/pensar.js`, nunca la partida real.

     `layout[p]` = { mano:[code], monstruos:[{code,seq,pos,owner}],
                     mt:[{code,seq,pos,owner}], gy:[code], ban:[code],
                     deck:[code], extra:[code] }
     `flags` lo decide quien llama (pensar.js empieza en el turno 1 SIN
     robar y CON batalla, y con el orden de mazo tal cual se coloca). */
  async createFromLayout({ layout, seed=[1n,2n,3n,4n], flags, lp0=8000, lp1=8000, decklist=null }){
    const { OcgDuelMode, OcgLocation, OcgPosition } = this.X;
    this.handle = await this.lib.createDuel({
      flags: flags ?? OcgDuelMode.MODE_GOAT, seed,
      team1:{ startingLP:lp0, startingDrawCount:0, drawCountPerTurn:1 },
      team2:{ startingLP:lp1, startingDrawCount:0, drawCountPerTurn:1 },
      cardReader: code => this.cardDb.get(code) ?? null,
      scriptReader: this.scriptReader,
      errorHandler: (type, text) => this.emit("coreError", { type, text:String(text) }),
    });
    if(!this.handle) throw new Error("ocgcore: createDuel devolvió null");
    for(const name of ["constant.lua","utility.lua"])
      await this.lib.loadScript(this.handle, name, this.scriptReader(name));
    const poner = async (owner, controller, code, location, sequence, position) => {
      await this.lib.duelNewCard(this.handle, { team:owner, duelist:0, code, controller,
                                                location, sequence, position });
      const c = this.newCard(code, controller, location);
      c.owner = owner; c.position = position; c.sequence = sequence;
      const z = this.zones[controller][location];
      if(SLOTTED.has(location)) z[sequence] = c; else z.push(c);
      this.reindex(controller, location);
    };
    for(const p of [0,1]){
      const L = layout[p] ?? {};
      for(const x of (L.monstruos ?? []))
        await poner(x.owner ?? p, p, x.code, OcgLocation.MZONE, x.seq, x.pos ?? OcgPosition.FACEUP_ATTACK);
      for(const x of (L.mt ?? []))
        await poner(x.owner ?? p, p, x.code, OcgLocation.SZONE, x.seq, x.pos ?? OcgPosition.FACEDOWN_DEFENSE);
      for(const code of (L.mano ?? []))  await poner(p, p, code, OcgLocation.HAND, 0, OcgPosition.FACEDOWN_DEFENSE);
      for(const code of (L.gy ?? []))    await poner(p, p, code, OcgLocation.GRAVE, 0, OcgPosition.FACEUP_ATTACK);
      for(const code of (L.ban ?? []))   await poner(p, p, code, OcgLocation.REMOVED, 0, OcgPosition.FACEUP_ATTACK);
      for(const code of (L.deck ?? []))  await poner(p, p, code, OcgLocation.DECK, 0, OcgPosition.FACEDOWN_DEFENSE);
      for(const code of (L.extra ?? [])) await poner(p, p, code, OcgLocation.EXTRA, 0, OcgPosition.FACEDOWN_DEFENSE);
    }
    this.decklist = decklist ?? { 0:[...(layout[0]?.deck ?? [])], 1:[...(layout[1]?.deck ?? [])] };
    this.lp[0] = lp0; this.lp[1] = lp1;
    await this.lib.startDuel(this.handle);
    /* El orden en que el motor guarda la mano, el cementerio y demás no
       tiene por qué ser el de colocación: se le pregunta y se ordena el
       espejo igual, o `resolve` iría a la carta equivocada. */
    const F = this.X.OcgQueryFlags;
    for(const p of [0,1]) for(const loc of [LOC.HAND, LOC.GRAVE, LOC.REMOVED, LOC.EXTRA, LOC.DECK]){
      let filas; try{ filas = this.lib.duelQueryLocation(this.handle, { flags:F.CODE, controller:p, location:loc }); }catch(e){ continue; }
      if(!Array.isArray(filas)) continue;
      const z = this.zones[p][loc], libres = [...z], nueva = [];
      for(const q of filas){
        if(!q) continue;
        const i = libres.findIndex(c => c.code === q.code);
        if(i >= 0) nueva.push(libres.splice(i,1)[0]);
      }
      if(nueva.length === z.length){ z.splice(0, z.length, ...nueva); this.reindex(p, loc); }
    }
  }
  newCard(code, controller, location){
    /* `owner`: de quién es la carta. Se fija al crearla y NO cambia al
       moverla —`insert` solo toca el controlador—, así que un monstruo
       robado con Snatch Steal o Change of Heart se distingue por
       controller ≠ owner. Antes la IA lo adivinaba mirando la decklist
       del rival, que falla en el espejo (las dos listas llevan la carta)
       y lee una lista que no es suya. */
    const c = { uid:++this.uid, code, controller, owner:controller, location, sequence:0,
                position:POS.FACEDOWN_DEFENSE };
    this.cards.set(c.uid, c); return c;
  }

  // ── seguimiento de posiciones ───────────────────────────────────
  // El core identifica cartas por (controlador, zona, índice), no por id.
  // Mantenemos el espejo para poder dar a cada carta un uid estable que
  // la vista pueda animar de un sitio a otro.
  at(controller, location, sequence){
    return this.zones[controller]?.[location]?.[sequence] ?? null;
  }
  /* El core identifica cartas por (controlador, zona, índice). Si nuestro
     espejo se desincroniza aunque sea un puesto, devolveríamos la carta
     equivocada — y eso hacía que jugaras una carta distinta a la que
     arrastrabas. Cuando el mensaje trae el código, lo verificamos y, si no
     cuadra, buscamos por código dentro de la misma zona. */
  resolve(loc, code){
    const z = this.zones[loc.controller]?.[loc.location];
    if(!z) return null;
    const direct = z[loc.sequence] ?? null;
    const want = code ?? loc.code;
    if(!want || (direct && direct.code === want)) return direct;
    const byCode = z.find(c => c && c.code === want);
    if(byCode){
      this.desyncs++;
      return byCode;
    }
    return direct;
  }
  remove(card){
    const z = this.zones[card.controller][card.location];
    if(!z) return;
    if(SLOTTED.has(card.location)){ const i=z.indexOf(card); if(i>=0) z[i]=null; }
    else { const i=z.indexOf(card); if(i>=0) z.splice(i,1); }
  }
  insert(card, controller, location, sequence){
    card.controller = controller; card.location = location; card.sequence = sequence;
    const z = this.zones[controller][location];
    if(!z) return;
    if(SLOTTED.has(location)) z[sequence] = card;
    else if(sequence >= 0 && sequence <= z.length) z.splice(sequence, 0, card);
    else z.push(card);
    this.reindex(controller, location);
  }
  reindex(controller, location){
    const z = this.zones[controller][location];
    if(!z || SLOTTED.has(location)) return;
    z.forEach((c,i)=>{ if(c) c.sequence = i; });
  }

  // ── bucle principal ─────────────────────────────────────────────
  async run(){
    const { OcgProcessResult } = this.X;
    while(!this.finished){
      const status = await this.lib.duelProcess(this.handle);
      for(const m of this.lib.duelGetMessage(this.handle)) this.handle_(m);
      if(status === OcgProcessResult.END){ this.finished = true; this.emit("end",{}); break; }
      if(status === OcgProcessResult.WAITING){ this.refrescarStats(); return this.pending; }
    }
    return null;
  }
  respond(response){
    this.lib.duelSetResponse(this.handle, response);
    this.pending = null;
  }

  /* ── ATAQUE REAL, no el impreso ──────────────────────────────────
     El espejo solo guarda el passcode, así que todo el que quería saber
     con cuánto pega un monstruo iba a la base de datos. Eso es la ficha
     de fábrica, no el tablero: Thousand-Eyes Restrict figura con 0 ATK
     y con un monstruo absorbido pega con 1900 —el bot no atacaba nunca
     con él—, y un monstruo robado con Snatch Steal o equipado no subía.
     El core sí lo sabe. Se le pregunta por las dos zonas de monstruos
     justo antes de devolver el control, una vez por decisión, y se deja
     el resultado en la propia carta del espejo (`atkReal`/`defReal`).
     Así la IA y la vista lo leen sin volverse asíncronas.
     No es hacer trampa: solo se piden ATK/DEF de los monstruos EN CAMPO,
     que están a la vista de los dos jugadores. */
  refrescarStats(){
    const F = this.X.OcgQueryFlags;
    if(!F || typeof this.lib.duelQueryLocation !== "function") return;
    const flags = F.CODE | F.POSITION | F.ATTACK | F.DEFENSE | F.EQUIP_CARD | F.TARGET_CARD;
    for(const p of [0,1]){
      let filas;
      try{
        filas = this.lib.duelQueryLocation(this.handle,
                  { flags, controller:p, location:LOC.MZONE });
      }catch(e){ return; }                      // core sin query: se sigue con la base
      if(!filas || typeof filas.then === "function") return;   // versión asíncrona
      const zona = this.zones[p][LOC.MZONE];
      filas.forEach((q,i)=>{
        const c = zona[i];
        if(!c) return;
        if(!q){ c.atkReal = c.defReal = null; c.equipado = false; return; }
        c.atkReal = q.attack  ?? null;
        c.defReal = q.defense ?? null;
        c.equipado = !!q.equipCard;
      });
    }
    this.refrescarVinculos();
  }

  /* ══════════════════════════════════════════════════════════════════
     A QUÉ MONSTRUO SE AGARRA CADA CARTA DEL BACKROW

     E: «las cartas de equipo y las trampas como Spellbinding Circle no
     tienen indicador ninguno de a qué carta están conectadas». Los
     EQUIPOS sí lo tenían —el motor manda EQUIP y de ahí sale la línea—,
     pero Spellbinding Circle no es un equipo para el motor: apunta y se
     queda, sin mandar EQUIP. Comprobado en el log de E: su cadena se
     resuelve sin un solo evento `equip`.

     Y no hacía falta inventar nada, como siempre: el motor lo sabe y lo
     dice en la consulta (`TARGET_CARD`). Lo que pasaba es que la
     consulta solo miraba la zona de MONSTRUOS, así que el backrow
     —donde viven las continuas— no se preguntaba nunca. Es literalmente
     la regla que ya está escrita para SHUFFLE_SET_CARD: no adivinar,
     preguntar.

     Se guarda en `vinculadoA` y NO en `equipadoA`, que sigue siendo lo
     que dice el mensaje EQUIP: son dos hechos distintos y la IA lee el
     segundo para saber qué pierde al destruir algo.
     ══════════════════════════════════════════════════════════════════ */
  refrescarVinculos(){
    const F = this.X.OcgQueryFlags;
    if(!F || typeof this.lib.duelQueryLocation !== "function") return;
    const flags = F.CODE | F.EQUIP_CARD | F.TARGET_CARD;
    for(const p of [0,1]){
      let filas;
      try{
        filas = this.lib.duelQueryLocation(this.handle,
                  { flags, controller:p, location:LOC.SZONE });
      }catch(e){ return; }
      if(!filas || typeof filas.then === "function") return;
      const zona = this.zones[p][LOC.SZONE];
      filas.forEach((q,i)=>{
        const c = zona[i];
        if(!c) return;
        c.vinculadoA = null;
        if(!q) return;
        /* Un equipo dice a quién está enganchado; una continua que
           apunta, a quién apunta. Para dibujar la unión da igual cuál de
           las dos sea: las dos son "esta carta se agarra a aquella". */
        const destino = q.equipCard ?? (q.targetCards ?? [])[0] ?? null;
        if(!destino) return;
        const otra = this.at(destino.controller, destino.location, destino.sequence);
        if(otra?.uid != null) c.vinculadoA = otra.uid;
      });
    }
  }

  handle_(m){
    const T = this.X.OcgMessageType;
    switch(m.type){
      case T.NEW_TURN:
        this.turnPlayer = m.player; this.turnCount++;
        this.emit("turn",{ player:m.player, turn:this.turnCount }); break;
      case T.NEW_PHASE:
        this.phase = m.phase; this.atacante = null; this.objetivoAtaque = null;
        this.emit("phase",{ phase:m.phase }); break;

      case T.DRAW: {
        this.cimaMazo[m.player] = null;
        const drawn = [];
        for(const d of (m.drawn ?? [])){
          const code = d.code ?? d;
          const deck = this.zones[m.player][LOC.DECK];
          // el core roba de arriba; nuestro espejo no conoce el orden real,
          // así que reasignamos el código a la carta que sacamos
          const card = deck.pop() ?? this.newCard(code, m.player, LOC.DECK);
          this.remove(card); card.code = code;
          this.insert(card, m.player, LOC.HAND, this.zones[m.player][LOC.HAND].length);
          card.position = POS.FACEUP_ATTACK;
          drawn.push(card);
        }
        this.emit("draw",{ player:m.player, cards:drawn }); break;
      }
      case T.MOVE: {
        const from = m.from, to = m.to;
        let card = this.resolve(from, m.card);
        if(!card){ // aparición no rastreada (fichas, cartas del deck rival…)
          card = this.newCard(m.card, to.controller, to.location);
        } else this.remove(card);
        card.code = m.card || card.code;
        const prev = { controller:from.controller, location:from.location,
                       sequence:from.sequence, position:card.position };
        this.insert(card, to.controller, to.location, to.sequence);
        card.position = to.position ?? card.position;
        if(from.location === LOC.DECK) this.cimaMazo[from.controller] = null;
        /* A la cima del mazo desde una zona pública (Feather of the
           Phoenix): todos han visto qué carta es y dónde ha ido. */
        if(to.location === LOC.DECK){
          const tam = this.zones[to.controller][LOC.DECK].length;
          const publica = [LOC.GRAVE, LOC.REMOVED, LOC.MZONE, LOC.SZONE].includes(from.location);
          this.cimaMazo[to.controller] = (publica && to.sequence >= tam - 1) ? card.code : null;
        }
        /* Cuándo entró en la zona de monstruos (público). Con esto la IA
           sabe si un monstruo puede invocarse por volteo este turno: no
           puede si entró este mismo turno. Ver `planTumbar` en brain.js. */
        if(to.location === LOC.MZONE && from.location !== LOC.MZONE) card.entroTurno = this.turnCount;
        /* Y cuándo se COLOCÓ una mágica o trampa (público: se ve caer la
           carta). Una carta colocada este turno no se puede activar hasta
           el siguiente, así que en la End Phase de su dueño es un blanco
           que no puede responder (ver `mstEnd` en brain.js). */
        if(to.location === LOC.SZONE && from.location !== LOC.SZONE) card.puestaTurno = this.turnCount;
        this.reindex(from.controller, from.location);
        this.emit("move",{ uid:card.uid, code:card.code, from:prev,
          to:{ controller:to.controller, location:to.location, sequence:to.sequence,
               position:card.position, faceDown:isFaceDown(card.position),
               defense:isDefense(card.position) } });
        /* ══ SALIR DEL CAMPO DESHACE LA UNIÓN, POR LOS DOS LADOS ══
           El motor manda EQUIP al enganchar pero no manda nada al
           soltar: se da por hecho que la carta ya no está. El espejo se
           quedaba con el `equipadoA` puesto y la vista seguía dibujando
           la línea DESDE EL CEMENTERIO, porque la pila también tiene su
           elemento y su rectángulo. Lo reportó E.
           Va aquí y no en la vista porque es un hecho del estado, no de
           cómo se pinte: la IA también lee `equipadoA` para saber qué
           pierde al destruir algo. Y se mira en los dos sentidos —el
           equipo que se va y el monstruo que se lleva lo que tenía
           encima— porque cualquiera de los dos puede irse primero. */
        if(!(to.location & (LOC.MZONE|LOC.SZONE))){
          const soltar = otra => {
            if(otra.equipadoA == null) return;
            otra.equipadoA = null;
            this.emit("equip",{ uid:otra.uid, sobre:null });
          };
          soltar(card);
          for(const otra of this.cards.values())
            if(otra.equipadoA === card.uid) soltar(otra);
        }
        break;
      }
      case T.POS_CHANGE: {
        const card = this.resolve(m, m.code);
        if(card){ card.position = m.position;
          this.emit("pos",{ uid:card.uid, faceDown:isFaceDown(m.position),
                            defense:isDefense(m.position) }); }
        break;
      }
      case T.SET: this.emit("set",{ code:m.code, controller:m.controller,
                    location:m.location, sequence:m.sequence }); break;

      /* ── MENSAJES QUE SE TIRABAN EN SILENCIO ──
         El adaptador trataba 28 de los ~100 mensajes del motor y el resto
         se perdían. No es un detalle: tres reportes distintos salían de
         aquí. El motor hacía lo correcto, pero nuestro espejo no se
         enteraba y la vista pintaba el estado anterior. */

      /* SWAP: Creature Swap. Los dos monstruos cambian de dueño. Sin esto
         "solo cambiaban el ATK y la DEF" —lo que se veía era el espejo
         viejo con los stats nuevos, que sí venían del motor. */
      case T.SWAP: {
        const a = this.resolve(m.card1, m.card1.code);
        const b = this.resolve(m.card2, m.card2.code);
        if(a && b){
          const destinoA = { controller:m.card2.controller, location:m.card2.location,
                             sequence:m.card2.sequence };
          const destinoB = { controller:m.card1.controller, location:m.card1.location,
                             sequence:m.card1.sequence };
          this.remove(a); this.remove(b);
          this.insert(a, destinoA.controller, destinoA.location, destinoA.sequence);
          this.insert(b, destinoB.controller, destinoB.location, destinoB.sequence);
          this.emit("swap",{ uidA:a.uid, uidB:b.uid });
        }
        break;
      }

      /* Contadores: Wave-Motion Cannon suma uno por turno y ese número es
         literalmente el daño que va a hacer. Sin verlo no hay forma de
         saber cuándo va a matarte. */
      case T.ADD_COUNTER: case T.REMOVE_COUNTER: {
        const c = this.at(m.controller, m.location, m.sequence);
        if(c){
          const suma = m.type===T.ADD_COUNTER ? (m.count ?? 1) : -(m.count ?? 1);
          c.contadores = Math.max(0, (c.contadores ?? 0) + suma);
          this.emit("contador",{ uid:c.uid, code:c.code, cuantos:c.contadores,
                                 clase:"contador", jugador:c.controller });
        }
        break;
      }

      /* ══ LA CUENTA QUE LLEVA LA CARTA ══
         Final Countdown, las Espadas de Luz Reveladora y Wall of Revealing
         Light llevan una cuenta que el jugador NECESITA ver y que no es un
         contador del motor: los scripts la mandan con CARD_HINT, que este
         adaptador tiraba a la basura como otros setenta mensajes. E lo pidió
         dos veces ("Final Countdown debería tener algún tipo de contador
         visible", "cuántos turnos han pasado o cuántos LP han pagado").
           · TURN   → turnos que lleva contados (Final Countdown va a 20,
                      las Espadas a 3).
           · NUMBER → un número que la carta se guarda; en Wall of Revealing
                      Light son los puntos de vida pagados, o sea el ataque
                      por debajo del cual no te pueden atacar.
         OJO: Final Countdown es una mágica NORMAL, así que cuando empieza a
         contar ya está en el cementerio y no hay carta en la mesa donde
         colgar el número. Por eso el evento lleva `code` y `jugador`: la
         vista pinta esas en una chapa junto a los puntos de vida. */
      /* MONEDAS Y DADOS. El motor los manda y el adaptador los tiraba, así
         que Fairy Box decidía si te comías el ataque sin que aparecieran
         ni la moneda ni el resultado. */
      case T.TOSS_COIN:
        this.emit("moneda",{ player:m.player, resultados:(m.results ?? []).map(Boolean) });
        break;
      case T.TOSS_DICE:
        this.emit("dado",{ player:m.player, resultados:m.results ?? [] });
        break;

      case T.CARD_HINT: {
        const H = this.X.OcgCardHintType;
        /* TRAMPA: CARD_HINT **no trae el código de la carta**, solo dónde
           está. El nombre hay que sacarlo del espejo o la chapa sale como
           "undefined 7". Con la carta en el cementerio hay que buscarla por
           puesto, que es donde vive Final Countdown mientras cuenta. */
        const c = this.at(m.controller, m.location, m.sequence) ?? null;
        const valor = Number(m.description ?? 0n);
        const clase = m.card_hint===H.TURN   ? "turnos"
                    : m.card_hint===H.NUMBER ? "numero" : null;
        if(!clase) break;
        /* El valor viene como entero de 64 bits; los descriptivos que no son
           cuentas llegan enormes y pintarlos sería ruido. */
        if(!Number.isFinite(valor) || valor < 0 || valor > 99999) break;
        if(!c) break;                       // sin carta no hay nada que nombrar
        c.cuenta = { clase, valor };
        this.emit("contador",{ uid:c.uid, code:c.code, cuantos:valor,
                               clase, jugador:m.controller,
                               enMesa: (m.location & (LOC.MZONE|LOC.SZONE)) !== 0 });
        break;
      }

      /* Equipos: qué está enganchado a qué. Ya se sabía por la consulta de
         stats (`equipado`), pero no a QUIÉN, que es lo que hace falta para
         dibujar la unión y para que la IA sepa qué pierde al destruirlo. */
      case T.EQUIP: {
        const eq  = this.resolve(m.card, m.card.code);
        const obj = this.resolve(m.target, m.target.code);
        if(eq) eq.equipadoA = obj?.uid ?? null;
        this.emit("equip",{ uid:eq?.uid, sobre:obj?.uid ?? null });
        break;
      }
      case T.SUMMONING:
      case T.SPSUMMONING:
      case T.FLIPSUMMONING: {
        const card = this.resolve(m, m.code);
        // el core no envía POS_CHANGE en una invocación por volteo: la
        // posición nueva viaja dentro de este mismo mensaje
        if(card && m.position != null) card.position = m.position;
        const kind = m.type===T.SUMMONING ? "normal"
                   : m.type===T.SPSUMMONING ? "special" : "flip";
        /* El último monstruo invocado, y cuándo. Una invocación es PÚBLICA
           (sale boca arriba), así que la IA puede saberlo: lo necesita para
           Bottomless Trap Hole y Trap Hole, que responden a ESE monstruo y
           no al más grande del campo. */
        if(card?.uid != null) this.ultimaInvocada = { uid: card.uid, turno: this.turnCount, kind };
        if(card){ if(kind === "flip") card.volteoTurno = this.turnCount; else card.entroTurno = this.turnCount; }
        this.emit("summon",{ uid:card?.uid, code:m.code, kind,
                             faceDown:isFaceDown(card?.position ?? 0),
                             defense:isDefense(card?.position ?? 0) }); break;
      }
      case T.CHAINING: {
        const card = this.resolve(m, m.code);
        /* Quién ha puesto cada eslabón. Hace falta para que la IA no se
           encadene a sí misma: negaba su propio Trap Dustshoot con Solemn
           Judgment y pagaba media vida por nada. */
        this.cadena.push({ code:m.code, controller:m.controller, uid:card?.uid ?? null });
        this.emit("chain",{ uid:card?.uid, code:m.code, link:m.chain_size,
                            controller:m.controller }); break;
      }
      case T.BATTLE: {
        const a=this.at(m.card.controller,m.card.location,m.card.sequence);
        const t=m.target?this.at(m.target.controller,m.target.location,m.target.sequence):null;
        /* El mensaje trae quién muere y con cuánto: con eso se puede medir
           si la IA ataca bien o se suicida (ver analizar.mjs). */
        this.emit("battle",{ uid:a?.uid, targetUid:t?.uid ?? null,
          atacante:{ atk:m.card.attack, def:m.card.defense, muere:!!m.card.destroyed,
                     controller:m.card.controller },
          objetivo: m.target ? { atk:m.target.attack, def:m.target.defense,
                     muere:!!m.target.destroyed, controller:m.target.controller } : null });
        break;
      }
      case T.ATTACK_DISABLED: this.emit("attackCancelled",{}); break;
      case T.SUMMONED: case T.SPSUMMONED: case T.FLIPSUMMONED:
        this.emit("summoned",{}); break;
      /* ══ EL ESLABÓN RESUELTO SE VA DE LA CADENA ══
         E, 02-10 (Goat Control, p1, T5): Sangan tributado, E encadenó Book
         of Moon y, al resolverse la búsqueda de Sangan, la IA cogió la PEOR
         carta (Dark Mimic LV1 con Pot of Greed y Heavy Storm en el
         cementerio para un Magician of Faith). La cadena del espejo solo se
         vaciaba con CHAIN_END, así que arriba seguía la Book of Moon de E y
         `elegirCartas` leía la búsqueda propia como un coste impuesto por
         el rival. El eslabón que acaba de resolverse ya no está en la
         cadena: lo de arriba es lo que se resuelve ahora. */
      /* ══ LO QUE YA SE HA RESUELTO ESTE TURNO ══
         Reddit, día 2: Waboku resuelta (nada de daño ni destrucción por
         batalla este turno) y el bot atacó igual con todo, sin ganar nada
         y arriesgándose a otra trampa. Para saberlo hace falta recordar
         qué eslabones se RESOLVIERON —no solo se activaron: uno negado no
         protege— en el turno. Es público: todo el mundo lo ha visto. */
      case T.CHAIN_NEGATED: case T.CHAIN_DISABLED:
        if(m.chain_size != null) (this.negadosCadena ??= new Set()).add(m.chain_size);
        break;
      case T.CHAIN_SOLVED: {
        const k = m.chain_size;
        const eslabon = k != null ? this.cadena[k - 1] : null;
        if(eslabon && !this.negadosCadena?.has(k)){
          if(this.resueltasTurno?.turno !== this.turnCount) this.resueltasTurno = { turno:this.turnCount, lista:[] };
          this.resueltasTurno.lista.push({ code:eslabon.code, controller:eslabon.controller });
        }
        this.negadosCadena?.delete(k);
        if(m.chain_size != null) this.cadena.length = Math.max(0, Math.min(this.cadena.length, m.chain_size - 1));
        this.emit("chainSolved",{ link:m.chain_size }); break;
      }
      /* ══════════════════════════════════════════════════════════════
         A QUIÉN APUNTA LA CADENA — otro mensaje que se tiraba

         E: «no encadenó Waboku cuando ella misma fue seleccionada para
         destrucción; mejor usarla que perderla». Y la regla que lo
         impedía es una buena regla: «toda carta que se encadena tiene
         que decir CONTRA QUÉ», puesta para que el bot dejara de
         encadenar Book of Moon a su propia invocación. Waboku sin
         ataque enfrente no tiene contra qué, así que se declinaba… y se
         iba al cementerio con el MST del rival.

         Lo que faltaba no era una excepción para Waboku sino el DATO:
         el motor dice perfectamente a qué apunta cada eslabón con
         BECOME_TARGET, y el adaptador lo tiraba. Con eso, "me van a
         destruir esta carta" es una razón como cualquier otra.
         ══════════════════════════════════════════════════════════════ */
      case T.BECOME_TARGET: {
        for(const t of (m.cards ?? [])){
          const c = this.at(t.controller, t.location, t.sequence);
          if(c?.uid != null) this.objetivosCadena.add(c.uid);
        }
        this.emit("target",{ uids:[...this.objetivosCadena] });
        break;
      }
      case T.CHAIN_END:    this.cadena.length=0; this.objetivosCadena.clear(); this.negadosCadena?.clear();
                           this.emit("chainEnd",{}); break;
      case T.ATTACK: {
        const a = this.at(m.card.controller, m.card.location, m.card.sequence);
        const t = m.target ? this.at(m.target.controller, m.target.location, m.target.sequence) : null;
        /* Quién está atacando ahora mismo. Hace falta para decidir si vale
           la pena responder: sin esto la IA gastaba una Sakuretsu Armor en
           un Sinister Serpent de 300 con la misma alegría que en un
           Airknight, porque en la ventana de cadena no sabía contra qué
           estaba respondiendo. */
        this.atacante = a ? { uid:a.uid, code:a.code, controller:a.controller } : null;
        if(a) a.atacoTurno = this.turnCount;
        /* A QUIÉN ataca, no solo quién ataca. `ai/pensar.js` lo necesita
           para imaginar cómo acaba el combate si no responde. */
        this.objetivoAtaque = t ? { uid:t.uid, code:t.code, controller:t.controller } : null;
        this.emit("attack",{ uid:a?.uid, targetUid:t?.uid ?? null }); break;
      }
      case T.DAMAGE:
        this.lp[m.player] = Math.max(0, this.lp[m.player] - m.amount);
        this.emit("damage",{ player:m.player, amount:m.amount, lp:this.lp[m.player] }); break;
      case T.RECOVER:
        this.lp[m.player] += m.amount;
        this.emit("recover",{ player:m.player, amount:m.amount, lp:this.lp[m.player] }); break;
      case T.PAY_LPCOST:
        this.lp[m.player] = Math.max(0, this.lp[m.player] - m.amount);
        this.emit("damage",{ player:m.player, amount:m.amount, lp:this.lp[m.player], cost:true }); break;
      case T.LPUPDATE:
        this.lp[m.player] = m.lp; this.emit("lp",{ player:m.player, value:m.lp }); break;
      case T.WIN:
        this.finished = true; this.emit("win",{ player:m.player, reason:m.reason }); break;
      case T.SHUFFLE_DECK: this.cimaMazo[m.player] = null; this.emit("shuffle",{ player:m.player }); break;
      case T.DECK_TOP: {
        /* Mazo boca arriba (Convulsion of Nature): la de arriba es pública. */
        let code = Number(m.code) >>> 0;
        if(code & 0x80000000) code = (code & 0x7fffffff) >>> 0;
        if((m.count ?? 0) === 0 && code) this.cimaMazo[m.player] = code;
        break;
      }
      /* ══ EL MOTOR BARAJA TUS TAPADAS Y NO NOS ENTERÁBAMOS ══
         Cada vez que colocas algo boca abajo teniendo ya otra tapada, el
         motor REORDENA las casillas para que no se le pueda seguir la
         pista a una carta concreta. Y esto es justo la trampa que ya nos
         mordió con la mano (Delinquent Duo): el motor identifica las
         cartas por POSICIÓN, así que si el espejo no reordena igual,
         volteas o eliges la carta equivocada.

         Nunca llegó a verse porque el paquete ni siquiera sabía leer el
         mensaje: reventaba con "eof" y mataba el duelo. Arreglado el
         lector (ver bundle.mjs), aparece este otro. */
      case T.SHUFFLE_SET_CARD: {
        /* EL MENSAJE NO DICE A DÓNDE VAN. El motor reserva el hueco de
           las posiciones nuevas antes de barajar, y en esta versión ese
           hueco llega SIEMPRE a ceros: se sabe qué cartas se han movido
           pero no adónde. Intentar usarlo movía las cartas a la casilla
           0 del jugador 0 y multiplicaba por diez los desajustes.

           Así que no se adivina: se le PREGUNTA al motor cómo ha quedado
           la zona y se reordena el espejo para que coincida. Es la misma
           herramienta que ya se usa para el ATK real (`duelQueryLocation`)
           y aquí no revela nada que el motor no vaya a contar de todas
           formas: el adaptador siempre lo ha sabido todo, quien tapa la
           información al bot es `ai/view.js`. */
        const lados = new Set((m.cards ?? []).map(x => x?.from?.controller).filter(v => v != null));
        if(!lados.size) break;
        const F = this.X.OcgQueryFlags;
        if(!F || typeof this.lib.duelQueryLocation !== "function") break;
        for(const lado of lados){
          const zona = this.zones[lado]?.[m.location];
          if(!zona) continue;
          let filas;
          try{
            filas = this.lib.duelQueryLocation(this.handle,
                      { flags:F.CODE|F.POSITION, controller:lado, location:m.location });
          }catch(e){ continue; }
          if(!filas || typeof filas.then === "function") continue;
          /* Se emparejan por código, cogiendo de las que ya estaban en la
             zona. Dos copias iguales pueden intercambiarse entre ellas y
             da igual: son la misma carta a todos los efectos. */
          const bolsa = zona.filter(Boolean);
          const nuevo = new Array(zona.length).fill(null);
          filas.forEach((q,i)=>{
            if(!q) return;
            let j = bolsa.findIndex(c => c && c.code === q.code);
            if(j < 0) j = bolsa.findIndex(c => c);        // no debería pasar
            if(j < 0) return;
            const carta = bolsa.splice(j,1)[0];
            carta.sequence = i;
            if(q.position != null) carta.position = q.position;
            nuevo[i] = carta;
          });
          /* Si algo no ha encajado, mejor dejar la zona como estaba que
             perder cartas por el camino. */
          if(nuevo.filter(Boolean).length !== zona.filter(Boolean).length) continue;
          for(let i=0;i<zona.length;i++) zona[i] = nuevo[i];
        }
        this.emit("reorder",{ player:[...lados][0], location:m.location });
        break;
      }
      /* Delinquent Duo, Graceful Charity y los descartes al azar hacen que el
         core baraje la mano. Si no reordenamos igual, nuestro espejo queda
         desfasado para siempre: era la causa de jugar la carta equivocada. */
      case T.SHUFFLE_HAND:
      case T.SHUFFLE_EXTRA: {
        const loc = m.type===T.SHUFFLE_HAND ? LOC.HAND : LOC.EXTRA;
        const zone = this.zones[m.player][loc];
        const pool = [...zone];
        const nuevo = [];
        for(const code of (m.cards ?? [])){
          let i = pool.findIndex(c => c && c.code === code);
          if(i < 0) i = pool.findIndex(c => c);          // no debería pasar
          if(i >= 0) nuevo.push(pool.splice(i,1)[0]);
        }
        for(const resto of pool) if(resto) nuevo.push(resto);
        zone.length = 0; zone.push(...nuevo);
        this.reindex(m.player, loc);
        this.emit("reorder",{ player:m.player, location:loc });
        break;
      }
      /* El motor avisa de qué cartas se enseñan (Trap Dustshoot, Confiscation,
         Mind Crush, mirar la cima del deck…). Antes se ignoraba y por eso la
         mano del rival seguía tapada mientras te pedía elegir de una lista.
         Al revelarse dejan de ser secretas: se les fija el código. */
      /* ══ LAS DE ARRIBA DEL MAZO, A LA VISTA (GitHub #2, Reddit) ══
         Cyber Jar enseña las cinco de arriba de cada mazo antes de invocar
         y llevarse a la mano el resto. Lo dice con CONFIRM_DECKTOP, que
         nadie escuchaba: el rival se llevaba cartas a la mano sin que
         vieras cuáles, y tú elegías posición sin saber de qué monstruo.
         Es información pública: se manda con los códigos. */
      case T.CONFIRM_DECKTOP: {
        const codes = (m.cards ?? []).map(c => c.code).filter(Boolean);
        if(codes.length) this.emit("revelarMazo", { player:m.player, codes });
        break;
      }
      case T.CONFIRM_CARDS: {
        const vistas=[];
        for(const c of (m.cards ?? [])){
          /* OJO: del DECK ni se pregunta. Nuestro orden del mazo es ficticio
             —el motor baraja por su cuenta— así que buscar ahí una carta
             concreta siempre "repara" y disparaba el contador de
             desincronizaciones: 30 por partida de puro ruido, tapando las
             de verdad. Además, fijar el código ahí pisaría otra carta. */
          if(c.location === LOC.DECK || c.location === LOC.EXTRA) continue;
          const card = this.resolve(c, c.code);
          if(!card) continue;
          if(c.code) card.code = c.code;
          vistas.push(card);
        }
        this.emit("revelar", { player:m.player, uids:vistas.map(c=>c.uid),
                               codes:vistas.map(c=>c.code),
                               location: m.cards?.[0]?.location ?? 0 });
        break;
      }
      /* El Damage Step no llega como fase: llega con sus propios avisos.
         Sin esto no había forma de saber si una cadena era en la
         declaración de ataque o ya dentro del cálculo de daño. */
      case T.DAMAGE_STEP_START: this.emit("damageStep",{ on:true }); break;
      case T.DAMAGE_STEP_END:   this.emit("damageStep",{ on:false }); break;
      case T.RETRY: this.emit("retry",{}); break;
      default:
        if(this.isQuestion(m.type)){ this.pending = m; this.emit("prompt",{ msg:m }); }
    }
  }
  isQuestion(t){
    const T = this.X.OcgMessageType;
    return [T.SELECT_IDLECMD,T.SELECT_BATTLECMD,T.SELECT_CHAIN,T.SELECT_EFFECTYN,
            T.SELECT_YESNO,T.SELECT_OPTION,T.SELECT_CARD,T.SELECT_UNSELECT_CARD,
            T.SELECT_PLACE,T.SELECT_DISFIELD,T.SELECT_POSITION,T.SELECT_TRIBUTE,
            T.SELECT_SUM,T.SELECT_COUNTER,T.SORT_CARD,T.ANNOUNCE_RACE,
            T.ANNOUNCE_ATTRIB,T.ANNOUNCE_NUMBER,T.ANNOUNCE_CARD].includes(t);
  }
}
