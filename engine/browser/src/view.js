/* ════════════════════════════════════════════════════════════
   CAPA VISUAL — no sabe nada de ocgcore. Consume eventos.
   ════════════════════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
/* Traducción: si no hay módulo de idiomas cargado (pruebas de node), el
   texto pasa tal cual. Ver src/i18n.js. */
const T = s => (globalThis.__T ? globalThis.__T(s) : s);
/* `GOAT_VELOCIDAD` (solo pruebas): acelera todas las esperas de la vista,
   para poder jugar un duelo entero de sala en dos pestañas en segundos. */
const sleep = ms => new Promise(r=>setTimeout(r, ms * (globalThis.GOAT_VELOCIDAD ?? 1)));
const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64, FZONE:256 };
const ZKEY = { [L.DECK]:"deck", [L.HAND]:"hand", [L.MZONE]:"m", [L.SZONE]:"st",
               [L.GRAVE]:"gy", [L.REMOVED]:"banish", [L.EXTRA]:"extra", [L.FZONE]:"field" };
const ATTRCOL = { 1:["#6b2f1d","#2a0f08","FUEGO"], 2:["#1f4f68","#0a1e28","AGUA"],
  4:["#46522c","#181d0e","TIERRA"], 8:["#26513f","#0d1f18","VIENTO"],
  16:["#7a6a3a","#2a240f","LUZ"], 32:["#412croak","#170b22","OSCURIDAD"],
  64:["#4a3a5a","#1a1020","DIVINO"] };
ATTRCOL[32] = ["#412a5e","#170b22","OSCURIDAD"];
const T_MONSTER=0x1, T_SPELL=0x2, T_TRAP=0x4, T_FUSION=0x40, T_FIELD=0x80000;
const IMG_BASE = "https://images.ygoprodeck.com/images/cards/";
/* Las variantes del pool no tienen imagen propia en el servidor: se pide
   la del passcode original. Sin esto, 212 cartas salían en blanco y
   parecía que la imagen no cargaba (E lo vio con Gravekeeper's Spy). */
const imgSrc = code => globalThis.imagenDeCarta
  ? globalThis.imagenDeCarta(code) : (IMG_BASE + code + ".jpg");

let grid, layer, DUEL, DB, NAMES, ME=0, useImages=true;
/* Orden visual de tu mano. Es SOLO de la vista: el motor mantiene su
   propio orden y no se toca, porque cambiarlo desincronizaría todo. */
let ordenMano = [];
function manoOrdenada(arr){
  const vivos = arr.map(c=>c.uid);
  ordenMano = ordenMano.filter(u=>vivos.includes(u));
  for(const u of vivos) if(!ordenMano.includes(u)) ordenMano.push(u);
  return [...arr].sort((a,b)=>ordenMano.indexOf(a.uid)-ordenMano.indexOf(b.uid));
}
/* Colocación provisional: al soltar una carta sobre una zona se queda ahí
   mientras decides invocar/colocar/activar. Si cancelas, vuelve a la mano.
   Antes volvía a la mano al instante y luego reaparecía en el campo, y
   parecía que la suelta no había funcionado. */
/* Cartas que el motor ha enseñado (Trap Dustshoot y compañía). Se sacan
   de la mano al centro del tablero, boca arriba y grandes, y vuelven a
   taparse solas cuando termina la cadena. */
let revelados = new Set();
export function revelar(uids){
  revelados = new Set(uids ?? []);
  layoutAll();
}
export function ocultarReveladas(){
  if(!revelados.size) return;
  revelados = new Set();
  layoutAll();
}
let previa = null;   // {uid, owner, zone, slot}
export function previaSuelta(uid, owner, zone, slot){
  previa = { uid, owner:Number(owner), zone, slot:Number(slot) };
  layoutAll();
}
export function quitarPrevia(recolocar=true){
  if(!previa) return;
  previa = null;
  if(recolocar) layoutAll();
}
export function moverEnMano(uid, destino){
  const i = ordenMano.indexOf(uid);
  if(i<0) return;
  ordenMano.splice(i,1);
  ordenMano.splice(Math.max(0,Math.min(destino, ordenMano.length)), 0, uid);
  layoutAll();
}
const els = new Map(), zoneEls = {};

/* Moneda al aire: la cara dorada es tuya, la roja del rival. */
/* La cara de la moneda: el arte de verdad si está, y si no el degradado
   de siempre. */
function caraMoneda(cual){
  const src = globalThis.ARTE?.[cual === "cara" ? "cara" : "cruz"];
  return src ? `<div class="coinFace conArte"><img src="${src}" alt=""></div>`
             : `<div class="coinFace"></div>`;
}

export async function sorteo(empiezasTu){
  const cap=document.getElementById("coin");
  cap.innerHTML=`<div class="coinWrap">${caraMoneda(empiezasTu?"cara":"cruz")}</div>
                 <div class="coinTxt">${T("Sorteo…")}</div>`;
  cap.style.display="flex";
  const moneda=cap.querySelector(".coinWrap");
  moneda.classList.add("girando");
  await sleep(1500);
  moneda.classList.remove("girando");
  moneda.classList.add(empiezasTu ? "cara" : "cruz");
  cap.querySelector(".coinTxt").textContent = T(empiezasTu ? "Empiezas tú" : "Empieza el rival");
  cap.querySelector(".coinTxt").style.color = empiezasTu ? "var(--gold)" : "#ff8f7a";
  await sleep(1400);
  cap.style.opacity="0";
  await sleep(350);
  cap.style.display="none"; cap.style.opacity="";
}
/* ══ LA MONEDA DEL DUELO ══
   Fairy Box, Time Wizard, Arcana Force… tiran una moneda y hasta ahora
   el resultado se aplicaba sin que se viera NADA: E lo describió como
   "parece que ha tirado la moneda pero yo no la he visto". Ahora se
   enseña, con su animación, y dice de quién es la tirada. */
export async function tirarMoneda(resultados, dueño = null){
  const cap = document.getElementById("coin");
  if(!cap || !resultados?.length) return;
  const cara = !!resultados[0];
  cap.innerHTML = `<div class="coinWrap girando">${caraMoneda(cara?"cara":"cruz")}</div>
    <div class="coinTxt">${T(dueño ? "Tirada de moneda" : "Tirada de moneda")}</div>`;
  cap.style.display = "flex";
  await sleep(1100);
  cap.querySelector(".coinWrap").classList.remove("girando");
  const txt = resultados.map(r => T(r ? "Cara" : "Cruz")).join(" · ");
  cap.querySelector(".coinTxt").textContent = txt;
  cap.querySelector(".coinTxt").style.color = cara ? "var(--gold)" : "#ff8f7a";
  await sleep(1200);
  cap.style.opacity = "0"; await sleep(300);
  cap.style.display = "none"; cap.style.opacity = "";
}

export function initView({ duel, db, names, me=0, images=true }){
  DUEL=duel; DB=db; NAMES=names; ME=me; useImages=images;
  grid=$("#grid"); layer=$("#cardLayer");
  /* ══ LIMPIAR ANTES DE EMPEZAR ══
     Hasta el Reino de los Duelistas, un duelo nuevo siempre venía con la
     página recién cargada. Ahora se juegan varios seguidos sin recargar y
     el estado del anterior se quedaba dentro: `els` guarda un elemento por
     uid, y los uids del duelo nuevo empiezan otra vez en 1, así que las
     cartas nuevas REUTILIZABAN los elementos de las viejas. Eso es lo que
     E vio en el segundo duelo: cartas que en la mano eran una y en el
     panel otra, imposibles de jugar, y los puntos de vida del rival a 0
     porque eran los del duelo anterior. */
  for(const [,el] of els) el.remove?.();
  els.clear();
  if(layer) layer.innerHTML = "";
  ordenMano = []; revelados.clear(); previa = null; dragging = null;
  ultimaCarta = null; ultimaFase = null; momentoActual = null;
  limpiarCuentas();
  for(const id of ["log","historial","prompt","fin","choice","zoneview"]){
    const n = document.getElementById(id);
    if(n){ n.innerHTML = ""; if(id!=="log"&&id!=="historial") n.style.display = "none"; }
  }
  for(const lado of [0,1]) setLP(lado, duel?.lp?.[lado] ?? 8000);
  buildBoard();
  fitBoard();
  recolocarSiempre();
  /* Tocar el tablero recoge la mano: es el gesto natural de "ya he
     mirado". El escenario, no `document`, para que los menús y el panel
     de decisiones sigan funcionando encima. */
  try{
    const escenario = document.getElementById("stage");
    if(escenario?.addEventListener && !escenario.__manoCierra){
      escenario.__manoCierra = true;
      escenario.addEventListener("pointerdown", e => {
        if(e.target?.closest?.(".card, #choice, #prompt, #controles")) return;
        abrirMano(false);
      });
    }
    document.body?.classList?.remove?.("manoAbierta");
  }catch(e){}
}
export function setImages(on){ useImages=on; for(const [,el] of els) el.dataset.code=""; layoutAll(true); }

let zoneViewHandler=null;
export function setZoneViewHandler(fn){ zoneViewHandler=fn; }
export function openZoneView(title, cards, onPick){
  const v=document.getElementById("zoneview");
  /* ══ UN CEMENTERIO QUE NO SE PUEDE LEER NO SIRVE ══
     Este visor tapa la pantalla entera con un fondo borroso, así que el
     panel de carta de la izquierda queda DEBAJO: llenarlo no servía de
     nada. Y lo único que había era un `onmouseenter`, o sea nada con el
     dedo. Resultado: en el móvil abrías el cementerio, veías veinte
     miniaturas y no había forma de saber qué hacía ninguna. Lo reportó
     E. La ficha va DENTRO del visor, y se llena al tocar.

     Y cuando el visor sirve para ELEGIR (un objetivo del cementerio),
     tocar una carta ya no la elige de golpe: la enseña, y elegirla es un
     botón aparte. Es el mismo error que E encontró en la hoja de
     recompensa —«a veces le doy a coger cuando quería cerrar»— y aquí
     costaba un objetivo equivocado. */
  v.innerHTML=`<div class="zvhead"><span>${T(title)}</span>
    <button class="zvclose">${T("Cerrar")}</button></div>
    <div class="zvcuerpo"><div class="zvgrid"></div>
    <aside class="zvficha"><div class="zvvacio">${
      T(esTactil() ? "Toca una carta para leerla"
                   : "Pasa el ratón por una carta para ver su texto")}</div></aside></div>`;
  const g=v.querySelector(".zvgrid");
  const ficha=v.querySelector(".zvficha");
  if(!cards.length) g.innerHTML=`<div class="zvempty">${T("No hay cartas aquí")}</div>`;

  function verFicha(c){
    const d=DB.get(c.code) ?? {};
    const mon=!!(d.type & T_MONSTER);
    const attr=T(mon ? (ATTRCOL[d.attribute]?.[2] ?? "")
                     : (d.type & T_SPELL ? "Carta Mágica" : "Carta de Trampa"));
    /* De DÓNDE sale la carta. En una búsqueda —Magician of Faith, Sangan,
       Premature Burial— la lista mezcla cementerio, mazo y desterradas, y
       sin esto no sabes de dónde te la vas a traer. */
    const ZONA = { 1:"Deck", 2:"Mano", 4:"Campo", 8:"M/T",
                   16:"Cementerio", 32:"Desterradas", 64:"Extra" };
    const donde = c.location != null && ZONA[c.location] ? T(ZONA[c.location]) : "";
    ficha.innerHTML=`${useImages?`<img class="zvimg" src="${IMG_BASE}${artCode(c.code)}.jpg"
        onerror="this.style.display='none'">`:""}
      <h3>${nameOf(c.code)}</h3>
      <div class="zvmeta">${[mon ? `${attr} · ${T("Nivel "+d.level)}` : attr, donde]
        .filter(Boolean).join(" · ")}</div>
      ${mon?`<div class="zvstats"><span>ATK ${d.attack}</span><span>DEF ${d.defense}</span></div>`:""}
      <div class="zvtexto">${textOf(c.code).replace(/\r?\n/g,"<br>")}</div>`;
    if(onPick){
      const b=document.createElement("button");
      b.className="zvelegir"; b.textContent=T(c.elegida ? "Quitar de la selección" : "Elegir esta carta");
      b.onclick=()=>{ onPick(c); };
      ficha.appendChild(b);
    }
  }

  for(const c of cards){
    const d=document.createElement("div");
    // lo que está boca abajo y no es tuyo, se enseña de espaldas
    const oculta = !!(c.position & 0x0a) && c.controller!=null && c.controller!==ME;
    /* Selección múltiple (dos cartas del cementerio, por ejemplo): la que
       ya elegiste sale marcada al volver a abrirse el visor. Sin esto, con
       dos copias de la misma carta no había forma de saber cuál cogiste. */
    d.className="zvcard"+(onPick?" pickable":"")+(c.elegida?" elegida":"");
    d.innerHTML=`<div class="card${oculta?" facedown":""}" style="position:static;width:100%;height:100%">
      <div class="inner"><div class="face front">${oculta?"":frontHTML(c.code)}</div>
      <div class="face back"><img src="${CARD_BACK}" alt=""></div></div></div>`;
    if(!oculta){
      /* Solo se repinta la ficha si de verdad ha cambiado de carta. Sin
         esto, cada `mouseenter` reescribía el `innerHTML` entero y volvía
         a pedir la imagen, así que el panel daba un fogonazo cada vez que
         el ratón rozaba la misma carta. */
      d.onmouseenter=()=>{
        showDetail(c.code);
        const quien = String(c.uid ?? c._i ?? c.code);
        if(ficha.dataset.uid === quien) return;
        verFicha(c); ficha.dataset.uid = quien;
      };
      d.onclick=()=>{
        /* La identidad tiene que ser ESTABLE y única. Con `c.uid` sin
           definir —las listas de selección no lo traían— todas las
           cartas valían "undefined", así que el segundo clic sobre
           CUALQUIER otra la elegía sin haberla leído. */
        const quien = String(c.uid ?? c._i ?? c.code);
        const yaLeida = ficha.dataset.uid === quien;
        verFicha(c);
        ficha.dataset.uid = quien;
        /* Con ratón, un clic sobre la carta que ya se está leyendo la
           elige: quien juega en PC no quiere dos clics por objetivo. Con
           el dedo NUNCA: ahí el botón es el único camino. */
        if(onPick && !esTactil() && yaLeida) onPick(c);
      };
    } else if(onPick) d.onclick=()=>{ onPick(c); };   // tapada: no hay nada que leer
    g.appendChild(d);
  }
  v.querySelector(".zvclose").onclick=closeZoneView;
  v.style.display="flex";
}
let alCerrarVisor=null;
export function setZoneViewClose(fn){ alCerrarVisor=fn; }
export function closeZoneView(){
  document.getElementById("zoneview").style.display="none";
  const f=alCerrarVisor; if(f) setTimeout(f,0);
}

