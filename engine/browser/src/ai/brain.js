/* ══════════════════════════════════════════════════════════════════
   CEREBRO DEL BOT — cuatro niveles sobre un mismo motor.

   Los principios están sacados del material competitivo de Goat
   (goatformat.com y el artículo de Pojo "40 Common Mistakes"):
     · La ventaja de cartas decide las partidas, no el ataque.
     · No gastes remoción en algo que puedes matar en combate.
     · Invoca ANTES de usar remoción, o regalas un Torrential Tribute.
     · Ataca primero con el monstruo fuerte para forzar el Scapegoat.
     · Guarda MST para Snatch Steal, Premature Burial o Call.
     · Sinister Serpent y Sangan valen más en la mano que colocados.
     · Thousand-Eyes Restrict sin objetivo bueno no compensa.
     · Scapegoat en tu turno te bloquea la invocación.
   ══════════════════════════════════════════════════════════════════ */
import { vistaDe, recordadaEnSitio, mensajeLegal, continuaMuerta } from "./view.js";
import { atk, def, poder, valorCarta, rolDe, infoDe, evaluar, ventaja,
         apuestaContraTapada, atkEnCombate,
         ganaCombate, muereAtacando, pegaMasFuerte, sobrevive,
         evaluarPosicion, valeAtaqueSuicida,
         costeDeQueMuera } from "./evaluar.js";
import { canon, conocer } from "./knowledge.js";
import { leerPosicion, decidirReserva, regalaChaos, letalEnBatalla, quitarJinzoLeAyuda, dañoQueHago } from "./posicion.js";
import { contextoEstrategico, riesgoSobreextension } from "./contexto.js";
import { planDe } from "./plan.js";
import { utilidadLeida, leerCarta } from "./lectura.js";
import { valorar, delta, efectoDe, aplicar } from "./valorar.js";

/* Combinaciones de cartas cuyos valores suman lo que pide el motor: los
   tributos de una invocación ritual. Está duplicado a propósito con el de
   `main.js` porque los dos módulos viven en ámbitos separados dentro del
   HTML de un solo archivo; si algún día se toca uno, tocar los dos. */
export function combinacionesSuma(m){
  const lista = m.selects ?? [];
  const n = lista.length;
  if(!n || n > 16) return [];
  const valores = lista.map(e=>{
    const bajo = e.amount & 0xffff, alto = (e.amount >>> 16) & 0xffff;
    return alto ? [bajo, alto] : [bajo];
  });
  const fijo = (m.selects_must ?? []).reduce((s,e)=>s + (e.amount & 0xffff), 0);
  const objetivo = (m.amount ?? 0) - fijo;
  const exacto = !m.select_max;
  /* OJO: el motor manda min y max en 0 cuando no hay límite de cuántas
     cartas puedes coger; tomarlos al pie de la letra dejaba fuera todas
     las combinaciones y los rituales seguían sin poder pagarse. */
  const min = Math.max(1, m.min || 1), max = (m.max > 0 ? m.max : n);
  const sumasDe = idx => idx.reduce((acc,i)=>{
    const nuevo=[]; for(const s of acc) for(const v of valores[i]) nuevo.push(s+v);
    return [...new Set(nuevo)];
  }, [0]);
  const out=[];
  for(let mask=1; mask<(1<<n); mask++){
    const idx=[]; for(let i=0;i<n;i++) if(mask & (1<<i)) idx.push(i);
    if(idx.length<min || idx.length>max) continue;
    const sumas = sumasDe(idx);
    const vale = exacto ? sumas.includes(objetivo)
      : sumas.some(s=>s>=objetivo) &&
        idx.every(i=>!sumasDe(idx.filter(j=>j!==i)).some(s=>s>=objetivo));
    if(vale) out.push(idx);
  }
  return out.sort((a,b)=>a.length-b.length);
}

export const NIVELES = ["novato","normal","duro","experto"];
const RANGO = { novato:0, normal:1, duro:2, experto:3 };