function slot(owner, zone, i, cls, label){
  const d=document.createElement("div");
  d.className="slot "+(cls||"");
  d.dataset.owner=owner; d.dataset.zone=zone; d.dataset.slot=i;
  if(label){ d.classList.add("empty-label"); d.dataset.label=T(label); }
  if(zone==="gy"||zone==="extra"||zone==="banish"){
    d.classList.add("browsable");
    d.addEventListener("click",()=>zoneViewHandler?.(owner, zone));
  }
  /* La casilla también responde al clic: si fallas la carta por unos píxeles
     —declarando un ataque, sobre todo— el clic sigue valiendo. */
  if(zone==="m"||zone==="st"||zone==="field"){
    d.classList.add("hitzona");
    d.addEventListener("click",()=>{
      if(dragging) return;
      const loc = zone==="m" ? L.MZONE : zone==="st" ? L.SZONE : L.FZONE;
      const c = DUEL?.zones?.[owner]?.[loc]?.[i];
      if(c) clickHandler?.(c);
    });
  }
  if(["deck","gy","extra","banish"].includes(zone)) d.classList.add("contable");
  zoneEls[`${owner}:${zone}:${i}`]=d; grid.appendChild(d); return d;
}
function buildBoard(){
  grid.innerHTML=""; const foe=1-ME;
  const blank=()=>{ const b=document.createElement("div"); b.className="slot blank"; grid.appendChild(b); };
  /* El lado del rival es el tuyo girado 180°, como dos tapetes enfrentados.
     Por eso hay NUEVE columnas y no ocho: con ocho, poner las desterradas
     del rival pegadas a su cementerio desplazaba sus monstruos una casilla
     y las dos filas dejaban de mirarse de frente. Con la columna extra a
     cada lado, monstruos y M/T quedan enfrentados y cada cementerio tiene
     sus desterradas al lado. */
  blank();
  slot(foe,"deck",0,"special","Deck");
  for(let i=4;i>=0;i--) slot(foe,"st",i,"st","M/T");
  slot(foe,"extra",0,"special","Extra");
  blank();

  slot(foe,"banish",0,"banish","Desterradas");
  slot(foe,"gy",0,"special","Cementerio");
  for(let i=4;i>=0;i--) slot(foe,"m",i,"","Monstruo");
  slot(foe,"field",0,"special","Campo");
  blank();

  const dv=document.createElement("div"); dv.className="divider"; grid.appendChild(dv);

  blank();
  slot(ME,"field",0,"special","Campo");
  for(let i=0;i<5;i++) slot(ME,"m",i,"","Monstruo");
  slot(ME,"gy",0,"special","Cementerio");
  slot(ME,"banish",0,"banish","Desterradas");

  blank();
  slot(ME,"extra",0,"special","Extra");
  for(let i=0;i<5;i++) slot(ME,"st",i,"st","M/T");
  slot(ME,"deck",0,"special","Deck");
  blank();
}
const nameOf = c => NAMES[c]?.name ?? `#${c}`;
const textOf = c => (NAMES[c]?.desc ?? "");
/* Con qué passcode se pide la imagen. Primero el alias de la base (las
   variantes "(GOAT)" apuntan al original), y si no lo tiene —hay 212 que
   no— la tabla que se calcula al construir. Sin esto la carta sale en
   blanco: E lo vio con Gravekeeper's Spy. */
/* ══════════════════════════════════════════════════════════════════
   `alias` EN LA BASE DE OCGCORE ES UNA REGLA DE NOMBRE, NO UNA IMAGEN

   Esto era `DB.alias || IMG_ALIAS[c] || c`, y el orden estaba al revés.
   En la base de ocgcore, `alias` significa "a efectos de reglas esta
   carta CUENTA como aquella" —el límite de tres copias por nombre—, no
   "se ilustra como aquella". Para las variantes "(GOAT)" y
   "(Pre-Errata)" las dos cosas coinciden y por eso funcionaba; para las
   que son cartas distintas de verdad, no:

     A Legendary Ocean  ->  se dibujaba con el arte de Umi
     Harpie Lady 1/2/3  ->  las tres con el arte de Harpie Lady
     Cyber Harpie Lady  ->  también

   Son 10 passcodes REALES, y cuatro de ellos están en el starter de
   arpías, así que el mazo entero salía con la misma ilustración
   repetida. E lo reportó como "cartas sin arte" y en realidad era arte
   equivocado — que desde el asiento del jugador se parece bastante.

   El orden bueno: manda `IMG_ALIAS`, que es la tabla hecha PARA las
   imágenes; si no dice nada y el passcode es de Konami (ocho dígitos o
   menos), el servidor tiene esa carta y se pide tal cual; y el `alias`
   de reglas queda solo como último recurso para los passcodes
   inventados del pool, que es lo único para lo que servía.
   Lo vigila `check-arte.mjs`.
   ══════════════════════════════════════════════════════════════════ */
const PASSCODE_DE_KONAMI = c => String(c).length <= 8;
const artCode = c => (globalThis.IMG_ALIAS?.[c]
                      || (PASSCODE_DE_KONAMI(c) ? c : DB.get(c)?.alias)
                      || c);

/* La imagen oficial YA es la carta entera (marco, nombre, ATK/DEF).
   Dibujar encima un marco propio solo la ensuciaba. Si la imagen no carga
   —sin internet— se muestra debajo una ficha mínima como respaldo. */
function frontHTML(code){
  const d=DB.get(code);
  const mon=!!(d?.type & T_MONSTER);
  const [c1,c2,attr] = !d ? ["#333","#111",""]
    : mon ? (ATTRCOL[d.attribute] ?? ["#4a4a4a","#1a1a1a",""])
    : (d.type & T_SPELL) ? ["#14544c","#062420",T("MÁGICA")] : ["#5c1f42","#26081a",T("TRAMPA")];
  const respaldo = `<div class="fallback" style="background:linear-gradient(155deg,${c1},${c2})">
      <span class="fbname">${nameOf(code)}</span>
      ${mon?`<span class="fbstats">${d.attack}/${d.defense}</span>
             <span class="fblv">${"★".repeat(Math.min(d.level||0,8))}</span>`
           :`<span class="fbstats">${attr}</span>`}
    </div>`;
  /* ══ LA IMAGEN PUEDE LLEGAR TARDE ══
     Reddit, día 2: «no puedo resolver ningún efecto de búsqueda sin que
     pete» y un `Cannot read properties of null (reading 'classList')` en
     el `onload` de una imagen. Era esto: una búsqueda abre el visor con
     las 30 cartas del mazo, eliges una, el visor se cierra… y las
     imágenes que seguían descargándose cargan DESPUÉS, ya sin padre. El
     error tapaba la pantalla entera. Con red lenta (un móvil) pasaba casi
     siempre; aquí, con la red local, nunca. `_repro-busqueda.mjs` lo
     reproduce retrasando las imágenes. */
  const img = useImages
    ? `<img class="cimg" src="${IMG_BASE}${artCode(code)}.jpg" loading="lazy"
         onload="var p=this.parentNode;if(p&&p.classList)p.classList.add('hasimg')">`
    : "";
  return respaldo + img;
}
function classOf(code){
  const d=DB.get(code); if(!d) return "";
  if(d.type & T_FUSION) return "fusion";
  if(d.type & T_SPELL) return "spell";
  if(d.type & T_TRAP) return "trap";
  return "";
}
/* ══════════════════════════════════════════════════════════════════
   LO QUE NO PUEDES VER NO LLEGA A LA PÁGINA

   E, dos veces: «sigo viendo cuando setea cartas; he visto cómo
   colocaba una carta y ponía Sinister Serpent». La causa estaba aquí:
   cada carta se pintaba con su CARA DE VERDAD —imagen, nombre, la clase
   `trap`/`spell` y el código en `data-code`— aunque estuviera boca abajo
   o en la mano del rival, y solo se tapaba GIRÁNDOLA con CSS. Durante la
   animación de colocarla el frente asoma, en algunos navegadores se ve
   a través, y cualquiera que abra las herramientas del navegador lo lee.
   Es la misma trampa que `ai/view.js` evita para el bot, en el otro lado.

   Regla: la cara solo se pinta si la carta es PÚBLICA para ti. Oculta:
   lo del rival boca abajo en el campo, su mano y su extra; y el mazo de
   los dos (el orden del tuyo tampoco lo sabes). Una carta que un efecto
   revela (`revelados`) sí se ve mientras dure. */
function ocultaParaMi(card){
  if(revelados.has(card.uid)) return false;
  if(card.location===L.DECK) return true;
  if(card.controller===ME) return false;
  if(card.location===L.HAND || card.location===L.EXTRA) return true;
  if((card.location===L.MZONE || card.location===L.SZONE) && isFD(card.position)) return true;
  return false;
}
function elFor(card){
  let el=els.get(card.uid);
  const oculta = ocultaParaMi(card);
  if(!el){
    el=document.createElement("div");
    el.className="card "+(oculta ? "" : classOf(card.code));
    el.dataset.uid=card.uid;
    el.innerHTML=`<div class="shake"><div class="inner">
      <div class="face front"></div>
      <div class="face back"><img src="${CARD_BACK}" alt=""></div></div></div>`;
    /* ══ UNA CARTA NUEVA NO NACE EN LA ESQUINA ══
       El elemento se creaba en 0,0 y la primera transición la llevaba a
       su sitio: una carta robada salía volando desde la esquina superior
       de la pantalla en vez de desde el mazo. Se coloca de entrada en la
       posición de su ZONA DE ORIGEN —el mazo, para lo que se roba— y la
       animación ya sale de donde tiene que salir. */
    const cuna = zonePos(card.controller,
      card.location === L.HAND ? "deck"
      : card.location === L.EXTRA ? "extra"
      : card.location === L.GRAVE ? "gy" : "deck", 0);
    el.style.transform = `translate3d(${cuna.x}px,${cuna.y}px,0)`;
    el.style.opacity = "0";
    layer.appendChild(el); els.set(card.uid, el); wire(el, card);
    /* Y aparece en el siguiente fotograma, para que la transición de
       `layoutAll` tenga de dónde partir. */
    requestAnimationFrame(()=>{ el.style.opacity = ""; });
  }
  const codigoVisible = oculta ? "" : String(card.code);
  if(el.dataset.code !== codigoVisible){
    el.querySelector(".face.front").innerHTML = oculta ? "" : frontHTML(card.code);
    el.className = "card "+(oculta ? "" : classOf(card.code));
    el.dataset.code = codigoVisible;
  }
  return el;
}
const isFD = p => !!(p & 0x0a);
/* Opciones → «Cartas del rival»: derechas (por defecto, como siempre) o
   del revés. E, 05-10: el giro, solo si se pide. */
let GIRAR_RIVAL = false;
try{ GIRAR_RIVAL = JSON.parse(localStorage.getItem("goatConfig") || "{}").girarRival === 1; }catch(e){}
const isDef= p => !!(p & 0x0c);
const TILT=11;

/* ── ATAQUE REAL SOBRE LA CARTA ──
   La ilustración lleva impreso el ATK de fábrica y punto. Thousand-Eyes
   Restrict pone 0/0 y con un monstruo absorbido pega con 1.900; un
   monstruo con Snatch Steal encima, o un Breaker que ya gastó su contador,
   tampoco coinciden. No había forma de saber con cuánto pega nada en el
   tablero, ni para ti ni mirando el campo rival. Desde que el adaptador le
   pregunta los valores al motor, se pinta una chapita cuando —y solo
   cuando— lo real no coincide con lo impreso.
   OJO: se guarda la referencia en el propio elemento en vez de buscarla
   con querySelector. El DOM simulado de las pruebas FABRICA el elemento
   que le pidas, así que un querySelector ahí nunca devuelve null y la
   comprobación "¿ya existe?" saldría siempre que sí. */
function marcarStats(el, card, loc){
  const d = DB.get(card.code);
  const visible = loc===L.MZONE && !isFD(card.position)
                  && d && (d.type & T_MONSTER) && card.atkReal!=null
                  && (card.atkReal!==d.attack || card.defReal!==d.defense);
  let b = el.__buff;
  if(!visible){ if(b) b.style.display="none"; return; }
  if(!b){
    b = document.createElement("div");
    b.className = "buff";
    el.appendChild(b); el.__buff = b;
  }
  b.style.display = "";
  const txt = `${card.atkReal}/${card.defReal}`;
  if(b.textContent !== txt){
    b.textContent = txt;
    b.classList.toggle("sube", card.atkReal >  d.attack);
    b.classList.toggle("baja", card.atkReal <  d.attack);
  }
}

/* ══ EL TABLERO SE COLOCA TARDE ══
   E, en Android: "al principio no veía los botones de pasar turno, pero
   al poner y quitar la pantalla completa sí los veía". No era la pantalla
   completa: era que ENTRAR Y SALIR dispara un `resize`, y el resize es lo
   único que volvía a medir. En un móvil la primera medida casi nunca es
   la buena — la barra de URL se retrae al primer scroll, las fuentes
   cargan después, y `100dvh` cambia de valor por el camino.

   Así que se mide varias veces y ante todo lo que mueve el viewport:
   rotación, entrar o salir de pantalla completa, y el `visualViewport`,
   que es el único que se entera de la barra del navegador. */
let recolocarPuesto = false;
function recolocarSiempre(){
  /* Solo con un motor de maquetación de verdad. En el DOM simulado todas
     las medidas son cero, así que estas pasadas no arreglarían nada y sí
     hacen daño: repintar el tablero a destiempo durante el sorteo dejaba
     `check-controles` fallando dos de cada tres veces. */
  if(!(grid?.offsetWidth > 0)) return;
  const rehacer = () => { fitBoard(); layoutAll(true); };
  /* Varias pasadas tras arrancar: dos fotogramas y tres tiempos. Sale
     barato y quita el "no veo los botones" de la primera partida. */
  const g = globalThis.requestAnimationFrame ?? (f=>setTimeout(f,16));
  g(()=> g(rehacer));
  for(const ms of [120, 400, 1200]) setTimeout(rehacer, ms);
  if(recolocarPuesto) return;              // los oyentes, una sola vez
  recolocarPuesto = true;
  for(const ev of ["resize","orientationchange","fullscreenchange",
                   "webkitfullscreenchange","pageshow"])
    window.addEventListener(ev, () => { rehacer(); setTimeout(rehacer, 260); });
  const vv = globalThis.visualViewport;
  if(vv){ vv.addEventListener("resize", rehacer); vv.addEventListener("scroll", rehacer); }
}

/* ══ LA MANO RECOGIDA, ESTILO HEARTHSTONE (SOLO CON EL DEDO) ══
   En el móvil la mano ocupaba tanto que tapaba tu propia fila de mágicas
   y trampas. E: "quiero algo estilo hearthstone en móvil, que la mano se
   hace pequeña, y cuando la tocas con el dedo, se hace grande y puedes
   jugar las cartas cómodamente. Esto que solo aplique a móvil".

   Recogida asoma lo justo para ver que hay cartas; el primer toque la
   abre —NO juega—, y a partir de ahí se juega normal. Se cierra al
   tocar el tablero, al jugar algo y al cambiar de turno. En escritorio
   `esTactil()` es falso y no cambia absolutamente nada. */
export function esTactil(){
  try{ return !!globalThis.matchMedia?.("(pointer:coarse)")?.matches; }
  catch(e){ return false; }
}
export function abrirMano(v){
  if(!esTactil()) return;
  const b = document.body;
  if(!b?.classList?.contains) return;          // DOM simulado: no hay clases
  const antes = b.classList.contains("manoAbierta");
  const quiero = v === undefined ? !antes : !!v;
  if(antes === quiero) return;
  b.classList.toggle("manoAbierta", quiero);
  layoutAll();
}
/* ══ LA MANO YA NO SE PLIEGA ══
   Se plegaba porque tapaba tus mágicas y trampas. Eso se arregló por
   geometría —la carta va entera por debajo del tablero— así que el
   gesto sobra: E lo pidió explícitamente ("prefiero mano siempre
   visible"). Se deja la función devolviendo SIEMPRE abierta en vez de
   borrarla, porque hay tres sitios que preguntan y un `undefined` ahí
   significaría "recogida" y volvería a tragarse el primer toque. */
export function manoEstaAbierta(){ return true; }

function colocarFases(){
  const c=$("#fasesCentro"), st=document.getElementById("stage"),
        dv=grid?.querySelector(".divider");
  apartarDelHistorial();
  if(!c||!st||!dv) return;
  const r=dv.getBoundingClientRect(), rs=st.getBoundingClientRect();
  c.style.top = (r.top - rs.top + r.height/2 - c.offsetHeight/2) + "px";
}

/* ══════════════════════════════════════════════════════════════════
   LA TIRA DE FASES Y EL HISTORIAL COMPARTEN EL BORDE IZQUIERDO

   Al mudar las fases a la izquierda —a la derecha se peleaban con el
   panel de decisiones— se metieron en el mismo carril que el historial
   de jugadas, que vive abajo a la izquierda. En el Android de E se
   solapan; en pantallas más altas no, porque la tira va centrada a
   media altura y ahí sobra sitio.

   Un número fijo en el CSS no vale, y esto ya ha mordido dos veces en
   este proyecto: el alto del historial depende de cuántas cartas lleve
   y el de la tira de cuántas fases quepan, así que cualquier margen que
   escriba a mano acierta en un teléfono y falla en el siguiente. Se
   miden los dos rectángulos y la tira se aparta lo justo — y solo
   cuando de verdad se pisan.
   ══════════════════════════════════════════════════════════════════ */
function apartarDelHistorial(){
  const f = document.getElementById("phases");
  const h = document.getElementById("historial");
  if(!f?.getBoundingClientRect || !h?.getBoundingClientRect) return;
  /* Se suelta lo puesto antes o cada llamada la empuja otro poco. */
  f.style.marginLeft = "";
  if(!esTactil()) return;              // en escritorio no comparten borde
  const a = f.getBoundingClientRect(), b = h.getBoundingClientRect();
  if(!a.width || !b.width) return;
  /* ¿Se pisan de verdad? Con `Math.max/min` a propósito: una comparación
     suelta dentro del HTML se confunde con texto entre etiquetas y el
     cazador de traducciones la marcaba como español sin traducir. */
  const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const alto  = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if(!(ancho > 0 && alto > 0)) return;
  f.style.marginLeft = Math.ceil(b.right - a.left + 6) + "px";
}
if(typeof globalThis !== "undefined") globalThis.__APARTAR_FASES__ = apartarDelHistorial;
/* ══════════════════════════════════════════════════════════════════
   LA COMPROBACIÓN QUE NO SE PUEDE FALSEAR

   Tres iteraciones "arreglando" que la mano tapaba el campo, y las tres
   veces medí la INTENCIÓN (el número del CSS) en vez de la realidad. La
   última incluso tenía el signo cambiado y el test daba verde con la
   mano dentro del tablero.

   Esto pregunta al navegador dónde están las cosas de verdad. Devuelve
   los rectángulos y el solape en píxeles; lo usa `check-tablero.mjs` y
   se puede llamar a mano desde la consola del juego.
   ══════════════════════════════════════════════════════════════════ */
export function medirTablero(){
  const grid = document.getElementById("grid");
  if(!grid?.getBoundingClientRect) return null;
  const tablero = grid.getBoundingClientRect();
  /* Solo TU mano: la del rival sí puede solaparse con su propio campo. */
  const mias = [...document.querySelectorAll(".card.in-hand")]
    .filter(el => !el.classList.contains("mano-rival"))
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  const controles = document.getElementById("controles")?.getBoundingClientRect?.() ?? null;
  const fases     = document.getElementById("phases")?.getBoundingClientRect?.() ?? null;
  if(!mias.length) return { tablero, mano:null, cartas:0, solape:0, solapeControles:0 };
  const mano = {
    top:    Math.min(...mias.map(r => r.top)),
    bottom: Math.max(...mias.map(r => r.bottom)),
    left:   Math.min(...mias.map(r => r.left)),
    right:  Math.max(...mias.map(r => r.right)),
  };
  /* Cuánto se mete la mano DENTRO del tablero, en píxeles. Cero o menos
     es lo correcto; el número negativo es la separación que hay. */
  const solape = tablero.bottom - mano.top;
  /* Y lo mismo con los botones de fase y de fin de turno: si la mano los
     tapa, en un móvil te quedas sin poder pasar de fase. */
  const chocaCon = r => {
    if(!r) return 0;
    /* Escrito con `Math.max/min` en vez de con comparaciones sueltas a
       propósito: `a > b && c < d` dentro del HTML se parece a un texto
       entre etiquetas y el cazador de traducciones sin hacer lo
       confundía con una cadena en español sin traducir. */
    const ancho = Math.min(mano.right, r.right) - Math.max(mano.left, r.left);
    const alto  = Math.min(mano.bottom, r.bottom) - Math.max(mano.top, r.top);
    return (ancho > 0 && alto > 0) ? ancho : 0;
  };
  /* ══ EL AIRE DE ARRIBA Y LO QUE SE SALE POR ABAJO ══
     Los dos números que faltaban, y que son justo lo que reportó E con
     una captura: una franja muerta entre la barra de arriba y lo primero
     que se dibuja, mientras SU MANO se salía por el borde de abajo. Sin
     medirlos, "sube el tablero unos píxeles" es a ojo.

       · `aire`     — hueco entre el pie de la barra y lo más alto que se
                      pinta (la mano del rival, o el tablero si no hay).
       · `desborde` — cuánto de tu mano queda por debajo del borde de la
                      ventana. Positivo = cartas cortadas. */
  const rivales = [...document.querySelectorAll(".card.mano-rival")]
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  const arriba = Math.min(tablero.top,
    ...(rivales.length ? rivales.map(r => r.top) : [tablero.top]));
  const barra = document.getElementById("topbar")?.getBoundingClientRect?.();
  const alto  = globalThis.innerHeight
             || document.documentElement?.clientHeight || 0;
  return { tablero, mano, cartas:mias.length, solape,
           aire: arriba - (barra?.bottom ?? 0),
           desborde: mano.bottom - alto,
           solapeControles: Math.max(chocaCon(controles), chocaCon(fases)) };
}
if(typeof globalThis !== "undefined") globalThis.__MEDIR_TABLERO__ = medirTablero;
/* ══════════════════════════════════════════════════════════════════
   LA PANTALLA FINAL TIENE QUE MORIR ANTES DEL DUELO SIGUIENTE

   El bug más caro de todos los reportados, porque no se veía como un
   bug: al empezar un duelo nuevo, la pantalla de victoria del ANTERIOR
   seguía en pantalla durante la carga, con sus botones vivos. Y su
   `onNuevo` es el que resuelve el nodo y cobra la recompensa. Pulsar
   «Continuar» en esa franja de un segundo daba por ganado el duelo que
   acababa de empezar: te lo saltabas y te llevabas la carta y la ficha
   sin jugar. Lo reportó E.

   `boot()` limpiaba la cadena, el temporizador y el log del duelo
   anterior, pero nunca esto. No basta con esconderla: se vacía, para
   que no quede ni un manejador colgado apuntando al duelo de antes.
   ══════════════════════════════════════════════════════════════════ */
export function cerrarFinal(){
  generacionFinal++;           // deja mudos los botones del duelo anterior
  const c = document.getElementById("fin");
  if(c){
    c.classList.remove("visible");
    c.style.display = "none";
    c.innerHTML = "";            // y sin manejadores del duelo anterior
  }
  /* Y el rincón de controles, por si quedó el «Continuar» que se pone
     al mirar el tablero. */
  setControles(null);
}