export function crearCerebro({ X, duel, db, names, nivel="normal", yo=1, log, lastre:lastreExtra, rng }){
  /* ── EL AZAR DEL CEREBRO, INYECTABLE ──
     Todas las tiradas del bot (lastres de nivel, desempates) salen de aquí.
     Por defecto es Math.random, así que en el juego no cambia nada. Con
     `rng` se le pasa un generador con semilla: hace falta para repetir una
     decisión y para `check-frontera`, que compara la misma decisión con la
     información oculta cambiada y necesita que el azar sea el mismo. */
  const aleatorio = typeof rng === "function" ? rng : Math.random;
  const R = X.OcgResponseType, T = X.OcgMessageType;
  const IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
  const n = RANGO[nivel] ?? 1;
  /* Ablación de reglas del nivel experto. Con GOAT_AI_OFF="clave,clave"
     se apagan una a una para medir cuánto aporta cada regla en el torneo:
     así se descubre qué la hacía perder contra "duro". En el navegador
     no existe la variable, así que están todas encendidas. */
  const APAGADAS = new Set(String(
    (typeof process!=="undefined" && process.env && process.env.GOAT_AI_OFF)
    || globalThis.GOAT_AI_OFF || "").split(",").map(x=>x.trim()).filter(Boolean));
  const exp = k => n>=3 && !APAGADAS.has(k);
  /* ── CEREBRO POR EVALUACIÓN ──
     Con GOAT_CEREBRO=evaluacion, cada jugada se puntúa por lo que MEJORA
     el tablero, en cartas (ver `valorar.js`), en vez de con la constante
     que le tocara. Convive con el criterio de siempre a propósito: el
     banco de posiciones dice cuál juega mejor, y hasta que lo diga el
     que manda es el de siempre. */
  const POR_EVALUACION = String(
    (typeof process!=="undefined" && process.env && process.env.GOAT_CEREBRO)
    || globalThis.GOAT_CEREBRO || "") === "evaluacion";

  /* ── LA ESCALERA DE DIFICULTAD ──
     Medido con 300 partidas por cruce, las cuatro "inteligencias" distintas
     daban el mismo bot: ninguna regla de nivel cambiaba la jugada elegida.
     Así que hay UN cerebro que juega lo mejor que sabe y los niveles de
     abajo se lastran con defectos concretos y medibles, como los bots de
     ajedrez. Cada lastre se puede apagar solo y se nota en el torneo.

       error         · probabilidad de elegir una jugada peor a propósito
       sinCadenas    · no responde nada en el turno rival
       cadenaTonta   · responde, pero con lo primero que pilla
       combateTonto  · ataca sin hacer cuentas
       objetivoTonto · elige a quién ataca al azar
       malaSeleccion · elige al azar qué descarta, busca o destruye
       sinRemocion   · no gasta remoción por iniciativa propia
       sinPosicion   · no cambia posiciones ni voltea
       sinGuardar    · gasta las cartas en cuanto puede, sin esperar momento

     Los números salen de medir cada defecto por separado con
     `medir-lastres.mjs`, no de suponerlos. */
  /* ── LO QUE SABE CADA NIVEL DE SU PROPIO MAZO ──
     Hasta ahora los niveles se separaban por defectos genéricos (no
     responde cadenas, ataca sin contar). Faltaba lo que E pidió: que el
     experto siga TODOS los pasos de la guía de su mazo y que los de abajo
     los vayan perdiendo de uno en uno. Son cuatro capacidades y se pierden
     en este orden, de la más avanzada a la más básica:

       pasos    seguir el guion del mazo: los muros antes que la cuenta
                atrás, Necrovalley antes de atacar, la Cannon cuanto antes
       postura  decidir para qué es el turno antes de tocar nada
       motor    reconocer el motor del mazo: voltear el mismo bicho cada
                turno, buscar las piezas, jugar los facilitadores pronto
       claves   saber siquiera con qué gana: no descartar la carta que
                gana la partida ni cambiarla por cualquier cosa

     experto  las cuatro · duro  sin `pasos` · normal  solo `claves`
     novato   ninguna: juega cartas sin saber para qué sirve el mazo. */
  const SABE = {
    experto: { pasos:true,  postura:true,  motor:true,  claves:true },
    duro:    { pasos:false, postura:true,  motor:true,  claves:true },
    normal:  { pasos:false, postura:false, motor:false, claves:true },
    novato:  { pasos:false, postura:false, motor:false, claves:false },
  };

  const LASTRE = {
    /* Medido con `medir-lastres.mjs`, 250 partidas por perfil, contra el
       cerebro limpio: novato pierde el 84%, normal el 66% y duro el 60%.
       Los números salen de ahí, no de la intuición. */
    novato:  { error:0.50, sinCadenas:true,  cadenaTonta:false, combateTonto:true,
               objetivoTonto:true, malaSeleccion:true, sinRemocion:true,
               sinPosicion:true,  sinGuardar:true },
    normal:  { error:0.35, sinCadenas:true,  cadenaTonta:false, combateTonto:true,
               objetivoTonto:true, malaSeleccion:true, sinRemocion:true,
               sinPosicion:false, sinGuardar:false },
    duro:    { error:0.20, sinCadenas:false, cadenaTonta:true,  combateTonto:false,
               objetivoTonto:true, malaSeleccion:false, sinRemocion:false,
               sinPosicion:false, sinGuardar:true },
    experto: { error:0,    sinCadenas:false, cadenaTonta:false, combateTonto:false,
               objetivoTonto:false, malaSeleccion:false, sinRemocion:false,
               sinPosicion:false, sinGuardar:false },
  };

  // `lastre` se puede forzar desde fuera para medir cuánto vale cada
  // defecto por separado (ver medir-lastres.mjs).
  const lastre = { ...(LASTRE[nivel] ?? LASTRE.normal), ...(lastreExtra ?? {}) };
  const traza = (msg,extra)=> log?.({ nivel, msg, ...extra });
  const azar = p => aleatorio() < p;

  /* CON QUÉ GANA ESTE MAZO. Se decide una vez, al empezar, mirando la
     decklist: ver `ai/plan.js`. Antes las 20 barajas se jugaban igual y
     por eso un mazo de Burn cambiaba golpes como uno de Zoo. */
  /* ══ EL PLAN SE LEE CUANDO HAY MAZO, NO AL CREAR EL CEREBRO ══
     E, 26-09: en los siete duelos del torneo el log decía «plan:
     Beatdown» —contra Goat Control, Cat Control y Empty Jar—. main.js
     crea el cerebro ANTES de `duel.create` (el sorteo va primero), así
     que la decklist estaba vacía y todas las barajas caían en el plan
     por defecto: agresivo 0,8, sin claves, sin motor. Las herramientas
     de medida crean el cerebro con el duelo ya montado y por eso nunca
     se vio. Ahora el plan se (re)calcula en la primera decisión con
     mazo. */
  const construirPlan = PR => sabe.claves ? {
    ...PR,
    volteos: sabe.motor && PR.volteos,
    esMotor: n => sabe.motor && PR.esMotor(n),
    pasos:   sabe.pasos ? PR.pasos : [],
  } : {
    nombre: PR.nombre, condicion:"(no sabe con qué gana su mazo)",
    objetivo:"beatdown", agresivo:0.8, aguanta:false, volteos:false, pasos:[],
    peso:()=>0, esClave:()=>false, esMotor:()=>false, sostiene:()=>false,
  };
  /* Un nivel que no "sabe" algo se queda con un plan recortado, no con un
     plan que sabe y no usa: así el defecto es de conocimiento, no de
     fuerza de voluntad, y se puede medir apagándolo. */
  const sabe = SABE[nivel] ?? SABE.normal;
  let PLAN = null, planConMazo = false;
  function asegurarPlan(){
    if(PLAN && planConMazo) return;
    const lista = duel.decklist?.[yo] ?? [];
    if(PLAN && !lista.length) return;
    planConMazo = lista.length > 0;
    PLAN = construirPlan(planDe(lista, names));
    if(!planConMazo) return;               // se traza cuando de verdad se sabe
    traza(`plan: ${PLAN.nombre} — ${PLAN.condicion}`);
    /* El guion, en el log. Es donde se lee si el bot lo está siguiendo. */
    if(PLAN.pasos.length) PLAN.pasos.forEach((paso,i)=>traza(`  paso ${i+1}: ${paso}`));
  }
  asegurarPlan();

  const nombreDe = c => names[c.code]?.name ?? "";
  let ultimoAtacante = null;   // para elegir bien el objetivo del ataque
  /* ¿La siguiente selección de cartas es el OBJETIVO del ataque que acabo
     de declarar? Antes se deducía de «estamos en batalla y la lista son
     monstruos», y eso también lo cumple el objetivo de un Book of Moon,
     un Ring of Destruction o un Night Assailant activados en batalla: se
     elegían con la lógica de ataque —«a quién le gano»—, que no mira de
     quién es la carta. De ahí Book of Moon a un monstruo propio. */
  let esperoObjetivoDeAtaque = false;
  let ultimoPlanIdle = [];
  /* Turno en el que ya activé una protección de batalla (Waboku). Su
     efecto dura TODO el turno: una segunda copia no añade nada y es una
     carta tirada. E lo vio en su primer turno de prueba, y bot contra bot
     con los mazos del Reino salía 9 veces en 150 partidas. */
  let protegidoEnTurno = -1;
  const giros = new Map();     // uid → veces que le hemos cambiado la posición
  /* ══ UN GIRO CUENTA CUANDO SE HACE, NO CUANDO SE PROPONE ══
     E, 20-09 (Chaos Turbo, p1, T18): «no volteó sus monstruos para pegar
     aunque sabía lo que había colocado». El Chaos Sorcerer tapado tenía
     el volteo vetado por «ya girada 2 veces» sin haberse girado nunca:
     el contador sumaba cada vez que la heurística PROPONÍA el giro, y en
     el turno 16 la simulación lo había descartado. Ahora la propuesta
     queda pendiente y solo cuenta cuando es la respuesta que se envía
     (`anotar` desde main.js) o, sin main.js (simulación, tests), cuando
     la siguiente pregunta confirma que se jugó. */
  let giroPendiente = null;
  let objetivoLetal = null;
  let objetivoPrestamo = null;   // a quién le quita Mind Control el monstruo que estorba
  /* Giant Rat, Pyramid Turtle, Mystic Tomato: sacan otro monstruo solo si
     mueren EN COMBATE (Sangan, en cambio, al salir del campo como sea). */
  const flotaEnCombate = c => !!c && !c.bocaAbajo && rolDe(c) === "floater"
    && /(destroyed|sent to the (GY|Graveyard)).{0,30}(by|as a result of) battle/i.test(names[c.code]?.desc ?? "");
  /* Con cuánto ataque sale lo que saca un floater al morir en combate. Es
     el formato, no la lista del rival: la Pyramid Turtle de Goat saca Ryu
     Kokki (2400) o Vampire Lord (2000); los que buscan por ATK ≤1500 sacan
     eso como mucho. */
  const SACA_FLOATER = { "Pyramid Turtle":2400, "Giant Rat":1500, "Mystic Tomato":1400, "Shining Angel":1400,
    "Howling Insect":1500, "UFO Turtle":1500, "Mother Grizzly":1400, "Flying Kamakiri #1":1500, "Masked Dragon":1600 };
  const loQueSacaFloater = c => SACA_FLOATER[canon(c?.nombre ?? "")] ?? 1500;
  /* ¿Mi mazo ES el bucle de voltear y re-tapar (PACMAN)? Medido con
     duelo-versiones: quitar el freno de giros a los que se re-tapan sube
     PACMAN del 50 % al 65 %, y el mismo cambio en Clown Control (tres Des
     Lacooda entre Clowns) lo baja al 36 %. El bucle es el plan solo cuando
     el mazo está hecho de eso: seis o más cartas que se re-tapan. */
  let _motorReTapa = null;
  const motorQueSeReTapa = () => (_motorReTapa ??=
    (duel.decklist?.[yo] ?? []).filter(code => conocer(names[code]?.name, db.get(code))?.reTapa).length >= 6);    // a quién ataca el primer golpe de una línea letal (battlePhase → elegirCartas)
  const contarGiro = uid => { if(uid != null) giros.set(uid, (giros.get(uid) ?? 0) + 1); };
  /* Una entrada de una lista de selección, con los ATK/DEF del TABLERO si
     la carta está en campo. Se usa `duel.at` y no `duel.resolve` a
     propósito: resolve incrementa el contador de desincronizaciones cuando
     no encuentra el código, y las tapadas del rival viven en nuestro espejo
     sin código —consultarlas ensuciaría la métrica con ruido. */
  const cartaDeLista = l => {
    const enCampo = l.location===4 || l.location===8;
    // tapada del rival: los ATK/DEF reales no son míos para saberlos
    const oculta = !!(l.position & 0x0a) && l.controller !== yo;
    const real = (enCampo && !oculta) ? duel.at(l.controller, l.location, l.sequence) : null;
    /* Tapada del rival: el mensaje ya llega sin código (`mensajeLegal`).
       Lo único legítimo que se puede saber es lo que YA se vio de ella. */
    const code = (oculta && enCampo)
      ? (recordadaEnSitio(duel, yo, l.controller, l.location, l.sequence)?.code ?? 0)
      : l.code;
    return { code, nombre:names[code]?.name ?? "",
             datos:db.get(code) ?? null,
             /* La identidad de la carta en la mesa (no dice qué es). Sin
                ella «¿esta carta está señalada?» no tenía respuesta. */
             uid: enCampo ? (duel.at(l.controller, l.location, l.sequence)?.uid ?? null) : null,
             tapadaDesconocida: (oculta && enCampo && !code) ? (l.location===8 ? "mt" : "monstruo") : null,
             atkReal: real?.atkReal ?? null, defReal: real?.defReal ?? null,
             muerta: continuaMuerta(real, oculta, names),
             defensa:false, bocaAbajo:false };
  };

  /* ── ¿tengo con qué? consultas sobre la vista legal ── */
  const tieneEnMano = (v,nom) => v.mano.some(c=>canon(c.nombre)===nom);
  const enCementerio = (v,nom) => v.cementerio.some(c=>canon(c.nombre)===nom);
  const rivalUso = (v,nom) => v.cementerioRival.some(c=>canon(c.nombre)===nom)
                            || v.desterradasRival.some(c=>canon(c.nombre)===nom);
  /* ══ GUÍA P03 · EL MOTOR ANTES QUE SU PRODUCTO ══
     Un Magician of Faith o un Dekoichi boca arriba no pegan, pero si el
     rival tiene con qué volver a taparlos (Book of Moon, Tsukuyomi) cada
     volteo es otra carta. Quitar el motor impide las cartas futuras;
     quitar el cuerpo de 1600 solo quita ese cuerpo. Solo cuenta si la
     repetición es REAL: ha enseñado con qué taparlo, o lo tiene en mesa. */
  const esMotorDeVolteo = c => { const i = infoDe(c); return i.rol==="flip" || !!i.voltearVale; };
  const rivalRevoltea = v => rivalUso(v,"Book of Moon") || rivalUso(v,"Tsukuyomi")
        || v.monstruosRival.some(x=>!x.bocaAbajo && canon(x.nombre)==="Tsukuyomi");
  /* ══ SPELLBINDING SOBRE EL QUE YA ESTÁ ATADO ══
     E, 19-09: dos Spellbinding Circle apuntando al mismo Skilled Dark
     Magician. La segunda no hace nada: ese monstruo ya no ataca ni cambia
     de posición. `vinculadoA` es público (se ve la línea en la mesa). */
  const atadoPorMi = (v, uid, code=null) => uid != null && v.backrow.some(b =>
        !b.bocaAbajo && b.vinculadoA === uid && (code == null || b.code === code));
  const ATADURAS = new Set(["Spellbinding Circle", "Shadow Spell"]);
  /* ══ UN POTENCIADOR ES PARA LO MÍO ══
     E, 03-10 (Reino, dos veces): «¿Reinforcements a mi monstruo?». Con
     la carta condenada (MST, Heavy Storm) se gastaba «antes de perderla»
     y el objetivo salía de la regla general —el monstruo suyo más
     fuerte—: le dio +500 a su Shining Angel justo antes de que atacara.
     Reinforcements, Rush Recklessly y compañía suman ATK al objetivo. */
  const esPotenciador = code => code != null
    && /gains? \d+ ATK|increase[^.]*ATK by \d+/i.test(names[code]?.desc ?? "")
    && !/loses|decrease|halve/i.test(names[code]?.desc ?? "");
  /* Los que sacan un monstruo del MAZO AL CAMPO boca arriba (no a la mano:
     Sangan y Witch buscan, y ahí un volteo sí vale). */
  const RECLUTADORES = new Set(["Mystic Tomato","Giant Rat","Pyramid Turtle","Howling Insect",
    "Shining Angel","Flying Kamakiri #1","UFO Turtle","Mother Grizzly","Masked Dragon","Hydrogeddon"]);
  const ataduraSinBlanco = (v, c) => ATADURAS.has(canon(c.nombre ?? ""))
        && v.monstruosRival.length > 0
        && v.monstruosRival.every(r => atadoPorMi(v, r.uid, c.code));
  let activoAhora = null;
  let puntosCadena = [];           // la última ventana de cadena: nota de cada opción
  /* ══ ROYAL DECREE ══
     E, 19-09: Mirror Force y Ring of Destruction activadas con un Royal
     Decree boca arriba en la mesa. Decree niega el efecto de TODAS las
     demás trampas: se activan, se van al cementerio y no hacen nada. */
  const decretoActivo = v => [...v.backrow, ...v.backrowRival]
        .some(b => !b.bocaAbajo && canon(b.nombre ?? "") === "Royal Decree");
  const esTrampa = c => ((Number(c?.datos?.type) || 0) & 0x4) !== 0;
  const negadaPorDecreto = (v, c) => exp("decreto") && esTrampa(c)
        && canon(c.nombre ?? "") !== "Royal Decree" && decretoActivo(v);
  /* Lo que barre TODO el backrow sin apuntar: lo mío que está puesto se va
     igual, así que es «úsala o piérdela» aunque no la señale. */
  const BARREN_BACKROW = new Set(["Heavy Storm", "Harpie's Feather Duster"]);          // lo último que he activado: sus objetivos vienen después
  /* La "amenaza" era solo lo que estaba boca arriba, y con un campo lleno
     de cartas tapadas el bot creía que no pasaba nada: no gastaba remoción,
     no atacaba —porque no sabía si ganaba— y el duelo se atascaba hasta el
     turno 60. Un monstruo tapado también estorba: si no hay nada a cara
     descubierta, cuenta como amenaza. */
  const amenazaMayor = v => {
    const caraArriba = v.monstruosRival.filter(c=>!c.bocaAbajo);
    /* PRIMERO LOS CANDADOS. Es el concepto que WindBot llama "floodgate" y
       que a esta IA le faltaba: mientras el rival tenga puesto un Jinzo, un
       Royal Decree, un Level Limit o un Thousand-Eyes Restrict, tu mazo no
       hace nada. Eso se quita antes que el monstruo de 1900. */
    const candados = caraArriba.filter(c=>infoDe(c).prioritario)
                               .sort((a,b)=>valorCarta(b)-valorCarta(a));
    if(exp("candados") && candados.length) return candados[0];
    /* AMENAZA es lo que PEGA, no lo que aguanta. Ordenando por "poder", un
       Gravekeeper's Spy de 2000 en defensa salía el primero — que es
       exactamente para lo que el rival lo pone: para que gastes ahí la
       remoción y te quedes sin nada cuando salga su 1900. Los muros se
       rodean, no se destruyen. */
    /* Lo que pega ES lo que pega en combate: una Injection Fairy Lily de
       400 sube a 3400 si su dueño puede pagar 2000. */
    const golpeDe = c => exp("amenazaReal") ? atkEnCombate(c, v.lp?.rival ?? Infinity) : atk(c);
    const pegan = caraArriba.filter(c=>!c.defensa).sort((a,b)=>golpeDe(b)-golpeDe(a));
    if(pegan.length) return pegan[0];
    const utiles = caraArriba.filter(c=>valorCarta(c) >= 1.3)
                             .sort((a,b)=>valorCarta(b)-valorCarta(a));
    if(utiles.length) return utiles[0];
    if(caraArriba.length) return caraArriba.sort((a,b)=>poder(b)-poder(a))[0];
    return v.monstruosRival[0] ?? null;
  };

  /* ── ¿ESTO CONSIGUE ALGO? ──
     La queja de E, palabra por palabra: "juega cartas por jugar". El
     ejemplo que lo resume: Snatch Steal sobre una ficha de Scapegoat. La
     ficha tiene 0 de ataque; robarla no cambia nada y quema la mejor carta
     del mazo. Lo mismo con Thunder Dragon descartado para buscar copias que
     ya no quedan, o con remoción sobre un muro.
     De aquí para abajo, ninguna carta se activa si no consigue algo. */
  /* ¿Es una ficha? Esto era solo `valorCarta(c) <= 0.2`, o sea que
     dependía de que la carta estuviera en la tabla escrita a mano. Las
     fichas que no lo están —y las hay: Sheep Token tiene su propio
     passcode, pero también salen fichas de otras cartas— pasaban por
     monstruo normal, y de ahí las dos jugadas que seguía contando el
     escáner: Snatch Steal sobre una ficha de Scapegoat y Smashing Ground
     gastado en lo mismo. Se mira además el BIT DE FICHA de la base y el
     caso "monstruo normal de 0/0", que es lo que son todas. */
  const esFicha = c => valorCarta(c) <= 0.2
    || !!((c?.datos?.type ?? 0) & 0x4000)
    || (!!((c?.datos?.type ?? 0) & 0x1) && atk(c) === 0 && def(c) === 0);
  const esMuro  = c => !c.bocaAbajo && c.defensa && def(c) >= 1700 && atk(c) <= 1200;
  /* Las fichas de Scapegoat no se pueden tributar para una invocación por
     tributo (lo dice la carta). */
  const noSeTributa = c => esFicha(c) && /Sheep Token/i.test(c?.nombre ?? "");
  // a quién merece la pena robarle o absorberle: ni fichas ni tapadas
  const objetivoDeRobo = v => v.monstruosRival
      .filter(c => !c.bocaAbajo && !esFicha(c))
      .sort((a,b) => poder(b) - poder(a))[0] ?? null;
  /* Cuántas copias me quedan de una carta EN EL MAZO. Un jugador se sabe su
     propia lista; el bot no podía porque el espejo del deck es ficticio.
     `v.mazo` lo calcula restándole a la decklist todo lo ya visto. */
  const quedanEnMazo = (v, nom) => {
    let n = 0;
    for(const [code, cuantas] of (v.mazo ?? []))
      if(canon(names[code]?.name ?? "") === nom) n += cuantas;
    return n;
  };

  /* ══════════════════════════════════════════════════════════════════
     A QUIÉN TUMBAR: TSUKUYOMI Y BOOK OF MOON EN MI TURNO (22-09)

     Bibliografía de E (r/Goat_Format, «How to best use Tsukuyomi in chaos
     turbo?»; goatrulings.com; goatformat.com Rulings A–C y S–T). Tsukuyomi
     no es «tumbar al primero que vea»: su objetivo puede estar en los dos
     lados del campo y cada uno da una ventaja distinta.

       · SU monstruo:
           - Thousand-Eyes Restrict: boca abajo pierde su efecto y queda
             con 0/0: «an easy out to TER».
           - lo que me frena y cuya DEF sí supero: tumbarlo y matarlo en
             combate (los Warriors tienen 1000 o menos de DEF: Breaker,
             Blade Knight, Sasuke).
           - con Nobleman en la mano, lo tumbo y lo destierro.
           - NUNCA lo mío que me robó con Snatch Steal: boca abajo, Snatch
             Steal se va y el monstruo SE QUEDA con él (ruling de Goat).
       · MI monstruo:
           - lo que le robé yo con Snatch Steal: por el mismo ruling, pasa
             a ser mío para siempre («makes the monster permanently yours»)
             y deja de darle 1000 LP por turno.
           - mi Chaos Sorcerer o BLS que ya usó su destierro este turno:
             boca abajo y otra vez boca arriba es una carta nueva y el
             efecto vuelve (Rulings A–C, BLS). Solo si la invocación por
             volteo es LEGAL este turno: no entró este turno, no atacó y
             no se giró a mano. Y solo si queda algo suyo que desterrar.
           - un volteo propio que ya dio su efecto (Magician of Faith):
             re-tapado lo vuelvo a voltear el turno siguiente.
       · Tsukuyomi a sí misma: se queda tapada en vez de volver a la mano.
         Es lo que pasa si no hay nada mejor (el efecto es obligatorio).

     Devuelve los objetivos posibles con su valor; `mainPhase` lo usa para
     decidir si invocar Tsukuyomi o activar Book of Moon en mi turno, y
     `elegirCartas` para escoger el objetivo.
     ══════════════════════════════════════════════════════════════════ */
  const efectoUsadoTurno = new Map();   // uid → turno en que usó su efecto (Chaos)
  const giroManualTurno = new Map();    // uid → turno en que lo giré a mano
  const CHAOS_REUSO = new Set(["Chaos Sorcerer","Black Luster Soldier - Envoy of the Beginning"]);
  const volteoLegalYa = (v, x) => (x.entroTurno == null || x.entroTurno < v.turno)
                                  && x.atacoTurno !== v.turno && giroManualTurno.get(x.uid) !== v.turno
                                  && x.volteoTurno !== v.turno;
  const snatchMio = (v, x) => x.prestado && v.backrow.some(b => !b.bocaAbajo
                               && canon(b.nombre ?? "")==="Snatch Steal" && b.equipadoA === x.uid);
  function planTumbar(v, { fuente = "Tsukuyomi", conBatalla = false } = {}){
    const out = [];
    const miMejor = Math.max(0, ...v.monstruos.filter(x=>!x.bocaAbajo && !x.defensa).map(x=>atk(x)));
    const atacantes = v.monstruos.filter(x=>!x.bocaAbajo && !x.defensa && atk(x) > 0 && x.atacoTurno !== v.turno
                                            && !(infoDe(x).noAtacaTrasEfecto && efectoUsadoTurno.get(x.uid) === v.turno));
    if(fuente === "Tsukuyomi" && conBatalla) atacantes.push({ nombre:"Tsukuyomi", datos:{ attack:1100 } });
    const suyosArriba = v.monstruosRival.filter(x=>!x.bocaAbajo && !esFicha(x));
    for(const x of suyosArriba){
      const nom = canon(x.nombre ?? "");
      if(x.mioRobado){ out.push({ uid:x.uid, valor:-3, por:"es mío robado: se quedaría con él" }); continue; }
      let valor = 0, por = [];
      if(nom === "Thousand-Eyes Restrict"){ valor += 4 + atk(x)/1000; por.push("TER boca abajo pierde su efecto"); }
      const ixv = infoDe(x);
      /* Dream Clown, Crass Clown y Blade Rabbit boca arriba en ataque
         destruyen al pasar a defensa en SU turno: tumbarlos les quita
         ese cambio (tendrían que voltear y esperar otro turno). */
      const clownArmado = !!ixv.aDefensa && !x.defensa;
      const esVolteo = !clownArmado && (ixv.rol === "flip" || ixv.colocarPreferente || (exp("motor") && esMotorDeVolteo(x)));
      if(clownArmado){ valor += 2.5; por.push("le quito el paso a defensa (destruiría)"); }
      if((miMejor > 0 && atk(x) >= miMejor) || (valorCarta(x) >= 1.4 && !esVolteo) || atk(x) >= 1800){ valor += 1.5 + valorCarta(x)/2; por.push("me frena"); }
      /* Un volteo boca arriba se mata mejor DE FRENTE: tapado, al atacarlo
         se voltea y su efecto sale otra vez. */
      if(conBatalla && !esVolteo && atacantes.some(a => atk(a) > def(x))){ valor += 1.5 + valorCarta(x); por.push(`tapado muere en combate (DEF ${def(x)})`); }
      if(v.mano.some(h => canon(h.nombre ?? "")==="Nobleman of Crossout")){ valor += 1.0; por.push("y Nobleman lo destierra"); }
      if(infoDe(x).espiritu) valor += 0.3;
      /* Tumbarle un volteo es regalárselo otra vez (guía P03): aunque lo
         mate en combate, al atacarlo se voltea y su efecto sale. */
      if(esVolteo){ valor -= 0.5 + valorCarta(x)/2; por.push("es un volteo: se lo regalo"); }
      out.push({ uid:x.uid, valor, por: por.join(", ") || "sin más" });
    }
    for(const x of v.monstruos.filter(y => !y.bocaAbajo && !esFicha(y))){
      const nom = canon(x.nombre ?? "");
      if(snatchMio(v, x)){
        out.push({ uid:x.uid, valor: 1.5 + valorCarta(x) + (v.backrowRival.length ? 1 : 0) - (conBatalla && atk(x) > 0 ? 0.8 : 0),
                   por:"robado con Snatch Steal: boca abajo pasa a ser mío para siempre" });
        continue;
      }
      if(CHAOS_REUSO.has(nom) && efectoUsadoTurno.get(x.uid) === v.turno && volteoLegalYa(v, x)
         ){
        const quedan = suyosArriba.filter(r => valorCarta(r) >= 0.8 || atk(r) >= 1400).length;
        const mejorBlanco = Math.max(0, ...suyosArriba.map(r => valorCarta(r)));
        if(quedan){ out.push({ uid:x.uid, valor: 3 + mejorBlanco + quedan*0.3, por:`${x.nombre} otra vez boca arriba: su destierro vuelve` }); continue; }
      }
      const inf = infoDe(x);
      if(inf.rol === "flip" || inf.colocarPreferente){
        /* «Re use flips» (captura de E): re-tapado, el volteo vuelve a
           servir el turno siguiente. Un motor de volteo (Des Lacooda,
           Dream Clown, Magician of Faith con mágicas) vale más. */
        /* Medido en el espejo de Clown Control: re-tapar lo mío antes que
           tumbar lo suyo pierde partidas. Solo si no hay nada suyo. */
        out.push({ uid:x.uid, valor: suyosArriba.length ? -1.5 : 0.8, por:"re-tapo mi volteo para usarlo otra vez" }); continue;
      }
      /* Tsukuyomi a sí misma se queda tapada y NO vuelve a la mano: pierde
         la invocación que se repite cada turno. Es el último recurso. */
      if(nom === "Tsukuyomi"){ out.push({ uid:x.uid, valor:-2, por:"se queda tapada (y no vuelve a la mano)" }); continue; }
      out.push({ uid:x.uid, valor:-3, por:"tumbar lo mío no da nada" });
    }
    return out.sort((a,b)=>b.valor-a.valor);
  }

  /* ══════════════════════════════════════════════════════════════════
     LA POSTURA DEL TURNO — para qué es este turno.

     Esto es lo que E echaba en falta: "la IA no sigue una win condition,
     solo juega cartas y responde a jugadas, sin un plan de acción claro".
     Y tenía razón en el diagnóstico: cada carta se puntuaba por su cuenta
     y la mejor nota ganaba. Un humano no juega así. Antes de tocar nada
     decide para qué es el turno —remato, presiono, aguanto, construyo o
     busco— y a partir de ahí todas las cartas se leen distinto: el mismo
     Smashing Ground vale mucho cuando estás estabilizando y poco cuando
     lo que necesitas es cavar para encontrar tu pieza.

     Es lo que hacen las IAs de los juegos de consola (World Championship,
     Tag Force): no buscan en árbol —no pueden—, tienen un modo y una
     lista de prioridades por modo.

     La postura se decide una vez por Main Phase y se apunta en el log,
     que es donde E lee lo que ha hecho el bot. */
  /* ══ EL PRECIO DE UN TRIBUTO ES EL CUERPO QUE ENTREGAS ══
     `lectura.js` cobra 1.0 por cualquier "Tribute", diga lo que diga el
     tablero. Aquí sí se sabe qué se va a dar: el motor deja elegir y el
     bot elegiría el más barato. Una ficha de Scapegoat no cuesta casi
     nada —Cannon Soldier con fichas ES la jugada del formato—; el 1400
     que acabas de invocar, sí.
     Y el caso que reportó E: si el ÚNICO tributo posible es la propia
     carta, además de perder el cuerpo pierdes la máquina, así que se
     paga aparte. El bot se comió su Cannon Soldier dos veces por 500. */
  function precioDelTributo(v, propia){
    const cuerpos = v.monstruos ?? [];
    if(!cuerpos.length) return 0;
    const precio = c => valorCarta(c) + poder(c)/1600;
    const otros = cuerpos.filter(c => c.uid !== propia?.uid);
    if(!otros.length){
      /* Solo me tengo a mí: el coste incluye quedarme sin la carta que
         hace el efecto, no solo sin un cuerpo. */
      return precio(cuerpos[0]) + 1.2;
    }
    return Math.min(...otros.map(precio));
  }

  const POSTURAS = {
    rematar:    "voy a por los puntos de vida: todo lo que haga daño",
    estabilizar:"voy por detrás: quitar de en medio y aguantar el turno",
    presionar:  "voy por delante: campo y daño sin regalar cartas",
    construir:  "igualados: ganar cartas y montar la jugada",
    buscar:     "no tengo mis piezas: cavar y guardar lo reactivo",
  };
  let posturaActual = null, posturaTurno = -1, lecturaTurno = -1;
  /* La lectura del tablero (ai/posicion.js): números, no intuiciones. Se
     calcula en cada decisión y se apunta en el log una vez por turno —es
     lo que E lee para saber qué estaba pensando el bot. */
  function lectura(v){
    const pos = leerPosicion(v, PLAN);
    if(lecturaTurno !== v.turno){ traza(`lectura: ${pos.texto}`); lecturaTurno = v.turno; }
    return pos;
  }
  /* ══ CONTEXTO ESTRATÉGICO (ai/contexto.js) ══
     Qué clase de partida es: rol (beatdown/control), fase, riesgo de
     trampas y de barrido, dominio de la mesa, simplificar. Lo consultan
     las reglas de invocar, atacar, guardar y gastar, así que un principio
     vale para todas las cartas a la vez. */
  let contextoTurno = -1;
  function contexto(v){
    if(!exp("contexto")) return null;
    const ctx = contextoEstrategico(v, leerPosicion(v, PLAN));
    if(contextoTurno !== v.turno){ traza(ctx.texto); contextoTurno = v.turno; }
    return ctx;
  }
  function postura(v){
    if(!sabe.postura) return "construir";
    if(posturaTurno === v.turno && posturaActual) return posturaActual;
    if(exp("lecturaPosicion")){
      const pos = lectura(v);
      if(pos.postura !== posturaActual) traza(`postura: ${pos.postura} — ${pos.razon}`);
      posturaActual = pos.postura; posturaTurno = v.turno;
      return pos.postura;
    }
    const mio  = v.monstruos.filter(c=>!c.bocaAbajo && !c.defensa)
                            .reduce((s,c)=>s+atk(c),0);
    const suyo = pegaMasFuerte(v, { conMano:false });
    const dif  = ventaja(v);
    const campoSuyo = v.monstruosRival.length, campoMio = v.monstruos.length;
    /* ¿tengo en la mano o en el campo algo con lo que gane este mazo? */
    const conPiezas = [...v.mano, ...v.monstruos, ...v.backrow]
      .some(c=>c.nombre && (PLAN.esClave(c.nombre) || PLAN.esMotor(c.nombre)));

    let p;
    if(campoSuyo===0 && mio >= v.lp.rival)                  p = "rematar";
    else if(v.lp.mio <= 2200 || campoSuyo - campoMio >= 2
            || (suyo > 0 && mio === 0 && campoSuyo > 0))    p = "estabilizar";
    else if(dif >= 1 && mio > suyo)                         p = "presionar";
    else if(!conPiezas && v.mano.length >= 2)               p = "buscar";
    else                                                    p = "construir";

    if(p !== posturaActual) traza(`postura: ${p} — ${POSTURAS[p]}`);
    posturaActual = p; posturaTurno = v.turno;
    return p;
  }

  /* Cuánta prisa tengo. Un jugador bueno guarda cartas, pero no las
     entierra: si va por detrás o la partida se alarga, las juega. */
  function apuro(v){
    let a = 0;
    if(v.turno >= 8)  a += 0.4;
    if(v.turno >= 14) a += 0.5;
    if(ventaja(v) < 0) a += 0.5;
    if(v.lp.mio < v.lp.rival - 2000) a += 0.5;
    if(v.lp.mio <= 2500) a += 0.4;
    if(v.mano.length >= 5) a += 0.3;          // mano llena: hay que gastar
    return Math.min(a, 1.6);
  }

  /* ══════════════════════════════════════════════════════════════════
     LIBRARY FTK: LO QUE SOLO VALE SABIENDO QUÉ HAY ARRIBA (02-10)

     E, dos rondas contra Library FTK: «apenas ha jugado», «no sabe jugar
     bien su mazo». En los logs: Archfiend's Oath activada a ciegas cada
     turno (500 LP por una carta que casi nunca acertaba: de 2600 a 100),
     Toon World pagando 1000 porque «Toon Table of Contents» empieza por
     Toon, y la Library colocada boca abajo.

     goatformat.com/library-ftk: Convulsion of Nature pone los mazos boca
     arriba y entonces Archfiend's Oath ES un robo por 500 (declaras la
     que ves) y Reversal Quiz acierta seguro. El cierre: la vida propia a
     500 o menos, Black Pendant en la mesa, Reversal Quiz cambia las vidas
     y el Pendant, al ir al cementerio como coste, le quita los 500 que le
     quedan. Sin saber qué hay arriba, nada de eso se hace.
     ══════════════════════════════════════════════════════════════════ */
  function libreriaFTK(v, l, c, nom){
    const loc = Number(l.location);
    const real = duel.resolve(l, l.code);
    const arribaEnMesa = loc === 8 && real && !((real.position ?? 0) & 0x0a);
    const enMesa = (n2) => v.backrow.some(b => !b.bocaAbajo && canon(b.nombre ?? "") === n2);
    const libArriba = v.monstruos.some(x => !x.bocaAbajo && canon(x.nombre ?? "") === "Royal Magical Library");
    const cima = v.cimaMazo ? (names[v.cimaMazo]?.name ?? "") : null;
    if(nom === "Royal Magical Library" && loc === 4) return { p:6.0, por:"quito tres contadores y robo" };
    if(nom === "Archfiend's Oath"){
      if(arribaEnMesa){
        if(!cima) return { p:0.02, firme:true, por:"no sé qué hay arriba: pagar 500 a ciegas es tirar la vida" };
        if(v.lp.mio <= 500) return { p:0.02, firme:true, por:"no me queda vida que pagar" };
        return { p:4.6, seguro:true, por:`arriba está ${cima}: me la llevo por 500` };
      }
      return (enMesa("Convulsion of Nature") || libArriba || cima)
        ? { p:2.6, por:"puesta, para usarla sabiendo qué hay arriba" }
        : { p:0.4, por:"sin Convulsion ni Library boca arriba no hace nada: se guarda" };
    }
    if(nom === "Convulsion of Nature"){
      if(enMesa("Convulsion of Nature")) return { p:0.02, firme:true, por:"ya está puesta" };
      return { p:3.4 + (libArriba ? 0.6 : 0), por:"mazo boca arriba: Archfiend's Oath y Reversal Quiz ven la carta de arriba" };
    }
    if(nom === "Reversal Quiz"){
      if(cima && enMesa("Black Pendant") && v.lp.mio <= 500 && v.lp.rival > v.lp.mio)
        return { p:9.5, seguro:true, por:`arriba hay ${cima}: cambio las vidas y Black Pendant remata` };
      return { p:0.02, firme:true, por: cima ? "sin Black Pendant y la vida a 500 no remata: me quedaría sin mano ni mesa"
                                              : "no sé qué hay arriba: es tirar la mano entera" };
    }
    return null;
  }

  /* ══════════ MAIN PHASE ══════════ */
  function mainPhase(m, intento){
    const v = vistaDe(duel, yo, db, names);
    const prisa = apuro(v);

    // ─ Novato: hace lo primero que puede, sin criterio ─
    if(n===0){
      const todo=[];
      (m.summons||[]).forEach((c,i)=>todo.push({a:IA.SELECT_SUMMON,i}));
      (m.activates||[]).forEach((c,i)=>todo.push({a:IA.SELECT_ACTIVATE,i}));
      (m.spell_sets||[]).forEach((c,i)=>todo.push({a:IA.SELECT_SPELL_SET,i}));
      (m.monster_sets||[]).forEach((c,i)=>todo.push({a:IA.SELECT_MONSTER_SET,i}));
      if(todo.length && intento<todo.length){
        const e=todo[(intento + (azar(.5)?1:0)) % todo.length];
        return { type:R.SELECT_IDLECMD, action:e.a, index:e.i };
      }
      return { type:R.SELECT_IDLECMD, action: m.to_bp?IA.TO_BP:IA.TO_EP, index:null };
    }

    const plan = [];   // {puntos, action, index, por, uid}
    const añadir = (puntos, action, index, por, uid) => plan.push({puntos, action, index, por, uid});
    const ctx = contexto(v);
    /* Jugadas que el CONTEXTO desaconseja (guardar, no sobreextenderse, no
       exponer): no son vetos de reglas pero sí decisiones estratégicas, y
       la simulación (ai/pensar.js) no debe resucitarlas por ruido de sus
       mundos —su evaluación paga el cuerpo en mesa y no el riesgo—. */
    const firmes = new Set();
    const firme = (a, i) => firmes.add(`${a}:${i}`);
    /* SEGURO es lo contrario de firme: una jugada que la heurística sabe
       correcta por una razón de reglas (no de valoración) y que la
       simulación no puede cambiar por ruido. Se usa muy poco. */
    const seguros = new Set();
    const seguro = (a, i) => seguros.add(`${a}:${i}`);
    /* Nobleman of Crossout solo castiga lo colocado si puede tenerlo: con
       su mano casi vacía (topdeck) o ya gastado, colocar deja de ser caro. */
    const nobleRiesgo = v.manoRival.cuantas >= 2 && !rivalUso(v, "Nobleman of Crossout");

    /* ── EL ORDEN ES LA JUGADA ──
       En Goat la habilidad no está solo en qué cartas juegas sino en el
       orden, y por una razón concreta: Torrential Tribute.
         · La remoción de BACKROW (Heavy Storm, MST) va ANTES de invocar:
           destruye el Torrential que iba a castigar la invocación.
         · La remoción de MONSTRUOS va DESPUÉS de invocar: si limpias
           primero y luego invocas, el Torrential se lleva tu monstruo y
           el campo del rival ya está vacío; si invocas primero, cuando
           cae el Torrential se lleva también lo suyo.
       Es el consejo repetido en todas las guías del formato y el bot lo
       tenía escrito en el comentario de arriba pero no en el código. */
    const puedoInvocar = (m.summons||[]).length > 0;

    /* REMATAR. Un bot decente reconoce cuándo la partida se acaba este
       turno. Si lo único que se interpone entre mi campo y sus puntos de
       vida es un monstruo, quitarlo de en medio no vale "una carta": vale
       el duelo. Sin esto la IA guardaba el Smashing Ground para más
       adelante con el rival a 1.200 puntos.

       TRAMPA MEDIDA: la primera versión no miraba la fase. SELECT_IDLECMD
       también llega en Main Phase 2, cuando los monstruos YA han atacado:
       el bot se gastaba la remoción para un "letal" que no existía. Solo
       cuenta en Main Phase 1 y con batalla por delante.

       Honestidad sobre la medida: con 4.000 partidas contra la versión
       anterior, esta regla sale 61% con ella y 62% sin ella. O sea, NO
       mejora el marcador; se queda porque la jugada que evita —guardar la
       remoción con el rival a 1.200 puntos— es de las que hacen que un
       humano diga "esta IA hace cosas raras". Se puede apagar con
       GOAT_AI_OFF=remate. */
    const miAtaque = v.monstruos.filter(c2=>!c2.bocaAbajo && !c2.defensa)
                                .reduce((s,c2)=>s+atk(c2), 0);
    const remate = v.turnoMio && v.fase===0x4 && !!m.to_bp
                   && v.monstruosRival.length<=1
                   && miAtaque >= v.lp.rival && miAtaque > 0;

    /* 1. INVOCAR. En Goat el monstruo entra antes que la remoción:
          si limpias primero y luego invocas, regalas Torrential. */
    const techoRival = Math.max(0, ...v.monstruosRival.filter(c=>!c.bocaAbajo).map(c=>atk(c)));
    (m.summons||[]).forEach((l,i)=>{
      const c = cartaDeLista(l), inf = infoDe(c);
      let p = 3 + atk(c)/1000, por = `invocar ${c.nombre}`;
      /* ¿SOBREVIVE A SU TURNO? Palabras de E: "la IA a veces invoca en
         ataque por invocar, sin darse cuenta de que yo tengo un monstruo
         con más ataque y que le haré daño al siguiente turno". El bot
         puntuaba lo que conseguía AHORA y no miraba el tablero que dejaba.
         Un monstruo invocado de frente que el rival se come no es solo una
         carta perdida: son los puntos de vida de la diferencia. Y si esa
         misma carta se puede COLOCAR, invocarla es directamente un error,
         no una preferencia: por eso el castigo es mucho mayor cuando hay
         alternativa. */
      const puedeColocarse = (m.monster_sets||[]).some(s=>
        s.code===l.code && s.sequence===l.sequence);
      /* PERO ojo con a quién se le aplica esto. Un monstruo que hace algo
         nada más entrar —Breaker rompe una tapada, Exiled Force se
         sacrifica, Chaos Sorcerer destierra, Airknight roba al golpear— se
         invoca aunque luego se lo coman: ya ha pagado su carta. Castigar
         también a esos costaba dos puntos de victoria medidos, porque el
         bot se quedaba colocando cuerpos y sin hacer nada. La regla es
         para los monstruos que son SOLO un cuerpo. */
      /* OJO con los volteos: un `flip` INVOCADO DE FRENTE no hace nada de
         nada —su efecto solo existe si la carta entra tapada y alguien la
         voltea—, así que estaba en esta lista por error y se saltaba el
         filtro de supervivencia. Es media explicación del «Magician of
         Faith en atk» que reportó E. */
      /* ══ TSUKUYOMI VALE LO QUE VALGA SU OBJETIVO (22-09) ══
         Su efecto es obligatorio: sin nada que merezca la pena tumbar se
         tumba a sí misma (R2 p1 T16 del 20-09). Ver `planTumbar`. */
      if(exp("tsukPlan") && canon(c.nombre ?? "") === "Tsukuyomi"){
        const obj = planTumbar(v, { conBatalla: !!m.to_bp && v.fase === 0x4 })[0];
        if(!obj || obj.valor < 0.8){ if(exp("tsukSinObjetivo")){ p -= 1.2; por += " (no hay nada que valga la pena tumbar)"; } }
        else { if(exp("tsukInvocar")) p += Math.min(3, obj.valor) * 0.25; por += ` (tumba: ${obj.por})`;
               /* Reutilizar un destierro de Chaos o quedarme lo robado es
                  una carta más por reglas: la simulación no lo discute. */
               if(/destierro vuelve|para siempre/.test(obj.por) && obj.valor >= 2.5) seguro(IA.SELECT_SUMMON, i); }
      }
      const puedePegarYa0 = !!m.to_bp && (
        v.monstruosRival.length === 0 ||
        v.monstruosRival.some(r=>!r.bocaAbajo && atk(c) > (r.defensa || !exp("amenazaReal") ? poder(r) : atkEnCombate(r, v.lp.rival))));
      /* Perforar, robar al golpear o atacar a todos solo «hacen algo» si
         este turno hay un golpe que dar (E, 02-10: Airknight de frente
         delante de una Lily que pega con 3400). */
      const haceAlgoAlEntrar = inf.rompeBackrow || inf.efectoAlInvocar || inf.invoca
        || ((inf.atacaTodos || inf.perfora || inf.robaAlGolpear) && (!exp("amenazaReal") || puedePegarYa0))
        || ["removal","buscador","fusion"].includes(inf.rol);
      /* Y tampoco cuenta si el monstruo va a hacer daño ESTE turno. Cambiar
         un 1700 por un ataque directo o por matarle algo es una jugada,
         no un descuido: lo que E reportó es invocar en ataque cuando eso
         no consigue nada y encima le regala daño al rival. */
      const puedePegarYa = puedePegarYa0;
      const coste = (exp("sobrevivir") && !haceAlgoAlEntrar && !puedePegarYa)
        ? costeDeQueMuera(c, v) : 0;
      /* `noColocar` quiere decir "no la COLOQUES boca abajo" —Sangan muere a
         Nobleman, Sinister Serpent vale más en la mano—, no "invócala sin
         mirar". Estaba saltándose el filtro de supervivencia entero, así
         que el bot invocaba un Sinister Serpent de 300 delante de un 1900.
         Lo cazó el banco de posiciones. */
      /* Y cuánto pesa depende del PLAN. Un mazo de Beastdown acepta el
         cambio y sigue pegando: colocarle los monstruos lo deja sin
         partida (medido: 40% cuando se le aplicaba el freno entero). Uno
         de Burn no se puede permitir perder un cuerpo. `agresivo` estaba
         en la tabla de planes desde el principio y no se usaba para
         nada; aquí es donde tiene sentido. */
      const prudencia = 1 - (PLAN.agresivo ?? 0.5);
      if(coste > 0 && prudencia > 0.1){
        /* El castigo tiene que ser el justo para que gane COLOCAR cuando
           colocar es la jugada, y ni un punto más. Con el doble, el bot se
           volvía miedoso: colocaba cuerpos toda la partida, los duelos se
           alargaban tres turnos y medía dos puntos de victoria peor. */
        p -= (puedeColocarse ? (1.2 + coste*0.6) : (0.5 + coste*0.5)) * (prudencia*2);
        por += ` (lo mata algo de ${pegaMasFuerte(v, { conMano:false })})`;
      }
      /* ══ SISTEMA J · UNA JUGADA DOMINADA NO ES CUESTIÓN DE ESTILO ══
         E, log 19-46-02 T4: «invoca en ataque contra mi monstruo de
         3000». Era un Archfiend Soldier de 1900 puesto de frente
         delante de un Black Luster Soldier.

         El freno de arriba SÍ estaba, pero lo escala `prudencia`, o sea
         `1 - agresivo`: con un mazo agresivo se queda en casi nada. Y
         eso está bien para los casos dudosos —Beastdown acepta el
         cambio y sigue pegando, medido— pero aquí no hay nada que
         sopesar. Si el monstruo NO puede atacar este turno y muere
         seguro contra algo que ya está boca arriba, colocarlo es el
         mismo cuerpo sin regalar el daño ni el combate: invocarlo de
         frente es estrictamente peor, se juegue como se juegue.

         Por eso este castigo no lo toca la agresividad. Se excluye lo
         que `knowledge.js` dice a mano que no se coloque (Sangan quiere
         morir de frente, Sinister Serpent vale más en la mano): esa
         tabla está comprobada carta a carta y manda sobre esto. */
      /* ══ UN MURO NO SE INVOCA DE FRENTE ══
         E, 03-10 (Reino, Mako, T1): «Aqua Madoor es un monstruo
         defensivo, ¿por qué lo invoca en ataque?». 1200/2000 en el turno
         1: la heurística decía colocarlo y la simulación, por ruido, lo
         sacó de frente. Si defiende claramente más de lo que pega, no
         puede atacar este turno y no hace nada al entrar, de frente es
         estrictamente peor: veto firme. */
      if(exp("muroTapado") && puedeColocarse && !puedePegarYa && !haceAlgoAlEntrar
         && def(c) >= atk(c) + 400 && !inf.noColocar){
        p = Math.min(p, 0.5); firme(IA.SELECT_SUMMON, i);
        por += " (un muro: colocado defiende igual y no regala el combate)";
      }
      if(exp("sobrevivir") && puedeColocarse && !puedePegarYa && !haceAlgoAlEntrar
         && !(inf.noColocar && nobleRiesgo) && !sobrevive(c, v)){
        p -= 2.2;
        por += " (de frente no ataca y muere seguro: colocarlo es lo mismo sin regalar nada)";
      }
      /* ══ TURNO SIN BATALLA Y NADA ENFRENTE: EL ATACANTE SE GUARDA ══
         Replays del GFCEU 2026 (29-09), turno 1 del que empieza: la IA
         invocaba de frente Breaker (14 %), Tsukuyomi (9 %), Tribe-Infecting
         Virus (7 %) o Exiled Force; los jugadores, ninguno de ellos, y un
         31 % de las veces no bajan monstruo. Un atacante que no puede
         atacar y no tiene nada que romper ni que tumbar solo sale para que
         el rival lo vea y lo quite en su turno; el turno que viene entra y
         pega. Los que disuaden de frente (D.D. Warrior Lady, que se lleva
         a quien la ataque) sí salen: eso los jugadores lo hacen. */
      if(exp("sinBatallaGuarda") && !m.to_bp && !v.monstruosRival.length && !v.backrowRival.length
         && !inf.peligroso && !inf.inmuneCombate && !(inf.rol==="flip" || inf.colocarPreferente)
         && ["beater","removal","trick","bomba"].includes(inf.rol)){
        /* E, 02-10 (Warrior, p1, T1): el −3 dejaba el Breaker empatado con
           colocar Mirror Force (2,8) y salió de frente; Creature Swap se lo
           llevó con su contador y le rompió la Mirror. Es un veto, no un
           matiz: la nota no puede quedar por encima de jugar. */
        p = Math.min(p - 3.0, 0.6); firme(IA.SELECT_SUMMON, i);
        por += " (sin batalla y sin nada enfrente: sale solo para que lo quiten; se guarda)";
      }
      /* ══ SISTEMA B · HAY CARTAS QUE QUIEREN ENTRAR BOCA ABAJO ══
         Man-Eater Bug invocada de frente es un cuerpo de 450 que no hace
         nada; colocada, se lleva un monstruo en cuanto la tocan. Black
         Dragon's Chick, igual: 800 puntos de cuerpo cuyo valor es el
         combo. E vio las dos invocadas de frente sin razón.
         La excepción es concreta y se comprueba: si con ella remato o si
         tengo un ataque de verdad, invocar es lo correcto. */
      if(inf.prefiereSet && puedeColocarse && !puedePegarYa){
        p -= 2.6; por += " (su valor está en entrar boca abajo)";
      }
      /* ══ UN VOLTEO INVOCADO DE FRENTE NO VOLTEA NADA ══
         E, partida 2: «turno 14 Magician of Faith en atk es raro». Y lo
         es: 300 de ataque boca arriba es un cuerpo muerto que además
         anuncia lo que hay y no recupera nada. El efecto de un volteo
         solo existe si la carta entra tapada.
         `prefiereSet` ya cubría a Man-Eater Bug; esto cubre a TODA la
         familia (`rol:"flip"` y las que la tabla marca como
         `colocarPreferente`). La excepción es la de siempre: si con ella
         remato o tengo un ataque de verdad, invocar es lo correcto. */
      else if((inf.rol==="flip" || inf.colocarPreferente) && puedeColocarse && !puedePegarYa){
        p -= 2.0; por += " (es un volteo: de frente no hace nada)";
      }
      /* ══ …NI AUNQUE PUEDA PEGAR, SI SOLO SON 300 ══
         E, 25-09 (Chaos Turbo, p2, T5): Magician of Faith invocado de frente
         con el campo rival vacío para pegar 300. Colocado, el turno que
         viene recupera el Heavy Storm. Pegar solo compensa si remata. */
      /* ══ …NI POR UN GOLPE DIRECTO QUE NO REMATA ══
         Replays del GFCEU 2026 (29-09): con el campo rival vacío, los
         jugadores colocan Dekoichi 17 de 19 veces. 1400 de daño una vez no
         pagan el robo del volteo, y el cuerpo se queda de frente para que
         le peguen. Matarle un monstruo sí es una jugada (eso no entra). */
      else if(exp("volteoDeFrente") && (inf.rol==="flip" || inf.colocarPreferente) && puedeColocarse
              && puedePegarYa && (atk(c) < 1000 || (exp("volteoDirecto") && v.monstruosRival.length === 0))
              && !(v.monstruosRival.length === 0 && atk(c) >= v.lp.rival)){
        p -= 2.4; firme(IA.SELECT_SUMMON, i); por += ` (es un volteo: ${atk(c)} de golpe no pagan su efecto)`;
      }
      if(inf.rol==="beater" || inf.rol==="bomba") p += 1.2;
      /* Sangan quiere atacar (es un floater: muera como muera, busca).
         Sinister Serpent no: vuelve sola cada Standby y su sitio es la
         mano, protegiendo del Delinquent Duo y alimentando descartes. */
      if(inf.noColocar && inf.rol!=="recurso"){
        /* ══ SANGAN: COLOCADO, SALVO QUE MATE ALGO ══
           Replays del GFCEU 2026: 32 de 41 Sangan colocados, y con el
           campo rival vacío 9 de 12, aunque esos mismos jugadores juegan
           Nobleman (una por duelo). De frente pega 1000 una vez y luego es
           un blanco que regala daño; colocado busca igual cuando muere y
           no cuesta vida. El riesgo de Nobleman lo tiene cualquier tapada. */
        const mataAlgo = v.monstruosRival.some(r => !r.bocaAbajo && !esFicha(r) && atk(c) > poder(r));
        const remata = v.monstruosRival.length === 0 && atk(c) >= v.lp.rival;
        if(exp("sanganColocado") && puedeColocarse && !mataAlgo && !remata){
          /* Contra tapadas, de frente es atacar a ciegas con 1000; contra
             algo más grande, un blanco. Los jugadores: 62 % y 83 % colocado. */
          p -= 2.2; por += " (no mata nada boca arriba: colocado busca igual y no regala daño)";
        } else p += 0.4;
      }
      /* ══ UN RECURSO NO SE INVOCA, NI AUNQUE PUEDA PEGAR ══
         E, torneo 1 (18-09): «turno 9 sinister serpent en atk? por qué».
         El freno de abajo solo valía cuando NO podía atacar, y con el
         campo rival vacío `puedePegarYa` es cierto: el bot gastaba su
         invocación normal —la del turno, la que no vuelve— y ponía en la
         mesa una carta de 300 cuyo valor es estar en la mano, para hacer
         300 de daño. Ahora solo se invoca si con eso REMATA. */
      if(exp("material") && inf.soloMaterial){
        const remata = !v.monstruosRival.length && atk(c) >= v.lp.rival;
        if(!remata){ p -= 6; por += " (su sitio es la mano, el cementerio o el coste de un Chaos)"; }
      }
      if(inf.rol==="recurso"){
        const remata = !v.monstruosRival.length && atk(c) >= v.lp.rival;
        if(remata){ p += 4.0; por += " (con esto remato)"; }
        else { p -= 2.5 + (puedePegarYa ? 1.5 : 0);
               por += " (vale más en la mano: la invocación del turno no vuelve)"; }
      }
      /* ESPÍRITUS. Asura Priest y Tsukuyomi vuelven a tu mano en la End
         Phase: si no pueden atacar este mismo turno, la invocación se ha
         ido a la basura. Reportado en Reddit: el bot invocaba Asura Priest
         en el turno 1, donde ni siquiera hay Battle Phase. */
      if(exp("espiritus") && inf.espiritu && !inf.efectoAlInvocar){
        const hayGolpe = v.monstruosRival.length===0 ||
           v.monstruosRival.some(r=>!r.bocaAbajo && atk(c) > poder(r));
        if(!m.to_bp){
          // turno 1: no hay Battle Phase, o sea que no hace absolutamente nada
          p -= 5.0; por += " (espíritu sin Battle Phase: se va a la mano sin tocar nada)";
        } else if(!hayGolpe){
          p -= 2.5; por += " (espíritu sin nada a lo que pegar)";
        } else if(inf.atacaTodos && v.monstruosRival.length>=2) p += 1.0;
        /* ══ ASURA PRIEST SE GUARDA PARA LIMPIAR ══
           Su valor es pegar a TODOS: contra las cuatro fichas de un
           Scapegoat, o contra dos o tres cuerpos pequeños, limpia la mesa.
           Gastarla contra un solo monstruo (o de golpe directo) cuando hay
           otro que invocar es tirar la carta que resuelve el Scapegoat
           que aún no ha salido. Si con ella remato, se invoca. */
        if(exp("asura") && inf.atacaTodos && m.to_bp){
          const rompe = v.monstruosRival.filter(r=>!r.bocaAbajo && atk(c) > poder(r)).length;
          const remata = !v.monstruosRival.length && atk(c) >= v.lp.rival;
          const otro = (m.summons ?? []).some(l => {
            const o = cartaDeLista(l); if(!o || o.code===c.code) return false;
            const io = infoDe(o); return !io.espiritu && io.rol!=="recurso" && atk(o) >= 1400;
          });
          if(rompe <= 1 && !remata && otro && !rivalUso(v,"Scapegoat")){
            p -= 1.5; por += " (Asura se guarda para limpiar el Scapegoat que no ha salido)";
          }
        }
      }
      // no duplicar ATK: Snatch Steal mata dos pájaros de un tiro
      if(exp("atkDuplicado") && v.monstruos.some(x=>!x.bocaAbajo && atk(x)===atk(c))) p -= 1.5;
      /* No sobreextender contra el Torrential Tribute. Una vez lo has
         visto salir ya no hay nada que temer, así que el freno se levanta:
         antes seguía frenando toda la partida y el bot se quedaba corto de
         campo sin motivo. Las fichas de Scapegoat no cuentan como campo:
         un Torrential que se lleva tres fichas es un regalo. */
      const campoReal = v.monstruos.filter(x=>valorCarta(x) > 0.2).length;
      /* Con mi Jinzo boca arriba no puede activar Torrential ni Mirror. */
      const miJinzoArriba = v.monstruos.some(x => !x.bocaAbajo && canon(x.nombre ?? "") === "Jinzo");
      const trampaMasaFuera = rivalUso(v,"Torrential Tribute") || rivalUso(v,"Mirror Force") || miJinzoArriba;
      /* Cuanto MÁS campo tengas, peor es añadir otro: un Torrential con
         tres monstruos tuyos fuera es una catástrofe, con uno es un
         cambio. El castigo era fijo (-1.4) y contra un cuerpo de 2000 no
         llegaba ni de lejos; ahora crece con lo que te juegas. */
      /* E, 03-10 (Reino, PaniK, T10): Breaker se quedó en la mano «para no
         sobreextender» con UNA tapada enfrente… y acabó colocado, sin
         contador. Breaker es justamente la respuesta a esa tapada: con una
         sola, la rompe antes de atacar. */
      const rompeLaUnica = exp("breakerRompe") && inf.rompeBackrow && v.tapadasRival <= 1;
      if(n>=2 && campoReal>=2 && v.tapadasRival>0 && ventaja(v)>=0 && !trampaMasaFuera && !rompeLaUnica){
        const enJuego = v.monstruos.reduce((s,x)=>s+valorCarta(x)+poder(x)/1600, 0);
        p -= 1.0 + enJuego;
        por += " (no sobreextender: tiene tapadas y no ha enseñado el Torrential)";
      }
      /* ══════════════════════════════════════════════════════════════
         SISTEMA E · UN TRIBUTO TIENE QUE SALIR A CUENTA

         Dos casos de E. En uno el bot revivió su Dark Magician y acto
         seguido lo tributó por un monstruo claramente peor. En otro
         tributó un Goblin Attack Force que TODAVÍA PODÍA ATACAR ese
         turno —y que después del ataque pasa a defensa con 0, o sea que
         su valor se evapora—.

         Antes esto no se miraba en absoluto: la nota de invocar era
         `3 + atk/1000` mirase lo que mirase el coste. Ahora se compara
         lo que sale con lo que entra, y se prefiere ATACAR PRIMERO y
         tributar en la Main Phase 2.
         ══════════════════════════════════════════════════════════════ */
      const nivel = c.datos?.level ?? 0;
      const pideTributo = nivel >= 5 && !inf.invocaGratis;
      if(pideTributo && v.monstruos.length){
        /* Los candidatos: los míos, de menos a más valiosos, que es como
           los elegiría cualquiera. Cuántos hacen falta lo dice el nivel. */
        const cuantos = nivel >= 7 ? 2 : 1;
        const candidatos = [...v.monstruos].filter(x => !(exp("fichasNoTributo") && noSeTributa(x)))
          .sort((a,b)=> (valorCarta(a)+poder(a)/2000) - (valorCarta(b)+poder(b)/2000))
          .slice(0, cuantos);
        /* Una Fusión no vuelve (Thousand-Eyes Restrict tumbado se voltea
           el turno siguiente y absorbe otra vez): pesa más como tributo. */
        const esFusion = x => ((Number(x.datos?.type) || 0) & 0x40) !== 0;
        const costeTributo = candidatos.reduce((t,x)=>
          t + valorCarta(x) * (exp("fichasNoTributo") && esFusion(x) ? 1.6 : 1) + poder(x)/2200, 0);
        const gano = valorCarta(c) + atk(c)/2200;
        /* Y el coste que no se ve en las estadísticas: una invocación por
           tributo GASTA UNA CARTA. Dos cuerpos de 2500 por uno de 2500 no
           es "lo mismo", es perder una carta por nada. Por eso el que
           entra tiene que ser MEJOR por un margen, no solo igual: es
           exactamente lo que pasó con el Dark Magician del log. */
        const costeEnCartas = 0.8 * candidatos.length;
        if(costeTributo + costeEnCartas > gano){
          p -= 1.0 + (costeTributo + costeEnCartas - gano) * 1.6;
          por += ` (tributar ${candidatos.map(x=>x.nombre).join(" y ")} no compensa por ${c.nombre})`;
        }
        /* Y lo del Goblin: si alguno de los que voy a tributar puede
           atacar con provecho AHORA, primero se ataca. La invocación
           sigue estando disponible en la Main Phase 2. */
        if(m.to_bp){
          const conAtaqueUtil = candidatos.filter(x => !x.bocaAbajo && !x.defensa
            && !x.yaAtaco && (
              v.monstruosRival.length === 0 ||
              v.monstruosRival.some(r=>!r.bocaAbajo && atk(x) > poder(r))));
          if(conAtaqueUtil.length){
            /* Esto no es una preferencia, es un ORDEN: la invocación sigue
               ahí en la Main Phase 2 y el ataque no vuelve. Con un simple
               −2.2 el Goblin de 2300 seguía ganando la comparación y se
               tributaba antes de pegar, que es justo lo que E reportó. */
            p = Math.min(p, 0.4);
            por = `invocar ${c.nombre} (primero ataco con ${conAtaqueUtil[0].nombre}` +
                  `, la invocación sigue en la Main 2)`;
          }
        }
      }
      /* ══ SOBREEXTENSIÓN (contexto) ══
         Principio (Lessons of the Game; Who's the Beatdown?): con la mesa
         ya ganada, el monstruo adicional aporta poco y se expone a
         Torrential y Mirror Force. No aplica si hace algo al entrar, si
         con él hay letal o si voy por detrás. */
      if(ctx){
        const conEl = { ...v, monstruos:[...v.monstruos, { ...c, defensa:false, bocaAbajo:false }] };
        const sobre = riesgoSobreextension(ctx, c, { haceAlgo: haceAlgoAlEntrar || inf.rol==="removal",
                                                     letal: !!m.to_bp && letalEnBatalla(conEl) });
        if(exp("sobreextension") && sobre > 0.3){ p -= sobre; firme(IA.SELECT_SUMMON, i); por += ` (sobreextenderme: barrido ${Math.round(ctx.riesgoBarrido*100)}% y ya domino)`; }
      }
      /* ══ ROYAL MAGICAL LIBRARY SE INVOCA PARA CARGARLA ══
         E, 02-10 (Library FTK, dos rondas): «apenas ha jugado», «no sabe
         jugar su mazo». Colocaba la Library boca abajo, donde no recibe
         contadores. Se invoca boca arriba cuando hay mágicas que jugar ya
         (o Level Limit la pone a cubierto en defensa). */
      if(exp("library") && canon(c.nombre ?? "") === "Royal Magical Library"){
        const magias = (m.activates ?? []).filter(a => Number(a.location) === 2 && ((Number(db.get(a.code)?.type) || 0) & 0x2)).length;
        const limite = v.backrow.some(b => !b.bocaAbajo && canon(b.nombre ?? "") === "Level Limit - Area B");
        p = (magias >= 2 || limite) ? 5.0 : magias === 1 ? 2.2 : 1.0;
        por = `invocar Royal Magical Library (boca arriba carga contadores: ${magias} mágica(s) que jugar ya${limite ? ", y Level Limit la protege" : ""})`;
      }
      añadir(p, IA.SELECT_SUMMON, i, por);
    });

    (m.special_summons||[]).forEach((l,i)=>{
      const c = cartaDeLista(l), inf = infoDe(c);
      let p = 4.5 + atk(c)/1000, por = `inv. especial ${c.nombre}`;
      /* Una invocación especial es gratis en invocación normal, pero no en
         recursos: BLS y Chaos Sorcerer gastan combustible del cementerio y
         son el finisher. Si no quitan nada ahora ni dan letal, entran como
         un cuerpo más y les aplica la misma cuenta de sobreextensión. */
      if(ctx){
        /* ¿Quita algo QUE VALGA la carta? (Skilled Chaos: guardar el
           Sorcerer para lo que no se mata en combate —Airknight, TER—).
           Un objetivo que mis monstruos ya ganan en batalla no cuenta. */
        const blancos = v.monstruosRival.filter(x => inf.soloCaraArriba ? !x.bocaAbajo : true);
        const valeLaPena = x => x.bocaAbajo
          || !v.monstruos.some(mm => !mm.bocaAbajo && !mm.defensa && ganaCombate(mm, x))
          || valorCarta(x) >= 1.6;
        const quita = (inf.rol==="removal" || inf.rol==="bomba") && blancos.some(valeLaPena);
        const conEl = { ...v, monstruos:[...v.monstruos, { ...c, defensa:false, bocaAbajo:false }] };
        const letal = !!m.to_bp && letalEnBatalla(conEl);
        if(!quita && !letal){
          p = 3 + atk(c)/1000;                                    // un cuerpo, no una jugada
          /* Un Chaos es combustible del cementerio (LIGHT+DARK) que no
             vuelve: sin nada que valga su efecto ni letal, se guarda
             salvo que vaya por detrás y necesite forzar. */
          if(exp("guardarChaos") && ["removal","bomba"].includes(inf.rol) && !ctx.detras){
            p = Math.min(p, 0.6); firme(IA.SELECT_SPECIAL_SUMMON, i); por += " (guardo el Chaos: nada suyo vale su efecto y no hay letal)";
          }
          const sobre = riesgoSobreextension(ctx, c, {});
          if(exp("sobreextension") && sobre > 0.3){ p -= sobre; firme(IA.SELECT_SPECIAL_SUMMON, i); por += ` (sin nada que quitar ni letal: sobreextenderme, barrido ${Math.round(ctx.riesgoBarrido*100)}%)`; }
        } else por += letal ? " (con esto hay letal)" : " (quita algo al entrar)";
        /* ══ UN CHAOS CONTRA DOS TAPADAS ══
           E, 25-09 (Chaos Turbo, p1, T8): «con 2 cartas set por mi parte,
           invocar al Chaos es peligroso; normalmente te la juegas a perder
           el monstruo a backrow». Le hicieron Ring of Destruction. Con
           combustible para UNO solo (no hay otro par LIGHT+DARK) y dos o más
           tapadas sin leer, se espera a gastarle una (cebo, MST) salvo que
           haya letal o vaya muy por detrás. Con mi Jinzo boca arriba sus
           trampas no salen. */
        if(exp("chaosTapadas") && CHAOS_REUSO.has(canon(c.nombre ?? "")) && !letal && v.tapadasRival >= 2){
          const gy = v.cementerio.filter(x => (Number(x.datos?.type)||0) & 0x1);
          const nAtr = bit => gy.filter(x => (Number(x.datos?.attribute)||0) & bit).length;
          const pares = Math.min(nAtr(16), nAtr(32));
          const jinzo = v.monstruos.some(x => !x.bocaAbajo && canon(x.nombre ?? "") === "Jinzo");
          const muyDetras = v.lp.mio <= 2000 || (ctx.detras && ventaja(v) <= -3);
          if(pares <= 1 && !jinzo && !muyDetras){
            /* Por detrás se puede forzar (y a veces hay que hacerlo): solo
               pesa. Igualado o por delante, se guarda. */
            if(ctx.detras) p -= 1.0 + 0.5 * (v.tapadasRival - 1);
            else p = Math.min(p, 0.6);
            firme(IA.SELECT_SPECIAL_SUMMON, i);
            por += ` (un solo Chaos de combustible contra ${v.tapadasRival} tapadas: se espera a gastarle una)`;
          }
        }
      }
      añadir(p, IA.SELECT_SPECIAL_SUMMON, i, por);
    });

    /* 2. COLOCAR MONSTRUO boca abajo */
    (m.monster_sets||[]).forEach((l,i)=>{
      const c = cartaDeLista(l), inf = infoDe(c);
      let p = 1.6, por = `colocar ${c.nombre}`;
      if(inf.colocarPreferente) p += 1.6;               // los flip quieren ser colocados
      if(inf.prefiereSet) p += 1.4;                     // y estas todavía más
      /* `noColocar` era un -3.0 que los demás bonus se comían: colocar un
         Sinister Serpent sumaba +0.5 por ser pequeño, +0.6 por campo
         vacío y +1.4 por haber algo más grande enfrente, y acababa en 1.1
         —por encima del umbral—. Para las cartas cuyo valor ES estar en la
         mano no hay matiz: no se colocan. */
      /* ══ …SALVO QUE HAGA FALTA UN MURO ══
         E, 26-09 (Zombie Goat Control, p1, T6): Vampire Lord y Kycoo
         enfrente, y la IA colocó un Asura Priest de muro teniendo Sangan
         en la mano. «Sangan se usa atacando» es cierto cuando puede
         atacar; delante de algo más grande, de frente solo regala daño y
         colocado cambia su muerte por una búsqueda. El riesgo de
         Nobleman lo tiene cualquier monstruo colocado, no solo él. */
      const hayQueTapar = exp("muroDeCara") && techoRival && atk(c) <= techoRival;
      if(inf.noColocar && !(exp("sanganColocado") && inf.rol === "floater"))
        p -= (nobleRiesgo && !hayQueTapar) ? 3.0 : 0.6;   // Sangan muere a Nobleman (si lo tiene)
      /* ══ LO QUE VALE BOCA ARRIBA NO SE PONE DE MURO ══
         La misma partida, y la R1 p2 T3: Asura Priest colocado. Un
         espíritu que no hace nada al voltearse vale por lo que hace de
         cara (1700 que atacan a todo y vuelven a la mano); colocado es un
         muro de 1200 que muere. Lo mismo Rescue Cat (su efecto pide que
         esté boca arriba): en la ronda 2 la IA la colocó tres veces. */
      if(exp("muroDeCara") && ((inf.espiritu && !inf.efectoAlInvocar)
          || /send this face-up card/i.test(names[c.code]?.desc ?? ""))){
        p -= 1.2; por += " (su valor es boca arriba: colocada es un muro que muere)";
      }
      if(exp("material") && inf.soloMaterial) p -= 6;   // Thunder Dragon: ni de cara ni tapado
      /* ══ MAGICIAN OF FAITH, CUANDO HAY QUÉ RECUPERAR ══
         Replays de torneo (101, 01-10): los jugadores la colocan con una
         mágica ya en su cementerio en 182 de 191 casos. Sin nada que
         recuperar, su volteo no hace nada y es un muro de 400; la IA la
         colocaba en el 26 % de sus turnos 1, con el cementerio vacío.
         Si este turno juego antes una mágica (Pot, Graceful…), la
         siguiente pregunta ya la ve en el cementerio. */
      if(exp("mofConMagia") && canon(c.nombre ?? "") === "Magician of Faith"
         && !v.cementerio.some(x => (Number(x.datos?.type) || 0) & 0x2)){
        p = Math.min(p, 0.6); firme(IA.SELECT_MONSTER_SET, i); por += " (no hay ninguna mágica en mi cementerio: su volteo no recuperaría nada)";
      }
      /* ══ NO SE TRIBUTA PARA PONER UN MURO QUE MUERE IGUAL ══
         E, 19-09 (Emissary, p1): Call of the Haunted para sacar un Sonic
         Duck, tributarlo y COLOCAR un Airknight (1400 de defensa) delante
         de un Ryu Kokki de 2400. Tres cartas por parar un ataque. Un
         monstruo de nivel 5-6 colocado solo vale su defensa, y si lo que
         ya tiene el rival lo rompe, el tributo no compra nada. */
      const nivelSet = Number(c.datos?.level ?? 0) & 0xff;
      const esVolteo = inf.rol==="flip" || inf.colocarPreferente || ((c.datos?.type ?? 0) & 0x200000);
      const suTecho = Math.max(0, ...v.monstruosRival.filter(x=>!x.bocaAbajo && !esFicha(x)).map(x=>atk(x)));
      if(exp("tributoMuro") && nivelSet >= 5 && !esVolteo && def(c) < suTecho){
        p -= 5; por += ` (tributar para un muro de ${def(c)} que su ${suTecho} rompe igual)`;
      }
      /* ══ COLOCAR UN NIVEL 5-6 TAMBIÉN TRIBUTA ══
         E, 02-10 (Goat Control, p3, T5): la IA tributó su Thousand-Eyes
         Restrict (tumbado por Book of Moon, que el turno siguiente se
         volteaba y absorbía otra vez) para COLOCAR un Airknight: 1400 de
         defensa que Kycoo se comió al turno siguiente. Las fichas de
         Scapegoat no se pueden tributar para una invocación por tributo,
         así que el tributo era el TER. Colocado, lo que entra solo vale su
         defensa: se cobra lo que se entrega. */
      if(exp("fichasNoTributo") && nivelSet >= 5 && !esVolteo){
        const cuantos = nivelSet >= 7 ? 2 : 1;
        const cands = v.monstruos.filter(x => !noSeTributa(x))
          .sort((a,b)=> (valorCarta(a)+poder(a)/2000) - (valorCarta(b)+poder(b)/2000)).slice(0, cuantos);
        const entrego = cands.reduce((t,x)=> t + valorCarta(x) + poder(x)/2200, 0) + 0.8 * cands.length;
        const entra = valorCarta(c) * 0.5 + def(c) / 2200;
        if(entrego > entra){ p -= 1.0 + (entrego - entra) * 1.6; firme(IA.SELECT_MONSTER_SET, i);
          por += ` (colocarlo cuesta ${cands.map(x=>x.nombre).join(" y ")}: boca abajo solo vale su defensa)`; }
      }
      if(atk(c) < 1400) p += 0.5;
      if(v.monstruos.length===0) p += 0.6;
      // el que gana alargando pone muros, no atacantes
      if(exp("planColocar") && PLAN.aguanta) p += 1.2 + (def(c) >= 1700 ? 0.8 : 0);
      // si enfrente hay algo más grande, colocarla es lo correcto
      if(techoRival && atk(c) <= techoRival) p += 1.4;
      /* AL FINAL, y pisando todo lo anterior: para las cartas cuyo valor
         ES estar en la mano no hay matiz que valga. Puesto arriba como un
         `p = 0.05`, los bonus de después lo levantaban otra vez hasta 2.55
         —pequeña, campo vacío, algo grande enfrente— y el bot colocaba su
         Sinister Serpent igual. Lo cazó el banco de posiciones. */
      if(inf.rol==="recurso"){
        /* ══ …SALVO DE MURO CON EL CAMPO VACÍO ══
           Replays del GFCEU 2026: los jugadores bajan Sinister Serpent 55
           veces y lo COLOCAN 45, sobre todo con su campo vacío. Si lo
           destruyen vuelve a la mano en mi Standby: es un bloqueo gratis
           cada turno. Lo justo por encima del umbral, para que cualquier
           otro monstruo que colocar vaya antes. */
        /* Contra un monstruo que PERFORA (Airknight Parshath: 1650 de daño
           y roba) el muro de 250 es peor que nada: ahí se queda en la mano. */
        if(exp("serpentMuro") && canon(c.nombre) === "Sinister Serpent" && v.monstruos.length === 0
           && !v.monstruosRival.some(x => !x.bocaAbajo && (infoDe(x).perfora || /piercing|inflict piercing|difference as Battle Damage/i.test(names[x.code]?.desc ?? "")))){
          p = 0.95; por += " (de muro: si lo destruyen vuelve a la mano)";
        } else { p = 0.05; por += " (vale más en la mano)"; }
      }
      /* Breaker colocado no recibe su contador (solo al invocarlo de
         Normal): «así pierde el efecto». Si no sale de frente, se guarda. */
      if(exp("breakerRompe") && inf.rompeBackrow){
        p = Math.min(p, 0.4); por += " (colocado pierde el contador: de frente o en la mano)";
      }
      if(exp("library") && canon(c.nombre ?? "") === "Royal Magical Library"){
        p = 0.05; firme(IA.SELECT_MONSTER_SET, i); por = "colocar Royal Magical Library (boca abajo no carga contadores)";
      }
      añadir(p, IA.SELECT_MONSTER_SET, i, por);
    });

    /* 3. ACTIVAR MAGIA/TRAMPA: aquí vive casi todo el criterio */
    (m.activates||[]).forEach((l,i)=>{
      const c = cartaDeLista(l), inf = infoDe(c), nom = canon(c.nombre);
      let p = 1.0, por = `activar ${c.nombre}`;
      if(negadaPorDecreto(v, c)){
        añadir(0.02, IA.SELECT_ACTIVATE, i, `${por} (Royal Decree la niega)`);
        return;
      }
      if(exp("atadura") && ataduraSinBlanco(v, c)){
        añadir(0.02, IA.SELECT_ACTIVATE, i, `${por} (todo lo suyo ya está atado por otra igual)`);
        return;
      }
      /* ══ LA ATADURA ES PARA LO QUE ME GANA ══
         E, 03-10 (Reino, Weevil, T14): «Spellbinding Circle a mi monstruo
         pequeño no aporta nada». Ató un Baby Dragon de 1200 delante de su
         Neo Bug y su Insect Knight, que ya le ganaban. En la cadena ya se
         guardaba «para un atacante de 1700 o más»; desde la Main Phase no
         había regla y la leía por su texto. */
      if(exp("ataduraAmenaza") && ATADURAS.has(nom)){
        const libres = v.monstruosRival.filter(r => !r.bocaAbajo && !esFicha(r) && !r.atado);
        const mx = Math.max(0, ...v.monstruos.filter(x => !x.bocaAbajo && !x.defensa).map(x => atk(x)));
        const peligro = libres.filter(r => atkEnCombate(r, v.lp.rival) >= 1700 || atkEnCombate(r, v.lp.rival) > mx);
        if(!peligro.length){
          añadir(0.3, IA.SELECT_ACTIVATE, i, `${por} (nada suyo me gana: la guardo para algo que pegue)`);
          firme(IA.SELECT_ACTIVATE, i);
          return;
        }
      }
      if(exp("library")){
        const lib = libreriaFTK(v, l, c, nom);
        if(lib){
          if(lib.firme) firme(IA.SELECT_ACTIVATE, i);
          if(lib.seguro) seguro(IA.SELECT_ACTIVATE, i);
          añadir(lib.p, IA.SELECT_ACTIVATE, i, `${por} (${lib.por})`);
          return;
        }
      }
      /* `vetado` = "esta carta no consigue NADA aquí", que es distinto de
         "vale poco": una carta vetada no puede resucitar porque la postura
         del turno le sume puntos. Sin esta distinción, el +1.2 a la
         remoción de cuando vas por detrás resucitaba justo las jugadas que
         acabábamos de prohibir: gastar el Smashing Ground en un muro. */
      let vetado = false;
      let despeja = false;          // la jugada despeja el ataque de este turno (contexto)

      /* ══ CON LETAL EN LA MESA, NO SE RENUNCIA AL ATAQUE ══
         Guía, caso C29 (P05) y P22: Black Luster Soldier y Chaos Sorcerer
         pueden desterrar con su efecto, pero entonces ese turno no atacan.
         El bot lo hacía por rutina —«quito un monstruo sin arriesgar la
         batalla»— teniendo el duelo ganado atacando: 2000 al monstruo y
         3000 directos contra 5000. Si la batalla que se ve ya gana, el
         efecto que la impide no se activa. */
      if(exp("letal") && inf.noAtacaTrasEfecto && Number(l.location) === 4
         && m.to_bp && v.turnoMio && letalEnBatalla(v)){
        añadir(0.05, IA.SELECT_ACTIVATE, i, `${por} (atacando gano ya: el efecto me quita el ataque)`);
        return;
      }
      /* LO QUE INVOCA YA ESTÁ EN EL CAMPO. Reportado en Reddit: el bot
         reanimó Hand of Nephthys teniendo ya el Sacred Phoenix fuera y
         tributó dos monstruos suyos para no conseguir nada. Vale para
         cualquier carta con `invoca`: si eso ya está puesto, o si no queda
         ninguna copia en el mazo, el efecto no hace nada. */
      if(n>=1 && inf.invoca){
        const yaEstá = v.monstruos.some(x=>canon(x.nombre)===inf.invoca);
        const quedan = quedanEnMazo(v, inf.invoca)
                     + v.extra.filter(x=>canon(x.nombre)===inf.invoca).length;
        if(yaEstá || !quedan){
          añadir(0.02, IA.SELECT_ACTIVATE, i,
                 `${por} (${yaEstá ? inf.invoca+" ya está en el campo"
                                   : "no queda ningún "+inf.invoca})`);
          return;
        }
      }

      /* ══ SISTEMA I · LA SEGUNDA COPIA NO APILA, SE COME A LA PRIMERA ══
         E, log 20-00-27 T2: «juega un segundo Harpie's Hunting Ground,
         debería quedarse uno en la mano». Un campo sustituye al campo
         que ya había, así que activar el segundo destruye el primero y
         el tablero se queda EXACTAMENTE igual con una carta menos. Lo
         mismo pasa con cualquier continua cuyo efecto ya esté puesto:
         dos Royal Decree no anulan más que una.

         Es la misma familia que `invoca` de aquí arriba —"si eso ya
         está, el efecto no hace nada"— y por eso va al lado y con la
         misma nota de 0.02: la carta no se prohíbe, se manda al final
         de la lista. Si de verdad no hay nada mejor que hacer, que la
         juegue. */
      /* Los CAMPOS salen del tipo de la carta, no de `knowledge.js`:
         Harpie's Hunting Ground no está escrita a mano (es una de las
         1.576 que caen en `lectura.js`) y era justo la del reporte. Un
         campo sustituye al anterior por regla del juego, así que esto
         vale para los 1.685 sin escribir una línea por carta.
         Los muros y los candados sí van por rol, uno a uno y
         comprobados: dos Royal Decree o dos Gravity Bind no hacen más
         que uno. Las continuas en general NO entran aquí — dos
         Wave-Motion Cannon sí suman, cada una con su cuenta. */
      const esCampo = ((Number(c.datos?.type) || 0) & 0x80000) !== 0;
      /* SOLO DESDE LA MANO. Una carta que YA está en el campo activando
         su propio efecto se encontraría a sí misma en la lista y se
         vetaría: pasó con Thousand-Eyes Restrict, que es `lock` y vive
         en el campo — el banco se puso rojo al instante. Lo que esta
         regla mira es "voy a jugar una segunda copia", y eso solo puede
         venir de la mano. */
      const desdeMano = Number(l.location) === 2;   // LOCATION_HAND
      if(n>=1 && desdeMano &&
         (esCampo || inf.rol==="campo" || inf.rol==="muroGlobal" || inf.rol==="lock")){
        const mismaFuera = [...v.backrow, ...v.monstruos]
          .some(x => !x.bocaAbajo && x.uid !== c.uid && x.nombre && canon(x.nombre) === nom);
        if(mismaFuera){
          añadir(0.02, IA.SELECT_ACTIVATE, i,
                 `${por} (ya tengo un ${c.nombre} en el campo: la segunda no apila)`);
          return;
        }
      }

      /* ══ EL MOTOR DE PACMAN: VOLTEAR Y RE-TAPAR ══
         E, 25-09: «en PACMAN se voltean los monstruos para usar su efecto y
         después se vuelven a poner boca abajo con su propio efecto; la IA no
         usa los efectos que puede todos los turnos». Des Lacooda, Golem
         Sentry, Medusa Worm y los Swarm se re-tapan una vez por turno: de
         frente son 300-600 de papel, tapados son el volteo del turno que
         viene. Se re-tapa en la Main Phase 2 (ya no va a atacar) o en la 1
         si atacar no le saca nada. */
      if(exp("reTapa") && inf.reTapa && Number(l.location) === 4){
        const yoMismo = v.monstruos.find(x => x.uid === c.uid) ?? null;
        const enMain2 = v.fase === 0x100;
        const pegaAlgo = !!m.to_bp && yoMismo && !yoMismo.defensa && (v.monstruosRival.length === 0
          || v.monstruosRival.some(r => !r.bocaAbajo && ganaCombate(yoMismo, r, v.lp.rival)));
        /* Tapado es blanco de Nobleman of Crossout, que con un volteo se
           lleva TODAS las copias de los dos mazos. Si puede tenerlo, se
           re-tapa solo lo que de frente se come el golpe entero. */
        const deFrenteMuere = yoMismo && !yoMismo.bocaAbajo && !yoMismo.defensa
          && v.monstruosRival.some(r => !r.bocaAbajo && atk(r) > atk(yoMismo));
        const riesgoNoble = exp("reTapaNoble") && nobleRiesgo;
        if((enMain2 || (exp("reTapaMain1") && !pegaAlgo)) && (!riesgoNoble || deFrenteMuere)){
          añadir(enMain2 ? 2.6 : 2.0, IA.SELECT_ACTIVATE, i, `${por} (re-tapo el volteo para usarlo otra vez)`);
          return;
        }
        añadir(0.3, IA.SELECT_ACTIVATE, i, `${por} (primero pega; se re-tapa en la Main Phase 2)`);
        return;
      }
      /* ══ SISTEMA C, EN LA MAIN PHASE ══
         Una trampa colocada se puede activar en tu propio turno, y el bot
         lo hacía: en el log de E, «activar Waboku» en su Main Phase 1 con
         puntos 2.2. Waboku anula daño de batalla; en tu turno no hay
         ningún ataque que anular, así que la carta se tira a la basura.
         Estas dos familias SOLO valen en el turno del rival y por eso su
         sitio es la cadena, no la Main Phase. */
      if(inf.rol==="proteccionBatalla" || inf.rol==="quemaPorMonstruos"){
        añadir(0.02, IA.SELECT_ACTIVATE, i,
               `${por} (es reactiva: se guarda para el turno del rival)`);
        return;
      }

      switch(inf.rol){
        case "draw":
          p = 5.0;
          /* ══ CARD DESTRUCTION NO ROBA: CAMBIA LA MANO ══
             Medido (exp-terminar.mjs, 22-09): valía 5,0 como un Pot of
             Greed y la simulación la hundía (−12 frente a pasar). Cada uno
             tira su mano y roba lo mismo: yo pierdo la carta que activo y
             él rehace la suya. Vale si mi mano es mala, si el descarte
             llena el cementerio para un Chaos o si es el motor del mazo
             (Empty Jar); si no, no. */
          if(exp("cardDestruction") && nom === "Card Destruction" && !PLAN.esMotor(c.nombre)){
            const otras = [...v.mano]; const yoMisma = otras.findIndex(h => canon(h.nombre ?? "") === "Card Destruction");
            if(yoMisma >= 0) otras.splice(yoMisma, 1);
            const media = otras.length ? otras.reduce((t,h)=>t+valorCarta(h),0)/otras.length : 0;
            const chaosMano = otras.some(h => ["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer"].includes(canon(h.nombre ?? "")));
            p = 0.4 + (otras.length >= 2 && media < 1.0 ? 2.2 : 0) + (chaosMano ? 1.0 : 0)
                + (v.manoRival.cuantas >= 4 ? 0.4 : 0);
            por += media < 1.0 ? " (mi mano es mala: la cambio)" : " (no roba: tiro mi mano y él rehace la suya)";
            /* ══ NO SE TIRA EL CHAOS QUE YA SE PUEDE SACAR ══
               E, 25-09 (Chaos Turbo, p1, T10): con 4 LIGHT y 2 DARK en el
               cementerio y dos Chaos Sorcerer en la mano, Card Destruction
               los mandó al cementerio a los dos: la carta que gana la partida,
               tirada con el combustible ya puesto. El bono de «llena el
               cementerio» es para cuando el Chaos AÚN no se puede invocar. */
            if(exp("cdChaosVivo") && chaosMano){
              const gy = v.cementerio.filter(x => (Number(x.datos?.type)||0) & 0x1);
              const hayAtr = bit => gy.some(x => (Number(x.datos?.attribute)||0) & bit);
              if(hayAtr(16) && hayAtr(32)){
                p = Math.min(p, 0.1); vetado = true; firme(IA.SELECT_ACTIVATE, i);
                por += " (tiraría un Chaos que ya puedo invocar)";
              }
            }
          }
          if(exp("graceful") && nom==="Graceful Charity"){
            // solo +1 de verdad si hay descarte gratis
            const gratis = tieneEnMano(v,"Sinister Serpent") ||
                           v.mano.some(x=>rolDe(x)==="chatarra");
            p = gratis ? 5.5 : 0.4 + prisa*2.6;
            por += gratis ? " (hay descarte gratis)"
                          : (prisa>0.7 ? " (sin descarte ideal, pero hay prisa)"
                                       : " (sin descarte bueno: mejor esperar)");
          }
          break;
        case "handRip":
          p = 4.0;
          if(exp("handRip")){
            // Delinquent Duo se neutraliza con Sinister Serpent
            const serpienteFuera = rivalUso(v,"Sinister Serpent");
            const manoGrande = v.manoRival.cuantas >= 4;
            p = serpienteFuera ? 4.6 : (manoGrande && v.turno<=2 ? 3.4 : 2.2 + prisa*1.5);
            /* Delinquent Duo: «descarta 1 al azar y, si le quedan, otra a su
               elección». Con UNA carta en su mano es un 1-por-1 que además
               cuesta 1000 LP: se guarda salvo que no quede futuro (topdeck)
               o que esa carta sea la que me gana la partida. Con ninguna, nada. */
            if(exp("duoCuenta")){
              const suMano = v.manoRival.cuantas;
              if(suMano === 0){ p = 0.05; vetado = true; por += " (no tiene mano)"; }
              else if(suMano === 1 && ctx?.fase !== "topdeck"){ p = Math.min(p, 0.6); firme(IA.SELECT_ACTIVATE, i); por += " (con una sola carta es 1-por-1 pagando 1000)"; }
            }
            /* ══ LOS 1000 DE DUO PUEDEN SER LA PARTIDA ══
               C.G., «How 2 Duo 2 (The ReDuo)»: a 3000 o menos y sin haber
               visto su Ring of Destruction, dudar; con el campo abierto y
               un monstruo suyo enfrente, no. Ring sobre su beater más un
               Chaos o un Airknight rematan. Regla: si tras pagar me mata
               lo que ya tiene boca arriba más un Ring, se guarda. */
            if(exp("duoVida")){
              const tras = v.lp.mio - 1000;
              const suGolpe = v.monstruosRival.filter(x=>!x.bocaAbajo && !x.defensa).reduce((t,x)=>t+atk(x), 0);
              const sinRing = !rivalUso(v, "Ring of Destruction");
              const abierto = !v.monstruos.some(x => !esFicha(x));
              if(v.lp.mio <= 3000 && abierto && suGolpe > 0 && sinRing && tras <= suGolpe + Math.max(0, ...v.monstruosRival.map(x=>atk(x)))){
                p = Math.min(p, 0.5); vetado = true; firme(IA.SELECT_ACTIVATE, i);
                por += ` (a ${v.lp.mio} con el campo abierto: pagar 1000 me deja a tiro de Ring más su ${suGolpe})`;
              }
            }
          }
          break;
        case "removal": {
          /* ══ TRIBE-INFECTING VIRUS: UN TIPO, NO UN OBJETIVO ══
             Se trataba como remoción de un objetivo («lo más valioso»), y
             el tipo lo declaraba el piloto genérico: el primero de la
             lista. Destruye TODO lo boca arriba de un tipo, de los dos
             lados, y cuesta un monstruo de la mano. Vale lo que se lleva
             suyo menos lo que se lleva mío menos el descarte. */
          if(exp("tiv") && nom === "Tribe-Infecting Virus" && Number(l.location) === 4){
            const t = mejorTipoTIV(v, c.uid);
            const descartes = v.mano.filter(h => (Number(h.datos?.type) || 0) & 0x1);
            const coste = descartes.length ? Math.min(...descartes.map(h => canon(h.nombre ?? "") === "Sinister Serpent" ? 0.1 : valorCarta(h))) : 9;
            const neto = t ? t.gana - t.pierde - coste * 0.6 : -1;
            if(!t || neto <= 0.2){ p = 0.1; vetado = true; por += ` (ningún tipo compensa el descarte)`; break; }
            p = 1.6 + neto * 1.8;
            if(t.dejaVacio && m.to_bp) p += 1.0;
            por += ` (declaro ${t.nombre}: me llevo ${t.suyos} suyo${t.suyos === 1 ? "" : "s"}${t.mios ? ` y pierdo ${t.mios}` : ""})`;
            break;
          }
          const objetivo = inf.soloCaraArriba
            ? (v.monstruosRival.some(c2=>!c2.bocaAbajo) ? amenazaMayor({ ...v, monstruosRival: v.monstruosRival.filter(c2=>!c2.bocaAbajo) }) : null)
            : amenazaMayor(v);
          if(!objetivo){ p = 0.2; vetado = true;
            por += inf.soloCaraArriba ? " (nada suyo boca arriba: el único objetivo sería mío)" : " (sin objetivo)"; break; }
          /* Ni fichas ni muros. Volar una ficha de Scapegoat con un
             Smashing Ground es cambiar una carta por nada, y un muro de
             2000 de defensa está ahí justamente para comerse la remoción
             que necesitas contra su monstruo de verdad. */
          if(exp("remocionUtil") && esFicha(objetivo)){
            p = 0.05; vetado = true; por += " (es una ficha: no vale una carta)"; break; }
          /* ══ UN RECLUTADOR NO SE DESTRUYE CON UNA CARTA ══
             E, 19-09 (Cat Control, p2): Ring of Destruction a un Sangan. Al
             morir, Sangan le busca otro monstruo: gasto una carta y él no
             pierde ninguna. Un floater pequeño se rodea o se mata en
             combate; la remoción es para lo que no se puede parar. */
          /* ══ …PERO EL QUE FLOTA SOLO EN COMBATE SE QUITA POR EFECTO ══
             E, 26-09 (Cat Control, p2, T2): «¿es mejor activar el efecto
             de Tribe-Infecting Virus para que no se dispare mi Giant Rat,
             que solo se activa si muere en batalla?». Sí: Giant Rat,
             Pyramid Turtle o Mystic Tomato solo sacan otro monstruo si
             mueren EN COMBATE. El Virus la mató atacando, salió una
             Pyramid Turtle, de ella un Ryu Kokki, y el Ryu Kokki se comió
             al Virus. Por efecto no sale nada, y el Virus pega directo. */
          const flotaBatalla = exp("floaterBatalla") && flotaEnCombate(objetivo);
          if(exp("remocionFloater") && rolDe(objetivo) === "floater" && poder(objetivo) < 1600 && !flotaBatalla
             && !(inf.rapida && v.lp.rival <= atk(objetivo))){
            p = 0.1; vetado = true; por += ` (${objetivo.nombre} se repone solo al morir: no vale una carta)`; break; }
          if(exp("remocionUtil") && esMuro(objetivo) && !v.monstruosRival.some(c2=>!c2.bocaAbajo && !c2.defensa)){
            p = 0.3; vetado = true; por += " (es un muro: se rodea, no se destruye)"; break; }
          // no gastes remoción en algo que matas en combate
          const puedoEnCombate = !flotaBatalla && n>=2 && v.monstruos.some(x=>!x.bocaAbajo && ganaCombate(x,objetivo));
          p = puedoEnCombate ? 0.6 : 3.2 + poder(objetivo)/1500;
          if(puedoEnCombate) por += " (lo mato en combate, no la gasto)";
          if(flotaBatalla){ p = 2.4 + poder(objetivo)/1500; por += ` (${objetivo.nombre} solo flota si muere en combate)`; }
          /* ══ DESTRUIR TAMBIÉN LE DA ══
             Guía §5.1 y P11: su monstruo muerto va a SU cementerio, y si
             es el atributo que le faltaba, acabo de pagarle medio Black
             Luster Soldier. Baja la nota; si aun así hace falta —porque
             esa amenaza gana la partida— el resto de la cuenta lo dice. */
          const regalo = exp("chaos") ? regalaChaos(v, objetivo) : 0;
          if(regalo){ p -= regalo; por += " (ojo: le completa el Chaos)"; }
          const jinzo = exp("jinzo") ? quitarJinzoLeAyuda(v, objetivo) : 0;
          if(jinzo){ p -= jinzo; por += " (su Jinzo le tiene apagadas más trampas a él que a mí)"; }
          if(exp("ring") && nom==="Ring of Destruction"){
            // Ring: para lo gordo o para rematar puntos de vida
            /* Ring of Destruction hace el daño a LOS DOS jugadores. Con
               "remata = sus LP <= ataque del objetivo" a secas, el bot se
               mataba a sí mismo: E lo vio suicidarse con ella al final de
               una partida. Solo remata si le mata a él Y NO a mí. */
            const golpe = poder(objetivo);
            const remata = v.lp.rival <= golpe && v.lp.mio > golpe;
            const meMata = v.lp.mio <= golpe;
            const noLoMato = !v.monstruos.some(x=>!x.bocaAbajo && ganaCombate(x,objetivo));
            p = remata ? 9.0
              : meMata ? 0.02
              : poder(objetivo)>=1700 ? 3.8
              : noLoMato ? 2.4 + prisa*1.6
              : 1.0 + prisa;
            if(remata) por += " (remata la partida)";
            if(meMata){ vetado = true; por += " (ese daño me mata a mí también)"; }
            /* Y si de todas formas lo mato en combate, la nota de arriba ya
               decía 0.6 y esta rama la pisaba: el log ponía "lo mato en
               combate, no la gasto" y acto seguido la gastaba. */
            if(!remata && puedoEnCombate){ p = Math.min(p, 0.6); vetado = true; }
          }
          if(n>=2 && nom==="Nobleman of Crossout"){
            const hayTapado = v.monstruosRival.some(c2=>c2.bocaAbajo);
            p = hayTapado ? 4.2 : 0.1;
          }
          // si abre el camino a la victoria, no hay nada mejor que hacer
          if(exp("remate") && remate){ p = 9.5; por += " (le abre el camino: es letal)"; }
          break;
        }
        case "spellRemoval": {
          const objetivos = v.backrowRival.length;
          if(!objetivos){ p = 0.1; break; }
          if(exp("mst")){
            // MST se guarda para equipos y reanimaciones
            const hayJugoso = v.backrowRival.some(c2=>!c2.bocaAbajo &&
              ["equipSteal","revival"].includes(rolDe(c2)));
            p = hayJugoso ? 5.0 : 0.8 + prisa*2.0;
            por += hayJugoso ? " (sobre un equipo/reanimación)" : " (no la malgasto en tapadas)";
            /* ══ SIMPLIFICAR / DESPEJAR EL ATAQUE (contexto) ══
               Principio (Why You Should Play Goat Control; Who's the
               Beatdown?): por delante, cambiar 1-por-1 amplía la ventaja
               relativa; y antes de atacar con la pieza que gana, quitar
               la única respuesta que puede tener. Con una o dos tapadas y
               un atacante que ya domina, la MST vale más ahora que
               guardada, y más cuanto menos futuro queda. */
            if(!hayJugoso && ctx && exp("simplificar") && v.fase === 0x4 && m.to_bp && ctx.dominio
               && ctx.tapadas >= 1 && ctx.tapadas <= 2
               && (ctx.simplificar || ctx.fase === "final" || ctx.fase === "topdeck")){
              p = Math.max(p, 3.2); despeja = true;
              por += ` (quito su respuesta antes de atacar: ${ctx.simplificar ? "voy por delante, simplifico" : "queda poco futuro"})`;
            }
          } else p = 2.2;
          break;
        }
        case "massRemoval": {
          const suyas = v.backrowRival.length, mias = v.backrow.length;
          /* Heavy Storm destruye TODO el backrow, también el tuyo, y hay
             dos cartas cuyo destrozo es peor que perder una carta: Snatch
             Steal boca arriba (el monstruo robado se vuelve con su dueño)
             y una reanimación boca arriba (el monstruo que sostiene se
             muere con ella). Un jugador reportó exactamente esto: el bot
             se voló su propio Snatch Steal y le devolvió el monstruo.
             Con una de esas puesta, la tormenta se guarda. */
          /* Y tampoco puede volarse lo que SOSTIENE su propio plan: la
             Wave-Motion Cannon del mazo de Burn, el Necrovalley del de
             Gravekeeper, el Gravity Bind de PACMAN. Sin esa carta en el
             campo, ese mazo no tiene plan. */
          const sostiene = v.backrow.filter(c2=>!c2.bocaAbajo &&
              (["equipSteal","revival"].includes(rolDe(c2)) || PLAN.sostiene(c2.nombre)));
          if(n>=1 && sostiene.length){
            p = 0.05; vetado = true;
            por += ` (me devolvería lo que sostiene ${sostiene[0].nombre})`;
            break;
          }
          /* ══ UNA TORMENTA ES UN BALANCE, NO UNA CUENTA DE CARTAS ══
             Esto miraba CUÁNTAS cartas hay a cada lado y, con n<2, bastaba
             con que el rival tuviera una para puntuar 3.0. En el log de E,
             Pegasus activó Heavy Storm con tres mágicas suyas colocadas y
             se voló su propio backrow entero.

             Lo que hay que comparar es VALOR, no número:

                valor del backrow rival que se destruye
              − valor del backrow propio que se destruye
              + lo que la jugada habilita después

             Una tapada del rival vale su incógnita —puede ser Mirror
             Force— pero una tapada PROPIA vale lo que vale de verdad,
             porque sé cuál es. Y lo que ya está gastado —una Premature o
             una Call cuyo monstruo ya no está— casi no cuesta nada:
             volarlas es de las pocas razones buenas para la tormenta. */
          const valorDeMias = v.backrow.reduce((t, c2) => {
            const rol = rolDe(c2);
            /* Un equipo/reanimación cuyo monstruo ya no está en el campo
               es papel: destruirla no cuesta nada. */
            const gastada = ["equipSteal","revival"].includes(rol)
                            && !v.monstruos.some(m => m.equipadaPor === c2.uid);
            return t + (gastada ? 0.1 : Math.max(0.4, valorCarta(c2)));
          }, 0);
          /* Las del rival: si están boca abajo no sé cuáles son, así que
             valen la media de una trampa de Goat. Boca arriba, su valor. */
          const valorDeSuyas = v.backrowRival.reduce((t, c2) =>
            t + (c2.bocaAbajo ? 1.5 : Math.max(0.8, valorCarta(c2))), 0);
          const balance = valorDeSuyas - valorDeMias;
          /* Lo que habilita: si limpiando el camino puedo invocar y
             atacar, la tormenta vale más que la suma de las cartas. */
          const habilita = (puedoInvocar && suyas >= 2) ? 0.9 : 0;

          if(balance <= 0){
            /* Destruyo más valor mío que suyo: no se activa. Es el caso
               del log, y no hay prisa que lo justifique. */
            p = 0.05; vetado = true;
            por += ` (me destruye ${valorDeMias.toFixed(1)} de valor propio`
                 + ` contra ${valorDeSuyas.toFixed(1)} suyo)`;
            break;
          }
          p = 0.6 + balance * 1.1 + habilita;
          por += ` (balance +${balance.toFixed(1)}: ${valorDeSuyas.toFixed(1)} suyo`
               + ` contra ${valorDeMias.toFixed(1)} mío)`;
          /* Con el campo vacío y sin nada que rematar, sigue sin correr
             prisa: la tormenta es mejor guardada para cuando hay dos o
             más cartas suyas puestas. */
          if(exp("masiva") && suyas < 2) p = Math.min(p, 0.5 + prisa * 0.6);
          break;
        }
        case "stall": {
          // Scapegoat bloquea tu propia invocación: no en tu turno
          p = (n>=2) ? 0.05 : 1.5;
          por += " (mejor encadenarla en el turno rival)";
          break;
        }
        case "revival": {
          const mejor = v.cementerio.filter(c2=>c2.datos?.type & 0x1)
                                    .sort((a,b)=>atk(b)-atk(a))[0];
          if(!mejor){ p = 0.1; break; }
          /* Reanimar un monstruo de 300 de ataque no es una jugada, es
             gastar una carta y 800 puntos de vida. Antes cualquier cosa en
             el cementerio valía 3.4 de salida, por encima del umbral. */
          p = exp("revivirFlojo")
              ? (atk(mejor)>=1700 ? 4.2 : atk(mejor)>=1400 ? 2.6 : 0.5) + atk(mejor)/2500
              : 3.4 + atk(mejor)/1400;
          if(n>=2 && inf.costeLP && v.lp.mio < 2000) p -= 2.0;
          if(exp("revivir") && v.tapadasRival>=2) p -= 1.0;      // te la responden
          /* ══ REVIVIR EN MI TURNO TIENE QUE HACER ALGO ══
             E, 19-09: Call of the Haunted en su propia Main Phase para
             sacar un Sonic Duck (1700) delante de un Ryu Kokki (2400): ni
             pega ni aguanta, y acabó de tributo para un muro. Lo que sale
             tiene que ganar un combate (o pegar directo), o ser el tributo
             de algo de la mano que sí lo gane. Si no, la trampa se queda
             puesta: en SU turno es un bloqueo por sorpresa. */
          if(exp("revivirUtil") && v.turnoMio){
            const techo = Math.max(0, ...v.monstruosRival.filter(x=>!x.bocaAbajo && !esFicha(x)).map(x=>atk(x)));
            /* E, 02-10 (Zombie, p1, T4): Call of the Haunted en la Main
               Phase 2 —«¿por qué no en la Battle Phase? te da un ataque
               más»—. Sin batalla por delante, lo que sale no pega este turno
               y queda expuesto a todo su turno: se guarda para su End Phase
               o para mi próxima entrada en batalla (ver `callTurnoRival`). */
            const pega = (!exp("callTurnoRival") || !!m.to_bp) && (v.monstruosRival.length === 0 || atk(mejor) > techo);
            const tributoUtil = v.mano.some(h => ((h.datos?.type ?? 0) & 0x1)
                                && [5,6].includes(Number(h.datos?.level ?? 0) & 0xff) && atk(h) > techo);
            if(!pega && !tributoUtil){
              p = Math.min(p, esTrampa(c) ? 0.1 : 0.5);
              por += ` (${mejor.nombre} no gana nada ahí: se guarda)`;
            }
          }
          break;
        }
        case "equipSteal": {
          /* EL CASO QUE REPORTÓ E: Snatch Steal sobre una ficha de
             Scapegoat. La ficha tiene 0 de ataque; robarla no cambia el
             marcador, no gana la partida y quema la mejor carta del mazo.
             El motivo era tonto: `amenazaMayor` devolvía la ficha porque
             era lo único boca arriba, y el valor no se miraba.
             La regla del formato es la contraria: Snatch Steal se guarda
             para el Airknight o el Black Luster Soldier. */
          const objetivo = objetivoDeRobo(v);
          if(!objetivo){
            p = 0.05; vetado = true; por += " (solo fichas o tapadas: robar eso no gana nada)"; break; }
          const decide = poder(objetivo) >= 1700 || valorCarta(objetivo) >= 1.6;
          p = decide ? 6.0 + poder(objetivo)/1200 : 1.0 + prisa*1.4;
          /* ══ «NO VALE LA SNATCH: LA GUARDO»… Y LA JUGABA ══
             E, 02-10 (Zombie, p1, T10): el log decía «Pyramid Turtle no
             vale la Snatch: la guardo» y la activó igual (la prisa la
             subía a 3,5). Y una Turtle robada que muere en combate va al
             cementerio de su DUEÑO y le saca a él un Ryu Kokki: fue lo que
             pasó. Un floater no se roba; lo demás, solo con prisa de verdad. */
          let snatchFloater = false;
          if(exp("snatchGuarda") && !decide){
            if(rolDe(objetivo) === "floater"){ p = 0.05; vetado = true; snatchFloater = true; firme(IA.SELECT_ACTIVATE, i); }
            else if(prisa < 1.2){ p = Math.min(p, 0.6); firme(IA.SELECT_ACTIVATE, i); }
          }
          /* ══ ROBAR PARA REMATAR ══
             «I Tested Giant Orc» (goatformat): Snatch Steal a su 1800 más
             un Giant Orc directo son 4000 justos, un letal habitual. Se
             cuenta con el robado en mi lado, fuera del suyo, y con el
             mejor monstruo que aún puedo invocar este turno. */
          if(exp("roboLetal") && m.to_bp && v.fase === 0x4){
            const mejorInvocable = (m.summons ?? []).map(cartaDeLista)
              .filter(c2 => (c2.datos?.level ?? 0) <= 4).sort((a,b)=>atk(b)-atk(a))[0];
            const vista2 = { ...v,
              monstruos: [...v.monstruos, { ...objetivo, bocaAbajo:false, defensa:false, yaAtaco:false },
                          ...(mejorInvocable ? [{ ...mejorInvocable, bocaAbajo:false, defensa:false }] : [])],
              monstruosRival: v.monstruosRival.filter(x => x.uid !== objetivo.uid) };
            if(letalEnBatalla(vista2)){ p = 9.0; vetado = false; snatchFloater = false; por = `activar ${c.nombre} (le robo ${objetivo.nombre}${mejorInvocable ? ` + ${mejorInvocable.nombre}` : ""}: letal)`; }
          }
          por += decide ? ` (le quito ${objetivo.nombre})`
                        : snatchFloater ? ` (${objetivo.nombre} es un floater: si muere, le saca otro a él)`
                        : ` (${objetivo.nombre} no vale la Snatch: la guardo)`;
          break;
        }
        case "prestamoMudo": {
          /* ══ UN PRÉSTAMO QUE NO PEGA SOLO VALE POR LO QUE DESTAPA ══
             Mind Control: el robado no ataca ni se tributa. E lo vio dos
             veces en la misma partida (Empty Jar, p2): en la Main Phase 1
             robó una Giant Rat y terminó el turno sin batalla, y en la
             Main Phase 2 robó un Vampire Lord con la batalla ya pasada.
             Vale si, quitándole ese monstruo de la mesa, mis atacantes
             rematan o pegan de verdad este turno. */
          objetivoPrestamo = null;
          if(!(m.to_bp && v.fase === 0x4)){
            p = 0.05; vetado = true; firme(IA.SELECT_ACTIVATE, i);
            por += " (sin batalla por delante: lo robado no ataca ni se tributa)"; break; }
          const mejorInvocable = (m.summons ?? []).map(cartaDeLista)
            .filter(c2 => (c2.datos?.level ?? 0) <= 4).sort((a,b)=>atk(b)-atk(a))[0];
          const atacantes = [...v.monstruos.filter(x => !x.bocaAbajo && !x.defensa && !x.yaAtaco && atk(x) > 0),
                             ...(mejorInvocable ? [{ ...mejorInvocable, bocaAbajo:false, defensa:false }] : [])];
          const base = dañoQueHago({ ...v, monstruos: atacantes });
          let mejor = null, gana = 0, letal = false;
          for(const x of v.monstruosRival){
            const v2 = { ...v, monstruos: atacantes, monstruosRival: v.monstruosRival.filter(y => y.uid !== x.uid) };
            if(letalEnBatalla(v2)){ mejor = x; letal = true; break; }
            const g = dañoQueHago(v2) - base;
            if(g > gana){ gana = g; mejor = x; }
          }
          if(letal){ p = 9.0; objetivoPrestamo = mejor.uid; por += ` (sin ${mejor.nombre ?? "su monstruo"} delante, es letal)`; break; }
          if(mejor && gana >= 1500){ p = 2.2 + gana/2000; objetivoPrestamo = mejor.uid;
            por += ` (quitándole ${mejor.nombre ?? "su monstruo"} pego ${gana} más)`; break; }
          p = 0.05; vetado = true; firme(IA.SELECT_ACTIVATE, i);
          por += " (quitarle un monstruo este turno no me abre ningún golpe)";
          break;
        }
        case "buscador": {
          /* Thunder Dragon. E lo vio descartar para buscar dos copias y
             luego activar esas dos con el mazo ya sin ninguna: tirar dos
             cartas a la basura. Ahora se cuenta lo que queda de verdad. */
          const quedan = quedanEnMazo(v, nom), hacenFalta = inf.necesitaCopias ?? 1;
          p = quedan >= hacenFalta ? 4.2 : 0.02;
          if(quedan < hacenFalta) vetado = true;
          /* ══ RESCUE CAT CON UN PLAN, O NO ══
             GitHub #17 (Cat Control, T1): sacó dos Gyaku-Gire Panda en el
             primer turno, sin batalla, y los dos murieron en la End Phase:
             tres cartas por nada. Sale a cuenta con The Wicked Worm Beast
             (vuelve a la mano en vez de morir), con batalla por delante o
             con algo que tributar (Metamorphosis, un monstruo grande). */
          if(exp("gatoConPlan") && nom === "Rescue Cat" && l.location === 4){
            const gusano = quedanEnMazo(v, "The Wicked Worm Beast") > 0;
            const batalla = !!m.to_bp;
            const tributo = v.mano.some(h => canon(h.nombre) === "Metamorphosis"
                                          || ((Number(h.datos?.type) || 0) & 0x1) && (Number(h.datos?.level) || 0) >= 5);
            if(!gusano && !batalla && !tributo){
              p = 0.05; vetado = true;
              por += " (sin Wicked Worm Beast, sin batalla y sin tributo: dos bestias que mueren en la End Phase)";
              break;
            }
          }
          /* E, 19-09 (Chaos Turbo, p1): «¿por qué descarta el segundo
             Thunder Dragon? mejor dejarlo en mano para descartar con otra
             cosa». Con UNA copia en el mazo, activarlo es cambiar una carta
             por otra igual. Si en la mano hay algo que pide descarte, el
             Thunder Dragon vale más ahí: es el descarte que no duele. */
          else if(exp("tdDescarte") && quedan === 1
                  && v.mano.some(h => ["Graceful Charity","Raigeki Break","Lightning Vortex","Tribe-Infecting Virus"]
                                      .includes(canon(h.nombre)))){
            p = 0.6; por += " (queda una sola: mejor guardarlo como descarte)";
          }
          por += quedan >= hacenFalta ? ` (quedan ${quedan} en el mazo)`
                                      : " (no queda ninguna en el mazo: no busca nada)";
          break;
        }
        case "quema": {
          /* Wave-Motion Cannon suma 1000 por turno que aguante puesta.
             Ponerla cuanto antes es el plan; cobrarla pronto es tirarla. */
          const enCampo = l.location === 8;
          if(!enCampo){ p = 5.2; por += " (a contar cuanto antes)"; break; }
          const remata = v.lp.rival <= 3000;
          p = remata ? 6.5 : 0.15;
          por += remata ? " (con esto llega)" : " (que siga sumando)";
          break;
        }
        case "muroGlobal": {
          // Level Limit, Gravity Bind: la carta del que gana alargando
          p = exp("murosGlobales") ? (PLAN.aguanta ? 6.0 : (v.monstruosRival.length > v.monstruos.length ? 2.6 : 0.4)) : 1.2;
          break;
        }
        case "stallGlobal": {
          p = (v.monstruosRival.length > v.monstruos.length || v.lp.mio < v.lp.rival) ? 4.5 : 1.0;
          break;
        }
        case "reloj": p = 9.0; break;      // Final Countdown ES la partida
        case "fusion": {
          /* LA JUGADA DEL FORMATO: ficha de Scapegoat → Metamorphosis →
             Thousand-Eyes Restrict, que absorbe el mejor monstruo del
             rival y deja el campo cerrado. Antes esto se puntuaba mirando
             solo si había un monstruo gordo enfrente, sin comprobar que
             hubiera material barato: el bot llegaba a sacrificar un
             Airknight para hacer un TER, que es cambiar una carta buena
             por otra y perder tempo.
             Lo que hace buena la jugada son las tres cosas a la vez:
             material que no cuesta nada, algo que absorber, y el TER
             realmente en el extra. */
          const rivalGordo = v.monstruosRival.filter(c2=>!c2.bocaAbajo)
                              .sort((a,b)=>poder(b)-poder(a))[0] ?? null;
          const barato = v.monstruos.filter(c2=>valorCarta(c2) <= 0.6 || atk(c2)===0);
          const absorbible = v.monstruosRival.some(c2=>!c2.bocaAbajo && !esFicha(c2));
          const hayTER = v.extra.some(c2=>canon(c2.nombre)==="Thousand-Eyes Restrict");
          /* ══ UN TER YA PUESTO BASTA ══
             E, 20-09 (Zombie, p1, T13): primer TER absorbió Ryu Kokki y
             un segundo Metamorphosis → TER absorbió a Kycoo. El segundo
             sobraba: el primero ya impide atacar a Kycoo (1800 contra un
             TER de 2000 que además lo mata en combate), y dos TER se
             bloquean entre sí los ataques. Solo compensa si lo que queda
             enfrente supera al TER que ya tengo. */
          const miTER = v.monstruos.filter(x => !x.bocaAbajo && canon(x.nombre)==="Thousand-Eyes Restrict")
                                    .sort((a,b)=>atk(b)-atk(a))[0] ?? null;
          /* Un TER recién sacado (0 de ATK) va a absorber lo más gordo:
             se mide con eso, y contra lo que QUEDA. Así fue el log: los
             dos Metamorphosis salieron antes de absorber nada. */
          const suyosArriba = v.monstruosRival.filter(x => !x.bocaAbajo && !esFicha(x)).sort((a,b)=>atk(b)-atk(a));
          const vaAAbsorber = miTER && atk(miTER) === 0 ? suyosArriba[0] ?? null : null;
          const atkTER = miTER ? (vaAAbsorber ? atk(vaAAbsorber) : atk(miTER)) : 0;
          const loSupera = miTER && suyosArriba.some(x => x !== vaAAbsorber && atk(x) > atkTER);
          if(exp("fusion")){
            /* Sin nada boca arriba que absorber no hay jugada, sea cual
               sea el material (R2 p1, T4: TER en defensa frente a una
               sola tapada; «solo material caro» dejaba 0,3 y la
               simulación lo resucitaba). */
            if(hayTER && !absorbible){ p = 0.1; vetado = true;
                   por += " (no hay nada boca arriba que absorber: el TER solo cierra mi campo)"; }
            else if(miTER && !loSupera){ p = 0.1; vetado = true;
                   por += ` (ya tengo un TER de ${atk(miTER)}: el segundo solo me bloquea)`; }
            else if(!barato.length){ p = 0.3; por += " (solo tengo material caro)"; }
            else if(rivalGordo && poder(rivalGordo)>=1500){
              p = 6.0; por += ` (ficha → TER y le quito ${rivalGordo.nombre})`;
            }
            else if(hayTER && absorbible){ p = 3.4; }
            /* SIN NADA BOCA ARRIBA ENFRENTE NO HAY JUGADA. E, partida 2:
               «la invocación de Thousand-Eyes Restrict sin nada en mi
               campo es algo extraña». Lo es: el TER no puede atacar y
               además impide atacar al resto, así que con el campo rival
               vacío la jugada solo cierra el campo PROPIO. Antes esto
               valía `1.0 + prisa`, por encima del umbral de jugar (0,8),
               o sea que se hacía siempre. Es el mismo agujero que ya se
               tapó en `case "lock"` para el efecto del propio TER. */
            else { p = 0.1; vetado = true;
                   por += " (no hay nada boca arriba que absorber: el TER solo cierra mi campo)"; }
          } else p = barato.length ? 3.0 : 1.2;
          /* ══ EL TER NO DEJA ATACAR A LOS MÍOS ══
             E, 19-09 (Emissary, p2): Airknight invocado, Metamorphosis →
             TER en la Main Phase 1 y el Airknight se quedó sin atacar:
             Thousand-Eyes Restrict impide declarar ataques a TODOS los
             demás monstruos, también los propios. Si tengo atacantes que
             sacan algo este turno, primero la batalla y el TER en la Main
             Phase 2. Si lo que hay que absorber es lo que para a mis
             atacantes, el TER va antes: eso ya lo dice `sacanAlgo`. */
          if(exp("terDespues") && v.fase === 0x4 && m.to_bp && p > 0.8){
            const atacantes = v.monstruos.filter(x => !x.bocaAbajo && !x.defensa && atk(x) > 0 && !esFicha(x));
            const sacanAlgo = atacantes.some(a => v.monstruosRival.length === 0
                              || v.monstruosRival.some(r => !r.bocaAbajo && ganaCombate(a, r)));
            if(sacanAlgo){ p = Math.min(p, 0.7);
              por += " (el TER no deja atacar a los míos: primero la batalla, luego la Main Phase 2)"; }
          }
          break;
        }
        case "cementerioHate": {
          /* ══ SOUL RELEASE VALE LO QUE HAYA QUE QUITARLE ══
             E, 18-09: «turno 1 el soul release no aporta nada». Destierra
             hasta cinco cartas de los cementerios, así que su valor es
             EXACTAMENTE lo que hay allí que le sirva al rival: un Chaos
             que revivir, el combustible LIGHT/DARK de otro, un Sinister
             Serpent que vuelve solo, algo gordo para un Premature. Con los
             cementerios vacíos es una carta tirada. */
          const gy = v.cementerioRival ?? [];
          const luz = gy.filter(c2 => (Number(c2.datos?.attribute)||0) & 16).length;
          const osc = gy.filter(c2 => (Number(c2.datos?.attribute)||0) & 32).length;
          const jugosas = gy.filter(c2 => {
            if(!((Number(c2.datos?.type)||0) & 0x1)) return false;      // monstruos
            const i2 = infoDe(c2);
            return i2.rol === "recurso" || i2.rol === "bomba" || valorCarta(c2) >= 1.4 || atk(c2) >= 1900;
          }).length;
          /* Si ya tiene LIGHT y DARK, dejárselos es dejarle el Chaos pagado. */
          const combustible = (luz && osc) ? Math.min(luz, osc) : 0;
          const quitar = jugosas + combustible;
          if(quitar === 0){ p = 0.05; vetado = true; por += " (no hay nada en su cementerio que le sirva)"; break; }
          p = quitar >= 3 ? 4.2 : quitar === 2 ? 3.2 : 1.6;
          por += ` (le quito ${quitar} cosa${quitar===1?"":"s"} que le sirven del cementerio)`;
          break;
        }
        case "swap": {
          /* Creature Swap con fichas en campo es robo puro: le das un
             cero y te llevas su monstruo. Sin ficha es un intercambio a
             ciegas que suele salir mal. */
          const ficha = v.monstruos.filter(c2=>valorCarta(c2) <= 0.2);
          const suyo  = v.monstruosRival.filter(c2=>!c2.bocaAbajo)
                          .sort((a,b)=>poder(b)-poder(a))[0] ?? null;
          if(exp("swapPeor")){
            /* ══ CREATURE SWAP: ÉL ELIGE LO QUE ME DA ══
               E, 02-10 (Zombie, p2, T24): «¿Creature Swap y me das tu
               Vampire Lord? vaya misplay». La IA tenía un solo monstruo
               —el Vampire Lord— y E le dio su Giant Rat tapada. Cada uno
               elige lo que entrega: yo el peor mío, él el peor suyo. Solo
               compensa si su peor vale claramente más que mi peor. */
            const precio = x => valorCarta(x) + ((x.bocaAbajo && !x.nombre) ? 0.6 : poder(x) / 2000);
            if(!v.monstruos.length || !v.monstruosRival.length){
              p = 0.05; vetado = true; por += " (hace falta un monstruo a cada lado)"; break; }
            const doy = Math.min(...v.monstruos.map(precio));
            const recibo = Math.min(...v.monstruosRival.map(precio));
            const gana = recibo - doy;
            if(gana >= 0.6){ p = 3.0 + gana; por += ` (le doy lo peor mío y su peor vale ${gana.toFixed(1)} más)`; }
            else { p = 0.05; vetado = true; firme(IA.SELECT_ACTIVATE, i);
                   por += " (él me daría lo peor que tiene: no compensa lo que entrego)"; }
            break;
          }
          if(!ficha.length || !suyo){ p = 0.2; por += " (sin ficha o sin nada que llevarme)"; }
          else p = 4.0 + poder(suyo)/1500;
          break;
        }
        case "trick": {
          /* Book of Moon y Enemy Controller son RÁPIDAS: su sitio es el
             turno del rival, cortando un ataque o apagando un efecto. En
             tu propio turno solo valen si desbloquean algo. Con el valor
             por defecto (1.2, por encima del umbral de 0.8) el bot las
             quemaba en cuanto no tenía nada mejor que hacer, y un jugador
             reportó verlo tumbar su propio Dekoichi recién invocado. */
          if(nom==="Book of Moon" || nom==="Enemy Controller"){
            // ¿hay un monstruo suyo que me frena y cuya DEFENSA sí supero?
            const desbloquea = v.monstruosRival.some(r=>!r.bocaAbajo && !esFicha(r) &&
              v.monstruos.some(y=>!y.bocaAbajo && !y.defensa &&
                                  atk(y) <= atk(r) && atk(y) > def(r)));
            p = desbloquea ? 2.8 : 0.05;
            por += desbloquea ? " (lo tumbo y le paso por encima)"
                              : " (rápida: se guarda para el turno rival)";
            /* En mi turno, Book of Moon a MI Chaos que ya desterró (vuelve
               su efecto) o a lo que robé con Snatch Steal (se queda). */
            if(exp("tsukPlan") && exp("tsukBom") && nom==="Book of Moon"){
              const obj = planTumbar(v, { fuente:"Book of Moon", conBatalla: !!m.to_bp && v.fase === 0x4 })
                            .find(o => v.monstruos.some(x => x.uid === o.uid) || /TER/.test(o.por));
              if(obj && obj.valor >= 2.4 && obj.valor > p){ p = obj.valor; por = `activar Book of Moon (${obj.por})`; }
            }
          } else if(nom==="Tsukuyomi"){
            /* Tsukuyomi vuelve a tu mano cada End Phase, así que la
               tentación es usarla todos los turnos: el escáner la contaba
               3,6 veces por partida. Solo vale si tumba algo que de verdad
               estorba —que aguante a mi mejor monstruo o que sea una carta
               fuerte—, no por girar al primero que vea. */
            const mejorMio = Math.max(0, ...v.monstruos.filter(x=>!x.bocaAbajo).map(x=>atk(x)));
            const estorba = v.monstruosRival.some(c2=>!c2.bocaAbajo && !esFicha(c2) &&
                              (atk(c2) >= mejorMio || valorCarta(c2) >= 1.4));
            p = estorba ? 3.2 : 0.05;
            if(!estorba) por += " (no hay nada boca arriba que estorbe)";
          } else p = 1.2;
          break;
        }
        case "invocador": {
          /* Cartas cuyo efecto pone en el campo un monstruo concreto
             (Hand of Nephthys → Sacred Phoenix). Lo que valen es lo que
             vale lo que sacan, menos lo que cuesta sacarlo. El lector de
             textos las dejaba justo en el umbral: "Tribute 2 monsters"
             es caro en general, pero no cuando lo que sale es un 2400
             que además vuelve solo cada End Phase. */
          const sale = inf.invoca ? { nombre: inf.invoca, datos:null } : null;
          p = sale ? 2.2 + valorCarta(sale) : 1.5;
          por += sale ? ` (saca ${inf.invoca})` : "";
          break;
        }
        /* Una carta que HABILITA a otras (Toon World). No hace nada
           sola, pero sin ella media baraja es papel. Se juega en cuanto
           hay algo que dependa de ella, y no antes: pagar 1000 puntos de
           vida sin tener un solo Toon en la mano es regalar el duelo. */
        case "habilita": {
          const marca = inf.habilita ?? "";
          /* Solo MONSTRUOS de esa familia. E, 02-10 (Library FTK, p2):
             Toon World pagando 1000 porque «Toon Table of Contents»
             empieza por Toon; esa es una mágica que no depende de nada. */
          const dependen = [...v.mano, ...v.monstruos].filter(x =>
            x.nombre && x.nombre.startsWith(marca + " ") && canon(x.nombre) !== nom
            && (!exp("library") || ((Number(x.datos?.type) || 0) & 0x1))).length;
          if(!dependen){ p = 0.25; vetado = true;
                         por += " (todavía no tengo nada que dependa de ella)"; break; }
          p = 4.0 + Math.min(dependen, 4) * 0.4;
          if(inf.costeLP && v.lp.mio <= inf.costeLP * 2){
            p = 0.3; vetado = true; por += " (no me queda vida para pagarla)"; break; }
          por += ` (habilita ${dependen} carta(s) de la mano)`;
          break;
        }
        case "lock": {
          /* Un 3.0 fijo y sin condición: es el mismo agujero que el
             `default`. Thousand-Eyes Restrict se activaba con el campo
             rival vacío o con solo tapadas, absorbía una tapada y se
             quedaba con 0 de ataque bloqueando su propio campo. E lo vio
             en dos partidas y preguntó si era stall o bug: era esto.
             Un candado necesita algo QUE ENCERRAR. */
          const absorbible = v.monstruosRival
            .filter(c2=>!c2.bocaAbajo && !esFicha(c2))
            .sort((a2,b2)=>poder(b2)-poder(a2))[0] ?? null;
          if(!absorbible){ p = 0.05; vetado = true;
                           por += " (no hay nada boca arriba que absorber)"; break; }
          p = 3.0 + poder(absorbible)/1600;
          por += ` (absorbe ${absorbible.nombre})`;
          /* ══ ABSORBER ANTES DE LA BATALLA SI EL TER PEGA ══
             E, 20-09 (Zombie, p2, T11): el TER se quedó con 0 de ataque
             en la Main Phase 1, fue a la batalla sin atacar y absorbió al
             Vampire Lord en la Main Phase 2. Absorberlo antes le daba 2000
             y se comía a la Pyramid Turtle de 1200. El candado es el mismo
             en la Main 1 que en la Main 2; lo que cambia es que el TER
             pueda atacar. La heurística ya lo elegía: la simulación lo
             cambió por ruido, así que esto va como SEGURO (no se discute). */
          if(exp("terAntes") && v.fase === 0x4 && m.to_bp && Number(l.location) === 4){
            const yo_ = duel.resolve(l, l.code);
            const deFrente = yo_ && !((yo_.position ?? 0) & 0x0e);
            const nuevo = atk(absorbible);
            const resto = v.monstruosRival.filter(x => x !== absorbible && !esFicha(x));
            const pega = resto.length === 0
              || resto.some(x => !x.bocaAbajo && (x.defensa ? def(x) : atk(x)) < nuevo);
            if(deFrente && nuevo > 0 && pega){
              p += 1.0; seguro(IA.SELECT_ACTIVATE, i);
              por += ` (antes de la batalla: con ${nuevo} ya puede pegar)`;
            }
          }
          /* Guía C22: absorber su Jinzo le devuelve sus trampas. */
          const jinzoTER = exp("jinzo") ? quitarJinzoLeAyuda(v, absorbible) : 0;
          if(jinzoTER){ p -= jinzoTER; por += " (ojo: sin Jinzo vuelven sus trampas)"; }
          break;
        }
        default: {
          /* ── EL ARREGLO QUE NO ERA UN PARCHE ──
             Aquí ponía `p = 1.2`, y el umbral para jugar una carta es
             0.8: la regla efectiva era "si no te suena la carta, juégala
             en cuanto puedas". Y no le suenan 1.576 de las 1.685 del
             pool, porque `knowledge.js` tiene 109 escritas a mano.
             De ahí salen, todos con la MISMA causa, el Breaker rompiendo
             una tapada cualquiera en vez del Premature Burial que
             sostenía un Jinzo, el Skull Lair sobre su propio monstruo y
             el Raigeki Break sobre lo suyo. No eran cuatro bugs.
             Ahora se lee el texto de la carta y, si no se puede
             justificar qué consigue, no se juega. Ver `lectura.js`. */
          const gordo = amenazaMayor(v);
          const leido = utilidadLeida(names[c.code]?.desc, c.datos, v, {
            objetivoBueno: (gordo && !esFicha(gordo)) ? gordo : null,
            lpRival: v.lp?.rival ?? 0,
            costeTributo: precioDelTributo(v, c),
            hayCadenaRival: !!(duel.cadena?.length &&
                               duel.cadena[duel.cadena.length-1].controller !== yo),
          });
          p = leido.p; por += ` (${leido.por})`;
          /* Un campo que sube a mis atacantes va ANTES de la batalla: si
             se juega después, el daño de este turno ya se ha perdido. La
             simulación lo veía igual (lo jugaba en la Main Phase 2) y lo
             dejaba para luego: es una regla, no una opinión. */
          if(leido.campoSube && m.to_bp && v.turnoMio){ p = Math.max(p, 2.0); seguro(IA.SELECT_ACTIVATE, i); por += " (antes de la batalla)"; }
          if(!p) vetado = true;
          break;
        }
      }
      /* ══ EXCAVAR CUESTA MAZO (Reasoning, Monster Gate) ══
         E, 25-09 (Reasoning Gate OTK, p1): «jugó muy bien la primera mesa
         que montó, pero se ha deckeado rápido». Turno 1: DMoC, Jinzo y
         Sacred Crane en mesa (sin Battle Phase), y aun así otro Reasoning
         con 13 cartas en el mazo (se fueron 8) y otro Monster Gate con 5.
         Acabó el turno con 3 cartas en el mazo y perdió por robar.
         Se estima lo que se va: con N cartas y K monstruos invocables de
         forma normal, el primero sale de media en la posición (N+1)/(K+1).
         Se cuenta con prudencia (×1.5) y se castiga dejar el mazo por debajo
         de 12; por debajo de 4, o sin monstruos que excavar, se veta. */
      /* ══ ROBAR TAMBIÉN CUESTA MAZO ══
         E, 26-09 (Empty Jar, p1): en el turno 7 la IA tenía 3 cartas en el
         mazo y E 10. Upstart, Pot, Reload, Spell Reproduction, Morphing
         Jar y Card Destruction le vaciaron SU mazo antes que el del rival,
         que era justo el plan al revés. Un robo solo mío no se juega si me
         deja por debajo de 3; uno que roban los dos (Card Destruction), si
         me deja con menos mazo que a él y por debajo de 8. */
      if(exp("robarMazo") && !vetado && v.turnoMio){
        const N = v.deckRestante ?? 99, NR = v.deckRestanteRival ?? 99;
        const robaYo = { "Pot of Greed":2, "Upstart Goblin":1, "Graceful Charity":3,
                         "Card Destruction": Math.max(0, v.mano.length - 1) }[nom] ?? 0;
        const robaEl = nom === "Card Destruction" ? (v.manoRival?.cuantas ?? 0) : 0;
        /* Con menos mazo del que roba, el motor ni la ofrece (Pot of Greed
           comprueba que puedas robar 2): si llega aquí así, el mazo no es
           el de verdad (tableros montados a mano) y no se puede juzgar. */
        if(robaYo > 0 && N >= robaYo){
          const quedo = N - robaYo, queda = NR - robaEl;
          const malo = robaEl > 0 ? (quedo < 8 && quedo <= queda) : quedo < 3;
          if(malo && !(robaEl > 0 && queda <= 0)){
            p = Math.min(p, 0.1); vetado = true; firme(IA.SELECT_ACTIVATE, i);
            por += ` (me deja ${quedo} en el mazo${robaEl ? ` y a él ${queda}` : ""})`;
          }
        }
      }
      if(exp("excavar") && inf.rol === "invocaDelMazo" && !vetado){
        const N = v.deckRestante;
        let K = 0;
        for(const [code, cu] of (v.mazo ?? new Map())){
          const t = Number(db.get(code)?.type) || 0;
          if((t & 0x1) && !(t & (0x40 | 0x80 | 0x2000 | 0x2000000 | 0x4000))) K += cu;
        }
        const seVan = (N + 1) / (K + 1);
        const queda = N - seVan * 1.5;
        if(K === 0 || queda < 4){
          p = Math.min(p, 0.1); vetado = true; firme(IA.SELECT_ACTIVATE, i);
          por += K === 0 ? " (no queda monstruo que excavar: se iría el mazo entero)"
                         : ` (excava ~${seVan.toFixed(0)} de ${N}: me deja sin mazo)`;
        } else if(queda < 12){
          p -= (12 - queda) * 0.4; firme(IA.SELECT_ACTIVATE, i);
          por += ` (excava ~${seVan.toFixed(0)} de ${N}: el mazo se me acaba)`;
        }
        /* Sin Battle Phase y con la mesa ya hecha, otro cuerpo no suma. */
        const fuertes = v.monstruos.filter(x => !esFicha(x) && atk(x) >= 2000).length;
        if(!m.to_bp && (fuertes >= 2 || v.monstruos.filter(x => !esFicha(x)).length >= 3)){
          p -= 1.2; firme(IA.SELECT_ACTIVATE, i); por += " (turno sin batalla y la mesa ya está hecha)";
        }
      }
      /* ══ BREAKER ROMPE ANTES DE PEGAR ══
         E, 19-09: «turno 5, ¿no usa el efecto de Breaker antes?». Lo usó
         en la Main Phase 2, después de atacar contra dos tapadas. Si va a
         haber batalla y el rival tiene algo puesto, se rompe primero: es
         lo que despeja el camino (Mirror Force, Sakuretsu, Waboku). */
      if(exp("breakerAntes") && inf.rompeBackrow && Number(l.location) === 4
         && m.to_bp && v.tapadasRival > 0 && v.turnoMio){
        p = Math.max(p, 1) + 3.0; vetado = false; por += " (romper su tapada antes de atacar)";
      }
      /* UNA COPIA BASTA. Wall of Revealing Light, Level Limit, Gravity
         Bind, Swords: son continuas cuyo efecto no se acumula. Poner la
         segunda es pagar dos veces por lo mismo y arriesgar dos cartas a
         un solo Heavy Storm; la buena se guarda en la mano hasta que
         destruyan la primera. E lo vio en la partida 9, pagando 1000 de
         vida dos veces por el mismo muro. */
      if(n>=1 && (inf.continua || inf.rol==="muroGlobal" || inf.rol==="stallGlobal")){
        const yaPuesta = v.backrow.some(c2=>!c2.bocaAbajo && canon(c2.nombre)===nom);
        if(yaPuesta){ p = 0.02; vetado = true; por += " (ya tengo una puesta)"; }
      }

      /* ── LA POSTURA MANDA ──
         La misma carta no vale lo mismo según para qué sea el turno. Un
         Smashing Ground es oro cuando vas por detrás y estorbo cuando lo
         que necesitas es cavar para encontrar tu pieza; un Pot of Greed es
         al revés. Antes todas las cartas se puntuaban igual siempre, que
         es exactamente el "juega cartas sin plan" que reportó E. */
      /* La misma regla en la Main Phase: la remoción puntual no se gasta
         en lo primero que aparece, y lo reactivo espera al turno rival. */
      if(exp("reservas") && !vetado && !despeja && p > 0.6){
        const guardo = decidirReserva(c, lectura(v),
          { esTurnoMio:true, objetivo: amenazaMayor(v), lpMio:v.lp.mio,
            flotaEnCombate: exp("floaterBatalla") && flotaEnCombate(amenazaMayor(v)),
            desbloquea: por.includes("desbloquea") || por.includes("paso por encima") });
        if(guardo?.guardar){ p = Math.min(p, 0.6); por += ` (la guardo para ${guardo.para})`; }
      }
      if(exp("postura") && sabe.postura && !vetado){
        const modo = postura(v);
        const empuja = {
          /* Los empujones son PEQUEÑOS a propósito. Con el doble de estos
             números el bot cambiaba de personalidad cada turno y perdía
             dos puntos de victoria: la postura tiene que inclinar el
             desempate, no reescribir el criterio de cada carta. */
          rematar:     { equipSteal:+0.8, removal:+0.6, revival:+0.4, draw:-0.3,
                         stallGlobal:-0.8, muroGlobal:-0.8 },
          estabilizar: { removal:+0.6, trapMass:+0.5, fusion:+0.4,
                         muroGlobal:+0.5, stallGlobal:+0.5, handRip:-0.4 },
          presionar:   { equipSteal:+0.4, removal:+0.25, swap:+0.25,
                         muroGlobal:-0.5, stallGlobal:-0.4 },
          construir:   { draw:+0.3, handRip:+0.3, fusion:+0.2, buscador:+0.25 },
          buscar:      { draw:+0.7, buscador:+0.7, handRip:+0.2, trick:-0.2 },
        }[modo] ?? {};
        if(empuja[inf.rol]){ p += empuja[inf.rol]; por += ` [${modo}]`; }
      }

      /* Secuencia: la remoción de monstruos espera a que haya invocado.
         Ver el bloque de `puedoInvocar` arriba: es la diferencia entre que
         el Torrential del rival se lleve solo lo tuyo o se lleve lo de los
         dos. */
      if(n>=2 && puedoInvocar && ["removal","equipSteal"].includes(inf.rol)
         && !rivalUso(v,"Torrential Tribute")){
        p -= 1.2; por += " (primero invoco, luego limpio)";
      }
      // lastre: un jugador flojo se guarda la remoción hasta que ya da igual
      if(lastre.sinRemocion && ["removal","massRemoval","spellRemoval","fusion","lock","swap","trick"].includes(inf.rol))
        p = Math.min(p, 0.1);
      /* La nota por evaluación sustituye a la constante, pero NUNCA a un
         veto: si la carta no consigue nada, no la juega, y eso ya está
         decidido arriba. Aquí solo se decide CUÁNTO vale lo que sí hace,
         y esa es la parte donde las constantes no eran comparables entre
         sí. */
      if(POR_EVALUACION && !vetado && p > 0.15){
        const efecto = efectoDe(c, leerCarta(names[c.code]?.desc, c.datos));
        if(efecto){
          const d = delta(v, efecto, PLAN);
          /* Se mezcla con el criterio de siempre en vez de sustituirlo del
             todo: la tabla escrita a mano sabe cosas que la evaluación no
             ve (que la Snatch Steal se guarda, que Scapegoat es del turno
             del rival) y tirarlas sería perder información. */
          p = p*0.4 + (d + 0.8)*0.6;
          por += ` [+${d.toFixed(2)} cartas]`;
        }
      }
      /* SIEMPRE al plan, también lo vetado. Antes solo entraba si valía
         más de 0.15, y ai/pensar.js lee «no está en el plan» como «no sé
         lo que vale» (no como veto): la simulación resucitaba justo lo
         que la heurística había prohibido. E, 19-09: Ring of Destruction
         a un Sangan y un Heavy Storm que se llevó dos cartas suyas por
         una del rival, las dos vetadas y las dos jugadas por la simulación. */
      /* Un veto es un veto para todos: por debajo de 0.15, que es donde
         pensar.js deja de simular. Había vetos a 0.2 y 0.3 (Chaos Sorcerer
         sin objetivo, un muro…) que la simulación seguía considerando. */
      if(vetado) p = Math.min(p, 0.1);
      añadir(p, IA.SELECT_ACTIVATE, i, por);
    });

    /* 4. COLOCAR MAGIA/TRAMPA */
    (m.spell_sets||[]).forEach((l,i)=>{
      const c = cartaDeLista(l), inf = infoDe(c);
      let p = 1.4;
      if(inf.reactiva || inf.rapida) p += 1.4;          // trampas y rápidas quieren estar puestas
      if(n>=2 && v.backrow.length>=3) p -= 1.2;         // no cargar todo el backrow
      /* ══ NO SE LE ENTREGA EL BACKROW A UN HEAVY STORM ══
         E, 19-09 (Horus, partida 2): turno 1, la IA colocó Scapegoat, MST,
         Torrential y Sakuretsu; su Heavy Storm se llevó las cuatro. Mientras
         el rival no haya gastado el suyo y tenga mano, la tercera tapada ya
         cuesta y la cuarta no se pone: lo que no está puesto no se barre. */
      if(exp("sobreBackrow") && !rivalUso(v,"Heavy Storm") && v.manoRival.cuantas > 0){
        if(v.backrow.length >= 2) p -= 1.0;
        if(v.backrow.length >= 3) p -= 2.5;
      }
      if(exp("cabras") && canon(c.nombre)==="Scapegoat") p += 1.2; // colocada para encadenarla luego

      /* ══ LO QUE SE VA A DESCARTAR, MEJOR PUESTO ══
         E, 26-09 (Empty Jar, p2, T3): «si el límite de mano es 6, es
         mejor colocar la Sakuretsu Armor que guardarla en la mano y
         descartarla al final del turno». La heurística quería colocarla;
         la simulación eligió terminar y en la End Phase se fueron al
         cementerio la Sakuretsu y The Shallow Grave. Con más de seis
         cartas, colocar no expone nada: lo que no se coloca se pierde.
         Por eso va `seguro`: no se vota. */
      /* Una trampa o una rápida colocada nunca sobra con la mano llena. Una
         mágica lenta solo si, tras bajar lo que sí se baja (trampas,
         rápidas y un monstruo), la mano sigue por encima de 6: E, 20-09,
         Heavy Storm colocado con siete cartas que iban a quedarse en
         cuatro (la regla `magiaLenta` de más abajo). */
      const inf2 = infoDe(c), t2 = Number(c.datos?.type) || 0;
      const util = (t2 & 0x4) || (t2 & 0x10000) || inf2.reactiva || inf2.rapida;
      const bajan = util ? 0 : (m.spell_sets ?? []).filter(l2 => {
          const c2 = cartaDeLista(l2), i2 = infoDe(c2), tt = Number(c2.datos?.type) || 0;
          return (tt & 0x4) || i2.reactiva || i2.rapida || (tt & 0x10000);
        }).length + (((m.monster_sets?.length ?? 0) + (m.summons?.length ?? 0)) ? 1 : 0);
      const sobraMano = (v.mano?.length ?? 0) - bajan - 6;
      if(exp("limiteMano") && sobraMano > 0){
        const pl = Math.max(p, (util ? 2.0 : 1.0) + valorCarta(c) * 0.3);
        añadir(pl, IA.SELECT_SPELL_SET, i, `colocar ${c.nombre} (mano de ${v.mano.length}: si no, se descarta)`);
        seguro(IA.SELECT_SPELL_SET, i);
        return;
      }

      /* ══ SISTEMA D · UNA MÁGICA NORMAL NO SE COLOCA SI SE PUEDE JUGAR ══
         En el log de E el bot COLOCÓ Reinforcement of the Army (puntos
         1.4) en vez de buscar un guerrero con ella. Colocar una mágica
         normal no la protege de nada —el rival puede romperla igual— y
         retrasa un turno lo que la carta hace. Solo tiene sentido con las
         rápidas (que se activan en el turno del rival) y con las trampas.

         Esto NO es una excepción para ROTA: es la regla general para
         cualquier mágica normal que el motor esté ofreciendo activar
         AHORA MISMO en esta misma lista de acciones. Si no se puede
         activar, colocarla sigue estando bien. */
      const tipo = c.datos?.type ?? 0;
      const esMagia   = !!(tipo & 0x2);
      const esRapida  = !!(tipo & 0x10000);
      const esContinua= !!(tipo & 0x20000 || tipo & 0x40000 || tipo & 0x80000);
      const magiaNormal = esMagia && !esRapida && !esContinua;
      const puedoActivarla = (m.activates||[]).some(a =>
        a.code === l.code && a.location === l.location && a.sequence === l.sequence);
      if(magiaNormal && puedoActivarla){
        p = 0.05;
        añadir(p, IA.SELECT_SPELL_SET, i,
               `colocar ${c.nombre} (es una mágica normal y puedo jugarla ya)`);
        return;
      }
      /* ══ UNA MÁGICA LENTA NO SE COLOCA «POR SI ACASO» ══
         E, torneo 2 (18-09): «turno 1 set snatch steal? riesgo de
         perderla y no aporta nada más que bait, ponerla boca abajo no?».
         Tiene razón: una mágica que solo se puede activar en MI turno se
         activa igual desde la mano —colocarla no adelanta el momento— y
         en cambio la deja a tiro de Heavy Storm, Mystical Space Typhoon y
         Dust Tornado. Lo único que se gana es esquivar la destrucción de
         mano, y eso solo paga cuando de verdad toca.
         Las rápidas (Scapegoat, Book of Moon) y las trampas no entran
         aquí: esas SÍ necesitan estar puestas para servir. */
      if(exp("magiaLenta") && esMagia && !esRapida && !inf.reactiva && !inf.rapida){
        /* «Mano llena» es la que QUEDA tras lo que sí conviene bajar:
           E, 20-09 (Goat Control, p2): con siete cartas tras Pot of Greed
           colocó Heavy Storm, cuando dos trampas y un monstruo ya la
           dejaban en cuatro. ¿Por qué tenía colocado Heavy Storm? Por esto. */
        const bajanSolas = (m.spell_sets ?? []).filter(l2 => {
            const c2 = cartaDeLista(l2), i2 = infoDe(c2), t2 = Number(c2.datos?.type) || 0;
            return (t2 & 0x4) || i2.reactiva || i2.rapida || (t2 & 0x10000);   // trampas y rápidas
          }).length + (((m.monster_sets?.length ?? 0) + (m.summons?.length ?? 0)) ? 1 : 0);
        const manoLlena = (v.mano?.length ?? 0) - bajanSolas > 6;
        if(!manoLlena){
          añadir(0.1, IA.SELECT_SPELL_SET, i,
                 `colocar ${c.nombre} (lenta: desde la mano hace lo mismo y no se expone)`);
          return;
        }
      }
      añadir(p, IA.SELECT_SPELL_SET, i, `colocar ${c.nombre}`);
    });

    /* 5. CAMBIAR POSICIÓN
       TRAMPA: esto valía 0.9 fijo y el umbral para actuar es 0.8, así que
       en cuanto no había nada mejor —que es casi siempre— el bot se dedicaba
       a girar monstruos. En el log del 2026-08-09 (Horus vs PACMAN, experto)
       hizo 72 cambios de posición contra 6 invocaciones: el duelo llegó al
       turno 35 sin que ninguno de los dos pudiera avanzar. Ahora cada giro
       se puntúa por lo que consigue, y se cuentan los giros por carta para
       que no pueda entrar en bucle aunque la valoración falle.
       OJO: pos_changes NO trae la posición, solo (code, zona, índice).
       Hay que resolverla contra el espejo, como en battlePhase. */
    /* E, 03-10 (Reino, T4): girar a defensa y LUEGO atar al que pegaba.
       Si en la mano/mesa hay una atadura lista y algo suyo sin atar, el
       giro espera: atado, ya no hay de qué protegerse. */
    const ataduraPendiente = exp("ataduraAntes")
      && (m.activates||[]).some(l => ATADURAS.has(canon(names[l.code]?.name ?? "")))
      && v.monstruosRival.some(r => !r.bocaAbajo && !r.atado && atk(r) > 0);
    if(!lastre.sinPosicion) (m.pos_changes||[]).forEach((l,i)=>{
      const real = duel.resolve(l, l.code);
      const c = cartaDeLista(l), inf = infoDe(c);
      const pos = real?.position ?? 0;
      const tapada  = !!(pos & 0x0a);          // boca abajo
      const defensa = !!(pos & 0x0c);          // en defensa
      const amenaza = amenazaMayor(v);
      const techo   = amenaza ? poder(amenaza) : 0;
      // el bit FLIP no es de fiar en esta base (Des Lacooda y Medusa Worm
      // salen sin él), así que se mira también el rol de la tabla
      const esFlip = !!((c.datos?.type ?? 0) & 0x200000)
                     || inf.rol==="flip" || inf.colocarPreferente;
      let p, por = `girar ${c.nombre}`;

      /* Voltear por voltear es la trampa de este bot: el escáner contó
         Tsukuyomi volteado casi seis veces por partida. Un volteo vale lo
         que valga su efecto AHÍ: Tsukuyomi sin nada que apagar no hace
         nada, y Magician of Faith sin mágicas en el cementerio tampoco. */
      /* ── MOTORES DE VOLTEO ──
         Tres de los veinte mazos GANAN volteando el mismo bicho cada
         turno: PACMAN, Clown Control y Phoenix. Des Lacooda roba una
         carta cada volteo, Swarm of Scarabs le mata una tapada, Medusa
         Worm cualquier monstruo, Golem Sentry lo devuelve a la mano.
         El bot no sabía nada de esto, y encima su freno anti-bucle
         apagaba justo el motor del mazo. `voltearVale` dice qué tiene
         que haber para que el volteo consiga algo. */
      const nomC = canon(c.nombre);
      const condicionFlip = {
        siempre:       ()=> true,
        tapadaRival:   ()=> v.monstruosRival.some(x=>x.bocaAbajo),
        backrowRival:  ()=> v.backrowRival.length > 0,
        monstruoRival: ()=> v.monstruosRival.length > 0,
      };
      /* ══ UN VOLTEO QUE DESTRUYE NO SE GASTA EN UN FLOATER ══
         E, 25-09 (Chaos Turbo, p1, T4): Night Assailant volteado para
         destruir un Sangan. Sangan le busca otro monstruo al morir: el
         volteo cambió una carta por nada, y encima dejó al Assailant de
         frente con 200. Un floater pequeño se rodea; el volteo espera a
         algo que valga (o a que le ataquen, que lo dispara igual). */
      const blancoQueVale = () => v.monstruosRival.some(x => !esFicha(x)
          && !(rolDe(x) === "floater" && !x.bocaAbajo && poder(x) < 1600));
      const flipSirve =
          (exp("volteoFloater") && inf.destruyeAlVoltear) ? blancoQueVale()
        : inf.voltearVale           ? (condicionFlip[inf.voltearVale] ?? (()=>true))()
        : nomC==="Tsukuyomi"        ? v.monstruosRival.some(x=>!x.bocaAbajo)
        : nomC==="Magician of Faith"? v.cementerio.some(x=>(x.datos?.type??0) & 0x2)
        : true;

      /* Morphing Jar: los dos descartan y roban 5. Con menos mazo que él,
         es cavarme la tumba (ver «robar también cuesta mazo»). */
      const jarCava = exp("robarMazo") && nomC === "Morphing Jar" && (v.deckRestante ?? 0) >= 5
        && (v.deckRestante ?? 99) - 5 <= (v.deckRestanteRival ?? 99) - 5 && (v.deckRestante ?? 99) - 5 < 8;
      const chaosReusa = exp("tsukPlan") && tapada && CHAOS_REUSO.has(nomC)
            && v.monstruosRival.some(x => !x.bocaAbajo && !esFicha(x) && (valorCarta(x) >= 0.8 || atk(x) >= 1400));
      if(chaosReusa){ p = 3.2; por += " (boca arriba otra vez: su destierro vuelve)"; seguro(IA.SELECT_POS_CHANGE, i); }
      else if(tapada){                          // voltear = invocación por volteo
        if(esFlip && jarCava)         { p = 0.05; por += " (los dos robamos 5 y yo tengo menos mazo)"; }
        else if(esFlip && flipSirve)  { p = 2.4; por += " (invocación por volteo: dispara su efecto)"; }
        else if(esFlip)               { p = 0.2; por += " (su efecto no conseguiría nada ahora)"; }
        /* El Sinister Serpent de muro (ver `serpentMuro`) no se levanta para
           pegar 300: lo reportó E («turno 9 sinister serpent en atk?»). */
        else if(!amenaza && exp("serpentMuro") && infoDe(c).rol === "recurso" && atk(c) < v.lp.rival)
                                      { p = 0.1; por += " (un muro de 300: de frente no hace nada)"; }
        /* E, 03-10 (Reino, Weevil, T26 y T30): Basic Insect y Cocoon of
           Evolution (0 de ATK) volteados a ataque en la Main Phase 2 «para
           pegar». Sin batalla por delante no pega nadie, y con 0 de ataque
           tampoco con ella: boca arriba solo se expone. */
        else if(!amenaza && exp("pegarConBatalla") && (!m.to_bp || atk(c) <= 0))
                                      { p = 0.05; por += !m.to_bp ? " (sin batalla por delante: boca arriba solo se expone)"
                                                                 : " (0 de ataque: no pega nada)"; }
        else if(!amenaza)             { p = 1.5; por += " (campo rival vacío: la saco a pegar)"; }
        /* E, 02-10 (Goat Control, p3, T27): «¿por qué flippea la serpiente?».
           Su amenaza era un Kycoo TAPADO (lo había tumbado la IA con Book of
           Moon): `poder` de una tapada sin datos es 0, así que 300 «ganaba»;
           y además la volteó sin batalla que hacer. E le pegó 1500 al turno
           siguiente. Un recurso no se levanta (vuelve solo a la mano), una
           tapada se mide con lo que recuerdo de ella o con 1500, y voltear
           para pegar solo tiene sentido con la batalla por delante. */
        else if(exp("serpentMuro") && infoDe(c).rol === "recurso"){ p = 0.1; por += " (un recurso no se levanta: de frente solo regala daño)"; }
        else if(atk(c) > (amenaza.bocaAbajo ? (amenaza.conocida?.datos ? Number(amenaza.conocida.datos.defense ?? 0) : 1500) : techo)
                && (!exp("serpentMuro") || !!m.to_bp))
                                      { p = 1.3; por += " (a cara descubierta gana el combate)"; }
        /* ══ VOLTEAR PARA PEGAR ANTES DE LA BATALLA ══
           E, 26-09 (Zombie Goat Control, p1, T4): «¿no podía haber
           invocado por volteo el Breaker después de mi Book of Moon, antes
           de la Battle Phase?». Podía: lo tumbó un efecto, no lo colocó él,
           así que el volteo es legal. Pero solo miraba si ganaba a SU
           monstruo más grande (un Breaker de 1600 contra otro de 1600), y
           lo volteó en la Main Phase 2 sin pegar: 1600 de daño perdidos,
           porque el Asura Priest ya le limpiaba el resto de la mesa. Es la
           misma cuenta que levantar a ataque un monstruo en defensa
           (`evaluarPosicion`: ¿se lleva algún combate o pega directo?). */
        else if(exp("volteoPegar") && !!m.to_bp && evaluarPosicion(c, v, {
                  puedeAtacarYa:true, inmuneCombate: !!inf.inmuneCombate, perfora: !!inf.perfora }).golpe)
                                      { p = 1.3 + atk(c)/2500; por += " (boca arriba tiene un combate que ganar este turno)"; }
        else                          { p = 0.05; por += " (descubierta se la comen)"; }
      } else if(defensa){                       // defensa → ataque
        /* PONER UNA FICHA EN ATAQUE. Lo reportó E y es de las cosas que
           más cantan: una ficha de Scapegoat tiene 0 de ataque, así que
           en ataque no mata nada y encima, cuando se la atacan, te comes
           TODO el ataque del rival en la cara. En defensa te comes cero.
           No es una preferencia: es estrictamente peor.
           Y lo mismo, en general, para cualquier monstruo cuya defensa
           sea mejor que su ataque o al que se vayan a comer. */
        const nada = atk(c) === 0 || valorCarta(c) <= 0.2;
        const peorDeFrente = atk(c) < def(c);
        /* ══ UN VETO NO PUEDE IR DELANTE DE LO QUE SE GANA ══
           E, log 19-14-58 T16: «podría haber atacado al pájaro, sabía
           que solo tenía 1000 de defensa». Tenía razón. El bot tenía
           una Lady Ninja Yae (1100/200) AGACHADA y enfrente un Sonic
           Bird en defensa con 1000: levantarla y atacar se lo llevaba
           gratis. Pero como E pegaba más fuerte que 1100, saltaba
           `posicionSegura` —"de frente se la comen"— y ahí se quedó,
           con la Battle Phase vacía (`attacks: []` en el log).
           El veto es bueno para cuando levantarse no consigue nada;
           delante de un combate ganado es un cambio, no un suicidio, y
           esa distinción ya está tomada en `valeAtacar`. `hayGolpe` de
           `evaluarPosicion` es la MISMA cuenta que usan el ataque y la
           postura, tapadas incluidas, así que las tres deciden igual. */
        const golpeAlLevantarse = !!evaluarPosicion(c, v, {
          puedeAtacarYa: !!m.to_bp,
          inmuneCombate: !!inf.inmuneCombate,
          perfora: !!inf.perfora,
        }).golpe;
        /* ══ «DEFIENDE MEJOR» NO VETA UN GOLPE ══
           E, 20-09 (Goat Control, p3, T15): mató el TER con Ring of
           Destruction, el campo rival quedó vacío y sus dos Gravekeeper's
           Spy (1200/2000) se quedaron agachados: 2400 de daño regalados.
           `peorDeFrente` iba delante de `golpeAlLevantarse` y la misma
           regla de arriba ya lo decía: un veto no va delante de lo que se
           gana. Cuando levantarse se lleva un combate o pega directo, se
           levanta; `peorDeFrente` queda para cuando no consigue nada. */
        /* ══ LEVANTAR SOLO LO QUE HACE FALTA ══
           E, 25-09 (Chaos Turbo, p3, T4): los DOS Gravekeeper's Spy se
           levantaron a ataque para un solo combate que valía la pena; el
           segundo se quedó de frente con 1200 delante de su mano. Levantar
           suma si hay más monstruos suyos que se ganan que atacantes míos
           ya de frente para ganarlos (o si puede pegar directo). */
        let sobra = false;
        if(golpeAlLevantarse && exp("levantarSobra") && v.monstruosRival.length){
          const yaDeFrente = v.monstruos.filter(x => x.uid !== c.uid && !x.bocaAbajo && !x.defensa && atk(x) > 0 && !x.yaAtaco);
          const gana = (a, r) => { const rr = (r.bocaAbajo && r.conocida) ? { ...r, datos:r.conocida.datos, bocaAbajo:false, defensa:true } : r;
                                   if(rr.bocaAbajo) return apuestaContraTapada(atk(a)).prob > 0.5;
                                   return ganaCombate(a, rr, v.lp.rival) && !muereAtacando(a, rr, v.lp.rival); };
          const seGanan = v.monstruosRival.filter(r => [...yaDeFrente, c].some(a => gana(a, r))).length;
          sobra = seGanan <= yaDeFrente.length;
        }
        if(nada)                      { p = 0.02; por += " (0 de ataque: en ataque solo sirve para comer daño)"; }
        else if(golpeAlLevantarse && sobra){ p = 0.3; por += " (lo que se gana ya lo cubren los que están de frente)"; }
        else if(golpeAlLevantarse)    { p = 1.5 + atk(c)/2500;
                                        por += " (levantándose se lleva un combate)"; }
        else if(peorDeFrente)         { p = 0.05; por += " (defiende mejor de lo que pega)"; }
        else if(exp("posicionSegura") && !sobrevive(c, v))
                                      { p = 0.1;  por += " (de frente se la comen)"; }
        else if(!amenaza)             { p = 1.6 + atk(c)/2500; por += " (a atacar: no hay nada delante)"; }
        else if(atk(c) > techo)       { p = 1.4; por += " (ya gana el combate)"; }
        else                          { p = 0.05; por += " (atacando no consigue nada)"; }
      } else {                                  // ataque → defensa
        /* ══ SISTEMA A · AQUÍ ESTABA EL BUG DE LOS CINCO REPORTES ══
           Para agacharse se exigía `def(c) > atk(c)`. Sangan es 1000/600,
           así que NUNCA entraba y se quedaba de frente delante de un
           La Jinn de 1800 regalando 800 de daño por turno. Pero la
           defensa no se compara con el ataque propio: en defensa el daño
           que te llevas es CERO, mida lo que mida. Lo decide ahora
           `evaluarPosicion`, que mira lo único que importa: si de frente
           consigo algo (atacar o aguantar) o solo regalo puntos de vida.

           OJO CON LA FASE: girar a defensa en la Main Phase 1 renuncia al
           ataque de este turno. Solo se considera "puedo atacar aún" si
           de verdad queda Battle Phase por delante. */
        const quedaBatalla = !!m.to_bp;
        const ev = evaluarPosicion(c, v, {
          puedeAtacarYa: quedaBatalla && !c.yaAtaco,
          inmuneCombate: !!inf.inmuneCombate,
          perfora: !!inf.perfora,
        });
        if(ev.quiere === "defensa"){ p = ev.peso; por += ` (${ev.por})`; }
        else                       { p = 0.05;    por += ` (${ev.por})`; }
        if(ataduraPendiente && p > 0.5){ p = 0.5; por += " (primero la atadura: atado, no pega)"; }
        /* ══ EL PAPEL NO SE QUEDA DE FRENTE ══
           E, 25-09 (Chaos Turbo, p1, T6): Night Assailant (200) se quedó en
           ataque dos turnos con una Giant Rat tapada enfrente —que la IA
           conocía— y tres cartas en su mano. `evaluarPosicion` solo mira lo
           que el rival tiene boca arriba, y un 200 «aguantaba» contra nada.
           Lo que puede voltear (lo tapado que recuerdo, o 1500 si no lo sé)
           y lo que puede invocar de la mano también pegan el turno que viene. */
        if(exp("papelDeFrente") && ev.quiere !== "defensa" && !ev.golpe && !esFicha(c)
           && atk(c) < 1000 && rolDe(c) !== "floater"){
          const tapadas = v.monstruosRival.filter(x => x.bocaAbajo)
            .map(x => x.conocida?.datos ? (x.conocida.datos.attack ?? 0) : 1500);
          const amenazaLuego = Math.max(0, ...tapadas, v.manoRival.cuantas > 0 ? 1800 : 0);
          if(amenazaLuego > atk(c)){
            p = 1.0 + (amenazaLuego - atk(c)) / 2000;
            por += ` (con ${atk(c)} de frente se lo come lo que tiene tapado o en la mano)`;
          }
        }
      }

      /* Dream Clown y Crass Clown se disparan al pasar a DEFENSA, no al
         voltearse: son la única familia que quiere ir hacia atrás. */
      if(inf.aDefensa && !defensa && !tapada && flipSirve){
        p = 3.0; por = `${c.nombre} a defensa (así es como destruye)`;
      }

      /* Freno de bucle: girar la misma carta una y otra vez no suele ser
         un plan… salvo en los mazos cuyo plan es exactamente ese. Con el
         freno puesto para todos, PACMAN y Clown Control se quedaban sin
         motor: su Des Lacooda deja de robar al tercer turno. Ahora el
         freno solo se aplica cuando el volteo NO consigue nada. */
      const uid = real?.uid ?? `${l.code}:${l.sequence}`;
      const yaGirada = giros.get(uid) ?? 0;
      /* MEDIDO, Y AL REVÉS DE LO QUE DECÍA LA TEORÍA. La guía de PACMAN
         dice que el mazo gana volteando sus bichos "una y otra vez", así
         que la primera versión levantaba el freno para esos mazos. Con
         400 partidas de PACMAN contra PACMAN, el resultado es monótono y
         no deja lugar a dudas:

              tope de giros     2      3      5    sin tope
              victorias        59%    44%    30%     24%

         Lo que falta no es permitir más volteos: es que esos monstruos se
         vuelven a poner boca abajo SOLOS con su propio efecto, y el bot
         los deja a cara descubierta con 500 de ataque para que se los
         coman. Hasta que sepa re-taparlos, voltear más es peor.
         Lo que sí ayuda —y mucho, +9 puntos en ese mismo mazo— es la otra
         mitad: `voltearVale`, que solo voltea cuando el volteo consigue
         algo. El freno se queda en dos para todos. */
      if(yaGirada >= 2 && !(exp("reTapa") && exp("reTapaGiro") && inf.reTapa && motorQueSeReTapa() && tapada && flipSirve)){
        p = Math.min(p, 0.05); por += ` (ya girada ${yaGirada} veces)`;
      }

      /* ══ NO EXPONER UN VOLTEO (contexto) ══
         Principio (Cards in Goat Format Pt.1; Three Easy-To-Build Decks):
         Magician of Faith y compañía valen por su efecto, y ese efecto
         salta igual cuando el rival ataca la carta tapada. Voltearla en mi
         turno la deja boca arriba en ataque con su ATK de papel: se pierde
         la carta Y la diferencia de daño. Solo compensa si esperar cuesta
         más: que Nobleman se la lleve antes (depende de su mano) o que el
         efecto haga falta YA. */
      /* Lo que se vuelve a tapar solo (PACMAN) no se queda expuesto: se
         voltea, hace lo suyo y en la Main Phase 2 se re-tapa. */
      if(ctx && exp("exponerVolteo") && tapada && esFlip && p > 0.8 && !(exp("reTapa") && exp("reTapaExpone") && inf.reTapa && motorQueSeReTapa())){
        /* Si el volteo DESTRUYE, lo más fuerte que tiene ya no me pega:
           se cuenta con lo que queda (Night Assailant contra un Airknight). */
        const quedanSuyos = v.monstruosRival.filter(x=>!x.bocaAbajo && !x.defensa).sort((a,b)=>atk(b)-atk(a));
        if(exp("volteoFloater") && inf.destruyeAlVoltear) quedanSuyos.shift();
        const suAtaque = Math.max(0, ...quedanSuyos.map(x=>atk(x)));
        if(suAtaque > atk(c)){
          /* Con pocos LP, el daño de dejarlo de frente pesa más: a 2550
             un golpe de 2000 sobre un volteo de 500 es media partida
             (medido en exp-terminar.mjs: Des Lacooda volteado a 2550 LP). */
          const dañoFrente = suAtaque - atk(c);
          const pierdoVolteando = valorCarta(c) + dañoFrente / 1000
                                  + (exp("volteoLP") ? (dañoFrente >= v.lp.mio ? 6 : 2 * dañoFrente / Math.max(1, v.lp.mio)) : 0);
          const riesgoNoble = rivalUso(v, "Nobleman of Crossout") ? 0 : Math.min(0.5, 0.12 * v.manoRival.cuantas);
          const pierdoEsperando = riesgoNoble * (valorCarta(c) + 1.0) + (ctx.fase === "topdeck" ? 0.3 : 0);
          if(pierdoVolteando > pierdoEsperando + 0.5){
            p = Math.min(p, 0.5); firme(IA.SELECT_POS_CHANGE, i);
            por += ` (voltearla la deja a tiro de su ${suAtaque}: su efecto llega igual si me ataca)`;
          }
        }
      }
      añadir(p, IA.SELECT_POS_CHANGE, i, por, uid);
    });

    plan.sort((a,b)=>b.puntos-a.puntos);
    /* Lo que opina la heurística de cada jugada: `ai/pensar.js` lo usa
       para decidir qué simular primero. */
    ultimoPlanIdle = plan.map(x => ({ action:x.action, index:x.index, puntos:x.puntos, por:x.por,
                                      firme: firmes.has(`${x.action}:${x.index}`),
                                      seguro: seguros.has(`${x.action}:${x.index}`) }));
    /* Lastre de nivel: de vez en cuando elige una jugada peor a propósito.
       No es ruido decorativo, es lo que separa novato de experto y se
       puede medir apagándolo. */
    if(lastre.error && plan.length>1 && azar(lastre.error))
      plan.unshift(plan.splice(1+((aleatorio()*(plan.length-1))|0),1)[0]);

    const elegido = plan[intento];
    if(elegido && elegido.puntos > 0.8){
      traza(elegido.por, { puntos:+elegido.puntos.toFixed(2) });
      if(elegido.action===IA.SELECT_POS_CHANGE && elegido.uid!=null)
        giroPendiente = { uid:elegido.uid, action:elegido.action, index:elegido.index };
      return { type:R.SELECT_IDLECMD, action:elegido.action, index:elegido.index };
    }
    // sin nada que merezca la pena: a la batalla o a terminar
    /* GitHub #13: «la IA pasa por todas las fases aunque solo tenga cartas
       colocadas». Sin nada boca arriba en ataque no hay batalla que hacer:
       entrar era otra ventana de respuesta y dos carteles de fase más. */
    const conQuePegar = v.monstruos.some(x => !x.bocaAbajo && !x.defensa && atk(x) > 0);
    return { type:R.SELECT_IDLECMD,
             action: (m.to_bp && (conQuePegar || !m.to_ep || !exp("sinBatallaVacia"))) ? IA.TO_BP : IA.TO_EP, index:null };
  }

  /* ══════════ BATTLE PHASE ══════════ */
  /* ══ CUANDO NO SE PUEDE NO ATACAR ══
     Reddit, día 2: Berserk Gorilla («debe atacar si puede») delante de un
     Mobius más grande y el duelo parado para siempre. Con un monstruo
     obligado a atacar, el motor no ofrece ni Main Phase 2 ni End Phase
     (to_m2 y to_ep a falso), pero el bot, que con razón no quería
     estrellarse, contestaba «paso a la End Phase». Respuesta ilegal, el
     motor pregunta otra vez, el bot contesta lo mismo… Ahora, si pasar no
     está permitido, ataca: el obligado primero, y entre las opciones la
     que menos duele (`check-obligado` lo prueba). */
  function battlePhase(m, intento){
    const r = battlePhaseLibre(m, intento);
    if(r?.action === BA.SELECT_BATTLE || m.to_m2 || m.to_ep) return r;
    const ataques = m.attacks || [];
    if(!ataques.length) return r;
    const golpe = l => { const c = duel.resolve(l, l.code); return c?.atkReal ?? db.get(l.code)?.attack ?? 0; };
    const orden = ataques.map((l, i) => ({ i, a:golpe(l) })).sort((x, y) => y.a - x.a);
    traza(`tengo que atacar (no me dejan pasar de fase): ataco con el más fuerte`);
    return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:orden[intento % orden.length].i };
  }
  function battlePhaseLibre(m, intento){
    const v = vistaDe(duel, yo, db, names);
    const ataques = (m.attacks||[]).map((l,i)=>{
      const c = duel.resolve(l, l.code);
      /* atkReal/defReal vienen del motor, no de la base: sin ellos un
         Thousand-Eyes Restrict con un 1900 absorbido seguía valiendo 0 y
         el bot no atacaba nunca con él. */
      /* `prestado` viene de la vista legal: un monstruo que controlo pero
         que es SUYO (Mind Control, Snatch Steal). Al acabar el turno se lo
         devuelvo, así que o ataca ahora o no ha servido de nada. E lo vio
         dos veces en la misma partida: robaba un Thunder Dragon y lo
         dejaba plantado hasta devolvérselo entero. */
      const enVista = v.monstruos.find(x=>x.uid === c?.uid);
      const mio = c ? { code:c.code, nombre:names[c.code]?.name??"",
                        datos:db.get(c.code)??null,
                        atkReal:c.atkReal ?? null, defReal:c.defReal ?? null,
                        prestado: !!enVista?.prestado,
                        defensa:false, bocaAbajo:false } : null;
      return { i, c:mio };
    }).filter(a=>a.c);

    if(!ataques.length)
      return { type:R.SELECT_BATTLECMD, action: m.to_m2?BA.TO_M2:BA.TO_EP, index:null };

    /* Lastre de combate: atacar con todo sin mirar. Es EL error de novato
       y el que más partidas regala, así que es el que separa los niveles. */
    if(lastre.combateTonto){
      /* "Sin hacer cuentas" no es "suicídate". Contra un monstruo en
         DEFENSA que no puedes romper te comes la diferencia en la cara,
         y el bot lo hacía dos veces seguidas contra el mismo: E lo vio en
         su primer duelo y tiene razón en que eso no es de nivel normal,
         es de no mirar el tablero. El lastre sigue siendo no pensar en
         trampas ni en cambios; el daño de retroceso gratis se evita. */
      const suicida = c => v.monstruosRival.some(r =>
        !r.bocaAbajo && r.defensa && def(r) > atk(c));
      const sensatos = ataques.filter(a => !suicida(a.c));
      const lista2 = sensatos.length ? sensatos : [];
      if(intento < lista2.length)
        return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:lista2[intento].i };
      return { type:R.SELECT_BATTLECMD, action: m.to_m2?BA.TO_M2:BA.TO_EP, index:null };
    }

    /* ══ CON WABOKU YA RESUELTA, ATACAR NO HACE NADA ══
       Reddit, día 2: Waboku del rival resuelta y el bot atacó con todo
       igual. Este turno no le hago daño de batalla ni le mato nada en
       combate; lo único que consigo es voltear sus tapadas (y sus
       efectos de volteo) y darle otra ventana para una trampa. Solo se
       ataca si un ataque concreto gana algo que Waboku no tapa: hoy, nada
       que el bot sepa medir, así que no se ataca. */
    if(exp("wabokuResuelta") && (v.resueltasRivalTurno ?? []).some(n => /^Waboku/.test(n))){
      traza(`no ataco: su Waboku ya se resolvió (ni daño ni destrucción por batalla este turno)`);
      return { type:R.SELECT_BATTLECMD, action: m.to_m2?BA.TO_M2:BA.TO_EP, index:null };
    }
    const rivales = v.monstruosRival;
    /* Cuánto vale atacar con este monstruo, mirando TODOS los objetivos.
       El escáner de partidas decía que el 58% de los ataques no conseguían
       nada: se lanzaban contra monstruos en defensa que no podían romper.
       Un ataque que no mata ni muere es tempo regalado y, encima, se come
       la Sakuretsu del rival para nada. */
    /* El plan manda en la batalla. Un mazo de Burn o de Countdown gana
       sobreviviendo: cambiar golpes es justo lo que NO tiene que hacer, y
       hasta ahora atacaba igual que un mazo de pegar. `agresivo` es cuánto
       vale el daño frente a la ventaja de cartas; `aguanta` es "mi plan es
       llegar vivo al final". */
    const valeAtacar = c => {
      /* Un ataque directo es daño gratis y sin riesgo: lo hace CUALQUIER
         plan, también el de Burn. La primera versión de esto se lo prohibía
         a los mazos defensivos y les costó cinco puntos de victoria
         (Clown Control 43%, Final Countdown 45%): no atacaban nunca, así
         que no cerraban ninguna partida y todo acababa en tablas al turno
         60. Lo que un mazo defensivo evita son los CAMBIOS de golpes, no el
         daño gratis. */
      if(!rivales.length) return 8 + atk(c)/1000;
      /* (Aquí hubo una versión que bajaba el ataque directo a 2.5 para los
         mazos defensivos. No cambió NI UNA partida de 2.400: la nota solo
         ordena los ataques entre sí, y 2.5 sigue estando por encima del
         umbral de 0.2. Sirvió para recordar que hay que comprobar que un
         cambio hace algo antes de darlo por bueno.) */
      let mejor = -9;
      const infoC = infoDe(c);
      for(const r of rivales){
        /* ══ SISTEMA F · LO QUE YA HE VISTO, LO RECUERDO ══
           Una tapada de la que ya conozco la identidad no es una
           incógnita. E lo reportó por sus dos caras en dos partidas
           seguidas: atacó a una defensa que sabía que no podía romper, y
           no atacó a otra que sabía que sí. `conocida` la rellena
           `ai/view.js` solo con lo que ha estado boca arriba. */
        const recordada = r.bocaAbajo && r.conocida
          ? { ...r, code:r.conocida.code, nombre:r.conocida.nombre,
              datos:r.conocida.datos, bocaAbajo:false, defensa:true,
              deMemoria:true }
          : r;
        const infoR = recordada.bocaAbajo ? {} : infoDe(recordada);
        /* LA CUENTA DE ATAQUE NO SIEMPRE VALE. Es `IsMonsterDangerous` de
           WindBot y es lo que faltaba aquí:
             · Spirit Reaper no muere en combate por mucho ataque que le
               eches, así que "le gano" es mentira.
             · D.D. Warrior Lady y D.D. Assailant destierran a los dos: la
               matas, sí, pero pierdes el tuyo. Es un cambio, no un regalo.
           OJO con no pasarse: la primera versión marcaba también los muros
           (Gravekeeper's Spy y compañía) y con eso el bot dejaba de pegarle
           a una Spy boca arriba en ataque, que son 1200 y hay que matarla.
           Para los muros ya están sus propios números; no hacen falta
           banderas. Marcarlos costó dos puntos de victoria medidos. */
        /* Los LP del RIVAL entran en la cuenta: Injection Fairy Lily pega
           con 3400 si puede pagar 2000 (ver `atkEnCombate`). */
        let mata = ganaCombate(c, recordada, v.lp.rival),
            muero = muereAtacando(c, recordada, v.lp.rival);
        /* ATAQUES IGUALADOS. `ganaCombate` pide ATK estrictamente mayor,
           que es lo correcto para "me lo llevo gratis", pero con ataques
           iguales mueren LOS DOS: es un cambio, no un suicidio, y aquí se
           puntuaba -4. Por eso el Thunder Dragon robado con Mind Control
           no atacaba al Breaker de 1600 y volvía intacto a su dueño al
           acabar el turno (partida 1, turnos 5 y 8). */
        if(!mata && !recordada.bocaAbajo && !recordada.defensa && atk(c) > 0
           && atk(c) === atk(recordada))
          mata = true;
        if(exp("peligrosos") && infoR.inmuneCombate) mata = false;
        let s;
        if(exp("peligrosos") && infoR.peligroso && mata && !muero)
          s = 0.8 + (valorCarta(recordada) - valorCarta(c));  // cambio, no regalo
        else if(mata && !muero) s = 4 + poder(recordada)/1000;  // te lo llevas gratis
        else if(mata && muero)  s = 1.0 + (valorCarta(recordada) - valorCarta(c));
        else if(!mata && !muero) s = -0.6;                  // no pasa nada: no ataques
        else                     s = -4;                    // suicidio
        /* ══ SISTEMA G · UNA TAPADA NO ES UN "NO", ES UNA APUESTA ══
           E, dos turnos seguidos: «no ataca a mi monstruo en defensa».
           Tenía un Magician of Faith tapado —300/400— y enfrente un
           Flying Kamakiri de 1400 que no se movió. La causa era un
           umbral escrito a ojo (`atk > 1600`) que convertía toda tapada
           por debajo de eso en `mata=false`, o sea en la rama de "no
           pasa nada: no ataques".
           Ahora la nota sale de la tabla medida de `apuestaContraTapada`:
           lo que gano si me la llevo por delante, menos los LP que me
           como cuando la defensa es mayor. Con 1400 la apuesta es 61%,
           que es un ataque que hay que hacer; con 900 es 44% y no. */
        if(recordada.bocaAbajo && !recordada.deMemoria){
          const ap = apuestaContraTapada(atk(c));
          /* Ganar aquí vale MUCHO menos que llevarse un monstruo
             conocido —4 y pico ahí arriba—: lo que hay tapado suele ser
             un monstruo de utilidad barato, y encima le doy su volteo
             (Magician of Faith recupera, Dekoichi roba, Cyber Jar lo
             revienta todo) tanto si lo mato como si no.
             El 1.2 no es a ojo: es el número que deja la apuesta del
             61% por encima del umbral de jugar (0.2) y la del 44% por
             debajo. Las dos posiciones están en el banco, y la segunda
             es el contraejemplo — sin él, "ataca siempre a las tapadas"
             aprobaría igual. */
          s = ap.prob * 1.2 - (1 - ap.prob) * (0.4 + ap.daño / 1200);
          if(ap.prob > 0.5)
            traza(`la tapada cae el ${Math.round(ap.prob*100)}% de las veces con ${atk(c)} de ataque`);
        }
        /* ══ SISTEMA B · ATACAR HACIA ARRIBA A PROPÓSITO ══
           Hyper Hammerhead devuelve a la mano al monstruo con el que
           combate. Contra algo que no puedo matar de ninguna otra forma,
           perder el cuerpo y unos puntos de vida para quitarlo de en
           medio puede ser buenísimo — y con la cuenta de siempre esto
           salía -4, o sea "suicidio", y no se hacía nunca. */
        if(!mata && (infoC.rebota || infoC.destierra)){
          const trato = valeAtaqueSuicida(c, recordada, v,
            { rebota:!!infoC.rebota, destierra:!!infoC.destierra });
          if(trato && trato.vale > 0) s = Math.max(s, 1.2 + trato.vale);
        }
        /* Si la conozco de haberla visto, el resultado del combate no es
           una apuesta: se apunta en el log para poder auditarlo. */
        if(recordada.deMemoria && s > 0)
          traza(`recuerdo que ${recordada.nombre} tiene ${def(recordada)} de defensa`);
        /* Con plan defensivo, un cambio de golpes no compensa: cada
           monstruo que se queda en el campo es un turno más de vida. */
        if(exp("planBatalla") && PLAN.aguanta && mata && muero) s -= 2.0;
        /* ══ UN FLOATER SE REPONE ══
           E, 25-09 (Chaos Turbo, p3, T4): Gravekeeper's Spy (1200) contra
           su Pyramid Turtle (1200): mueren los dos y la tortuga le saca un
           Ryu Kokki de 2400 del mazo. Cambiar un cuerpo por un floater es
           perder el cuerpo; matarlo gratis sigue valiendo (el daño y el
           tempo), pero menos. */
        if(exp("floaterCambio") && !recordada.bocaAbajo && rolDe(recordada) === "floater" && mata && !c.prestado){
          s -= muero ? 1.8 : 1.0;
        }
        /* ══ LO QUE SALE DEL FLOATER PUEDE SER PEOR QUE EL FLOATER ══
           E, 02-10 (Goat Control, p2, T4): Asura Priest mató al Vampire
           Lord, luego a la Giant Rat (que sacó una Pyramid Turtle) y luego a
           la Turtle, que sacó un Ryu Kokki de 2400. En la End Phase Asura
           volvió a la mano: la mesa de la IA vacía y un 2400 que antes no
           estaba. «Matarme la Pyramid Turtle abre la puerta a que saque Ryu
           Kokki o Vampire Lord gratis». Si lo que sale le gana a lo que me
           queda en la mesa (un espíritu no se queda), el ataque le regala
           un monstruo mejor. */
        if(exp("floaterSale") && mata && !c.prestado && flotaEnCombate(recordada)){
          const sale = loQueSacaFloater(recordada);
          const meQueda = (infoC.espiritu || muero) ? 0 : atk(c);
          if(sale > meQueda) s -= 2.0 + (sale - meQueda) / 1000;
        }
        mejor = Math.max(mejor, s);
      }
      /* Un monstruo prestado no tiene futuro: cambiarlo por lo que sea es
         ganancia, porque la alternativa es devolvérselo entero. */
      if(c.prestado) mejor += 3.0;
      /* Y una carta clave del plan no se cambia por cualquier cosa: el
         Airknight que te gana la partida no muere contra un 1900. */
      if(exp("planBatalla") && mejor < 3) mejor -= PLAN.peso(c.nombre) * 0.6;
      return mejor;
    };

    /* Primero el que más saca; a igualdad, el más gordo. El orden importa:
       atacar con el grande obliga al rival a gastar el Scapegoat o la
       Sakuretsu ahí, y los pequeños pasan después. Al revés le regalas la
       trampa por un monstruo de 1400. */
    /* ══════════════════════════════════════════════════════════════
       SISTEMA G · ¿PUEDO GANAR ESTE TURNO?

       En el log de E (20-08-11, turno 10) el bot tenía daño de sobra
       para cerrar la partida y no atacó: cada ataque se puntuaba por su
       cuenta —"no pasa nada: no ataques"— y nadie sumaba el total.
       Un jugador cuenta ANTES de decidir.

       Solo cuenta lo determinista con el tablero actual: ataques
       directos si no tiene monstruos, y el exceso sobre los que sí
       tiene. Si el rival tiene tapadas, la cuenta sigue valiendo —puede
       haber una trampa, pero no atacar es perder seguro—, aunque no se
       fuerza el remate si eso implica suicidarse contra una defensa
       conocida.
       ══════════════════════════════════════════════════════════════ */
    const hayLethal = (() => {
      if(!exp("rematar")) return false;
      const defensores = rivales.filter(r => !r.bocaAbajo ? true : true);
      const libres = ataques.map(a => a.c).filter(c => atk(c) > 0);
      if(!libres.length) return false;
      if(!rivales.length){
        const total = libres.reduce((t,c) => t + atk(c), 0);
        return total >= v.lp.rival;
      }
      /* Con monstruos delante: se empareja cada atacante con el defensor
         que puede romper, y el resto pega directo solo si no queda
         ninguno. Es una cota INFERIOR del daño, así que si esto dice que
         hay lethal, lo hay de verdad. */
      const suyos = rivales.map(r => (r.bocaAbajo && r.conocida)
        ? { ...r, datos:r.conocida.datos, bocaAbajo:false } : r);
      const puedenRomper = suyos.every(r =>
        libres.some(c => atk(c) > poder(r)));
      if(!puedenRomper) return false;
      if(libres.length <= suyos.length) return false;   // no sobra nadie para pegar directo
      const ordenados = [...libres].sort((a,b)=>atk(b)-atk(a));
      const directos = ordenados.slice(suyos.length);
      const daño = directos.reduce((t,c)=>t+atk(c), 0);
      return daño >= v.lp.rival;
    })();
    /* ══ LETAL QUE SOLO SE VE JUGANDO LOS ATAQUES ══
       E, 25-09 (Reasoning Gate OTK, p1, T3): DMoC (2800) y Blowback Dragon
       (2300) contra una Injection Fairy Lily y 3800 LP, y la IA no atacó.
       Si le ataca el DMoC, o no paga (2400 de daño) o paga 2000 y se queda
       a 1800: el Blowback que viene detrás le mata la Lily (ya no puede
       pagar) o le pega directo. Es letal hagan lo que hagan, y la cuenta de
       arriba no lo ve porque suma ataques, no los juega.
       Se busca a fondo (son cinco monstruos como mucho): yo elijo atacante
       y objetivo, él elige si paga; letal si gano contra todas sus
       respuestas. Solo con lo que se ve: una tapada que no conozco bloquea. */
    let lineaLetal = null;
    const letalJugado = !hayLethal && exp("letalExacto") ? (() => {
      const mios = ataques.map(a => ({ i:a.i, atk:atk(a.c), doble: canon(a.c.nombre ?? "") === "Black Luster Soldier - Envoy of the Beginning" }))
                          .filter(a => a.atk > 0);
      if(!mios.length) return false;
      const suyos0 = rivales.map(r => {
        const x = (r.bocaAbajo && r.conocida) ? { ...r, datos:r.conocida.datos, bocaAbajo:false, defensa:true } : r;
        if(x.bocaAbajo) return { uid:r.uid, oculta:true };
        const inf = infoDe(x);
        return { uid:r.uid, defensa:!!x.defensa, atk:atk(x), def:def(x), sube:inf.atkSiPaga ?? 0, cuesta:inf.costeLPAtaque ?? 0,
                 inmune:!!inf.inmuneCombate };
      });
      let pasos = 0;
      const gana = (quedan, suyos, lp, linea) => {
        if(lp <= 0) return linea ?? true;
        if(++pasos > 20000 || !quedan.length) return false;
        for(let k = 0; k < quedan.length; k++){
          const a = quedan[k], resto = quedan.filter((_, j) => j !== k);
          const blancos = suyos.length ? suyos : [null];
          for(const t of blancos){
            if(t?.oculta) continue;                          // no sé qué es: no la cuento
            const respuestas = [];
            if(!t) respuestas.push({ lp: lp - a.atk, suyos, sigue:false });
            else {
              const opciones = [{ paga:false }];
              if(!t.defensa && t.sube && lp > t.cuesta) opciones.push({ paga:true });
              for(const o of opciones){
                const lpR = o.paga ? lp - t.cuesta : lp;
                const suAtk = t.atk + (o.paga ? t.sube : 0);
                let lp2 = lpR, suyos2 = suyos, sigue = false;
                if(t.defensa){ if(a.atk > t.def && !t.inmune){ suyos2 = suyos.filter(x => x !== t); sigue = true; } }
                else if(a.atk > suAtk){ lp2 = lpR - (a.atk - suAtk); if(!t.inmune){ suyos2 = suyos.filter(x => x !== t); sigue = true; } }
                else if(a.atk === suAtk && !t.inmune){ suyos2 = suyos.filter(x => x !== t); }
                respuestas.push({ lp: lp2, suyos: suyos2, sigue });
              }
            }
            /* Él elige la respuesta que peor me viene; BLS vuelve a atacar si mató. */
            const todas = respuestas.every(rp => {
              const siguientes = (a.doble && rp.sigue) ? [...resto, { ...a, doble:false }] : resto;
              return !!gana(siguientes, rp.suyos, rp.lp, true);
            });
            if(todas){ if(linea == null) lineaLetal = { i:a.i, uid:t?.uid ?? null }; return true; }
          }
        }
        return false;
      };
      return !!gana(mios, suyos0, v.lp.rival, null);
    })() : false;
    if(letalJugado && lineaLetal){
      traza(`LETHAL jugando los ataques: primero ${ataques.find(a=>a.i===lineaLetal.i)?.c?.nombre}, el rival está a ${v.lp.rival}`);
      objetivoLetal = lineaLetal.uid;
      const a0 = ataques.find(a => a.i === lineaLetal.i);
      ultimoAtacante = a0.c;
      return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:a0.i };
    }
    if(hayLethal){
      traza(`LETHAL: ataco con todo, el rival está a ${v.lp.rival}`);
      const todos = ataques.map(a=>({ ...a, p: 90 + atk(a.c)/1000 }))
                           .sort((a,b)=>b.p-a.p);
      if(intento < todos.length){
        ultimoAtacante = todos[intento].c;
        return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:todos[intento].i };
      }
    }

    /* ══ GUÍA P10 / C24 · NO LIBERAR UNA MESA BLOQUEADA ══
       Cinco zonas del rival llenas de cuerpos que no me hacen nada (las
       fichas de Scapegoat, sobre todo) son un candado: no puede invocar
       nada sin sitio. Atacarle una ficha le devuelve una zona. Si además
       su mazo se acaba antes que el mío, pasar gana solo: el reloj del
       mazo corre a mi favor y él no tiene por dónde salir. Todo boca
       arriba (una tapada puede ser cualquier cosa) y nada suyo que rompa
       lo mío. */
    const mesaBloqueada = (() => {
      if(!exp("bloqueo") || rivales.length < 5) return false;
      if(rivales.some(r=>r.bocaAbajo)) return false;
      const miMenor = Math.min(...v.monstruos.map(x=>poder(x)));
      if(!v.monstruos.length || rivales.some(r=>atk(r) >= miMenor)) return false;
      const suMazo = v.deckRestanteRival ?? 99, miMazo = v.deckRestante ?? 0;
      return suMazo <= 10 && suMazo + 2 <= miMazo;
    })();
    if(mesaBloqueada){
      traza(`no ataco: su mesa está llena y bloqueada, y su mazo (${v.deckRestanteRival}) se acaba antes que el mío (${v.deckRestante})`);
      return { type:R.SELECT_BATTLECMD, action: m.to_m2?BA.TO_M2:BA.TO_EP, index:null };
    }

    const puntuados = ataques.map(a=>({ ...a, p:valeAtacar(a.c) }))
                             .filter(a=>a.p > 0.2)
                             .sort((a,b)=> (b.p-a.p) || (atk(b.c)-atk(a.c)));

    /* Freno con motivo: si el rival tiene tapadas, aún no ha enseñado la
       trampa de masa y tú ya vas ganando, no metas todo el campo. */
    const trampasFuera = rivalUso(v,"Mirror Force") || rivalUso(v,"Torrential Tribute");
    const prudente = !trampasFuera && v.tapadasRival>=2 && v.monstruos.length>=3
                     && ventaja(v)>2 && v.lp.rival>3000;
    let lista = prudente ? puntuados.slice(0,1) : puntuados;
    /* ══ PRIMERO EL CEBO (contexto) ══
       Principio (Lessons of the Game: «no evites las trampas, cébalas»
       con monstruos baratos como Sangan o Sinister Serpent). Con backrow
       suyo sin leer, el primer ataque es el que se come Sakuretsu Armor,
       Negate Attack o Waboku: que lo declare el monstruo que menos duele
       perder —un floater que se repone, uno pequeño—, y que la pieza que
       gana (Airknight, BLS) ataque cuando ya se ha visto la respuesta.
       No aplica con letal (ahí manda el orden del remate). */
    const ctxB = contexto(v);
    if(ctxB && exp("cebo") && ctxB.riesgoTrampa >= 0.3 && lista.length >= 2 && intento === 0){
      const precio = a => valorCarta(a.c) + atk(a.c)/2000 + (exp("planBatalla") ? PLAN.peso(a.c.nombre)*0.5 : 0)
                          - (infoDe(a.c).rol === "floater" ? 0.6 : 0);
      const cebo = [...lista].filter(a => a.p >= 0.5).sort((a,b) => precio(a) - precio(b))[0];
      if(cebo && cebo !== lista[0]){
        traza(`primero ${cebo.c.nombre} de cebo: su backrow sin leer (${Math.round(ctxB.riesgoTrampa*100)}% trampa)`);
        lista = [cebo, ...lista.filter(a => a !== cebo)];
      }
    }

    if(intento < lista.length){
      ultimoAtacante = lista[intento].c;
      traza(`ataca con ${lista[intento].c.nombre}`, { valor:+lista[intento].p.toFixed(2) });
      return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:lista[intento].i };
    }
    return { type:R.SELECT_BATTLECMD, action: m.to_m2?BA.TO_M2:BA.TO_EP, index:null };
  }

  /* ══════════ CADENAS ══════════ */
  /* ══════════ LA PRIORIDAD (reglas de 2005) ══════════
     goatformat.com, «6 Facts That You Should Know About Priority» y
     «Basic Mechanics»: después de una invocación, el jugador del turno
     puede activar un efecto de IGNICIÓN antes de que el rival pueda
     responder («Player A Summons Tribe-Infecting Virus. Player A can
     activate the effect of Tribe-Infecting Virus before Player B can
     activate Book of Moon»). Y solo hay UNA ventana para responder a una
     invocación: si el jugador del turno la pasa, el rival responde ahí.

     El motor lo hace así (MODE_GOAT lleva OBSOLETE_IGNITION, comprobado en
     check-prioridad.mjs): tras la invocación llega un SELECT_CHAIN al
     jugador del turno con el efecto del monstruo, y solo si lo pasa llega
     la ventana del rival. La IA lo pasaba siempre —el efecto de un
     monstruo propio no tenía nota en cadena() y salía por debajo del
     umbral— y lo usaba después en la Main Phase, cuando el rival ya había
     podido tumbarlo con Book of Moon o romperlo con Ring.

     Replays del GFCEU 2026 (101): cuando el jugador usa el efecto de BLS,
     Chaos Sorcerer o TIV, lo hace en esa ventana; lo que el rival le
     responde antes es Solemn o Torrential, que van contra la invocación. */
  /* El tipo que más rinde a Tribe-Infecting Virus: lo boca arriba de ese
     tipo se destruye en los dos lados (también el propio Virus si fuera
     Aqua). Devuelve null si no hay nada suyo boca arriba. */
  const NOMBRE_TIPO = { 0x1:"Guerrero", 0x2:"Lanzador de Conjuros", 0x4:"Hada", 0x8:"Demonio", 0x10:"Zombi",
    0x20:"Máquina", 0x40:"Aqua", 0x80:"Piro", 0x100:"Roca", 0x200:"Bestia Alada", 0x400:"Planta",
    0x800:"Insecto", 0x1000:"Trueno", 0x2000:"Dragón", 0x4000:"Bestia", 0x8000:"Bestia-Guerrero",
    0x10000:"Dinosaurio", 0x20000:"Pez", 0x40000:"Serpiente Marina", 0x80000:"Reptil", 0x100000:"Psíquico" };
  const tipoDe = x => { try { return BigInt(x?.datos?.race ?? 0); } catch(e){ return 0n; } };
  const valorEnMesa = x => esFicha(x) ? 0.05 : valorCarta(x) + poder(x) / 2000;
  function mejorTipoTIV(v, uidVirus, disponibles = null){
    const suyos = v.monstruosRival.filter(x => !x.bocaAbajo);
    const mios  = v.monstruos.filter(x => !x.bocaAbajo);
    const tipos = new Set([...suyos, ...mios].map(tipoDe).filter(t => t));
    let mejor = null;
    for(const t of tipos){
      if(disponibles != null && !(disponibles & t)) continue;
      const s = suyos.filter(x => tipoDe(x) === t), mi = mios.filter(x => tipoDe(x) === t);
      const gana = s.reduce((a, x) => a + valorEnMesa(x), 0);
      const pierde = mi.reduce((a, x) => a + valorEnMesa(x) + (x.uid === uidVirus ? 0.8 : 0), 0);
      const r = { tipo:t, nombre: NOMBRE_TIPO[Number(t)] ?? `tipo ${t}`, gana, pierde, suyos:s.length, mios:mi.length,
                  dejaVacio: s.length === v.monstruosRival.length };
      if(!mejor || (r.gana - r.pierde) > (mejor.gana - mejor.pierde)) mejor = r;
    }
    return mejor && mejor.suyos ? mejor : null;
  }
  const IGNICION_PELIGROSA = {
    "Black Luster Soldier - Envoy of the Beginning": v => v.monstruos.length > 0,
    "Chaos Sorcerer":        v => v.monstruos.some(x => !x.bocaAbajo),
    "Tribe-Infecting Virus": v => v.monstruos.some(x => !x.bocaAbajo && !esFicha(x)) && (v.manoRival?.cuantas ?? 0) > 0,
    "Exiled Force":          v => v.monstruos.length > 0,
    "Thousand-Eyes Restrict":v => v.monstruos.some(x => !x.bocaAbajo && !esFicha(x)),
    "Breaker the Magical Warrior": (v, x) => v.backrow.length > 0 && (duel.cards?.get?.(x.uid)?.contadores ?? 1) > 0,
  };
  /* El monstruo que el RIVAL acaba de invocar y con el que puede hacer algo
     que me duela en cuanto tenga la mano: si me llega a mí la ventana, es
     que ha pasado la prioridad sin usarlo. */
  const recienInvocadoSuyo = (v, arriba) => {
    const ui = duel.ultimaInvocada;
    if(!ui || ui.turno !== duel.turnCount || v.turnoMio || arriba) return null;
    if(![0x4, 0x100].includes(v.fase)) return null;
    const x = v.monstruosRival.find(r => r.uid === ui.uid && !r.bocaAbajo);
    if(!x) return null;
    const cond = IGNICION_PELIGROSA[canon(x.nombre ?? "")];
    return cond && cond(v, x) ? x : null;
  };
  /* ¿Activaría ahora este efecto en mi Main Phase? Se le pregunta a la
     misma heurística con una lista de jugadas que solo tiene esa. */
  const loActivariaAhora = l => {
    const g = { plan: ultimoPlanIdle, letal: objetivoLetal, prest: objetivoPrestamo, giro: giroPendiente };
    try{
      const falso = { type:T.SELECT_IDLECMD, player:yo, summons:[], special_summons:[], pos_changes:[],
                      monster_sets:[], spell_sets:[], activates:[l],
                      to_bp: duel.phase === 0x4 && duel.turnCount > 1, to_ep:true };
      const r = mainPhase(falso, 0);
      return r?.action === IA.SELECT_ACTIVATE;
    } finally {
      ultimoPlanIdle = g.plan; objetivoLetal = g.letal; objetivoPrestamo = g.prest; giroPendiente = g.giro;
    }
  };

  function cadena(m, intento){
    puntosCadena = [];
    const v = vistaDe(duel, yo, db, names);
    const opciones = (m.selects||[]).map((l,i)=>({ i, c:cartaDeLista(l) }));
    if(!opciones.length) return { type:R.SELECT_CHAIN, index:null };
    if(m.forced) return { type:R.SELECT_CHAIN, index: intento % opciones.length };

    /* Los niveles bajos no responden en el turno rival: la mitad de las
       trampas de Goat se quedan sin usar y se nota mucho en el marcador. */
    if(lastre.sinCadenas) return { type:R.SELECT_CHAIN, index:null };
    // lastre: responde con lo primero que tenga, sin pensar si toca
    if(lastre.cadenaTonta) return { type:R.SELECT_CHAIN,
      index: azar(.4) ? ((aleatorio()*opciones.length)|0) : null };

    /* NUNCA responder a tu propia carta. En el duelo del 2026-08-10 el
       bot experto negó su propio Trap Dustshoot con Solemn Judgment y
       pagó media vida por nada: veía "hay ventana de respuesta y tengo
       una contra-trampa" sin mirar de quién era el eslabón de arriba. */
    const arriba = duel.cadena?.[duel.cadena.length-1] ?? null;

    /* CONTRA QUÉ estoy respondiendo. Sin esto la ventana de cadena era
       ciega: la IA veía "puedo activar algo" y lo activaba, gastando una
       Sakuretsu Armor en un Sinister Serpent de 300 o media vida de Solemn
       Judgment en un Book of Moon. La mitad de Goat se juega aquí. */
    const desdeCodigo = code => code ? { code, nombre:names[code]?.name ?? "",
                                         datos:db.get(code) ?? null } : null;
    /* El atacante tiene que SEGUIR en su campo. E, 02-10 (Warrior, p2, T4):
       la Sakuretsu destruyó a su D.D. Warrior Lady y en la ventana
       siguiente `duel.atacante` seguía apuntando a ella: la IA tiró Book of
       Moon «contra el atacante», y el único objetivo legal era su Spirit
       Reaper YA en defensa. «No tiene sentido hacer Book of Moon a algo
       que ya he puesto yo en defensa». */
    /* Y BOCA ARRIBA: un atacante que un Book of Moon ha dado la vuelta ya no
       ataca, y su ATK real es información oculta (check-frontera, 02-10:
       Des Lacooda volteado boca abajo seguía siendo «el atacante»). */
    const atacanteVivo = !exp("atacanteVivo") || (duel.atacante && v.monstruosRival.some(x => x.uid === duel.atacante.uid && !x.bocaAbajo));
    const cartaAtacante = duel.cards?.get(duel.atacante?.uid);
    const atacante = (duel.atacante && duel.atacante.controller!==yo && atacanteVivo)
      ? { ...desdeCodigo(duel.atacante.code),
          atkReal: (cartaAtacante && !((cartaAtacante.position ?? 0) & 0x0a)) ? (cartaAtacante.atkReal ?? null) : null } : null;
    const negando = (arriba && arriba.controller!==yo) ? desdeCodigo(arriba.code) : null;
    const BATALLA = [0x8,0x10,0x20,0x40,0x80];
    const enBatalla = BATALLA.includes(v.fase);
    const enEnd     = v.fase === 0x200;
    /* Una tapada suya colocada este mismo turno: no puede responder. */
    const frescaRival = () => v.backrowRival.find(x => x.bocaAbajo && x.puestaTurno === v.turno) ?? null;

    /* ── MI PRIORIDAD: el efecto del monstruo que acabo de invocar ── */
    if(exp("prioridad") && duel.turnPlayer === yo && !arriba){
      const ui = duel.ultimaInvocada;
      const recien = ui && ui.turno === duel.turnCount ? ui.uid : null;
      for(const o of opciones){
        const l = m.selects[o.i];
        if(recien == null || Number(l.location) !== 4 || l.controller !== yo || o.c?.uid !== recien) continue;
        if(loActivariaAhora(l)){
          traza(`prioridad: uso el efecto de ${o.c.nombre} antes de que el rival pueda responder a la invocación`);
          if(CHAOS_REUSO.has(canon(o.c.nombre ?? ""))) efectoUsadoTurno.set(o.c.uid, duel.turnCount);
          return { type:R.SELECT_CHAIN, index:o.i };
        }
      }
    }
    /* ── SU PRIORIDAD, PASADA: responder antes de que use el efecto ── */
    const suRecien = exp("prioridadRival") ? recienInvocadoSuyo(v, arriba) : null;
    const sinReserva = new Set();
    const guardadasDetras = new Set();

    const puntuar = o => {
      const inf = infoDe(o.c), nom = canon(o.c.nombre);
      if(exp("atadura") && ataduraSinBlanco(v, o.c)) return -1;
      if(negadaPorDecreto(v, o.c)) return -1;
      /* El rival ha invocado BLS, Chaos Sorcerer, TIV… y me ha pasado la
         ventana sin usar el efecto: en cuanto tenga la mano lo usará, y
         entonces tumbarlo o romperlo ya no lo para. Book of Moon ahora lo
         deja boca abajo el turno entero (lo invocado este turno no puede
         voltearse), y Ring lo quita antes de que haga nada. */
      if(suRecien && nom === "Book of Moon"){
        sinReserva.add(o.i);
        return 5.5;
      }
      if(suRecien && inf.rol === "removal" && inf.rapida && nom === "Ring of Destruction"){
        const golpe = poder(suRecien);
        if(v.lp.mio <= golpe) return -1;                 // Ring de antes de la errata: me mata a mí
        sinReserva.add(o.i);
        return v.lp.rival <= golpe ? 9 : 5.0;
      }
      /* Scapegoat se encadena en el turno rival, sí, pero además LO MÁS
         TARDE POSIBLE: en la End Phase o cortando un ataque. Quemarla en
         la Main Phase 1 del rival le enseña las fichas y le deja todo el
         turno para responderlas. */
      if(nom==="Scapegoat"){
        if(v.turnoMio) return -1;
        if(!enBatalla && !enEnd) return 0.5;        // aún es pronto
        /* ══ LAS FICHAS SALEN CONTRA EL GOLPE DIRECTO, NO AL ENTRAR EN BATALLA ══
           E, 02-10 (Warrior, p1, T2): «Scapegoat se guarda para evitar daño
           directo o para Metamorphosis. Usarlo en mi Battle Phase teniendo
           un monstruo en tu campo no es el momento. Cuando vaya a pegarte
           directamente, ahí sí. Así el oponente nunca sabe si es otra
           carta». En batalla: con el ataque directo ya declarado (las
           fichas obligan a repetirlo), o si lo que queda por pegar me mata.
           Si no, a su End Phase, que es donde las fichas sirven de material. */
        if(exp("cabrasAlGolpe") && enBatalla){
          if(atacante && !duel.objetivoAtaque) return 6;
          if(atacante){
            const detras = v.monstruosRival.filter(x => !x.bocaAbajo && !x.defensa && atk(x) > 0
                             && x.uid !== duel.atacante?.uid && x.atacoTurno !== v.turno);
            const golpe = detras.reduce((t, x) => t + atkEnCombate(x, v.lp.rival), 0);
            if(golpe >= v.lp.mio) return 6;
          }
          return 0.5;
        }
        return v.monstruos.length===0 ? 6 : 3;
      }
      /* ══ TRAP DUSTSHOOT: EN CUANTO ROBA ══
         E, 20-09 (Zombie, p1, T18): «Trap Dustshoot no activada tras su
         Draw Phase con 4 cartas». No tenía regla y la nota por defecto
         (2) quedaba bajo el umbral. Pide 4+ cartas en su mano: la mejor
         ventana es su Draw/Standby (acaba de robar y aún no ha bajado
         nada); en su Main Phase sigue valiendo mientras le queden 4. */
      /* ══ PHOENIX WING WIND BLAST: DEVOLVER, NO DESTRUIR ══
         goatformat, «Phoenix Wing: An Often Overlooked Gem»: contra un
         atacante o una amenaza, devolverlo encima del mazo no dispara
         floaters ni le llena el cementerio para el Chaos; en su End Phase
         sobre una tapada es un «Time Seal»: su próximo robo es esa carta.
         Cuesta un descarte: sin descarte barato, pierde valor. */
      if(nom==="Phoenix Wing Wind Blast"){
        const otras = v.mano.filter(h => h.uid !== o.c?.uid);
        if(!otras.length) return -1;
        const peor = Math.min(...otras.map(h => valorCarta(h)));
        const coste = peor >= 1.6 ? 1.2 : peor >= 1.1 ? 0.5 : 0;
        if(!v.monstruosRival.length && !v.backrowRival.length) return -1;
        if(v.turnoMio) return 1.0 - coste;
        if(atacante && (atk(atacante) >= 1600 || v.monstruos.every(x => x.bocaAbajo || atk(x) <= atk(atacante))))
          return 4.0 - coste;
        const amenaza = v.monstruosRival.filter(x => !x.bocaAbajo && !esFicha(x)).sort((a,b)=>valorCarta(b)-valorCarta(a))[0];
        if(amenaza && (valorCarta(amenaza) >= 1.6 || canon(amenaza.nombre ?? "") === "Thousand-Eyes Restrict")) return 3.4 - coste;
        if(enEnd && v.monstruosRival.some(x => x.bocaAbajo)) return 3.0 - coste;
        return 1.0 - coste;
      }
      if(nom==="Trap Dustshoot"){
        const suMano = v.manoRival?.cuantas ?? 0;
        if(suMano < 4) return -1;
        if(v.turnoMio) return 1.2;                 // mejor en su turno, recién robado
        if(v.fase === 0x1 || v.fase === 0x2) return 3.8;
        return v.fase === 0x4 ? 3.0 : 2.6;
      }
      if(nom==="Book of Moon"){
        /* LA JUGADA QUE MÁS SALÍA EN EL ESCÁNER: 194 veces en 300 partidas,
           el bot encadenaba su propia Book of Moon a su propia invocación,
           con el campo rival vacío o solo con tapadas. Aquí no había
           condición ninguna: "puedo encadenar algo" era razón suficiente.
           Book of Moon es del turno del rival: tumba al que ataca o apaga
           un efecto. En el tuyo, y sin nada boca arriba enfrente, no hace
           absolutamente nada. */
        if(v.turnoMio) return -1;
        /* ══ EN SU MAIN PHASE NO CORTA NADA ══
           E, 19-09: Book of Moon a su Ryu Kokki en respuesta a un
           Reinforcement of the Army; él lo volteó de nuevo al momento y
           en la Battle Phase la IA gastó OTRA. Tumbar un monstruo en la
           Main Phase del rival no para nada: lo vuelve a voltear gratis.
           Se guarda para la batalla (el ataque, o la entrada en la Battle
           Phase, donde ya no puede voltearlo). */
        if(exp("bomBatalla") && !atacante && !enBatalla) return -1;
        /* ══ CREATURE SWAP NO APUNTA ══
           E, torneo del 18-09 tarde: «turno 2 book of moon no me
           interrumpe el cambiarte el monstruo con creature swap». Creature
           Swap no selecciona: cada jugador escoge al resolverse, y un
           monstruo boca abajo se cambia igual. Tumbar algo en respuesta
           no para nada; es tirar la carta. */
        if(!atacante && negando && rolDe(negando) === "swap") return -1;
        /* ══ SI EL QUE ATACA ES MÍO ROBADO, TUMBAR A OTRO NO PARA NADA ══
           GitHub #15: me robó Don Zaloog con Snatch Steal y atacó con D.D.
           Warrior Lady y luego con el Zaloog. Al segundo ataque la IA tumbó
           a la Lady, que YA había atacado. Al robado no se le tumba (ver
           `noTumbarRobado`: se lo quedaría), así que el ataque en curso no
           se para; solo vale tumbar algo suyo que aún no haya atacado. */
        if(exp("noTumbarRobado") && atacante && duel.cards?.get(duel.atacante?.uid)?.owner === yo){
          const aunPegan = v.monstruosRival.filter(x => !x.bocaAbajo && !x.defensa && !esFicha(x)
            && x.uid !== duel.atacante?.uid && x.atacoTurno !== v.turno && duel.cards?.get(x.uid)?.owner !== yo);
          if(!aunPegan.length) return -1;
        }
        /* ══ LO QUE YA VA A QUEDAR BOCA ABAJO ══
           E, 20-09 (Zombie, p1, T4): Ring of Destruction a su Pyramid
           Turtle atacante, él respondió con Book of Moon a su propia
           tortuga (para que el Ring no la encuentre boca arriba) y la IA
           encadenó OTRA Book of Moon a la misma tortuga. Resultado igual
           con o sin la segunda: el ataque se para y el Ring falla. Si el
           eslabón de arriba ya tumba a ese monstruo, la mía no añade nada. */
        if(exp("bomRedundante") && negando && ["Book of Moon","Tsukuyomi"].includes(canon(negando.nombre ?? ""))){
          const blanco = atacante ? duel.atacante?.uid : null;
          const señalados = duel.objetivosCadena ?? new Set();
          const suyosCaraArriba = v.monstruosRival.filter(x => !x.bocaAbajo && !esFicha(x) && !x.defensa);
          if((blanco != null && señalados.has(blanco))
             || (suyosCaraArriba.length && suyosCaraArriba.every(x => señalados.has(x.uid)))) return -1;
        }
        /* Una FICHA no se puede poner boca abajo: Book of Moon no la
           admite como objetivo. Contarla como objetivo hacía que el bot
           activara Book of Moon con el rival lleno de ovejas… y el único
           objetivo legal era su propio monstruo. 8 de cada 200 partidas.
           ══ Y LO QUE YA ESTÁ EN DEFENSA NO AMENAZA ══
           E, mismo torneo, turno 12: «book of moon a una carta que estaba
           en defensa ya». Un monstruo en defensa no ataca: tumbarlo no
           corta nada. Solo el atacante o lo que está de frente cuenta. */
        const objetivo = atacante ?? v.monstruosRival.find(c=>!c.bocaAbajo && !esFicha(c) && !c.defensa);
        if(!objetivo) return -1;
        /* Y contra qué. Tumbar un Sinister Serpent de 300 que ataca a tu
           Airknight es tirar la carta: tu monstruo ya gana ese combate.
           Book of Moon es para lo que NO puedes parar de otra forma. */
        if(n>=2 && atacante){
          const meLoComo = v.monstruos.some(x=>!x.bocaAbajo && !x.defensa
                                            && atk(x) > atk(atacante));
          if(meLoComo) return -1;
          /* ══ EL ATAQUE QUE YA REBOTA NO SE PARA ══
             E, 25-09 (Chaos Turbo, p3, T3): Breaker (1600) atacó a mi
             Gravekeeper's Spy tapado (2000 de defensa) y la IA le tiró Book
             of Moon. El Breaker se estrellaba solo y E se comía 400. Mi
             carta la conozco aunque esté tapada: si defiende más de lo que
             pega el atacante, no hace falta nada. */
          if(exp("bomRebota") && duel.objetivoAtaque){
            const mio = v.monstruos.find(x => x.uid === duel.objetivoAtaque.uid);
            if(mio && (mio.bocaAbajo || mio.defensa) && def(mio) > atk(atacante)) return -1;
          }
          /* ══ NO SE GASTA UNA CARTA EN SALVAR LO QUE NO CUESTA PERDER ══
             E, 02-10: Book of Moon para salvar un Sinister Serpent tapado
             (dos veces, Goat Control p3: vuelve solo a la mano en la
             Standby) y otra para salvar una ficha de Scapegoat (Zombie p2).
             En defensa no me como daño; si lo que atacan es una ficha, un
             recurso que vuelve o un floater que busca al morir, perderlo
             no cuesta nada y la Book of Moon se queda para algo de verdad. */
          /* E, 03-10 (Reino, T2): «al haber hecho ya Waboku, Book of Moon
             es overkill: tu monstruo no iba a recibir daño igualmente». */
          if(exp("wabokuCubre") && protegidoEnTurno === duel.turnCount) return -1;
          if(exp("bomNoSalva") && duel.objetivoAtaque){
            const mio = v.monstruos.find(x => x.uid === duel.objetivoAtaque.uid);
            if(mio && (mio.bocaAbajo || mio.defensa)
               && (esFicha(mio) || infoDe(mio).rol === "recurso" || (rolDe(mio) === "floater" && valorCarta(mio) < 1.5))) return -1;
          }
        }
        return n>=2 ? 3.5 : 2;
      }
      /* ══ THREATENING ROAR SE ACTIVA ANTES DEL ATAQUE ══
         E, 25-09 (PACMAN, p1, T4): «Threatening Roar ha de activarse antes
         del battle step, no durante el ataque, porque no funciona». Impide
         DECLARAR ataques: el ataque ya declarado sigue. Su ventana es la
         entrada del rival en la Battle Phase (antes del primer ataque); con
         un ataque en curso solo vale si lo que queda detrás es lo que mata. */
      if(inf.rol==="antiAtaque"){
        if(v.turnoMio) return -1;
        const pegan = v.monstruosRival.filter(x => !x.bocaAbajo && !x.defensa && atk(x) > 0);
        if(!pegan.length) return -1;
        const golpeTotal = pegan.reduce((t, x) => t + atk(x), 0);
        const miMuro = Math.max(0, ...v.monstruos.filter(x => !x.bocaAbajo || x.defensa).map(x => poder(x)));
        const peligro = v.lp.mio <= golpeTotal ? 9
                      : (golpeTotal - miMuro >= 1500 || pegan.some(x => v.monstruos.some(y => !y.bocaAbajo && poder(y) < atk(x)))) ? 4.2
                      : golpeTotal >= 1400 ? 2.8 : 0.4;
        if(atacante){
          /* Este ataque pasa igual: solo cuenta lo que viene detrás. */
          const detras = pegan.filter(x => x.uid !== duel.atacante?.uid && x.atacoTurno !== v.turno);
          const resto = detras.reduce((t, x) => t + atk(x), 0);
          if(v.lp.mio - atk(atacante) <= resto && resto > 0) return 6;
          return -1;
        }
        if(enBatalla) return peligro;
        /* Su Main Phase: aún puede no ir a la batalla; mejor esperar a que entre. */
        return Math.min(peligro, 0.5);
      }
      /* ══ SISTEMA C · REACTIVAS CON CONDICIÓN, NO CON VENTANA ══
         Una ventana de respuesta no es una razón para responder. Estas
         dos salían en el log de E gastadas a nada. */
      if(inf.rol==="proteccionBatalla"){
        /* Waboku anula el daño de batalla DE ESTE TURNO. En tu propio
           turno no hay ataques que anular: la carta se tira. Y aun en el
           turno del rival, hace falta que haya un ataque de verdad o al
           menos algo que pueda atacar. */
        if(v.turnoMio) return -1;
        if(protegidoEnTurno === duel.turnCount) return -1;   // ya estoy cubierto
        if(!enBatalla) return 0.2;
        if(!atacante){
          const puedenPegar = v.monstruosRival.filter(x=>!x.bocaAbajo && !x.defensa);
          if(!puedenPegar.length) return -1;
          /* E, 03-10 (Reino, Ghost Kaiba, T2): Waboku al empezar su
             batalla, sin ataque declarado, y encima luego Book of Moon. Al
             entrar en batalla todavía no sé a qué ataca (ni si ataca): se
             espera al ataque, salvo que lo que tiene de frente me mate. */
          const golpeTotal = puedenPegar.reduce((t, x) => t + atkEnCombate(x, v.lp.rival), 0);
          if(exp("wabokuEspera") && golpeTotal < v.lp.mio) return 1.0;
        }
        /* Y cuánto vale: lo que me ahorro. Anular 400 de daño no es
           gastar una carta; salvar el monstruo o media vida, sí. */
        const golpe = atacante ? atk(atacante) : pegaMasFuerte(v, { conMano:false });
        const miMejorDefensor = v.monstruos.filter(x=>!x.bocaAbajo)
                                 .reduce((mx,x)=>Math.max(mx, poder(x)), 0);
        const dañoQueEvito = Math.max(0, golpe - miMejorDefensor);
        const meSalvaElCuerpo = !!atacante && v.monstruos.some(x=>!x.bocaAbajo && poder(x) < golpe);
        if(v.lp.mio <= golpe) return 9;                       // o esto, o pierdo
        if(dañoQueEvito >= 1500 || meSalvaElCuerpo) return 4.2;
        if(dañoQueEvito >= 800) return 2.8;
        return 0.4;
      }
      if(inf.rol==="quemaPorMonstruos"){
        /* Just Desserts: 500 por cada monstruo que tenga el rival. Con un
           solo monstruo son 500 puntos, o sea nada, y la carta ya no está
           para cuando de verdad rematan. Se juega si mata, si el daño es
           relevante, o si la voy a perder igualmente. */
        const cabezas = v.monstruosRival.length;
        const porCabeza = inf.porCabeza ?? 500;
        const daño = cabezas * porCabeza;
        if(daño <= 0) return -1;
        if(daño >= v.lp.rival) return 9.5;                    // lethal: máxima prioridad
        /* ¿Se va a perder de todas formas? Si el rival está resolviendo
           algo que barre el backrow, mejor cobrarla ahora. */
        const laVoyAPerder = !!negando &&
          ["massRemoval","spellRemoval"].includes(rolDe(negando));
        if(laVoyAPerder && daño > 0) return 3.2;
        const trozo = daño / Math.max(1, v.lp.rival);
        if(trozo >= 0.35) return 4.6;                         // más de un tercio de su vida
        if(trozo >= 0.20) return 2.9;
        return 0.3;                                           // daño irrelevante: se guarda
      }

      /* ── ANTES QUE NINGUNA RAMA POR ROL ──
         `conocer()` inventa un rol para las cartas que no están en la
         tabla: toda trampa sale como "trapRemoval". Con este bloque
         DEBAJO de esa rama, Skull Lair y Raigeki Break —que no tienen
         caso escrito— cogían la nota genérica de trapRemoval (4) y se
         encadenaban con el campo rival vacío. Lo cazó el banco de
         posiciones. Un rol deducido no es información: es un hueco. */
      /* ══ CALL OF THE HAUNTED, EN SU TURNO O AL ENTRAR EN MI BATALLA ══
         Replays del GFCEU 2026: los jugadores activan Call en el turno
         RIVAL el 35 % de las veces (la IA, 0 %). En su End Phase lo que
         sale está listo para pegar en mi turno y esquiva su remoción de
         Main Phase; contra un ataque directo es un bloqueo por sorpresa.
         En mi turno, al entrar en la Battle Phase, es un atacante más. */
      if(exp("callTurnoRival") && inf.rol === "revival" && esTrampa(o.c)){
        const mejor = v.cementerio.filter(x => ((Number(x.datos?.type) || 0) & 0x1)
                          && infoDe(x).rol !== "recurso" && !infoDe(x).espiritu)
                        .sort((a,b) => atk(b) - atk(a))[0];
        if(!mejor) return -1;
        if(!v.turnoMio){
          if(enEnd) return atk(mejor) >= 1400 ? 3.6 : 0.5;
          if(atacante && !duel.objetivoAtaque)
            return (atk(mejor) >= atk(atacante) || v.lp.mio <= atk(atacante)) ? 4.0 : 1.0;
          return 0.5;
        }
        if(enBatalla && !arriba && !duel.atacante){
          const techo = Math.max(0, ...v.monstruosRival.filter(x => !x.bocaAbajo && !esFicha(x)).map(x => poder(x)));
          return (v.monstruosRival.length === 0 || atk(mejor) > techo) ? 3.4 : 0.5;
        }
        return 0.5;
      }
      if(inf.deducido){
        const gordo = amenazaMayor(v);
        const leido = utilidadLeida(names[o.c.code]?.desc, o.c.datos, v, {
          objetivoBueno: atacante ?? ((gordo && !esFicha(gordo)) ? gordo : null),
          lpRival: v.lp?.rival ?? 0,
          costeTributo: precioDelTributo(v, o.c),
          hayCadenaRival: !!negando,
        });
        return leido.p;
      }
      if(inf.rol==="trapInvocacion"){
        /* ══ SE JUEGA POR LA MESA, NO POR UN UMBRAL ══
           E, 18-09: «el bottomless traphole probablemente era mejor
           usarlo en el vamp, no esperar a un tribute summon. Hay que
           jugarlo dependiendo de la mesa, no de un threshold de atk». Se
           mira el monstruo que ACABA de invocar (`ultimaInvocada`, que es
           público) y qué le hace a MI mesa:
             · si me gana a lo que tengo, o me pega directo, vale mucho;
             · desterrar a uno que vuelve solo (Vampire Lord) o que se
               aprovecha de morir (floaters) vale más que destruirlo;
             · si no cambia nada y la carta es poca cosa, se guarda. */
        if(v.turnoMio) return -1;
        const u = duel.ultimaInvocada;
        const recien = u && u.turno === duel.turnCount
          ? v.monstruosRival.find(c2 => c2.uid === u.uid && !c2.bocaAbajo) : null;
        if(!recien || esFicha(recien)) return -1;
        const infR = infoDe(recien);
        const mios = v.monstruos.filter(x => !x.bocaAbajo).map(x => poder(x));
        const meAmenaza = !mios.length || atk(recien) > Math.max(...mios);
        let nota = 1.0 + valorCarta(recien) + (meAmenaza ? 2.4 : 0);
        if(inf.destierra && (infR.recurrente || infR.rol === "floater")) nota += 1.4;
        if(!meAmenaza && valorCarta(recien) < 1.3) nota = Math.min(nota, 0.6);
        return nota;
      }
      if(inf.rol==="rebote"){
        if(v.turnoMio) return -1;
        const u = duel.ultimaInvocada;
        const recien = u && u.turno === duel.turnCount
          ? v.monstruosRival.find(c2 => c2.uid === u.uid && !c2.bocaAbajo) : null;
        const obj = atacante ?? recien;
        if(!obj || esFicha(obj)) return -1;
        const mios = v.monstruos.filter(x => !x.bocaAbajo).map(x => poder(x));
        const meAmenaza = !mios.length || atk(obj) > Math.max(...mios);
        const nivel = Number(obj.datos?.level ?? 0) & 0xff;
        const caro = nivel >= 5 || ((Number(obj.datos?.type) || 0) & 0x40) !== 0   // tributo o Extra
                     || (u && u.uid === obj.uid && u.kind === "special");
        if(!meAmenaza && !caro) return -1;
        return 1.0 + (meAmenaza ? 2.0 : 0) + (caro ? 1.8 : 0) + valorCarta(obj) * 0.5;
      }
      if(inf.rol==="trapMass"){
        /* Trampa de masa. Lo que la hace buena no es que haya una ventana:
           es la DIFERENCIA de campo, y medida en VALOR, no en número.
           Dos observaciones de E:
             · la usaba como disparador de su propia invocación. Torrential
               salta cuando invoca cualquiera de los dos, y el bot no
               miraba de quién era el turno: se volaba su propio monstruo.
             · la usaba estando por delante, que es regalarla.
           Se activa cuando de verdad va perdiendo el campo. */
        if(nom==="Torrential Tribute" && v.turnoMio) return -1;
        const valorSuyo = v.monstruosRival.reduce((s,c2)=>
          s + (c2.bocaAbajo ? 1.0 : valorCarta(c2) + poder(c2)/2000), 0);
        const valorMio  = v.monstruos.reduce((s,c2)=>
          s + valorCarta(c2) + poder(c2)/2000, 0);
        if(valorSuyo <= valorMio + 0.4) return 0.3;   // saldría perdiendo
        return valorSuyo - valorMio >= 2 ? 6.5 : 3.0;
      }
      if(inf.rol==="trapRemoval"){
        // Sakuretsu y compañía: por un atacante que duela, no por cualquiera
        if(!atacante) return 4;
        /* Injection Fairy Lily pega con 3400 si su dueño puede pagar 2000. */
        const fuerza = exp("amenazaReal") ? atkEnCombate(atacante, v.lp.rival) : atk(atacante);
        /* ══ LA SAKURETSU ES PARA EL QUE VIENE DETRÁS ══
           E, 02-10 (Warrior, p2, T6): «la Sakuretsu hay que guardársela
           para Lily». Atacaba un Spirit Reaper (300, y con mi mano vacía
           su descarte no hacía nada) y detrás esperaba la Lily, que pega
           con 3400. Si lo que ataca pega poco y detrás hay alguien que
           pega de verdad, la trampa se guarda (y la simulación no la gasta). */
        if(exp("guardaParaDetras") && fuerza < 1700 && fuerza < v.lp.mio){
          const detras = v.monstruosRival.filter(x => !x.bocaAbajo && !x.defensa && x.uid !== duel.atacante?.uid
                           && x.atacoTurno !== v.turno && atkEnCombate(x, v.lp.rival) >= 1700);
          if(detras.length){ guardadasDetras.add(o.i); return 1.0; }
        }
        return fuerza>=1700 ? 5.2 : fuerza>=1400 ? 3.2 : 1.0;
      }
      if(inf.rol==="counter"){
        /* Solemn Judgment cuesta MEDIA VIDA. Solo por algo que decida la
           partida: negar un Book of Moon con 4.000 puntos de vida es cómo
           se pierde un duelo ganado. */
        if(!exp("counter")) return 2;
        if(v.lp.mio <= 2500) return -1;
        /* ══ SIN CADENA, LO QUE SE NIEGA ES UNA INVOCACIÓN ══
           E, 03-10 (Reino, T5): «igual merecía la pena Solemn Judgment a
           mi Mobius: había opción de que destruyese el Judgment con su
           efecto». Sin cadena, Solemn solo se ofrece contra una invocación,
           y aquí `negando` era null: valía 1.0 y nunca salía. Ahora vale
           lo que vale el monstruo, más si es de tributo y más aún si al
           entrar me barre el backrow (con la propia Solemn dentro). */
        if(exp("solemnInvocacion") && !negando && !v.turnoMio){
          const u = duel.ultimaInvocada;
          const recien = u && u.turno === duel.turnCount
            ? v.monstruosRival.find(c2 => c2.uid === u.uid && !c2.bocaAbajo) : null;
          if(!recien || esFicha(recien)) return -1;
          const texto = names[recien.code]?.desc ?? "";
          const nivel = Number(recien.datos?.level ?? 0) & 0xff;
          const barre = /when this card is (normal |tribute )?summoned[^.]*(spell|trap|card on the field|cards on the field)/i.test(texto)
                        && v.backrow.length > 0;
          const mios = v.monstruos.filter(x => !x.bocaAbajo).map(x => poder(x));
          const meGana = !mios.length || atk(recien) > Math.max(...mios);
          const vale = valorCarta(recien) + (nivel >= 5 ? 0.5 : 0) + (barre ? 1.0 : 0) + (meGana && atk(recien) >= 1900 ? 0.3 : 0);
          /* Esa invocación ES «la carta que decide»: la reserva del contador
             no la guarda para otra (y si barre, la Solemn no llega a otra). */
          if(vale >= 1.6) sinReserva.add(o.i);
          return vale >= 1.6 ? 5.0 : vale >= 1.3 ? 2.6 : 0.4;
        }
        const vale = negando ? valorCarta(negando) : 1.0;
        return vale>=1.6 ? 5.0 : vale>=1.3 ? 2.6 : 0.4;
      }
      if(inf.rol==="removal" && inf.rapida){
        // Ring of Destruction: rematar, o llevarse algo gordo
        const obj = atacante ?? amenazaMayor(v);
        /* Ring de antes de la errata daña a LOS DOS. En la Main Phase esto
           ya estaba (`remata`/`meMata`); en la cadena no: con mis LP por
           debajo del ATK me suicidaba. Solo si ese golpe me mata igual
           (ataque directo letal) un empate es mejor que perder. */
        if(nom === "Ring of Destruction" && obj && v.lp.mio <= atk(obj)){
          const directoLetal = atacante && !duel.objetivoAtaque && atk(obj) >= v.lp.mio;
          return (directoLetal && v.lp.rival <= atk(obj)) ? 2.5 : -1;
        }
        if(obj && v.lp.rival <= atk(obj)) return 9;
        if(exp("remocionFloater") && obj && rolDe(obj) === "floater" && poder(obj) < 1600) return 0.5;   // salvo que se vaya a perder igual
        return obj && poder(obj)>=1700 ? 4.5 : 1.5;
      }
      if(inf.rol==="spellRemoval"){
        /* DESTRUIR NO ES NEGAR. Si la carta del rival ya está en la
           cadena resolviéndose, romperla no impide nada: el efecto sale
           igual y tú has tirado tu trampa. E lo vio dos veces —Dust
           Tornado sobre un Nobleman y sobre un Metamorphosis que ya
           estaban activándose— y las dos era tirar la carta. */
        /* …salvo que lo que resuelve me barra el backrow: entonces la
           MST se va igual, y llevarse otra carta suya con ella es gratis. */
        if(negando && barreTodo && v.backrowRival.some(x => x.uid !== arriba?.uid)) return 2.6;
        /* ══ …PERO UN EQUIPO O UNA CONTINUA SÍ SE PARAN ══
           Una mágica de equipo o una continua que se destruye antes de
           resolverse no aplica su efecto (goatformat, «Dust Tornado vs
           Snatch Steal»). Contra Snatch Steal, el artículo dice que
           encadenar de inmediato es «uno de los errores más comunes»: lo
           normal es esperar y romperlo cuando ataque o en respuesta a su
           invocación normal (le cuesta la invocación o la Main Phase 1).
           Se encadena YA si lo robado tiene un efecto que usarían en el
           acto (Chaos Sorcerer, BLS, un removal) o vale la partida. */
        const tipoNeg = Number(negando?.datos?.type) || 0;
        if(exp("equipEnCadena") && negando && (tipoNeg & (0x40000|0x20000))){
          if(rolDe(negando) === "equipSteal"){
            const robado = v.monstruos.find(x => duel.objetivosCadena?.has?.(x.uid));
            if(!robado) return 0.5;
            const ir = infoDe(robado);
            const inmediato = CHAOS_REUSO.has(canon(robado.nombre ?? "")) || ir.rol === "removal" || valorCarta(robado) >= 2.2;
            return inmediato ? 4.5 : 0.5;
          }
          return ["revival","lock"].includes(rolDe(negando)) ? 4.0 : 2.0;
        }
        if(negando){ return -1; }
        /* ══ LA MST DE LA END PHASE ══
           Replays del GFCEU 2026 (29-09): de 34 MST y 28 Dust Tornado de
           jugadores de torneo, la mitad se juega en la End Phase del
           rival, casi siempre justo después de que coloque algo. La IA:
           ninguna. Es la jugada de manual: una carta colocada ESTE turno
           no se puede activar hasta el siguiente —ni una trampa ni una
           rápida—, así que en su End Phase es un blanco que no puede
           responder, y si no la quito ahora estará viva en mi turno.
           Aquí la reserva («guárdala para un equipo») no la frenaba por
           mala regla sino porque solo miraba las boca arriba. */
        if(exp("mstEnd") && !v.turnoMio && enEnd && frescaRival()) return 4.2;
        /* "They Mystical Space Typhooned their own magic/trap card on every
           game I played" (AyeRye, Reddit). Aquí no había NINGUNA condición:
           devolvía 3 y a correr. Si el rival no tiene backrow, el único
           objetivo legal es el tuyo, y el bot se volaba su propia trampa
           puesta. Igual que en la Main Phase: sin objetivo del rival, no
           se activa; y se guarda para lo que de verdad duele. */
        if(!v.backrowRival.length) return -1;
        const jugoso = v.backrowRival.some(c2=>!c2.bocaAbajo &&
          ["equipSteal","revival","lock","muroGlobal","campo"].includes(rolDe(c2)));
        return jugoso ? 5 : 2.6;
      }
      return 2;
    };
    /* ══ SERIAL SPELL: LA CARTA QUE VIVE DE ENCADENARSE A LO MÍO ══
       E, 26-09 (Empty Jar, p1, T3): la IA tenía Serial Spell colocada
       desde el turno 1 y activó Card Destruction sin encadenarla: la regla
       de arriba («nunca responder a tu propia carta») se la comía. Es EL
       combo del mazo: Serial copia Card Destruction, así que el rival
       descarta y roba DOS veces su mano (y yo, que ya la descarté como
       coste, no robo nada). Fuera de ese plan, solo si el mazo rival ya
       no aguanta el doble robo. Copiando un robo (Pot of Greed…) solo
       vale con la mano vacía o casi: el coste es descartarla entera. */
    if(arriba && arriba.controller === yo && exp("serial")){
      const oSerial = opciones.find(o => canon(o.c.nombre ?? "") === "Serial Spell");
      if(oSerial){
        const copia = canon(names[arriba.code]?.name ?? "");
        const suMano = v.manoRival?.cuantas ?? 0;
        const valeMano = v.mano.reduce((t, h) => t + valorCarta(h), 0);
        let vale = false;
        if(copia === "Card Destruction")
          vale = suMano > 0 && (PLAN.objetivo === "deckout" || (v.deckRestanteRival ?? 99) <= 2 * suMano);
        else if(["Pot of Greed","Graceful Charity","Upstart Goblin"].includes(copia))
          vale = v.mano.length === 0 || (v.mano.length === 1 && valeMano < 1.0);
        if(vale){
          traza(`encadeno Serial Spell a mi ${copia}`);
          return { type:R.SELECT_CHAIN, index:oSerial.i };
        }
      }
    }
    if(arriba && arriba.controller === yo){
      traza("no me encadeno a mi propia carta");
      return { type:R.SELECT_CHAIN, index:null };
    }
    /* ══ LO QUE SE GUARDA, SE GUARDA ══
       E: «no hay manera ninguna de guardarse cartas para el futuro». Cada
       carta reactiva tiene una condición de gasto (ai/posicion.js): la
       Sakuretsu es para un 1700, la masiva para dos cuerpos o un 1900, la
       contra-trampa para algo que decida la partida. Mientras no se
       cumpla, su nota se capa por debajo del umbral y la carta se queda
       puesta. Con el reloj corto —o si el golpe me mata— deja de guardar:
       una carta reservada para un turno que no llega es una carta menos. */
    const posCadena = exp("reservas") ? lectura(v) : null;
    /* A cada carta hay que darle SU objetivo: a una Dust Tornado no se le
       pregunta por el monstruo que ataca sino por el backrow del rival.
       Con el objetivo equivocado el criterio se invierte. */
    const objetivoDe = c => {
      const rol = infoDe(c).rol;
      if(rol === "spellRemoval" && exp("mstEnd") && !v.turnoMio && enEnd && frescaRival()) return frescaRival();
      if(rol === "spellRemoval")
        return v.backrowRival.find(x => !x.bocaAbajo &&
                 ["equipSteal","revival","lock","muroGlobal","campo"].includes(rolDe(x)))
            ?? v.backrowRival.find(x => !x.bocaAbajo) ?? null;
      if(rol === "counter") return negando;
      return atacante ?? amenazaMayor(v);
    };
    const reserva = o => {
      if(!posCadena) return null;
      const r = decidirReserva(o.c, posCadena, { atacante, objetivo: objetivoDe(o.c),
                                                 esTurnoMio: v.turnoMio, lpMio: v.lp.mio,
                                                 lpRival: exp("amenazaReal") ? v.lp.rival : undefined,
                                                 /* ¿hay algo a lo que responder? */
                                                 hayCadena: !!arriba });
      return r?.guardar ? r : null;
    };
    /* ══ SISTEMA H · ÚSALA O PIÉRDELA ══
       E: «no encadenó Waboku cuando ella misma fue seleccionada para
       destrucción; mejor usarla que perderla». La regla que lo impedía
       —"toda carta que se encadena tiene que decir CONTRA QUÉ"— es
       buena y se queda: sin ella el bot encadenaba Book of Moon a su
       propia invocación 234 veces en 300 partidas. Lo que faltaba era
       el dato de que la carta está SEÑALADA, y ese lo manda el motor
       con BECOME_TARGET (lo tiraba el adaptador).

       Una carta que se va al cementerio de todas formas no tiene coste:
       lo peor que puede pasar es que su efecto no sirva de nada, que es
       exactamente lo que pasa si no se activa. Así que sube por encima
       del umbral, pero solo lo justo — si hay algo mejor que encadenar,
       ese sigue ganando. */
    /* …salvo que gastarla solo pueda hacerme daño a mí: una Book of Moon
       o un Ring sin nada del rival boca arriba solo pueden apuntar a lo
       mío. Book of Moon sobre un volteo propio sí rinde (lo re-tapa para
       volver a voltearlo). */
    const volteoPropio = v.monstruos.some(x=>!x.bocaAbajo && (((x.datos?.type ?? 0) & 0x200000) || infoDe(x).rol==="flip"));
    const soloContraMi = o => infoDe(o.c).soloCaraArriba && !v.monstruosRival.some(x=>!x.bocaAbajo && !esFicha(x))
                              && !(canon(o.c.nombre)==="Book of Moon" && volteoPropio);
    const barreTodo = exp("barrido") && !!negando && BARREN_BACKROW.has(canon(negando.nombre));
    const enMiBackrow = o => v.backrow.some(b => b.uid === o.c?.uid);
    /* ══ UNA CONTRA-TRAMPA NO SE SALVA A SÍ MISMA ══
       E, 19-09 (Cat Control, p1): MST a su Solemn Judgment y la IA
       encadenó el Solemn: media vida para negar una MST que solo iba a
       destruir… el Solemn, que se va al cementerio igual al resolverse.
       Negar lo que me apunta SOLO a mí no salva nada. Contra un barrido
       (Heavy Storm) sí: salva el resto del backrow. */
    const seSalvaSola = o => infoDe(o.c).rol === "counter" && !barreTodo;
    /* ══ «MEJOR GASTARLA» NECESITA ALGO CONTRA LO QUE GASTARLA ══
       E, 20-09 (Chaos Turbo, p1, T2): Heavy Storm suyo y la IA encadenó
       Raigeki Break… apuntando al propio Heavy Storm, que ya se estaba
       resolviendo: destruirlo no para su efecto, así que se tiró un
       Thunder Dragon de la mano a cambio de nada. Una carta que destruye
       un objetivo solo «se gasta mejor que perderla» si hay algo suyo en
       el campo que NO sea un eslabón de esta misma cadena. */
    const enCadena = new Set((duel.cadena ?? []).map(k => k.uid).filter(u => u != null));
    const destruyeObjetivo = o => /target/i.test(names[o.c?.code]?.desc ?? "") && /destroy/i.test(names[o.c?.code]?.desc ?? "");
    const sinBlancoUtil = o => destruyeObjetivo(o)
          && ![...v.monstruosRival, ...v.backrowRival].some(x => !enCadena.has(x.uid));
    /* ══ UNA CONTINUA QUE SE VA NO HACE NADA ══
       E, 25-09 (PACMAN, p2, T4): Wall of Revealing Light en respuesta al
       Heavy Storm: pagó los LP y el muro se fue al cementerio sin parar ni
       un ataque. Una continua (Wall, Gravity Bind, Call of the Haunted…)
       solo trabaja mientras está en la mesa: activarla para que la barran
       es pagar por nada. */
    const esContinua = o => { const t = Number(o.c?.datos?.type) || 0;
      return exp("continuaCondenada") && ((t & 0x20000) || infoDe(o.c).continua || ["muroGlobal","stallGlobal"].includes(infoDe(o.c).rol)); };
    /* Un potenciador solo se gasta si tengo algo boca arriba y en ataque
       a quien darle el ATK: si no, la única opción es darle al rival (E,
       03-10: con un Giant Germ en defensa, +500 a su Shining Angel). */
    const potenciadorSinMio = o => exp("potenciadorPropio") && esPotenciador(o.c?.code)
          && !v.monstruos.some(x => !x.bocaAbajo && !x.defensa);   // en defensa el ATK no sirve de nada
    const condenada = o => o.c?.uid != null && !soloContraMi(o) && !seSalvaSola(o) && !sinBlancoUtil(o) && !esContinua(o)
          && !potenciadorSinMio(o)
          && (duel.objetivosCadena?.has?.(o.c.uid) || (barreTodo && enMiBackrow(o)));
    const orden = opciones.map(o=>{
                            let p = puntuar(o);
                            const guardo = p > 1.5 && !sinReserva.has(o.i) ? reserva(o) : null;
                            if(guardo){
                              traza(`${o.c.nombre}: la guardo para ${guardo.para}`);
                              p = Math.min(p, 1.5);
                              o = { ...o, guardada:true };
                            }
                            if(guardadasDetras.has(o.i)){
                              traza(`${o.c.nombre}: la guardo para el que ataca detrás`);
                              o = { ...o, guardada:true };
                            }
                            if(condenada(o) && p > -1){
                              p = Math.max(p, 2.5);
                              traza(`${o.c.nombre} se va igualmente: mejor gastarla`);
                            }
                            return {...o, p};
                          });
    /* Lo que la heurística VETA (-1: Royal Decree en la mesa, Book of Moon
       en su Main Phase…) no lo puede resucitar la simulación de la
       ventana de cadena (ai/pensar.js), que resuelve la batalla a mano y
       no sabe de Decrees. E, 19-09: Ring of Destruction con Decree. */
    /* `guardada`: la heurística la reserva para algo concreto (la Sakuretsu
       para un 1700). La simulación de la ventana de cadena no la gasta: E,
       02-10 (Warrior, p2, T6) —Sakuretsu en un Spirit Reaper que pegaba 300
       con mi mano vacía, y la Lily (3400) atacó detrás—. */
    puntosCadena = orden.map(o => ({ index:o.i, p:o.p, guardada: !!o.guardada }));
    orden.splice(0, orden.length, ...orden.filter(o=>o.p>2.4).sort((a,b)=>b.p-a.p));
    if(intento < orden.length){
      traza(`encadena ${orden[intento].c.nombre}`);
      if(infoDe(orden[intento].c).rol === "proteccionBatalla") protegidoEnTurno = duel.turnCount;
      return { type:R.SELECT_CHAIN, index:orden[intento].i };
    }
    return { type:R.SELECT_CHAIN, index:null };
  }

  /* ══════════ SELECCIONES ══════════ */
  /* Cuánto más (o menos) vale buscar esta carta AHORA que lo que dice su
     valor de tabla. Ver `buscarSegun` en elegirCartas. */
  function ajusteBusqueda(va, c){
    const nom = canon(c.nombre ?? "");
    const magias = va.cementerio.filter(x => (Number(x.datos?.type) || 0) & 0x2);
    const mejorMagia = magias.length ? Math.max(...magias.map(x => valorCarta(x))) : 0;
    const suyos = va.monstruosRival.filter(x => !x.bocaAbajo && !esFicha(x));
    const suMayor = Math.max(0, ...suyos.map(x => atkEnCombate(x, va.lp.rival)));
    const miMayor = Math.max(0, ...va.monstruos.filter(x => !x.bocaAbajo).map(x => atk(x)));
    let aj = 0;
    if(nom === "Magician of Faith") aj += magias.length ? 0.3 + mejorMagia * 0.7 : -0.8;
    if(nom === "D.D. Warrior Lady" && (suMayor >= 1900 || (suMayor >= 1600 && suMayor > miMayor))) aj += 1.0;
    if(nom === "Tsukuyomi"){ const o = planTumbar(va, {})[0]; aj += (o && o.valor >= 0.8) ? 0.3 : -0.4; }
    if(nom === "Sinister Serpent") aj -= 0.3;     // vuelve sola: buscarla es casi no buscar nada
    return aj;
  }
  function elegirCartas(m, intento, esObjetivoDeAtaque = false){
    const lista = m.type===T.SELECT_UNSELECT_CARD ? (m.select_cards||[]) : (m.selects||[]);
    if(!lista.length) return null;
    /* La vista, solo si hace falta: montarla cuesta y aquí casi nunca se
       necesita (elegir un descarte o un tributo no mira el tablero). */
    let _v = null;
    const vistaAhora = () => (_v ??= vistaDe(duel, yo, db, names));
    /* ¿La carta que se está resolviendo manda el objetivo AL CEMENTERIO?
       Un Thousand-Eyes lo absorbe, una Snatch Steal lo roba y un Book of
       Moon lo tumba: en esos tres no hay nada que regalarle. */
    const rolQueResuelve = () => {
      const top = duel.cadena?.at(-1);
      if(!top?.code) return null;
      return rolDe({ nombre: names[top.code]?.name ?? null, datos: db.get(top.code) ?? null });
    };
    const destruyeLoQueResuelve = () => {
      const rol = rolQueResuelve();
      if(!rol) return true;
      return !["lock","equipSteal","trick","swap","stall","prestamoMudo"].includes(rol);
    };

    /* Lastre: descartar, buscar o destruir a lo tonto. Aquí se decide qué
       carta se va al cementerio y qué se saca del deck, y un jugador malo
       lo hace sin mirar. */
    if(lastre.malaSeleccion && m.type!==T.SELECT_UNSELECT_CARD){
      const min = Math.max(1, m.min ?? 1), max = m.max ?? min;
      const idx = lista.map((_,i)=>i).sort(()=>aleatorio()-0.5).slice(0, Math.min(max, Math.max(min,1)));
      return { type: m.type===T.SELECT_TRIBUTE?R.SELECT_TRIBUTE:R.SELECT_CARD, indicies:idx };
    }

    /* Elegir a quién atacar. Antes se cogía "la carta más valiosa", que
       es justo como un monstruo se suicida contra otro más grande. */
    const enBatalla = [8,16,32,64,128].includes(duel.phase);
    if(n>=1 && enBatalla && ultimoAtacante && esObjetivoDeAtaque && m.type===T.SELECT_CARD
       && lista.every(l=>l.location===4 && l.controller!==yo)){
      const cand = lista.map((l,i)=>{
        const c = cartaDeLista(l);
        /* ══ LA TAPADA QUE CONOZCO SE ELIGE CON SU DEFENSA ══
           E, 20-09 (Zombie, p2, T9): Tsukuyomi (1100) tumbó a la D.D.
           Warrior Lady (DEF 1600) y luego la atacó: 500 de daño y la Lady
           desterró a Tsukuyomi. `valeAtacar` ya usaba la memoria y había
           decidido atacar por el Mystic Swordsman LV2 de 900; la elección
           del objetivo no, y trataba la tapada como una incógnita. */
        const tapada = !!(l.position & 0x0a);
        const conocida = tapada && !!c.code;
        const objetivo = { ...c, defensa: conocida || !!(l.position & 0x0c), bocaAbajo: tapada && !conocida };
        const peligro = exp("peligrosos") && !objetivo.bocaAbajo && infoDe(objetivo).peligroso ? 3 : 0;
        return { i, objetivo, gano: ganaCombate(ultimoAtacante, objetivo),
                 muero: muereAtacando(ultimoAtacante, objetivo),
                 valor: valorCarta(objetivo) + poder(objetivo)/2000 - peligro };
      });
      const buenos = cand.filter(c=>c.gano && !c.muero).sort((a,b)=>b.valor-a.valor);
      let elegido = buenos[0] ?? cand.sort((a,b)=>poder(a.objetivo)-poder(b.objetivo))[0];
      if(objetivoLetal != null){
        const k = lista.findIndex(l => duel.at(l.controller, l.location, l.sequence)?.uid === objetivoLetal);
        if(k >= 0) elegido = cand.find(x => x.i === k) ?? elegido;
        objetivoLetal = null;
      }
      // elegir bien a quién atacas es donde está de verdad la habilidad
      if(lastre.objetivoTonto) elegido = cand[(aleatorio()*cand.length)|0];
      traza(`objetivo: ${elegido.objetivo.nombre}`);
      return { type:R.SELECT_CARD, indicies:[elegido.i] };
    }
    /* Mind Control: el que se decidió al activarla (el que estorba). */
    if(exp("prestamo") && objetivoPrestamo != null && m.type===T.SELECT_CARD){
      const top = duel.cadena?.at(-1);
      if(top?.controller === yo && canon(names[top?.code]?.name ?? "") === "Mind Control"){
        const k = lista.findIndex(l => duel.at(l.controller, l.location, l.sequence)?.uid === objetivoPrestamo);
        objetivoPrestamo = null;
        if(k >= 0){ traza("objetivo de Mind Control: el que me tapa el golpe"); return { type:R.SELECT_CARD, indicies:[k] }; }
      }
    }
    /* Thousand-Eyes Restrict absorbe copiando el ATK del objetivo. Si
       absorbe una carta tapada se queda en 0 ATK y ataca con 0: medido en
       check-cartas.mjs (boca arriba → 1900, tapada → 0). Así que de los
       monstruos del rival, solo boca arriba, y el de más ataque. */
    /* ══ TSUKUYOMI / BOOK OF MOON EN MI TURNO: EL OBJETIVO LO DICE planTumbar ══
       Puede ser mío (Chaos que reutiliza su efecto, lo que robé con
       Snatch Steal) o suyo. Ver `planTumbar`. */
    if(exp("tsukPlan") && exp("tsukObjetivo") && m.type===T.SELECT_CARD && lista.length>1 && lista.every(l=>Number(l.location)===4)
       && !esObjetivoDeAtaque){
      const top = duel.cadena?.at(-1);
      const nomTop = canon(names[top?.code]?.name ?? "");
      const esTsuk = top?.controller === yo && nomTop === "Tsukuyomi";
      const esBom = top?.controller === yo && nomTop === "Book of Moon" && duel.turnPlayer === yo;
      if(esTsuk || esBom){
        const va = vistaAhora();
        const plan = planTumbar(va, { fuente: esTsuk ? "Tsukuyomi" : "Book of Moon",
                                      conBatalla: va.fase === 0x4 && duel.turnPlayer === yo });
        const valorDe = l => { const u = duel.at(l.controller, l.location, l.sequence)?.uid;
                               return plan.find(o => o.uid === u) ?? null; };
        const orden2 = lista.map((l,i)=>({ i, o:valorDe(l) })).filter(x=>x.o).sort((a,b)=>b.o.valor-a.o.valor);
        if(orden2.length){
          traza(`objetivo de ${nomTop}: ${cartaDeLista(lista[orden2[0].i]).nombre || "?"} (${orden2[0].o.por})`);
          return { type:R.SELECT_CARD, indicies:[orden2[0].i] };
        }
      }
    }
    /* ══ BOOK OF MOON A MI VOLTEO QUE ATACAN (E, 25-09) ══
       Chaos Turbo, p1, T5: su Giant Rat atacaba a mi Night Assailant boca
       arriba. Tumbar a la Rata para el golpe, pero la Rata sigue ahí y
       vuelve a atacar. Tumbar al ASSAILANT hace que el ataque lo voltee:
       su efecto destruye a la Rata —por efecto, así que no busca a nadie—
       y el Assailant va al cementerio (combustible DARK). Con un floater
       atacando, re-tapar mi volteo destructor es la jugada. */
    if(exp("bomVolteoPropio") && m.type===T.SELECT_CARD && lista.length>1 && lista.every(l=>Number(l.location)===4)
       && !esObjetivoDeAtaque && duel.atacante && duel.atacante.controller !== yo && duel.objetivoAtaque){
      const top = duel.cadena?.at(-1);
      if(top?.controller === yo && canon(names[top.code]?.name ?? "") === "Book of Moon"){
        const va = vistaAhora();
        const mio = va.monstruos.find(x => x.uid === duel.objetivoAtaque.uid && !x.bocaAbajo);
        const suyo = va.monstruosRival.find(x => x.uid === duel.atacante.uid);
        if(mio && suyo && infoDe(mio).destruyeAlVoltear && rolDe(suyo) === "floater"
           && atk(suyo) > (mio.defensa ? def(mio) : atk(mio))){
          const k = lista.findIndex(l => duel.at(l.controller, l.location, l.sequence)?.uid === mio.uid);
          if(k >= 0){ traza(`Book of Moon a mi ${mio.nombre}: al atacarlo se voltea y destruye a ${suyo.nombre} sin que busque`);
                      return { type:R.SELECT_CARD, indicies:[k] }; }
        }
      }
    }
    /* El objetivo de un potenciador (ver `esPotenciador`): lo mío boca
       arriba —el que ataca, o el de más ATK de frente—; si solo hay
       suyos, el que menos pega. */
    {
      const top = duel.cadena?.at(-1);
      const codRes = (top?.controller === yo ? top.code : null) ?? activoAhora;
      if(exp("potenciadorPropio") && m.type===T.SELECT_CARD && lista.length>1 && !esObjetivoDeAtaque
         && lista.every(l=>Number(l.location)===4) && esPotenciador(codRes)){
        const cs = lista.map((l,i)=>({ i, l, c:cartaDeLista(l), real: duel.at(l.controller, l.location, l.sequence) }))
                        .filter(x => !(x.l.position & 0x0a));
        const mios = cs.filter(x => x.l.controller === yo);
        const atacaMio = mios.find(x => duel.atacante && x.real?.uid === duel.atacante.uid);
        const elegido = atacaMio
          ?? mios.sort((a,b) => ((b.l.position & 0x1) ? 1 : 0) - ((a.l.position & 0x1) ? 1 : 0) || atk(b.c) - atk(a.c))[0]
          ?? cs.sort((a,b) => atk(a.c) - atk(b.c))[0];
        if(elegido){
          traza(`${names[codRes]?.name ?? "potenciador"}: a ${elegido.c.nombre || "?"}${elegido.l.controller === yo ? "" : " (no hay nada mío boca arriba)"}`);
          return { type:R.SELECT_CARD, indicies:[elegido.i] };
        }
      }
    }
    if(m.type===T.SELECT_CARD && lista.length>1
       && lista.every(l=>l.location===4) && !esObjetivoDeAtaque){
      const rivales = lista.map((l,i)=>({ i, l, c:cartaDeLista(l),
                                          tapada:!!(l.position & 0x0a) }))
                           .filter(x=>x.l.controller!==yo);
      /* Si lo que se activa es una atadura (Spellbinding Circle), lo que
         ya tiene atado otra igual no cuenta: se ata a otro, aunque esté
         tapado. */
      const esAtadura = exp("atadura") && activoAhora && ATADURAS.has(canon(names[activoAhora]?.name ?? ""));
      const yaAtado = x => esAtadura && atadoPorMi(vistaAhora(), duel.at(x.l.controller, x.l.location, x.l.sequence)?.uid, activoAhora);
      if(esAtadura && rivales.some(yaAtado)){
        const libres = rivales.filter(x=>!yaAtado(x));
        const libreArriba = libres.filter(x=>!x.tapada);
        const otro = libreArriba.sort((a,b)=>atk(b.c)-atk(a.c))[0] ?? libres[0];
        if(otro){ traza(`atadura: ${otro.c.nombre || "una tapada"} (el otro ya está atado)`);
                  return { type:R.SELECT_CARD, indicies:[otro.i] }; }
      }
      const caraArriba = rivales.filter(x=>!x.tapada);
      if(caraArriba.length){
        /* Y aquí también manda el Chaos (guía §5.1, P11): entre dos
           monstruos suyos parecidos, el que NO le completa el atributo
           que le falta. Solo cuando lo que se resuelve DESTRUYE: un
           Thousand-Eyes absorbe y un Snatch Steal roba —la carta no va a
           su cementerio— y un Book of Moon solo la tumba. */
        /* Si lo que se resuelve es un Book of Moon, lo que importa es lo
           que ATACA: `poder` de un monstruo en defensa es su DEF, y un muro
           de 2000 salía como «la mayor amenaza». Lo de frente, primero. */
        const esTruco = rolQueResuelve() === "trick";
        const rolR = rolQueResuelve();
        const loSaca = rolR !== "equipSteal" && rolR !== "trick";   // Snatch lo deja en el campo
        const floaterPequeño = x => exp("volteoFloater") && !esTruco && loSaca && destruyeLoQueResuelve()
                                    && rolDe(x.c) === "floater" && poder(x.c) < 1600 ? 1.5 : 0;
        /* E, 02-10 (Zombie, p2, T22): «BLS debería usar el efecto en Lily:
           es la única que puede pasarle por encima, y con Royal Decree en
           el campo no hay respuesta si Lily ataca». Desterró al Ryu Kokki
           (2400, que BLS ya gana) y la Lily (400 → 3400) lo mató. Lo que
           cuenta es con cuánto pega en combate. */
        const lpR = vistaAhora().lp.rival;
        const golpeR = x => exp("amenazaReal") ? atkEnCombate(x.c, lpR) : atk(x.c);
        const nota = x => (esTruco ? golpeR(x)/1000 - ((x.l.position & 0x0c) ? 5 : 0) : Math.max(poder(x.c), golpeR(x))/1000)
                          - floaterPequeño(x)
                          - (destruyeLoQueResuelve() ? regalaChaos(vistaAhora(), x.c) : 0)
                          - (loSaca && exp("jinzo") ? quitarJinzoLeAyuda(vistaAhora(), x.c) : 0)
                          + (exp("motor") && esMotorDeVolteo(x.c)
                               ? (esTruco ? -3                       // tumbarle su volteo es regalárselo otra vez
                                  : loSaca && rivalRevoltea(vistaAhora()) ? 1.5 : 0)
                               : 0);
        /* ══ NO TUMBES LO QUE TE HAN ROBADO ══
           E, 20-09 (Zombie, p2, T6): Book of Moon a mi D.D. Warrior Lady
           robada con Snatch Steal mientras atacaba su Pyramid Turtle.
           Ruling de Goat (goatrulings.com, Snatch Steal): si el monstruo
           equipado se pone boca abajo, Snatch Steal va al cementerio y el
           monstruo SE QUEDA con quien lo controla. Tumbarlo le regala el
           monstruo para siempre y me quita los 1000 por turno; tumbar al
           que ataca para el golpe. Lo que ataca va primero, lo mío robado
           al final. */
        const tumba = esTruco || canon(names[activoAhora]?.name ?? "") === "Tsukuyomi";
        const real = x => duel.at(x.l.controller, x.l.location, x.l.sequence);
        const ajusteTumbar = x => !(exp("noTumbarRobado") && tumba) ? 0
            : (real(x)?.owner === yo ? -6 : 0)
              + (duel.atacante && real(x)?.uid === duel.atacante.uid ? 2 : 0)
              /* lo que ya atacó este turno no va a pegar más: tumbarlo no corta nada */
              + ([8,16,32,64,128].includes(duel.phase) && duel.turnPlayer !== yo && real(x)?.atacoTurno === duel.turnCount && real(x)?.uid !== duel.atacante?.uid ? -3 : 0);
        const mejor = caraArriba.sort((a,b)=>(nota(b)+ajusteTumbar(b))-(nota(a)+ajusteTumbar(a)))[0];
        traza(`objetivo boca arriba: ${mejor.c.nombre}`);
        return { type:R.SELECT_CARD, indicies:[mejor.i] };
      }
    }
    const esTributo = m.type===T.SELECT_TRIBUTE;
    /* Descartar es de MI mano. E, 20-09 (Chaos Turbo, p1, T9): Trap
       Dustshoot enseña SU mano y le devuelve un monstruo al mazo; como la
       lista era «todo de la mano», se leía como un descarte propio y se
       elegía lo que menos vale (Sinister Serpent) en vez del BLS. */
    const esDescarte = m.type===T.SELECT_CARD && m.selects?.every(l=>l.location===2 && l.controller===yo);
    /* ══ ¿ESTO ME LO PIDEN O ME LO LLEVO? ══
       E, torneo 1 (18-09): «cuando tenga que descartar cartas por efecto
       del Vampire Lord, hay que descartar las peores cartas, nunca algo
       como Graceful Charity o Pot of Greed». Y eso hacía: Vampire Lord te
       obliga a mandar una carta de TU mazo al cementerio, la lista venía
       de una zona oculta y la regla genérica decía «de una zona oculta se
       coge lo MEJOR» —que es cierto cuando la que busca es mi Sangan, y
       exactamente al revés cuando me lo impone una carta suya—.
       Quién manda lo dice la cadena: si el efecto que se está resolviendo
       es del rival, esto es un coste y se paga con lo que menos duela. */
    const meLoImponen = (() => {
      const top = duel.cadena?.at(-1);
      return !!top && top.controller != null && top.controller !== yo;
    })();

    /* ── NO TE DISPARES EN EL PIE ──
       El motor pasa la lista de objetivos LEGALES y no dice si la carta
       que se resuelve hace bien o mal al objetivo. Ring of Destruction,
       Book of Moon, Nobleman of Crossout y Tsukuyomi admiten monstruos de
       los dos lados, y esta función ordenaba por "lo más valioso" sin
       mirar de quién era: reportado por un jugador, el bot tumbó su propio
       Dekoichi recién invocado con su Book of Moon.
       Regla: si en la lista hay algo del rival, lo mío va al final.
       Cuando la carta necesita de verdad un objetivo propio —el material
       de Metamorphosis, un tributo, una reanimación desde el cementerio—
       la lista es SOLO mía y esta regla no llega a aplicarse. */
    const enCampo = lista.every(l=>[4,8].includes(l.location));
    const hayDelRival = lista.some(l=>l.controller!==yo);
    const evitarPropias = enCampo && hayDelRival && !esTributo && !esDescarte;
    /* Si TODO lo que se ofrece es mío y está en el campo, esto no es un
       objetivo: es un COSTE. El material de Metamorphosis, el tributo de
       una invocación, la carta que se manda al cementerio. Ordenarlo por
       "lo más valioso" hacía que el bot sacrificara el Airknight teniendo
       una ficha de Scapegoat al lado — lo cazó el banco de posiciones. */
    const esCoste = enCampo && !hayDelRival && !esTributo && !esDescarte;
    const deZonaOculta = lista.every(l=>[1,16,32].includes(l.location));
    const reclutaAlCampo = () => {
      const top = duel.cadena?.at(-1);
      return exp("recluta") && !!top && top.controller === yo
             && RECLUTADORES.has(canon(names[top.code]?.name ?? ""));
    };

    /* Qué descarte llena cada atributo que le falta al cementerio para
       un Chaos en la mano: el que menos vale de cada atributo, uno solo. */
    const llenaHueco = new Set(), chaosQueSeSacrifica = new Set();
    if(exp("combustibleChaos") && esDescarte){
      const CHAOS = ["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer"];
      const va = vistaAhora();
      if(va.mano.some(h => CHAOS.includes(canon(h.nombre ?? "")))){
        const gy = va.cementerio.filter(x => (Number(x.datos?.type)||0) & 0x1);
        const hay = bit => gy.some(x => (Number(x.datos?.attribute)||0) & bit);
        /* ══ CON DOS CHAOS EN LA MANO, UNO ES EL COMBUSTIBLE DEL OTRO ══
           E, 25-09 (Chaos Turbo, p1, T3): Raigeki Break descartó Magician of
           Faith con BLS y dos Chaos Sorcerer en la mano y el cementerio sin
           ningún DARK. Los tres estaban muertos; tirar un Chaos Sorcerer
           (DARK) los encendía a los otros dos. Un Chaos solo cuenta como
           descarte si en la mano queda otro. */
        const chaosEnMano = va.mano.filter(h => CHAOS.includes(canon(h.nombre ?? ""))).length;
        for(const bit of [16, 32]){
          if(hay(bit)) continue;
          const cand = lista.filter(l2 => { const c2 = cartaDeLista(l2);
              return ((Number(c2.datos?.type)||0) & 0x1) && ((Number(c2.datos?.attribute)||0) & bit)
                     && !CHAOS.includes(canon(c2.nombre ?? "")); })
            .sort((a2,b2) => valorCarta(cartaDeLista(a2)) - valorCarta(cartaDeLista(b2)));
          if(cand[0]) llenaHueco.add(cand[0]);
          else if(exp("chaosCombustible") && chaosEnMano >= 2){
            const c3 = lista.find(l2 => { const c2 = cartaDeLista(l2);
              return CHAOS.includes(canon(c2.nombre ?? "")) && ((Number(c2.datos?.attribute)||0) & bit); });
            if(c3){ llenaHueco.add(c3); chaosQueSeSacrifica.add(c3); }
          }
        }
      }
    }
    const puntuar = (l)=>{
      const c = cartaDeLista(l);
      let val = valorCarta(c);
      const inf = infoDe(c);
      if(esTributo || esDescarte || (meLoImponen && deZonaOculta)){
        // sacrificar/descartar lo que menos duela; Sinister vuelve sola
        if(canon(c.nombre)==="Sinister Serpent") val = 0.1;
        if(inf.rol==="chatarra") val -= 0.4;
        /* Con lo que gana la partida no se paga un coste. Descartar el
           Black Luster Soldier para un Graceful Charity, o tributar el
           Airknight para hacer un Thousand-Eyes, es tirar el plan. */
        /* El peso dice CUÁNTO aporta esa carta a ganar: 3 = es la
           partida (Final Countdown, Black Luster Soldier), 2 = jugada de
           poder, 1 = ayuda. Con eso, "no descartes tu carta buena" deja
           de ser un sí/no y se ordena solo. */
        if(exp("planDescarte")) val += PLAN.peso(c.nombre) * 1.2;
        /* ══ EL DESCARTE QUE ENCIENDE A LOS CHAOS (contexto) ══
           Principio (Three Easy-To-Build Decks; Chaos Turbo): mandar LIGHT
           y DARK al cementerio habilita BLS y Chaos Sorcerer. Si tengo un
           Chaos en la mano (o en el mazo, según el plan) y al cementerio le
           falta ese atributo, descartar un monstruo que lo aporta cuesta
           menos: la carta sigue trabajando desde allí. */
        /* Solo UNA carta por atributo que falta: con el DARK ya cubierto
           por la primera, la segunda DARK no llena nada (E, 20-09, Chaos
           Turbo p1 T1: Graceful Charity descartó Mystic Tomato Y Night
           Assailant, dos DARK, guardando un Thunder Dragon muerto). */
        if(exp("combustibleChaos") && esDescarte && llenaHueco.has(l)) val -= 1.2;
        /* El peso de plan de un Chaos es enorme (es LA carta): el que se
           sacrifica para encender a los demás va al fondo del todo. */
        if(chaosQueSeSacrifica.has(l)) val = Math.min(val, 0.15);
        /* ══ EL BUSCADOR SIN NADA QUE BUSCAR ES EL DESCARTE IDEAL ══
           Thunder Dragon sin copias en el mazo ya no hace nada desde la
           mano: descartarlo no cuesta una carta, cuesta cero. */
        if(exp("tdDescarte") && esDescarte && inf.rol === "buscador" && inf.necesitaCopias
           && quedanEnMazo(vistaAhora(), canon(c.nombre ?? "")) < inf.necesitaCopias){
          val = Math.min(val, 0.1);
        }
        if(exp("planDescarte") && PLAN.esMotor(c.nombre)) val += 0.6;
        return val;                            // menor es mejor
      }
      if(esCoste) return val;                            // menor es mejor
      /* ══ MST EN SU END PHASE: A LO QUE ACABA DE COLOCAR ══
         Es la razón de activarla ahí (ver `mstEnd` en cadena()): lo
         colocado este turno no puede encadenarse. Cualquier otra tapada
         suya sí, y ya ha tenido un turno entero para usarse. */
      /* Book of Moon o Ring contra lo que acaba de invocar y aún no ha
         usado (ver `prioridadRival` en cadena()): a ese, no a otro. */
      if(exp("prioridadRival") && l.location===4 && l.controller!==yo && duel.turnPlayer !== yo){
        const top = duel.cadena?.at(-1);
        const nomTop = top?.controller === yo ? canon(names[top.code]?.name ?? "") : "";
        const ui = duel.ultimaInvocada;
        if((nomTop === "Book of Moon" || nomTop === "Ring of Destruction") && ui && ui.turno === duel.turnCount
           && duel.at(l.controller, l.location, l.sequence)?.uid === ui.uid) return -60;
      }
      if(exp("mstEnd") && l.location===8 && l.controller!==yo && (l.position & 0x0a) && duel.turnPlayer !== yo){
        const top = duel.cadena?.at(-1);
        const mia = top?.controller === yo && rolDe({ nombre: names[top.code]?.name ?? null, datos: db.get(top.code) ?? null }) === "spellRemoval";
        if(mia && duel.at(l.controller, l.location, l.sequence)?.puestaTurno === duel.turnCount) return -50;
      }
      /* ══ LO QUE SACA UN RECLUTADOR ENTRA BOCA ARRIBA ══
         E, 19-09: Howling Insect sacó un Man-Eater Bug. Del mazo al campo
         entra boca arriba en ataque, así que el volteo no se dispara nunca
         y queda un cuerpo de 450: el mejor efecto del mazo, tirado. Lo que
         un reclutador saca se mide por lo que hace BOCA ARRIBA: ataque, y
         si es otro reclutador, que la cadena sigue. */
      if(l.location===1 && reclutaAlCampo()){
        if(inf.rol==="flip" || inf.colocarPreferente || inf.prefiereSet) val -= 2.5;
        else val += atk(c)/1500 + (RECLUTADORES.has(canon(c.nombre)) ? 0.4 : 0);
      }
      if(evitarPropias && l.controller===yo) return 99;   // lo mío, lo último
      /* ══ LO QUE SE BUSCA DEPENDE DE LA MESA ══
         E, 02-10 (Goat Control, p1, T3): «seguro que hay mejores cartas
         que buscar con Sangan que el cofre». Con Pot of Greed y Heavy Storm
         en el cementerio, Magician of Faith recupera una de ellas; contra
         un monstruo grande, D.D. Warrior Lady es la respuesta. El valor de
         tabla de cada carta no mira nada de eso. Solo para lo que saco de
         MI mazo a mi mano con un efecto mío. */
      if(exp("buscarSegun") && l.location===1 && l.controller===yo && deZonaOculta && !meLoImponen && !reclutaAlCampo())
        val += ajusteBusqueda(vistaAhora(), c);
      /* ══ TRAP DUSTSHOOT: EL MONSTRUO QUE PUEDE BAJAR ══
         E, 25-09 (Chaos Turbo, p2, T2): con Vampire Lord y Kycoo en su
         mano y ningún monstruo en su campo, la IA le devolvió el Vampire
         Lord… que no podía invocar (pide un tributo). Quitándole el Kycoo
         se quedaba sin nada que bajar ese turno y con el Vampire muerto en
         la mano. Un monstruo de tributo sin tributos a la vista pesa menos;
         las invocaciones especiales (BLS, Chaos) no entran aquí. */
      if(exp("dustshootInvocable") && l.location===2 && l.controller!==yo && ((Number(c.datos?.type)||0) & 0x1)){
        const nivel = Number(c.datos?.level ?? 0) & 0xff;
        const pide = nivel >= 7 ? 2 : nivel >= 5 ? 1 : 0;
        const especial = CHAOS_REUSO.has(canon(c.nombre ?? "")) || ((Number(c.datos?.type)||0) & (0x40|0x2000000));
        const suyos = vistaAhora().monstruosRival.length;
        if(pide > suyos && !especial) val -= 1.3;
      }
      /* Una carta que YA se está resolviendo en la cadena no se para
         destruyéndola (su efecto sale igual): el Heavy Storm al que
         respondo con MST no es el objetivo, lo es la otra tapada. */
      if(l.location===8 && (duel.cadena ?? []).some(k => k.uid != null
           && k.uid === duel.at(l.controller, l.location, l.sequence)?.uid)) return 98;
      /* ══ NO LE REGALES EL ATRIBUTO QUE LE FALTA ══
         De la guía (§5.1, P11): matarle un monstruo le llena el
         cementerio, y en Goat eso puede ser la mitad del coste de un
         Black Luster Soldier. Entre dos objetivos parecidos, el que NO le
         completa el Chaos. Es un desempate, no un veto: si esa amenaza me
         mata, sobrevivir manda y el resto de la nota ya lo dice. */
      if(exp("chaos") && l.controller!==yo && enCampo && ((Number(c?.datos?.type)||0) & 0x1))
        val -= regalaChaos(vistaAhora(), c);
      /* ══ A QUIÉN SACO DEL CEMENTERIO ══
         E, partida 2: «premature burial a monstruo pequeño, encima a
         serpent, que vuelve a la mano ella sola». Ochocientos puntos de
         vida y la carta entera por un cuerpo de 300 que además iba a
         volver gratis a la mano en la Standby siguiente.
         La nota de "¿activo la reanimación?" ya miraba el MEJOR monstruo
         del cementerio (`case "revival"`), pero el objetivo se elegía
         aquí con la regla genérica —valor y un pellizco de ataque— y
         salía otro. Así que aquí, para lo que sale de MI cementerio:
           · el ataque pesa de verdad (a eso se reanima);
           · lo que vale por estar en la mano, no se reanima;
           · un espíritu vuelve a la mano en la End Phase y se lleva el
             equipo por delante.
         Solo para lo mío: desterrar el Sinister Serpent del RIVAL sigue
         siendo quitarle un recurso, y ahí manda la regla de siempre. */
      if(l.location===16 && l.controller===yo && (Number(c.datos?.type)||0) & 0x1){
        /* `atk` y no `poder`: en el cementerio la posición es basura —una
           carta que llegó ahí desde defensa arrastra el bit— y lo que va a
           pegar cuando vuelva es su ATAQUE. Con `poder`, un 1700 que murió
           agachado valía menos que el Sinister Serpent. */
        val += atk(c)/1200;
        if(inf.rol==="recurso"){ val -= 2.0; }
        if(inf.espiritu){ val -= 2.0; }
      }
      return -val - poder(c)/2000;             // destruir/robar lo más valioso
    };
    const orden = lista.map((l,i)=>({i, p:puntuar(l)})).sort((a,b)=>a.p-b.p);
    if(n===0) orden.sort(()=>aleatorio()-0.5);
    const min = Math.max(1, m.min??1), max = Math.min(m.max??min, lista.length);
    /* Si es un COSTE (sacrificar, descartar) se coge el mínimo. Si es un
       BENEFICIO (buscar en el deck, recuperar del cementerio) se coge el
       máximo: Thunder Dragon deja añadir dos copias y la IA cogía una. */
    const beneficio = !esTributo && !esDescarte && deZonaOculta && !meLoImponen;
    const cuantas = beneficio ? Math.max(min, max)
                              : Math.min(Math.max(min,1), Math.max(max,1));
    const desplaz = intento % Math.max(1, orden.length-cuantas+1);
    let idx = orden.slice(desplaz, desplaz+cuantas).map(o=>o.i);
    /* Tributos: `min` son TRIBUTOS y una carta puede valer dos (Double
       Coston con un OSCURO). Se van cogiendo, de la más prescindible a la
       que menos, hasta llegar; si una sola que vale dos basta y es de las
       baratas, mejor que gastar dos cartas. */
    if(esTributo && lista.some(l => (l.release_param ?? 1) > 1)){
      const vale = i => Math.max(1, Number(lista[i].release_param) || 1);
      const doble = orden.slice(0, cuantas).find(o => vale(o.i) >= min);
      if(doble) idx = [doble.i];
      else {
        idx = []; let suma = 0;
        for(const o of orden.slice(desplaz).concat(orden.slice(0, desplaz))){
          if(suma >= min) break;
          if(suma + vale(o.i) > Math.max(min, m.max ?? min)) continue;
          idx.push(o.i); suma += vale(o.i);
        }
      }
    }
    if(m.type===T.SELECT_UNSELECT_CARD)
      return { type:R.SELECT_UNSELECT_CARD, index: (m.can_finish && intento>=lista.length) ? null : idx[0] };
    return { type: esTributo?R.SELECT_TRIBUTE:R.SELECT_CARD, indicies: idx };
  }

  /* ══════════ POSICIÓN Y SÍ/NO ══════════ */
  function posicion(m){
    const P = X.OcgPosition;
    const v = vistaDe(duel, yo, db, names);
    const puede = p => m.positions & p;
    if(n===0) return { type:R.SELECT_POSITION, position: puede(P.FACEUP_ATTACK)?P.FACEUP_ATTACK:P.FACEUP_DEFENSE };

    /* Antes se comparaba el NÚMERO de monstruos, así que un Thousand-Eyes
       Restrict acababa en defensa aunque el rival tuviera el campo vacío.
       Lo que importa es si algo puede matarlo y si hay a quién pegar. */
    const mio = { datos: db.get(m.code) ?? null, defensa:false, bocaAbajo:false };
    /* Lo que puede pegarme en SU turno, no solo lo que hay ahora en el
       campo: si le quedan cartas en la mano, cuenta con la invocación
       típica del formato. Poner en ataque un 1400 con el rival a punto de
       sacar un 1900 es regalar la carta y los puntos de vida. */
    const amenaza = Math.max(
      v.monstruosRival.reduce((mx,c)=> Math.max(mx, c.bocaAbajo ? 1500 : poder(c)), 0),
      pegaMasFuerte(v));
    const campoRivalVacio = v.monstruosRival.length === 0;
    /* Thousand-Eyes Restrict figura como 0/0 y por eso acababa siempre en
       defensa. Pero absorbe el monstruo del rival JUSTO DESPUÉS de entrar
       y se queda con su ataque: si hay algo boca arriba que absorber, su
       sitio es el ataque. La posición se elige antes de la absorción, así
       que hay que saberlo de antemano. */
    const absorbe = canon(names[m.code]?.name ?? "")==="Thousand-Eyes Restrict"
                    && v.monstruosRival.some(c=>!c.bocaAbajo && atk(c) > amenaza-1);
    const aguanta = absorbe || atk(mio) > amenaza;

    /* ══ P04 · CHAOS SORCERER QUE VA A DESTERRAR, EN DEFENSA ══
       Guía, P04: si el monstruo va a usar su destierro, ese turno no
       ataca, así que el ataque no le sirve de nada. En defensa un
       reclutador no puede suicidarse contra él para sacar al siguiente
       (Witch de 1100 contra 2000 de defensa rebota y no muere) y Mirror
       Force no lo toca. Solo se queda en ataque si los números lo piden:
       lo que queda del rival tras el destierro lo mata en defensa pero
       no en ataque. BLS va aparte: su doble ataque es otro plan (P05). */
    const infoPos = infoDe({ ...mio, nombre: names[m.code]?.name ?? "" });
    /* ══ UN VOLTEO QUE SE PUEDE SACAR TAPADO, SALE TAPADO ══
       E, 03-10 (Reino, Weevil, T12): Insect Imitation sacó a Man-Eater
       Bug del mazo DE FRENTE: «pierdes todo el valor de Man-Eater Bug».
       La versión de Goat deja elegir boca abajo en defensa, y un volteo
       solo hace algo si entra tapado. */
    const esVolteo = !!((Number(mio.datos?.type) || 0) & 0x200000)
                     || infoPos.rol === "flip" || infoPos.prefiereSet || infoPos.colocarPreferente;
    if(exp("volteoTapado") && esVolteo && puede(P.FACEDOWN_DEFENSE))
      return { type:R.SELECT_POSITION, position:P.FACEDOWN_DEFENSE };
    /* ══ CONTRA D.D. WARRIOR LADY Y SASUKE, EN ATAQUE ══
       goatformat, «Chaos Monsters: Attack or Defense?»: si el rival juega
       D.D. Warrior Lady (en ataque le cuesta 300–800 de daño antes del
       destierro) o Ninja Grandmaster Sasuke (destruye lo que está en
       defensa sin combate), el Chaos va en ataque. Lo sé si ya los he
       visto: en su campo, cementerio o destierro. */
    const vistoSuyo = nom => rivalUso(v, nom) || v.monstruosRival.some(x => !x.bocaAbajo && canon(x.nombre ?? "") === nom);
    const castigaDefensa = exp("chaosAtk") && (vistoSuyo("D.D. Warrior Lady") || vistoSuyo("Ninja Grandmaster Sasuke"));
    if(exp("chaosDef") && !castigaDefensa && infoPos.noAtacaTrasEfecto && !infoPos.dobleAtaque
       && v.turnoMio && puede(P.FACEUP_DEFENSE) && !letalEnBatalla(v)){
      const blanco = v.monstruosRival.filter(c=>!c.bocaAbajo)
                      .sort((a,b)=>poder(b)-poder(a))[0];
      if(blanco){
        const resto = Math.max(
          v.monstruosRival.filter(c=>c!==blanco)
             .reduce((mx,c)=> Math.max(mx, c.bocaAbajo ? 1500 : poder(c)), 0),
          v.manoRival.cuantas > 0 ? 1800 : 0);   // lo típico que baja de la mano
        if(def(mio) > resto || resto >= atk(mio))
          return { type:R.SELECT_POSITION, position:P.FACEUP_DEFENSE };
        /* Lo que le queda al rival lo mata en defensa pero no en ataque:
           aquí el ataque es lo que lo mantiene vivo. Se mide contra lo
           que QUEDA, no contra el que va a desterrar. */
        if(puede(P.FACEUP_ATTACK))
          return { type:R.SELECT_POSITION, position:P.FACEUP_ATTACK };
      }
    }

    if((campoRivalVacio || aguanta) && puede(P.FACEUP_ATTACK))
      return { type:R.SELECT_POSITION, position:P.FACEUP_ATTACK };
    /* ══ SISTEMA A, TAMBIÉN AQUÍ ══
       Esto pedía `def >= atk` para elegir defensa, la misma condición
       equivocada que dejaba a Sangan de frente: un monstruo que no gana
       el combate pierde CERO puntos de vida en defensa aunque su defensa
       sea ridícula, y la diferencia entera de frente. Si no aguanta y no
       hay nada a lo que pegar, se agacha y punto. */
    const infoMio = infoDe({ ...mio, nombre: names[m.code]?.name ?? "" });
    const ev = evaluarPosicion(mio, v, {
      puedeAtacarYa: false,          // recién invocado: la batalla la decide después
      inmuneCombate: !!infoMio.inmuneCombate,
      perfora: !!infoMio.perfora,
    });
    if(ev.quiere === "defensa" && puede(P.FACEUP_DEFENSE))
      return { type:R.SELECT_POSITION, position:P.FACEUP_DEFENSE };
    if(puede(P.FACEUP_DEFENSE) && def(mio) >= atk(mio))
      return { type:R.SELECT_POSITION, position:P.FACEUP_DEFENSE };
    if(puede(P.FACEUP_ATTACK)) return { type:R.SELECT_POSITION, position:P.FACEUP_ATTACK };
    if(puede(P.FACEUP_DEFENSE)) return { type:R.SELECT_POSITION, position:P.FACEUP_DEFENSE };
    return { type:R.SELECT_POSITION, position:P.FACEDOWN_DEFENSE };
  }
  /* ── LOS EFECTOS OPCIONALES SON DECISIONES ──
     Esto devolvía `yes` a TODO: "los efectos opcionales suelen convenir".
     Suelen, pero no siempre, y ahí vive una familia entera de misplays.
     El que reportó E: D.D. Warrior Lady dice "when this card battles an
     opponent's monster: You can banish that monster, ALSO BANISH THIS
     CARD". Si tu Lady gana el combate limpio, aceptar es cambiar tu
     monstruo vivo por uno que ya estaba muerto: pierdes el cuerpo y el
     tempo. Solo compensa cuando el de enfrente es algo que no puedes
     matar de otra forma. */
  function siNo(m, tipo){
    if(n===0) return { type:tipo, yes: azar(.6) };
    const nom = canon(names[m.code]?.name ?? "");
    const v = vistaDe(duel, yo, db, names);

    if(exp("opcionales") && (nom==="D.D. Warrior Lady" || nom==="D.D. Assailant")){
      /* ¿contra qué está peleando? El adaptador guarda quién declaró el
         ataque; si ataca ella, el objetivo es lo que hay enfrente. */
      const rival = v.monstruosRival.filter(c=>!c.bocaAbajo)
                     .sort((a,b)=>poder(b)-poder(a))[0] ?? null;
      const yoMisma = { datos: db.get(m.code) ?? null, defensa:false, bocaAbajo:false };
      /* Si le gano limpio, me quedo el cuerpo. Si no puedo con él —o es de
         los que no mueren en combate— desterrar a los dos es justo para
         lo que está esa carta. */
      const ganoLimpio = rival && atk(yoMisma) > poder(rival) && !infoDe(rival).inmuneCombate;
      const vale = !rival || !ganoLimpio || valorCarta(rival) >= 1.6;
      traza(`${nom}: ${vale ? "destierro a los dos" : "no, que le gano limpio y me quedo el cuerpo"}`);
      return { type:tipo, yes: vale };
    }
    return { type:tipo, yes:true };     // el resto de opcionales sí convienen
  }

  /* ══════════ ENTRADA ══════════ */
  decidir.ultimoPlan = () => ultimoPlanIdle;
  /* El plan que está usando AHORA (banco: que no se quede en el de por
     defecto cuando el cerebro nace antes que el mazo). */
  decidir.plan = () => PLAN?.nombre ?? null;
  /* Si otro (ai/pensar.js) decide el ataque, el cerebro tiene que saber
     con QUÉ monstruo se ataca: el objetivo se elige después con esa
     carta, y la que había apuntado era la suya. */
  decidir.fijarAtaque = (m, index) => {
    const l = m?.attacks?.[index];
    if(!l){ esperoObjetivoDeAtaque = false; return; }
    const c = duel.resolve(l, l.code);
    ultimoAtacante = c ? { code:c.code, nombre:names[c.code]?.name ?? "", datos:db.get(c.code) ?? null,
                           atkReal:c.atkReal ?? null, defReal:c.defReal ?? null,
                           prestado: c.controller===yo && c.owner!=null && c.owner!==yo,
                           defensa:false, bocaAbajo:false } : null;
    esperoObjetivoDeAtaque = true;
  };
  /* Lo que se acaba de activar, venga de la heurística o de la
     simulación (main.js lo anota también cuando decide ai/pensar.js):
     los objetivos se eligen después y hay que saber para QUÉ carta. */
  decidir.puntosCadena = () => puntosCadena;
  /* Lo que la jugada enviada cambia en la memoria del cerebro. Con
     main.js llega la respuesta FINAL (la de la simulación si decidió
     ella); sin main.js (simulación, tests) la propuesta queda pendiente y
     la confirma la siguiente pregunta de la Main Phase. */
  let jugadaPendiente = null;
  const aplicarJugada = (m, r) => {
    if(r.action === IA.SELECT_POS_CHANGE){
      const l = m.pos_changes?.[r.index];
      const c = l ? duel.resolve(l, l.code) : null;
      contarGiro(c?.uid ?? giroPendiente?.uid);
      if(c?.uid != null) giroManualTurno.set(c.uid, duel.turnCount);
    }
    if(r.action === IA.SELECT_ACTIVATE){
      const l = m.activates?.[r.index];
      const c = l && Number(l.location) === 4 ? duel.resolve(l, l.code) : null;
      if(c?.uid != null && CHAOS_REUSO.has(canon(names[c.code]?.name ?? ""))) efectoUsadoTurno.set(c.uid, duel.turnCount);
    }
  };
  decidir.anotar = (m, r, final = true) => {
    if(!m || !r) return;
    if(m.type === T.SELECT_IDLECMD){
      if(final){ aplicarJugada(m, r); giroPendiente = null; jugadaPendiente = null; }
      else jugadaPendiente = { m, r };
    }
    if(m.type === T.SELECT_IDLECMD)
      activoAhora = r.action === IA.SELECT_ACTIVATE ? (m.activates?.[r.index]?.code ?? null) : null;
    else if(m.type === T.SELECT_CHAIN)
      activoAhora = r.index != null ? (m.selects?.[r.index]?.code ?? null) : activoAhora;
  };
  return decidir;
  function decidir(mensaje, intento=0){
    asegurarPlan();
    /* Frontera: el cerebro nunca ve el mensaje crudo del motor. */
    const m = mensajeLegal(mensaje, duel, yo);
    const tocaObjetivo = esperoObjetivoDeAtaque;
    /* Un reintento de la misma selección conserva la marca; cualquier
       otra pregunta la borra. */
    if(m.type !== T.SELECT_CARD) esperoObjetivoDeAtaque = false;
    switch(m.type){
      case T.SELECT_IDLECMD:   {
        /* Sin main.js (simulación, tests) nadie confirma: la propuesta
           anterior que siga pendiente se jugó. */
        if(jugadaPendiente){ aplicarJugada(jugadaPendiente.m, jugadaPendiente.r); jugadaPendiente = null; giroPendiente = null; }
        else if(giroPendiente){ contarGiro(giroPendiente.uid); giroPendiente = null; }
        const r = mainPhase(m, intento); decidir.anotar(m, r, false); return r; }
      case T.SELECT_BATTLECMD: {
        const r = battlePhase(m, intento);
        esperoObjetivoDeAtaque = r?.action === BA.SELECT_BATTLE;
        return r;
      }
      case T.SELECT_CHAIN:     { const r = cadena(m, intento); decidir.anotar(m, r); return r; }
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE:
      case T.SELECT_UNSELECT_CARD: {
        /* La marca se borra con la siguiente pregunta que no sea esta
           (siempre llega una ventana de cadena antes de cualquier otro
           objetivo), así que un reintento de la misma selección la
           conserva. */
        return elegirCartas(m, intento, tocaObjetivo && m.type === T.SELECT_CARD);
      }
      case T.ANNOUNCE_RACE: {
        /* Tribe-Infecting Virus (y cualquier carta que pida un tipo): el
           que más le quita a él y menos a mí. Antes lo declaraba el piloto
           genérico, que coge el primer tipo de la lista. */
        if(!exp("tiv")) return null;
        const v2 = vistaDe(duel, yo, db, names);
        const disponibles = (() => { try { return BigInt(m.available ?? 0); } catch(e){ return 0n; } })();
        const virus = v2.monstruos.find(x => canon(x.nombre ?? "") === "Tribe-Infecting Virus");
        const t = mejorTipoTIV(v2, virus?.uid ?? null, disponibles || null);
        if(!t) return null;
        traza(`declara el tipo ${t.nombre}`);
        return { type:R.ANNOUNCE_RACE, races:[t.tipo] };
      }
      case T.ANNOUNCE_CARD: {
        /* Un jugador conoce su propio mazo: se declara la carta que más
           copias le quedan, que es la jugada correcta con Archfiend's Oath. */
        /* OJO: esto miraba `duel.zones[yo][DECK]`, y ahí los códigos son
           ficticios —al robar se reasignan—, así que declaraba una carta
           que podía llevar ya en la mano. Se usa el mazo restante de
           verdad: decklist menos todo lo visto. */
        const v2 = vistaDe(duel, yo, db, names);
        /* Con la carta de arriba a la vista (Convulsion, Feather of the
           Phoenix), Archfiend's Oath declara ESA. */
        if(exp("library") && v2.cimaMazo){
          const d0 = db.get(v2.cimaMazo); let vale0 = true;
          try{ vale0 = X.cardMatchesOpcode(d0, m.opcodes); }catch(e){ vale0 = true; }
          if(d0 && vale0){ traza(`declara ${names[v2.cimaMazo]?.name ?? v2.cimaMazo} (la veo arriba del mazo)`); return { type:R.ANNOUNCE_CARD, card:v2.cimaMazo }; }
        }
        const orden=[...(v2.mazo ?? new Map()).entries()].sort((a,b)=>b[1]-a[1]);
        for(const [code] of orden){
          const d=db.get(code); if(!d) continue;
          let vale=true;
          try{ vale = X.cardMatchesOpcode(d, m.opcodes); }catch(e){ vale=true; }
          if(vale){ traza(`declara ${names[code]?.name ?? code}`); return { type:R.ANNOUNCE_CARD, card:code }; }
        }
        return null;
      }
      /* Tributos de una invocación ritual: hay que dar con un grupo cuyos
         niveles sumen lo que pide la carta. Sin esto el bot no podía jugar
         ningún mazo de ritual —y el jugador tampoco, que es por donde
         apareció el fallo. Se paga con lo que menos duela. */
      case T.SELECT_SUM: {
        const combis = combinacionesSuma(m);
        if(!combis.length) return { type:R.SELECT_SUM, indicies:null };
        const coste = idx => idx.reduce((s,i)=>s + valorCarta(cartaDeLista(m.selects[i])), 0);
        const mejor = combis.slice().sort((a,b)=> coste(a)-coste(b) || a.length-b.length)[0];
        traza(`tributa ${mejor.map(i=>names[m.selects[i].code]?.name).join(" + ")}`);
        return { type:R.SELECT_SUM, indicies:mejor };
      }
      /* ══ CUÁNTO SE PAGA POR WALL OF REVEALING LIGHT ══
         E, 25-09 (PACMAN): «normalmente cuando se juega Wall of Revealing
         Light se suele pagar 3000». 3000 para todo lo que el formato suele
         poner en la mesa (hasta BLS y Jinzo); más si ya tiene algo mayor
         boca arriba, y nunca tanto que me deje por debajo de 1000. */
      case T.ANNOUNCE_NUMBER: {
        const opciones = (m.options ?? []).map(o => Number(o));
        if(!opciones.length || !exp("pagoMuro")) return null;
        const nom = canon(names[activoAhora]?.name ?? "");
        if(nom !== "Wall of Revealing Light") return null;
        const v2 = vistaDe(duel, yo, db, names);
        const suMayor = Math.max(0, ...v2.monstruosRival.filter(x => !x.bocaAbajo).map(x => atk(x)));
        const quiero = Math.max(3000, Math.ceil(suMayor / 1000) * 1000);
        const tope = v2.lp.mio - 1000;
        const validas = opciones.map((o, i) => ({ o, i })).filter(x => x.o <= tope);
        if(!validas.length) return { type:R.ANNOUNCE_NUMBER, value:0 };
        const elegida = validas.filter(x => x.o >= quiero).sort((a,b) => a.o - b.o)[0]
                     ?? validas.sort((a,b) => b.o - a.o)[0];
        traza(`Wall of Revealing Light: pago ${elegida.o}`);
        return { type:R.ANNOUNCE_NUMBER, value:elegida.i };
      }
      /* Reversal Quiz: «monstruo, mágica o trampa» con la de arriba a la vista. */
      case T.SELECT_OPTION: {
        /* Cantar la moneda (Fairy Box y compañía): opciones 60/61, cara o
           cruz. Sin esto contestaba el piloto genérico, que dice siempre
           la primera: el bot cantaba cara SIEMPRE y se notaba (Reddit). */
        if((m.options ?? []).length === 2 && m.options.every(o => o === 60n || o === 61n || o === 60 || o === 61))
          return { type:R.SELECT_OPTION, index: Math.random() < 0.5 ? 0 : 1 };
        if(!exp("library")) return null;
        const top = duel.cadena?.at(-1);
        if(!(top?.controller === yo && canon(names[top.code]?.name ?? "") === "Reversal Quiz")) return null;
        const cima = duel.cimaMazo?.[yo];
        const t = Number(db.get(cima)?.type) || 0;
        if(!cima || !t) return null;
        const idx = (t & 0x1) ? 0 : (t & 0x2) ? 1 : 2;
        if(idx >= (m.options?.length ?? 3)) return null;
        traza(`Reversal Quiz: arriba hay ${names[cima]?.name} → ${["monstruo","mágica","trampa"][idx]}`);
        return { type:R.SELECT_OPTION, index: idx };
      }
      case T.SELECT_POSITION:  return posicion(m);
      case T.SELECT_EFFECTYN:  return siNo(m, R.SELECT_EFFECTYN);
      case T.SELECT_YESNO:     return siNo(m, R.SELECT_YESNO);
      case T.SELECT_PLACE: {
        /* ══ LAS ZONAS DEL BACKROW NO SE LEEN ══
           FLC9 (MMF, goatformat): su rival siempre pegaba la MST a la
           tapada más cercana al mazo y su Book of Moon era predecible por
           la zona. El piloto genérico colocaba siempre en la primera zona
           libre: un rival atento sabía qué había en cada una por orden de
           colocación. Para mis mágicas y trampas, una zona libre al azar. */
        if(n < 2 || (m.count ?? 1) !== 1) return null;
        const mask = m.field_mask >>> 0;
        const b = (mask >>> 8) & 0xff;                     // byte 1: mis zonas de M/T
        const libresMT = [0,1,2,3,4].filter(sq => !((b >>> sq) & 1));
        const bm = mask & 0xff;
        const libresM = [0,1,2,3,4].filter(sq => !((bm >>> sq) & 1));
        /* Solo si lo que se coloca es M/T: si hay zonas de monstruo libres
           en la máscara, la pregunta es por un monstruo y se deja. */
        if(!libresMT.length || libresM.length) return null;
        const sq = libresMT[(aleatorio() * libresMT.length) | 0];
        return { type:R.SELECT_PLACE, places:[{ player:m.player ?? yo, location:8, sequence:sq }] };
      }
      default: return null;    // lo demás lo resuelve el piloto genérico
    }
  };
}