/* Gancho de prueba para la pantalla final. Sin él no hay forma de PULSAR
   sus botones desde una comprobación, y el bug de «Ver el tablero» —que
   escondía la única salida— era justo de los que solo se ven pulsando.
   Mismo patrón que `__REINO_PRUEBA__` y `__PREGUNTA_DE_PRUEBA__`. */
if(typeof globalThis !== "undefined") globalThis.__FINAL_DE_PRUEBA__ = pantallaFinal;
/* Y el cierre, que es lo que llama `boot()` al empezar el duelo siguiente. */
if(typeof globalThis !== "undefined")
  /* Ganchos de prueba: `cerrarFinal` para la pantalla final y el clic de
     tablero para poder DECLARAR UN ATAQUE desde una comprobación (atacar
     es clicar un monstruo, no pulsar un botón, y sin esto no había forma
     de provocar la ventana de cadena del bot). */
  globalThis.__VIEW_DE_PRUEBA__ = { get cerrarFinal(){ return cerrarFinal; },
                                    clic: uid => clickHandler?.({ uid }),
                                    /* Para comprobar que la marca de «te están
                                       señalando esta carta» llega al elemento. */
                                    marcar: uids => marcarObjetivos(uids),
                                    claseDe: uid => els.get(uid)?.className ?? null,
                                    /* Lo que la PÁGINA sabe de una carta: si una
                                       tapada del rival lleva aquí su código, se ve. */
                                    codigoEnPagina: uid => els.has(uid) ? (els.get(uid).dataset?.code ?? "") : null,
                                    frenteEnPagina: uid => els.get(uid)?.querySelector?.(".face.front")?.innerHTML ?? null };

/* ══════════════════════════════════════════════════════════════════
   QUÉ ESTÁ ENGANCHADO A QUÉ

   Snatch Steal, Premature Burial, Spellbinding Circle, un equipo… todas
   apuntan a un monstruo concreto y en la pantalla no se veía: había una
   trampa boca arriba en tu backrow y un monstruo en el campo, y nada
   decía que fueran la misma jugada. El adaptador ya sabía el destino
   (`equipadoA`, desde el mensaje EQUIP) pero nadie lo dibujaba.

   Se pinta una línea fina entre las dos, y al pasar por encima de
   cualquiera de las dos, las dos se encienden. Se redibuja con el resto
   del tablero, así que sigue el movimiento de las cartas sin lógica
   aparte.
   ══════════════════════════════════════════════════════════════════ */
function dibujarUniones(){
  let svg = $("#uniones");
  if(!svg){
    try{
      svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("id","uniones");
      $("#plane")?.appendChild(svg);
    }catch(e){ return; }
  }
  if(!svg?.setAttribute) return;
  const pl = $("#plane");
  const caja = pl?.getBoundingClientRect?.();
  if(!caja || !caja.width) return;
  svg.setAttribute("viewBox", `0 0 ${caja.width} ${caja.height}`);
  let d = "";
  /* La marca de "estoy unida a" se BORRA antes de repintar: se ponía y
     no se quitaba nunca, así que una carta ya desequipada seguía
     resaltando a su antigua pareja al pasar el ratón. */
  for(const [,el] of els) if(el?.dataset){ delete el.dataset.unida; delete el.dataset.atado; }
  for(const [uid, el] of els){
    const c = DUEL?.cards?.get?.(uid);
    /* Dos fuentes para lo mismo: `equipadoA` lo pone el mensaje EQUIP
       —equipos de verdad— y `vinculadoA` sale de preguntarle al motor a
       quién apunta cada carta del backrow. La segunda es la que cubre
       Spellbinding Circle y compañía, que NO mandan EQUIP: apuntan y se
       quedan. Ver `refrescarVinculos` en duel.mjs. */
    const atado = c?.equipadoA ?? c?.vinculadoA ?? null;
    if(atado == null) continue;
    /* Y las DOS tienen que estar en el campo. El espejo ya suelta la
       unión al salir (ver el MOVE de duel.mjs), pero esto es la red: una
       carta del cementerio también tiene su elemento y su rectángulo, y
       una línea mal dibujada sale desde la pila hasta el monstruo, que
       es justo lo que reportó E. */
    const otroC = DUEL?.cards?.get?.(atado);
    const enMesa = x => (x?.location & 12) !== 0;      // MZONE|SZONE
    if(!enMesa(c) || !enMesa(otroC)) continue;
    const otro = els.get(atado);
    if(!otro?.getBoundingClientRect) continue;
    const a = el.getBoundingClientRect(), b = otro.getBoundingClientRect();
    if(!a.width || !b.width) continue;
    const x1 = a.left - caja.left + a.width/2, y1 = a.top - caja.top + a.height/2;
    const x2 = b.left - caja.left + b.width/2, y2 = b.top - caja.top + b.height/2;
    d += `M${x1} ${y1} L${x2} ${y2} `;
    /* Y la marca en las dos cartas, para el resaltado al pasar el ratón. */
    el.dataset.unida = String(atado);
    otro.dataset.unida = String(uid);
    /* Y una marca en la carta, no solo la línea: el hilo dorado es fino
       y sobre el arte de una carta se pierde. E lo reportó como "no
       tienen indicador visual NINGUNO", y la línea estaba ahí — así que
       si no se ve, no cuenta. */
    el.dataset.atado = "1"; otro.dataset.atado = "1";
  }
  svg.innerHTML = d ? `<path d="${d}" class="union"/>` : "";
}

/* ══════════════════════════════════════════════════════════════════
   EL PANEL DE DECISIONES NO PUEDE TAPAR LOS PUNTOS DE VIDA

   Lo reportó E dos veces, con captura: el marcador del rival vive
   arriba a la derecha y el panel de «Main Phase · Show all actions»
   —y el de «Respond?»— le caía justo encima.

   Ya lo intenté con un `top` fijo en el CSS del móvil y se quedó corto:
   el alto del marcador depende de la cara, del nombre del duelista y de
   qué bloque de estilos gane en ese aparato concreto, así que cualquier
   número que ponga a mano es una apuesta. Aquí se MIDE. Si los dos
   rectángulos se pisan, el panel baja lo justo para quedar por debajo.

   Se llama cada vez que el panel se enseña, porque el nombre del rival
   —y con él, su alto— cambia de un duelo a otro.
   ══════════════════════════════════════════════════════════════════ */
export function apartarPanel(){
  const p = document.getElementById("prompt");
  const lp = document.getElementById("lpOpp");
  if(!p?.getBoundingClientRect || !lp?.getBoundingClientRect) return;
  /* Se suelta lo puesto antes: si no, cada llamada lo baja otro poco. */
  p.style.marginTop = "";
  const a = p.getBoundingClientRect(), b = lp.getBoundingClientRect();
  if(!a.width || !b.width) return;
  /* ¿Comparten franja horizontal? Con `Math.max/min` a propósito: una
     comparación suelta dentro del HTML se confunde con texto entre
     etiquetas y el cazador de traducciones la marcaba como español. */
  const cruce = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  if(cruce <= 0) return;
  const invade = b.bottom - a.top;
  if(invade > 0) p.style.marginTop = Math.ceil(invade + 6) + "px";
}
if(typeof globalThis !== "undefined") globalThis.__APARTAR_PANEL__ = apartarPanel;

export function fitBoard(){
  const st=document.getElementById("stage"), pl=document.getElementById("plane");
  if(!st||!pl||!grid) return;
  /* `clientWidth` INCLUYE el padding, y el escenario reserva a la derecha
     el carril del panel de decisiones. Sin descontarlo, el tablero se
     escalaba como si tuviera todo el ancho y se metía debajo del panel —
     que es justo lo que se reportó: el panel tapando el cementerio y las
     dos casillas de monstruo de la derecha. */
  const estilo = getComputedStyle(st);
  const carril = parseFloat(estilo.paddingRight) || 0;
  /* Y abajo, el recorte del sistema: en el iPhone la barra de inicio se
     comía justo la franja donde cuelga tu mano. */
  const abajo  = parseFloat(estilo.paddingBottom) || 0;
  const availW=st.clientWidth-24-carril, availH=st.clientHeight-16-abajo;
  const w=grid.offsetWidth, h=grid.offsetHeight;
  if(!w||!h) return;
  /* Debajo del tablero cuelga la mano. Reservar "un 20% más" era un número
     inventado que en el móvil se quedaba corto y las cartas se salían por
     abajo: ahora se reserva EXACTAMENTE lo que asoma, que es alto de carta
     por el trozo visible. */
  const CW = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue("--cw")) || 116;
  const esc = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue("--mano-mia")) || 1;
  /* ══ SE RESERVA LA MANO ENTERA, MÁS EL HUECO ══
     Antes se reservaba solo "lo que asoma", y como la mano en realidad
     estaba DENTRO del tablero, el número no tenía nada que ver con la
     realidad. Ahora la mano va entera por debajo, así que hay que
     reservar su alto completo (alto de carta × escala) más la
     separación. Es el MISMO cálculo que usa `layoutAll` para colocarla:
     tenerlos separados es lo que hacía que discreparan. */
  const hueco = parseFloat(getComputedStyle(document.documentElement)
                  .getPropertyValue("--hueco-mano")) || 0;
  const cuelga = CW*1.46*esc + hueco;
  /* Y por arriba asoma la mano del rival, que se dibuja en `y` negativa
     y por tanto FUERA de la caja del tablero. Es poco —un 11% de carta
     más el arco de las de los extremos— pero si no se reserva, al
     subirlo todo se corta. */
  const escR = parseFloat(getComputedStyle(document.documentElement)
                 .getPropertyValue("--mano-rival")) || 1;
  const asomaRival = CW*1.46*(0.06 + 0.10*escR) + 16;
  /* ══ EN UNA PANTALLA GRANDE, EL TABLERO CRECE Y SE CENTRA ══
     Reddit, 05-10: «if we center the playground, it's on the top of the
     screen». La escala tenía techo en 1: en un monitor de 1080 o más el
     tablero se quedaba a tamaño de portátil pegado arriba, con media
     pantalla vacía debajo. Ahora puede crecer (hasta ×1,6) y lo que sobre
     de alto se reparte arriba y abajo. */
  const ESCALA_MAX = 1.6;
  const k=Math.min(ESCALA_MAX, availW/w, availH/(h + cuelga + asomaRival));
  const sobra = Math.max(0, availH - (h + cuelga + asomaRival)*k);

  /* ══ LA BANDA MUERTA DE ARRIBA ══
     `scale()` escala desde el CENTRO del elemento (`transform-origin`
     por defecto), y la caja de `#plane` es solo el tablero: la mano se
     dibuja con transformaciones y no cuenta para el tamaño. Así que al
     encoger a `k`, el borde de arriba del tablero BAJA `(1-k)·alto/2`
     píxeles y deja una franja vacía entre la barra y el tablero —
     mientras la mano, que va por debajo, se sale por el borde de abajo.
     Es exactamente la captura que mandó E: hueco arriba, cartas
     cortadas abajo.

     Se compensa con un `translateY` en el espacio SIN escalar (va antes
     del `scale`, así que no lo afecta), dejando solo el hueco que
     necesita la mano del rival. No se toca `transform-origin` a
     propósito: eso movería también el eje del giro 3D y cambiaría la
     perspectiva del tablero. */
  const subir = (1 - k) * h / 2 - asomaRival * k - sobra / 2;
  pl.style.transform =
    `translateY(${(-subir).toFixed(1)}px) scale(${k.toFixed(3)}) rotateX(var(--tilt))`;
  requestAnimationFrame(colocarFases);
}
let cuantasEnMano = -1;
export function layoutAll(instant){
  const seen=new Set();
  /* Jugar una carta recoge la mano: si no, te quedabas con media
     pantalla de cartas tapando el tablero justo cuando quieres verlo.
     Se detecta por la cuenta, que es lo único que no depende de por qué
     salió la carta (jugada, descartada, robada por el rival…). */
  {
    const n = (DUEL?.zones?.[ME]?.[L.HAND] ?? []).filter(Boolean).length;
    if(cuantasEnMano >= 0 && n < cuantasEnMano) document.body.classList.remove("manoAbierta");
    cuantasEnMano = n;
  }
  /* Medidas y escalas, una sola vez por repintado. Las escalas de mano
     salen del CSS para que el móvil pueda agrandar TU mano y encoger la
     del rival sin tocar el código. */
  const raiz = getComputedStyle(document.documentElement);
  const CW = parseFloat(raiz.getPropertyValue("--cw")) || 116;
  const ESC_MIA   = parseFloat(raiz.getPropertyValue("--mano-mia"))   || 1;
  const ESC_RIVAL = parseFloat(raiz.getPropertyValue("--mano-rival")) || 1;
  for(const p of [0,1]) for(const loc of [L.DECK,L.HAND,L.GRAVE,L.REMOVED,L.EXTRA,L.MZONE,L.SZONE,L.FZONE]){
    let arr=DUEL.zones[p][loc]; if(!arr) continue;
    if(loc===L.HAND && p===ME) arr = manoOrdenada(arr.filter(Boolean));
    arr.forEach((card,idx)=>{
      if(!card) return; seen.add(card.uid);
      const el=elFor(card);
      marcarStats(el, card, loc);
      if(el.style.display==="none") el.style.display="";
      el.classList.remove("apilada");
      el.style.transition = instant ? "none" : "transform .48s var(--ease), opacity .3s";
      const mine = card.controller===ME;
      let x=0,y=0,rz=0,rx=0,tz=0,sc=1,z=10;
      const enPrevia = !!(previa && previa.uid===card.uid && loc===L.HAND);
      const revelada = revelados.has(card.uid);
      if(revelada && loc===L.HAND && !mine){
        // en fila, en el centro del tablero y a tamaño legible
        const grupo = arr.filter(c=>c && revelados.has(c.uid));
        const k = grupo.indexOf(card), n2 = Math.max(1, grupo.length);
        const paso = Math.min(CW*1.06, (grid.offsetWidth-CW)/n2);
        x = grid.offsetWidth/2 - CW/2 + (k-(n2-1)/2)*paso;
        y = grid.offsetHeight*0.16;
        tz = 220; z = 400 + k; sc = 1.06;
      } else if(enPrevia){
        const p2=zonePos(previa.owner, previa.zone, previa.slot);
        x=p2.x; y=p2.y; tz=26; z=210;
      } else if(loc===L.HAND){
        /* La mano cuelga POR DEBAJO del tablero, no encima. Antes se
           dibujaba dentro del campo y con seis cartas tapaba la fila de
           M/T y media de monstruos: no se veía lo que ibas a jugar.
           Al pasar el ratón (o el dedo) la carta se levanta y se lee
           entera, así que basta con asomar dos tercios. */
        const CH = CW*1.46;
        sc = mine ? ESC_MIA : ESC_RIVAL;
        const n=arr.length, off=idx-(n-1)/2;
        /* ══ LA MANO DEL RIVAL: UN ABANICO, NO UNA TORRE ══
           La versión anterior las apilaba casi encima unas de otras y
           quedaba un montón vertical raro. E lo pidió claro: una hilera
           horizontal pequeña, como la tuya pero en miniatura. 0.42 de
           separación las deja solapadas pero en FILA, que es lo que se
           lee como "cinco cartas". */
        /* 0.42 las dejaba tan solapadas que parecían un montón de tres:
           E pidió verlas separadas. 0.62 sigue siendo bastante menos que
           tu 0.80 —su mano no puede competir con la tuya en peso
           visual— pero ya se cuentan de un vistazo. */
        const abanico = mine ? 0.80 : 0.62;
        const spread=Math.min(CW*abanico*sc, (grid.offsetWidth*(mine?0.62:0.52))/Math.max(n,1));
        x = grid.offsetWidth/2 - CW/2 + off*spread;
        const arc=off*off*2.2;
        /* Tu mano se dibuja más grande y asomando más; la del rival, más
           pequeña y apenas asomando: es información que no puedes usar.
           CUÁNTO SE SEPARA sale del CSS (`--hueco-mano`) para que el móvil
           pueda tener la mano recogida y abrirla al tocarla, estilo
           Hearthstone: con seis cartas asomando tapaba tu propia fila de
           mágicas y trampas, que es justo lo que reportó E. */
        /* ══ EL SIGNO ESTABA AL REVÉS, Y POR ESO SEGUÍA TAPANDO ══
           `y` es el BORDE SUPERIOR de la carta, así que
           `y = gridH - CH*asoma` con asoma=1 no dejaba la carta debajo
           del tablero: la dejaba ENTERA DENTRO, justo encima de la fila
           de mágicas y trampas. Llevo dos iteraciones "arreglándolo" en
           la dirección contraria.

           Ahora se calcula lo único que importa: que el borde de arriba
           de la carta quede POR DEBAJO del borde de abajo del tablero,
           más un hueco visible. Y como `scale()` escala desde el CENTRO
           (transform-origin por defecto), hay que compensar la mitad de
           lo que crece o encoge, o con `sc` distinto de 1 el número
           miente. */
        const hueco = parseFloat(raiz.getPropertyValue("--hueco-mano")) || 0;
        /* La mano del rival asomaba casi media carta POR ENCIMA de su
           campo y en horizontal ahí sobraba sitio: es información que no
           puedes usar, así que se recorta y el tablero gana alto. */
        /* ══ LA MANO DEL RIVAL, UN MONTONCITO ══
           Asomaba media carta por encima de su propio campo y era la
           franja de espacio desperdiciado que E marcó en amarillo. No
           puedes leer esas cartas: sobra con ver que están. Ese alto se
           lo queda el tablero. */
        y = mine ? grid.offsetHeight + hueco + CH*(sc-1)/2 + arc
                 : -CH*(0.06+0.10*sc) - arc;
        rz = (mine?1:-1)*off*2.6; rx=-TILT; tz=mine?90:110; z=50+idx;
      } else if(loc===L.DECK||loc===L.GRAVE||loc===L.EXTRA||loc===L.REMOVED){
        /* Solo se dibujan las cartas de arriba del montón. Antes se
           pintaban las 40 y sus sombras se sumaban hasta formar una
           mancha negra (y costaba rendimiento para nada). */
        const desdeArriba = arr.length-1-idx;
        el.style.display = desdeArriba > 3 ? "none" : "";
        if(desdeArriba > 3) return;
        el.classList.toggle("apilada", desdeArriba > 0);
        const p2=zonePos(card.controller, ZKEY[loc], 0);
        const k = Math.min(desdeArriba, 3);
        x=p2.x - k*1.6; y=p2.y - k*2.2; tz=-k*0.5; z=10-k;
        if(!mine && GIRAR_RIVAL && (loc===L.GRAVE || loc===L.REMOVED)) rz = 180;
      } else {
        const [zk, zi] = casillaDe(loc, idx);
        const p2=zonePos(card.controller, zk, zi);
        x=p2.x; y=p2.y;
        // girar 90° solo monstruos en defensa; una M/T colocada llega con el
        // bit de defensa puesto y se veía tumbada sin motivo
        if(loc===L.MZONE && isDef(card.position)) rz=90;
        /* ══ LAS CARTAS DEL RIVAL, DEL REVÉS ══
           Reddit, 05-10: «every other simulator does it, so it is kinda
           jarring to have every card right side up facing you». Si se
           pide en Opciones, lo del rival en su campo se gira media vuelta. */
        if(!mine && GIRAR_RIVAL && (loc===L.MZONE || loc===L.SZONE || loc===L.FZONE)) rz += 180;
        if(card.lift){ tz=40; }
      }
      el.style.setProperty?.("--contragiro", (-rz) + "deg");
      el.style.zIndex=z;
      el.style.transform=`translate3d(${x}px,${y}px,${tz}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${sc})`;
      /* La visibilidad depende de la ZONA, no de los bits de posición.
         El core marca como "boca abajo" todo lo que está en una mano, así
         que una carta devuelta desde el cementerio (Magician of Faith)
         llegaba con posición 10 y se pintaba del revés en tu propia mano. */
      const hidden = loc===L.HAND ? !mine
                   : (loc===L.DECK || loc===L.EXTRA) ? true
                   : isFD(card.position);
      /* Las cartas de un montón no capturan el ratón: así el hover y el clic
         llegan a la casilla, que es quien enseña el contador y abre el visor.
         Con la del rival encima, el contador de su mazo no salía nunca. */
      el.classList.toggle("enMonton",
        loc===L.DECK||loc===L.GRAVE||loc===L.EXTRA||loc===L.REMOVED);
      el.classList.toggle("facedown", (enPrevia || revelada) ? false : hidden);
      el.classList.toggle("colocando", enPrevia);
      el.classList.toggle("revelada", revelada);
      el.classList.toggle("in-hand", loc===L.HAND && mine && !enPrevia);
      el.classList.toggle("mano-rival", loc===L.HAND && !mine && !revelada);
      el.classList.toggle("mine", mine);
    });
  }
  for(const [uid,el] of els) if(!seen.has(uid)){ el.remove(); els.delete(uid); }
  refreshLabels();

  /* Las uniones (equipos, Snatch Steal, Spellbinding Circle) se redibujan
     con el tablero: así siguen a las cartas sin lógica aparte. */
  requestAnimationFrame(dibujarUniones);
}
/* Con las reglas de 2005 el Field Spell no está en FZONE: el motor lo pone
   en el puesto 5 de la zona de magias y trampas. Sin esta traducción se
   pintaba en la esquina superior izquierda del tablero, fuera de sitio, y
   la casilla "Campo" no se ocupaba nunca. */
function casillaDe(loc, idx){
  if(loc===L.SZONE && idx===5) return ["field", 0];
  return [ZKEY[loc], idx];
}
function zonePos(owner, zone, i){
  const z=zoneEls[`${owner}:${zone}:${i}`];
  return z ? {x:z.offsetLeft, y:z.offsetTop} : {x:0,y:0};
}
const LOCNUM={deck:1, gy:16, extra:64, banish:32};
function pintarContadores(){
  for(const k in zoneEls){
    const [p,z] = k.split(":");
    const loc = LOCNUM[z]; if(loc===undefined) continue;
    const n=(DUEL.zones[p]?.[loc] ?? []).length;
    zoneEls[k].dataset.n = n;
    zoneEls[k].classList.toggle("conCartas", n>0);
  }
}
function refreshLabels(){
  const occ=new Set();
  for(const p of [0,1]) for(const loc of [L.MZONE,L.SZONE,L.FZONE,L.DECK,L.GRAVE,L.EXTRA]){
    const a=DUEL.zones[p][loc]; if(!a) continue;
    const slotted = loc===L.MZONE||loc===L.SZONE||loc===L.FZONE;
    a.forEach((c,i)=>{
      if(!c) return;
      const [zk, zi] = casillaDe(loc, i);
      occ.add(`${p}:${zk}:${slotted?zi:0}`);
    });
  }
  for(const k in zoneEls) zoneEls[k].classList.toggle("empty-label", !occ.has(k));
  pintarContadores();
}

/* ── historial visual ──
   Miniaturas de lo que se ha jugado, en orden. El log descargable es para
   depurar; esto es para enterarte de qué pasó mientras mirabas otra cosa. */
const HISTORIAL_MAX = 24;
export function alHistorial(code, mia, tipo){
  const z = document.getElementById("historial");
  if(!z || !code) return;
  const d = document.createElement("div");
  d.className = "hcarta " + (mia ? "mia" : "suya");
  d.dataset.tipo = tipo ?? "";
  d.title = `${nameOf(code)} — ${T(mia?"tú":"rival")}`;
  d.innerHTML = useImages
    ? `<img src="${IMG_BASE}${artCode(code)}.jpg" loading="lazy" alt="">`
    : `<span class="hnom">${nameOf(code)}</span>`;
  d.onmouseenter = ()=>showDetail(code);
  d.onclick = ()=>showDetail(code);
  z.appendChild(d);
  while(z.children.length > HISTORIAL_MAX) z.removeChild(z.firstChild);
  z.scrollTop = z.scrollHeight; z.scrollLeft = z.scrollWidth;
}

/* ── LUPA: la carta a tamaño grande, con su texto ──
   En el móvil no hay ratón, así que el panelito de la izquierda no se
   puede "consultar": hay que poder tocar una carta y leerla. Se abre con
   pulsación larga sobre cualquier carta visible, y con un toque en el
   panel de detalle. Reportado en Reddit el primer día: "I cant read the
   cards". */
/* Y por si el navegador saca su menú igual (Android lo hace con
   `contextmenu`): sobre una carta, no. */
try{
  document.addEventListener("contextmenu", e => {
    const t = e.target;
    if(t?.closest?.(".card, #detail, #lupa, #zoneview, #historial")) e.preventDefault();
  });
}catch(e){}
let ultimaCarta = null;
export function verCarta(code){
  const d = DB.get(code); if(!d) return;
  const cap = document.getElementById("lupa"); if(!cap) return;
  const mon = !!(d.type & T_MONSTER);
  const attr = T(mon ? (ATTRCOL[d.attribute]?.[2] ?? "")
                     : (d.type & T_SPELL ? "Carta Mágica" : "Carta de Trampa"));
  const img = useImages
    ? `<img class="luImg" src="${IMG_BASE}${artCode(code)}.jpg" alt="">` : "";
  cap.innerHTML = `<div class="luCaja">
      ${img}
      <div class="luTxt">
        <h3>${nameOf(code)}</h3>
        <div class="luMeta">${mon ? `${attr} · ${T("Nivel "+d.level)}` : attr}</div>
        ${mon?`<div class="luStats"><span>ATK ${d.attack}</span><span>DEF ${d.defense}</span></div>`:""}
        <div class="luCuerpo">${textOf(code).replace(/\r?\n/g,"<br>")}</div>
      </div>
      <button class="luCerrar">${T("Cerrar")}</button>
    </div>`;
  cap.style.display = "flex";
  const cerrar = ()=>{ cap.style.display="none"; };
  cap.onclick = cerrar;
  const bt = cap.querySelector(".luCerrar"); if(bt) bt.onclick = cerrar;
  const caja = cap.querySelector(".luCaja"); if(caja) caja.onclick = e => e.stopPropagation?.();
}
export function verUltimaCarta(){ if(ultimaCarta) verCarta(ultimaCarta); }

/* ── panel de detalle (izquierda) ── */
/* ══════════════════════════════════════════════════════════════════
   EL INSPECTOR DE CARTA EN ESCRITORIO

   Tres cosas que E pidió y que son el mismo problema: el panel cambiaba
   de carta con CADA movimiento del ratón. Al mover el cursor por encima
   del tablero, o al hacer scroll con el ratón sobre las cartas, el
   contenido parpadeaba y era imposible leer nada.

     · CLIC = FIJAR. Una carta fijada se queda hasta que la sueltas.
       Mientras hay una fijada, pasar el ratón no cambia nada.
     · HOVER CON RETARDO. Sin fijar, el panel espera 90 ms antes de
       cambiar: rozar una carta de camino a otra ya no la muestra.
     · ESCAPE Y CLIC FUERA sueltan la fijada.

   El retardo es corto a propósito: lo bastante para filtrar el roce, lo
   bastante poco para que pasar el ratón siga sintiéndose instantáneo.
   ══════════════════════════════════════════════════════════════════ */
let cartaFijada = null, temporizadorHover = null;
export function fijarCarta(code, uid = null){
  cartaFijada = code ?? null;
  if(temporizadorHover){ clearTimeout(temporizadorHover); temporizadorHover = null; }
  if(code != null) pintarDetalle(code, uid);
  const det = $("#detail");
  if(det?.classList) det.classList.toggle("fijada", cartaFijada != null);
}
export function soltarCarta(){ fijarCarta(null); }
export function hayCartaFijada(){ return cartaFijada != null; }
/* Lo que llaman los `pointerenter`: propone, no impone. */
export function proponerDetalle(code, uid = null){
  if(cartaFijada != null) return;              // hay una fijada: manda ella
  if(temporizadorHover) clearTimeout(temporizadorHover);
  temporizadorHover = setTimeout(() => {
    temporizadorHover = null;
    if(cartaFijada == null) pintarDetalle(code, uid);
  }, 90);
}
try{
  /* Clic fuera de una carta y del propio panel: se suelta. */
  document.addEventListener("pointerdown", e => {
    if(cartaFijada == null) return;
    const t = e.target;
    if(t?.closest?.(".card") || t?.closest?.("#detail") || t?.closest?.("#side")) return;
    soltarCarta();
  }, true);
}catch(e){}

export function showDetail(code){ pintarDetalle(code); }
function pintarDetalle(code, uid = null){
  const d=DB.get(code); if(!d) return;
  ultimaCarta = code;
  const mon=!!(d.type & T_MONSTER);
  /* ══ EL ATK/DEF DE VERDAD, TAMBIÉN EN EL PANEL ══
     Reddit, 05-10: «modified atk and def values are only visible on the
     playing field». Si la carta está boca arriba en el campo y el motor
     dice otra cosa que la ficha (equipos, Thousand-Eyes, Snatch Steal…),
     el panel enseña lo que vale ahora, con lo impreso al lado. */
  const viva = uid != null ? DUEL?.cards?.get?.(uid) : null;
  const real = viva && viva.location === L.MZONE && !isFD(viva.position) && viva.atkReal != null
    && (viva.atkReal !== d.attack || viva.defReal !== d.defense) ? viva : null;
  const stat = (nombre, ahora, base) => ahora == null || ahora === base
    ? `<span>${nombre} ${base}</span>`
    : `<span class="${ahora > base ? "sube" : "baja"}">${nombre} ${ahora} <small>(${base})</small></span>`;
  const attr = T(mon ? (ATTRCOL[d.attribute]?.[2] ?? "") : (d.type & T_SPELL ? "Carta Mágica":"Carta de Trampa"));
  const img = useImages ? `<img class="dimg" src="${IMG_BASE}${artCode(code)}.jpg"
      onerror="this.style.display='none'">` : "";
  const det = $("#detail");
  /* ══ EL PANEL TIENE QUE INVITAR A PULSARLO ══
     E: «además del nombre y los puntos de ATK y DEF, añade un icono de
     lupa y un CTA que invite a pulsar para ver la info de la carta ahí,
     si no los jugadores van a confundirse». El panel ya se abría al
     hacer clic desde que se le quitó el `pointer-events:none` que
     mataba su propio `onclick`, pero nada en pantalla lo decía: la
     única pista era una línea de 7,5 px que solo sale en móvil. */
  det.innerHTML = `${img}
    <h3><span class="dlupa" aria-hidden="true">🔍</span>${nameOf(code)}</h3>
    <div class="dmeta">${mon ? `${attr} · ${T("Nivel "+d.level)}` : attr}</div>
    ${mon?`<div class="dstats">${stat("ATK", real?.atkReal, d.attack)}${stat("DEF", real?.defReal, d.defense)}</div>`:""}
    <div class="dcta"><span class="soloRaton">${T("Pulsa aquí para verla en grande")}</span
      ><span class="soloTacto">${T("Toca aquí para verla en grande")}</span></div>
    <div class="dtext">${textOf(code).replace(/\r?\n/g,"<br>")}</div>`;
  /* El aviso de "toca para leerla entera" solo se ve en móvil (lo enciende
     el CSS). Se escribe traducido AQUÍ porque va en un `data-*` y lo pinta
     `content:attr()`: eso no lo ve `traducirDOM`, es la misma trampa que
     se comió la etiqueta de DECLARACIÓN DE ATAQUE. */
  det.dataset.toque = T("Toca para leerla");
}
/* ── interacción ── */
let clickHandler=null, dropHandler=null, dragFilter=null, arrastrable=false;
export function setHandlers({ onClick, onDrop, canDrag, arrastre=false }={}){
  clickHandler=onClick??null; dropHandler=onDrop??null; dragFilter=canDrag??null;
  /* El arrastre solo se arma en Main Phase. Fuera de ahí, tocar una carta de
     la mano tiene que ser un clic limpio (elegir descarte, elegir objetivo):
     antes salía el fantasma de arrastre y confundía. */
  arrastrable=!!arrastre;
}
export function markTargets(uids){
  for(const [uid,el] of els) el.classList.toggle("targetable", uids.has(uid));
}
/* ── LA CARTA QUE SEÑALA UN EFECTO ──
   Lo pidió E: cuando la IA activa un Mystical Space Typhoon hay que ver
   A QUÉ apunta antes de decidir si respondes. El motor lo dice con
   BECOME_TARGET; aquí solo se pinta. Es una marca distinta de
   `targetable` (eso es "puedes elegirla"), porque significa lo contrario:
   "te la están señalando". */
export function marcarObjetivos(uids){
  for(const [uid,el] of els) el.classList.toggle("senalada", uids.has(uid));
}
export function markDraggable(uids){
  for(const [uid,el] of els) el.classList.toggle("playable", uids.has(uid));
}
/* Cartas ya en el campo cuyo efecto se puede activar ahora mismo.
   Se distingue de "jugable desde la mano" porque es lo que más se
   pasa por alto: los efectos de monstruo. */
export function markAtacadas(uids){
  for(const [uid,el] of els) el.classList.toggle("gastada", uids.has(uid));
}
export function markUsable(uids){
  for(const [uid,el] of els){
    const on = uids.has(uid);
    el.classList.toggle("usable", on);
    let insignia = el.querySelector(".fx");
    if(on && !insignia){
      insignia=document.createElement("div");
      insignia.className="fx"; insignia.textContent="✦";
      el.appendChild(insignia);
    } else if(!on && insignia) insignia.remove();
  }
}
/* ══ LO QUE NO SE PUEDE LEER ══
   Reddit, día 2: «I can see the opp hand cards if I click on them». El
   pasar el ratón ya tapaba la mano del rival, pero el CLIC (fijar en el
   panel) solo miraba si la carta estaba boca abajo: la mano del bot va
   boca arriba para el motor, así que un toque la enseñaba entera. Ahora
   los tres gestos (pasar, fijar y pulsación larga) preguntan aquí, y
   `check-frontera` vigila que no vuelva. Oculta = ni enseñada por un
   efecto ni mía, y además boca abajo, en la mano, en el mazo o en el
   Extra Deck: la misma regla que decide si se pinta la cara. */
function cartaOculta(card){ return !card || ocultaParaMi(card); }
function wire(el, card){
  el.addEventListener("pointerenter",()=>{
    if(cartaOculta(card)) return;
    proponerDetalle(card.code, card.uid);
  });
  /* CLIC = FIJAR. Va en `pointerup` para no pelearse con el arrastre:
     si has arrastrado, no era un clic. */
  el.addEventListener("pointerup", e => {
    if(cartaOculta(card)) return;
    if(arrastrando) return;
    /* Volver a pulsar la misma carta la suelta: es el gesto que espera
       cualquiera de un "pin". */
    if(cartaFijada === card.code) soltarCarta(); else fijarCarta(card.code, card.uid);
  });
  /* Pulsación larga = ver la carta grande. Es el gesto que espera
     cualquiera en un móvil, y en escritorio no molesta porque el ratón
     ya enseña el detalle al pasar por encima. */
  let temporizadorLupa = null, x0 = 0, y0 = 0;
  const cancelarLupa = ()=>{ if(temporizadorLupa){ clearTimeout(temporizadorLupa); temporizadorLupa=null; } };
  el.addEventListener("pointerdown",e=>{
    if(!cartaOculta(card)){
      x0 = e.clientX ?? 0; y0 = e.clientY ?? 0;
      cancelarLupa();
      /* Con el dedo la pulsación larga es LA forma de leer una carta, así
         que se acorta: 550 ms se sentían como que no respondía. */
      temporizadorLupa = setTimeout(()=>{
        temporizadorLupa = null;
        cancelarArrastre();          // la pulsación larga gana al arrastre
        verCarta(card.code);
      }, esTactil() ? 330 : 550);
    }
    /* Antes aquí se tragaba el primer toque para "abrir la mano". Con la
       mano siempre visible, ese toque es la jugada: tragárselo era pedir
       dos toques para arrastrar una carta. */
    if(arrastrable && card.location===L.HAND && card.controller===ME){
      e.preventDefault(); startDrag(card, e, !!dragFilter?.(card));
    }
  });
  el.addEventListener("pointermove",e=>{
    if(temporizadorLupa && (Math.abs((e.clientX??0)-x0) > 8 || Math.abs((e.clientY??0)-y0) > 8))
      cancelarLupa();
  });
  for(const ev of ["pointerup","pointercancel","pointerleave"])
    el.addEventListener(ev, cancelarLupa);
  el.addEventListener("click",e=>{
    e.stopPropagation();
    if(dragging) return;
    /* El toque que ABRIÓ la mano no vale también como jugada. */
    if(card.location===L.HAND && card.controller===ME && !manoEstaAbierta()) return;
    if([L.GRAVE,L.EXTRA,L.REMOVED].includes(card.location)){
      const z = card.location===L.GRAVE ? "gy" : card.location===L.EXTRA ? "extra" : "banish";
      zoneViewHandler?.(card.controller, z);
      return;
    }
    clickHandler?.(card);
  });
}
/* arrastre */
let dragging=null;
/* Suelta el arrastre a medias sin jugar nada: hace falta cuando la
   pulsación larga abre la lupa con el dedo ya apoyado en la carta. */
function cancelarArrastre(){
  /* La marca se limpia en el siguiente tick: el `pointerup` que suelta la
     carta llega DESPUÉS de esto, y si se borrara ya, ese mismo evento se
     leería como un clic y fijaría la carta sin querer. */
  setTimeout(()=>{ arrastrando = false; }, 0);
  if(!dragging) return;
  const g=ghost(); if(g) g.style.display="none";
  els.get(dragging.card.uid)?.classList.remove("dragging");
  document.querySelectorAll(".slot").forEach(s=>s.classList.remove("drop-ok","drop-hot"));
  dragging=null;
  window.removeEventListener("pointermove",onMove);
  window.removeEventListener("pointerup",onUp);
  layoutAll();
}
const ghost = () => $("#ghost");
/* Se marca mientras hay un arrastre en curso: un `pointerup` después de
   arrastrar NO es un clic, y sin esto fijar la carta se disparaba cada
   vez que soltabas una en el tablero. */
let arrastrando = false;
function startDrag(card, e, jugable=true){
  arrastrando = true;
  /* Si había otra carta posada esperando decisión, se cancela: el menú de
     antes ya no tiene sentido y dejarlo abierto jugaba la carta equivocada. */
  closeChoice(); quitarPrevia();
  dragging={card, moved:false, jugable};
  card.hover=false;
  const g=ghost();
  g.innerHTML=`<div class="card" style="position:static;width:100%;height:100%">
    <div class="inner"><div class="face front">${frontHTML(card.code)}</div></div></div>`;
  g.style.display="block"; moveGhost(e);
  els.get(card.uid).classList.add("dragging");
  if(jugable){
    const d=DB.get(card.code);
    const kind = (d.type & T_MONSTER) ? "m" : "st";
    for(let i=0;i<5;i++) zoneEls[`${ME}:${kind}:${i}`]?.classList.add("drop-ok");
    // un Field Spell también se puede soltar en la casilla de Campo
    if(d.type & T_FIELD) zoneEls[`${ME}:field:0`]?.classList.add("drop-ok");
  }
  window.addEventListener("pointermove",onMove);
  window.addEventListener("pointerup",onUp);
}
function moveGhost(e){ const g=ghost(); g.style.left=e.clientX+"px"; g.style.top=e.clientY+"px"; }
function onMove(e){
  if(!dragging) return; dragging.moved=true; moveGhost(e);
  document.querySelectorAll(".slot.drop-hot").forEach(s=>s.classList.remove("drop-hot"));
  const t=slotUnder(e); if(t?.classList.contains("drop-ok")) t.classList.add("drop-hot");
}
/* Zona de suelta generosa: en vez de exigir que el cursor caiga dentro del
   hueco, buscamos la zona válida cuyo centro esté más cerca, con margen. */
function slotUnder(e){
  let best=null, bestD=Infinity;
  for(const k in zoneEls){
    const z=zoneEls[k];
    if(!z.classList.contains("drop-ok")) continue;
    const r=z.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const d=Math.hypot(e.clientX-cx, e.clientY-cy);
    if(d<bestD){ bestD=d; best=z; }
  }
  // radio de tolerancia: ancho y medio de carta
  const lim=(best?best.getBoundingClientRect().width:110)*1.6;
  return bestD<=lim ? best : null;
}
function indiceEnMano(e){
  // ¿sobre qué hueco de la mano se ha soltado?
  const mias=[...els.entries()].filter(([uid,el])=>el.classList.contains("in-hand"))
    .map(([uid,el])=>({uid, x:el.getBoundingClientRect().left + el.offsetWidth/2}))
    .sort((a,b)=>a.x-b.x);
  if(!mias.length) return null;
  let i=0;
  while(i<mias.length && e.clientX > mias[i].x) i++;
  return { indice:i, alturaOk: e.clientY > (window.innerHeight||800)*0.62 };
}
function onUp(e){
  setTimeout(()=>{ arrastrando = false; }, 0);
  const d=dragging; if(!d) return;
  window.removeEventListener("pointermove",onMove);
  window.removeEventListener("pointerup",onUp);
  ghost().style.display="none";
  els.get(d.card.uid)?.classList.remove("dragging");
  const t=slotUnder(e);
  document.querySelectorAll(".slot").forEach(s=>s.classList.remove("drop-ok","drop-hot"));
  dragging=null;
  if(t && t.classList.contains("slot") && String(t.dataset.owner)===String(ME)){
    // se queda donde la has soltado mientras eliges qué hacer con ella
    previaSuelta(d.card.uid, t.dataset.owner, t.dataset.zone, +t.dataset.slot);
    dropHandler?.(d.card, t.dataset.zone, +t.dataset.slot, e.clientX, e.clientY);
    return;
  }
  // soltada sobre la propia mano: reordenar
  const dest = d.moved ? indiceEnMano(e) : null;
  if(dest && dest.alturaOk){ moverEnMano(d.card.uid, dest.indice); return; }
  layoutAll();
}
/* menú contextual en el punto de suelta */
export function choiceMenu(x, y, title, options){
  const m=$("#choice");
  m.innerHTML=`<div class="ctitle">${T(title)}</div>`;
  for(const o of options){
    const b=document.createElement("button");
    b.className="cbtn"+(o.primary?" primary":"");
    b.innerHTML=`<span class="cico">${o.icon??"•"}</span><span>${T(o.label)}</span>`;
    b.onclick=()=>{ m.style.display="none"; o.run(); };
    m.appendChild(b);
  }
  m.style.display="block";
  m.style.left=Math.min(x, (window.innerWidth||1400)-230)+"px";
  m.style.top =Math.min(y, (window.innerHeight||800)-170)+"px";
}
/* OJO: aquí NO se recoge la mano. `closeChoice` lo llama también
   `startDrag`, y cerrarla ahí encogía las cartas justo al empezar a
   arrastrarlas. La mano se recoge sola cuando pierde una carta. */
export function closeChoice(){ $("#choice").style.display="none"; }

/* ══════════════════════════════════════════════════════════════════
   CADA PANTALLA FINAL TIENE SU NÚMERO, Y SOLO VALE LA ÚLTIMA

   Esconder la pantalla no basta: los tres botones son objetos que
   siguen existiendo, con su `onclick` cableado al duelo que acabó. Si
   alguien conserva una referencia —y el dedo del jugador YA está encima
   cuando arranca el duelo siguiente— pulsarlo llama a `onNuevo`, que
   resuelve el nodo y cobra la recompensa de un duelo que no se ha
   jugado. Así que cada pantalla se lleva un número y los manejadores lo
   comprueban antes de hacer nada; `cerrarFinal()` sube el contador y
   con eso los de antes quedan mudos de golpe, sin recorrerlos.
   ══════════════════════════════════════════════════════════════════ */
let generacionFinal = 0;

/* Final del duelo: pantalla completa, no un menú de tres líneas. */
export async function pantallaFinal({ ganaste, motivo, lpMio, lpRival, turnos,
                                      avatarMio, avatarRival, nombreRival, onNuevo,
                                      textoNuevo="Nuevo duelo" }){
  const c=document.getElementById("fin");
  if(!c) return;
  const gen = ++generacionFinal;          // ver la nota de arriba
  const vigente = () => gen === generacionFinal;
  c.className = ganaste ? "gana" : "pierde";
  c.innerHTML=`
    <div class="finLuz"></div>
    <div class="finCaja">
      <div class="finTitulo">${T(ganaste?"VICTORIA":"DERROTA")}</div>
      <div class="finSub">${T(motivo??"")}</div>
      <div class="finDuelistas">
        <div class="finD ${ganaste?"gana":""}">
          ${avatarMio?.src?`<img src="${avatarMio.src}" alt="">`:""}
          <span class="finN">${avatarMio?.nombre??T("Tú")}</span>
          <span class="finLP">${lpMio} LP</span>
        </div>
        <div class="finVs">VS</div>
        <div class="finD ${ganaste?"":"gana"}">
          ${avatarRival?.src?`<img src="${avatarRival.src}" alt="">`:""}
          <span class="finN">${avatarRival?.nombre??T("Oponente")}</span>
          <span class="finLP">${lpRival} LP</span>
        </div>
      </div>
      <div class="finDatos">${T(`${turnos} turnos`)}${nombreRival?` · ${nombreRival}`:""}</div>
    </div>`;
  /* ══ LOS BOTONES SE CREAN, NO SE ESCRIBEN ══
     Iban dentro del `innerHTML` de arriba, y el DOM simulado de las
     pruebas no construye `innerHTML`: devuelve lo que se le asignó pero
     no crea hijos. O sea que estos tres botones eran invisibles para
     toda la suite — y el bug de «Ver el tablero», que escondía la única
     salida, es justo de los que solo se ven pulsando. Creados con
     `appendChild` sí se pueden pulsar desde `check-salida.mjs`. */
  /* Colgada de `#fin` DIRECTAMENTE, sin `querySelector`: el DOM simulado
     crea elementos al pedirlos, así que buscar `.finCaja` devolvía un
     elemento fantasma y la fila acababa colgada de la nada. Es la misma
     trampa que dejó los botones de fase ausentes del HTML sin que
     ninguna comprobación se quejara. */
  const fila = document.createElement("div");
  fila.className = "finBotones";
  c.appendChild(fila);
  const boton = (txt, clase) => {
    const b = document.createElement("button");
    b.className = "finBtn" + (clase ? " " + clase : "");
    b.textContent = T(txt);
    fila.appendChild(b);
    return b;
  };
  const bNuevo = boton(textoNuevo, "primario");
  const bLog   = boton("Descargar log");
  const bVer   = boton("Ver el tablero");
  /* Reportar un fallo o una jugada rara de la IA, aquí mismo: es cuando
     la tienes fresca. Lo monta main.js (`reportarFallo`). */
  const bRep   = boton("Reportar");
  bRep.onclick=()=>{ if(!vigente()) return; globalThis.reportarFallo?.(); };
  c.style.display="flex";
  requestAnimationFrame(()=>c.classList.add("visible"));
  /* Sobre los elementos que acabamos de crear, no buscándolos otra vez:
     `querySelectorAll` tampoco recorre descendientes en el DOM simulado,
     así que el cableado se perdía y el test no podía pulsar nada. */
  bNuevo.onclick=()=>{ if(!vigente()) return;
                       onNuevo ? onNuevo() : location.reload(); };
  /* El log, aquí mismo: es el momento en el que hace falta. */
  bLog.onclick=()=>{ if(!vigente()) return; globalThis.descargarLog?.(); };
  /* ══ MIRAR EL TABLERO NO PUEDE SER UN CALLEJÓN SIN SALIDA ══
     «Ver el tablero» solo escondía esta pantalla, y esta pantalla era el
     ÚNICO camino de vuelta: en el Reino, `onNuevo` es lo que resuelve el
     nodo y te devuelve al mapa con la ficha ganada. O sea que mirar el
     tablero después de ganar te dejaba encerrado y sin el progreso del
     duelo. Lo reportó E.

     La salida se muda al rincón que nunca puede taparse —el de fase y
     fin de turno, abajo a la derecha, que en móvil está reservado justo
     para esto— y el botón de fin pasa a decir «Continuar». Es lo que
     pidió E y además es donde ya está el pulgar. */
  bVer.onclick=()=>{
    if(!vigente()) return;
    c.classList.remove("visible");
    setTimeout(()=>{ c.style.display="none"; },400);
    setControles({ fin: () => { if(!vigente()) return;
                                onNuevo ? onNuevo() : location.reload(); },
                   finTxt: textoNuevo });
  };

}

/* Confirmación modal para lo que no tiene vuelta atrás (rendirse). */
export function confirmar(titulo, texto, alSi, etiquetaSi="Sí, rendirme"){
  const c=document.getElementById("confirm");
  c.innerHTML=`<div class="cfcaja">
    <div class="cftit">${T(titulo)}</div>
    <div class="cftxt">${T(texto??"")}</div>
    <div class="cfbtns">
      <button class="cfno">${T("Seguir jugando")}</button>
      <button class="cfsi">${T(etiquetaSi)}</button>
    </div></div>`;
  c.style.display="flex";
  const caja=c.querySelector(".cfcaja");
  c.querySelector(".cfno").onclick=()=>{ c.style.display="none"; };
  c.querySelector(".cfsi").onclick=()=>{ c.style.display="none"; alSi?.(); };
  if(caja) caja.onclick=e=>e.stopPropagation?.();
  c.onclick=()=>{ c.style.display="none"; };
}

/* Elegir entre varias cosas (lo usa «Reportar»): una caja como la de
   rendirse, con un botón por opción y «Cancelar». */
export function elegir(titulo, texto, opciones){
  const c=document.getElementById("confirm");
  c.innerHTML=`<div class="cfcaja">
    <div class="cftit">${T(titulo)}</div>
    <div class="cftxt">${T(texto??"")}</div>
    <div class="cfbtns cfVarios"></div></div>`;
  const fila=c.querySelector(".cfbtns");
  const cerrar=()=>{ c.style.display="none"; };
  for(const o of [...opciones, { label:"Cancelar", cancelar:true }]){
    const b=document.createElement("button");
    b.className = o.cancelar ? "cfno" : "cfopt";
    if(o.id) b.id = o.id;
    b.textContent = T(o.label);
    b.onclick = () => { cerrar(); o.run?.(); };
    fila?.appendChild(b);
  }
  c.style.display="flex";
  const caja=c.querySelector(".cfcaja");
  if(caja) caja.onclick=e=>e.stopPropagation?.();
  c.onclick=cerrar;
}

/* Contadores sobre la carta. Wave-Motion Cannon suma uno por turno y ese
   número ES el daño que va a hacerte; Breaker gasta el suyo para romper
   una tapada. Sin verlo no hay forma de jugar contra ellas. */
export function contador(uid, cuantos, clase="contador", nombre=null, mia=true){
  const el = uid!=null ? els.get(uid) : null;
  /* Sin carta en la mesa donde colgarlo —Final Countdown cuenta desde el
     cementerio— la cuenta va a una chapa junto a los puntos de vida, que es
     el único sitio que se ve siempre. */
  if(!el) return chapaCuenta(nombre, cuantos, clase, mia);
  let b = el.__cont;
  if(!cuantos){ if(b) b.style.display="none"; return; }
  if(!b){ b = document.createElement("div"); el.appendChild(b); el.__cont = b; }
  b.className = "cont " + clase;
  /* Un «1» suelto en una bola dorada no se leía como contador (E lo tomó
     por una marca de selección): el de magia lleva su símbolo. */
  b.style.display = ""; b.textContent = clase==="contador" ? `✦${cuantos}` : String(cuantos);
  b.title = T(clase==="turnos" ? "Turnos contados"
            : clase==="numero" ? "Puntos de vida pagados" : "Contadores");
}

/* Chapas de cuenta pegadas a los puntos de vida. Una por carta y jugador:
   "Final Countdown 7". Se quedan hasta que la partida acaba, que es
   justo lo que hacen esas cartas. */
const chapas = new Map();      // clave (dueño+nombre) -> elemento
function chapaCuenta(nombre, cuantos, clase, mia){
  if(!nombre) return;
  const caja = document.getElementById(mia ? "lpMe" : "lpOpp");
  if(!caja) return;
  const clave = (mia?"m:":"r:") + nombre;
  let ch = chapas.get(clave);
  if(!cuantos){ if(ch){ ch.remove(); chapas.delete(clave); } return; }
  if(!ch){ ch = document.createElement("span"); ch.className = "cuenta " + clase;
           caja.appendChild(ch); chapas.set(clave, ch); }
  ch.textContent = `${T(nombre)} ${cuantos}`;
  ch.title = T(clase==="turnos" ? "Turnos contados" : "Puntos de vida pagados");
}
export function limpiarCuentas(){
  for(const ch of chapas.values()) ch.remove();
  chapas.clear();
}

/* El bot está pensando: un punto que late junto a su avatar. Lo pide el
   `main.js` antes de la primera decisión de cada fase suya. */
export function pensando(on){
  const lp = document.getElementById("lpOpp");
  if(!lp) return;
  lp.classList.toggle("pensando", !!on);
}

/* ── efectos ── */
export function toast(t){
  const d=document.createElement("div"); d.className="toast"; d.textContent=T(t);
  $("#log").appendChild(d);
  setTimeout(()=>{ d.style.transition=".4s"; d.style.opacity=0; setTimeout(()=>d.remove(),400); },2000);
}
export function banner(t,color){
  const b=$("#banner"); b.textContent=T(t); b.style.color=color||"var(--gold)";
  b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
}
export function setLP(player,v,deSalida=false){
  const isMe=player===ME;
  const el=$(isMe?"#lpMeVal":"#lpOppVal"), box=$(isMe?"#lpMe":"#lpOpp");
  /* Cada cambio corta la animación anterior: si no, la cuenta que seguía
     en marcha (la de montar la vista, hacia 8000) pisaba los LP de salida
     de Pegasus en el fotograma siguiente. */
  const turno=(el._animLP=(el._animLP||0)+1);
  /* Los LP con los que empieza el duelo se ponen sin animar ni «herida». */
  if(deSalida){ el.textContent=String(v); return; }
  const from=+el.textContent||0, t0=performance.now();
  box.classList.add("hurt"); setTimeout(()=>box.classList.remove("hurt"),700);
  (function step(t){ if(el._animLP!==turno) return;
    const k=Math.min(1,(t-t0)/450);
    el.textContent=Math.round(from+(v-from)*(1-Math.pow(1-k,3)));
    if(k<1) requestAnimationFrame(step); })(t0);
}
const PHASE_TXT={1:["Draw Phase","Robo"],2:["Standby Phase","Mantenimiento"],
  4:["Main Phase 1",""],8:["Battle Phase","¡A la batalla!"],16:["Battle Step",""],
  32:["Damage Step",""],64:["Damage Step",""],128:["Battle Phase",""],
  256:["Main Phase 2",""],512:["End Phase","Fin del turno"]};
let ultimaFase=null;
export async function announcePhase(ph, mia){
  const [t,sub]=PHASE_TXT[ph] ?? ["",""];
  if(!t || t===ultimaFase) return;
  ultimaFase=t;
  const c=$("#phasecard");
  c.className = "show " + (mia ? "mine" : "foe");
  c.innerHTML=`<div class="pcmain">${T(t)}</div>${sub?`<div class="pcsub">${T(sub)}</div>`:""}`;
  await sleep(760);
  c.className="";
}
const FASES=[["DP","Draw"],["SP","Standby"],["M1","Main 1"],["BP","Battle"],
             ["M2","Main 2"],["EP","End"]];
export function setPhase(ph){
  const map={1:"DP",2:"SP",4:"M1",8:"BP",16:"BP",32:"BP",64:"BP",128:"BP",256:"M2",512:"EP"};
  const id=map[ph]||"M1";
  document.querySelectorAll(".ph").forEach(e=>e.classList.toggle("on", e.dataset.p===id));
  // misma información en el centro del campo, que es donde se mira
  const c=$("#fasesCentro");
  if(c){
    if(!c.children.length)
      c.innerHTML = FASES.map(([k,n])=>`<div class="fc" data-p="${k}">${n}</div>`).join("");
    for(const el of c.children) el.classList.toggle("on", el.dataset.p===id);
    colocarFases();
  }
}
/* El Damage Step no es una fase más y no va en la tira: se marca encima de
   Battle. Sin esto no se sabía si una cadena era en la declaración de
   ataque o ya dentro del cálculo de daño, que es cuando cambian las cosas
   que se pueden activar. */
let momentoActual = null;
export const MOMENTOS = { ataque:"Declaración de ataque", damage:"Damage Step" };
export function setMomento(m){
  momentoActual = MOMENTOS[m] ? m : null;
  /* SE ESCRIBE EN UN data-* Y LO PINTA EL CSS con content:attr(data-sub),
     así que no pasaba por ningún nodo de texto: ni la traducción del DOM
     ni el cazador de fugas de check-idioma lo veían, y "DECLARACIÓN DE
     ATAQUE" seguía en español encima de la tira de fases con el juego en
     inglés. Hay que traducirlo AQUÍ, al escribirlo. */
  const txt = momentoActual ? T(MOMENTOS[momentoActual]) : "";
  const marcar = el => {
    if(!el || el.dataset.p!=="BP") return;
    el.dataset.sub = txt;
    el.classList.toggle("conSub", !!txt);
    el.classList.toggle("enDamage", momentoActual==="damage");
  };
  for(const el of ($("#fasesCentro")?.children ?? [])) marcar(el);
  document.querySelectorAll(".ph").forEach(marcar);
}
export function momento(){ return momentoActual; }
export function momentoTexto(){ return momentoActual ? T(MOMENTOS[momentoActual]) : ""; }

/* Botones fijos de turno: "siguiente fase" y "terminar turno". */
/* ══════════════════════════════════════════════════════════════════
   LOS ATAJOS DE TECLADO (SOLO ESCRITORIO)

   SPACE avanza de fase con la acción legal que haya, ESC pasa de la
   cadena o cierra lo que esté abierto. No hay una lista de teclas por
   pantalla: se guarda QUÉ ES LO LEGAL AHORA MISMO cada vez que la
   interfaz pone los botones, y las teclas disparan exactamente eso. Así
   una tecla nunca puede hacer algo ilegal, que es la única forma de que
   un atajo no se convierta en un generador de bugs.

   Y la regla que no se salta: si el foco está en un campo de texto —el
   de la semilla, el buscador de sobres— las teclas son del campo. */
let accionEspacio = null, accionEscape = null;
export function atajos({ espacio = null, escape = null } = {}){
  accionEspacio = espacio; accionEscape = escape;
}
function escribiendo(){
  const a = document.activeElement;
  if(!a) return false;
  const t = String(a.tagName ?? "").toUpperCase();
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || a.isContentEditable;
}
try{
  document.addEventListener("keydown", e => {
    /* Con el dedo no hay teclado, y en un móvil con teclado externo
       tampoco molesta: lo que se comprueba es que exista la acción. */
    if(escribiendo()) return;
    if(e.key === " " || e.code === "Space"){
      if(!accionEspacio) return;
      e.preventDefault();
      const f = accionEspacio; accionEspacio = null;   // no dispararla dos veces
      try{ f(); }catch(err){}
    } else if(e.key === "Escape"){
      if(!accionEscape) return;
      e.preventDefault();
      const f = accionEscape; accionEscape = null;
      try{ f(); }catch(err){}
    }
  });
}catch(e){}

export function setControles(cfg){
  const z=$("#controles"), bf=$("#btnFase"), bt=$("#btnFin");
  /* Los atajos siguen a los botones: si no hay botón de fase, SPACE no
     hace nada. Es lo que garantiza que la tecla nunca sea ilegal. */
  atajos({ espacio: cfg?.fase ?? cfg?.fin ?? null, escape: cfg?.escape ?? null });
  if(!z) return;
  if(!cfg){ z.style.display="none"; return; }
  z.style.display="flex";
  bf.style.display = cfg.fase ? "flex" : "none";
  if(cfg.fase){ $("#btnFaseTxt").textContent = T(cfg.faseTxt ?? "Siguiente fase"); bf.onclick=cfg.fase; }
  bt.style.display = cfg.fin ? "flex" : "none";
  if(cfg.fin){
    bt.onclick=cfg.fin;
    /* El botón de fin cambia de nombre cuando cambia de trabajo: al
       acabar el duelo deja de terminar el turno y pasa a ser la salida
       («Continuar»). Sin esto decía «Terminar turno» y volvía al mapa,
       que es lo peor de los dos mundos. */
    const t = $("#btnFinTxt");
    if(t) t.textContent = T(cfg.finTxt ?? "Terminar turno");
  }
}
export function flash(){ const f=$("#flash"); f.style.transition="none"; f.style.opacity=".5";
  requestAnimationFrame(()=>{ f.style.transition="opacity .35s"; f.style.opacity="0"; }); }
export function popDamage(v,player){
  const d=document.createElement("div"); d.className="dmg"; d.textContent="-"+v;
  const W=window.innerWidth||1400, H=window.innerHeight||800;
  d.style.left=W*0.5+"px"; d.style.top=(player===ME?H*0.70:H*0.28)+"px";
  document.body.appendChild(d); setTimeout(()=>d.remove(),1000);
}
/* declaración de ataque: telegrafía, todavía sin cálculo de daño */
export async function telegraphAttack(uid, targetUid){
  const a=els.get(uid); if(!a) return;
  a.classList.add("declaring");
  const arrow=document.createElement("div"); arrow.className="atkArrow";
  const ar=a.getBoundingClientRect();
  const t=targetUid?els.get(targetUid):null;
  const tr=t?t.getBoundingClientRect()
            :{left:(window.innerWidth||1400)/2-40, top:(window.innerHeight||800)*0.22, width:80, height:0};
  const x1=ar.left+ar.width/2, y1=ar.top+ar.height/2;
  const x2=tr.left+tr.width/2, y2=tr.top+(tr.height||0)/2;
  const len=Math.hypot(x2-x1,y2-y1), ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
  arrow.style.left=x1+"px"; arrow.style.top=y1+"px";
  arrow.style.width=len+"px"; arrow.style.transform=`rotate(${ang}deg)`;
  document.body.appendChild(arrow);
  if(t) t.classList.add("underAttack");
  toast(targetUid ? "Ataque declarado" : "Ataque directo declarado");
  await sleep(620);
  arrow.remove(); a.classList.remove("declaring"); t?.classList.remove("underAttack");
}
/* choque real, en el damage step */
export async function animateBattle(uid,targetUid){
  const el=els.get(uid); if(!el) return;
  const start=el.style.transform;
  el.classList.add("attacking");
  const tEl=targetUid?els.get(targetUid):null;
  if(tEl){
    const a=el.getBoundingClientRect(), b=tEl.getBoundingClientRect();
    el.style.transition="transform .24s cubic-bezier(.6,0,.9,.5)";
    el.style.transform=start.replace(/translate3d\(([^)]+)\)/,(m,p)=>{
      const [x,y,z]=p.split(",").map(parseFloat);
      return `translate3d(${x+(b.left-a.left)*0.8}px,${y+(b.top-a.top)*0.8}px,${z+70}px)`;});
    await sleep(250); flash(); tEl.classList.add("hit");
    setTimeout(()=>tEl.classList.remove("hit"),340);
  } else {
    el.style.transition="transform .26s cubic-bezier(.6,0,.9,.5)";
    el.style.transform=start.replace(/translate3d\(([^)]+)\)/,(m,p)=>{
      const [x,y,z]=p.split(",").map(parseFloat);
      const dy=(DUEL.cards.get(uid)?.controller===ME?-1:1)*grid.offsetHeight*0.38;
      return `translate3d(${x}px,${y+dy}px,${z+90}px)`;});
    await sleep(270); flash();
  }
  el.style.transition="transform .4s var(--ease)"; el.style.transform=start;
  await sleep(360); el.classList.remove("attacking");
}
export function glow(uid,on){ els.get(uid)?.classList.toggle("glow",on); }
export { sleep };
