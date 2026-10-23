/* Valoración del estado: cuánto de bien va la partida para el bot. */
import { conocer } from "./knowledge.js";

/* El ATK que cuenta es el del tablero. `atkReal` lo rellena el adaptador
   preguntándole al motor; si la carta no está en campo (mano, cementerio,
   una lista de selección) no hay valor real y se cae a la ficha impresa. */
export const atk = c => c?.atkReal ?? c?.datos?.attack ?? 0;
export const def = c => c?.defReal ?? c?.datos?.defense ?? 0;
export const atkBase = c => c?.datos?.attack ?? 0;
// Lo que aporta un monstruo defendiendo o atacando
export const poder = c => c?.defensa ? def(c) : atk(c);

export function valorCarta(c){
  /* Desconocida. Una TAPADA del rival no vale lo mismo que "cualquier
     carta": en Goat el backrow colocado es sobre todo Mirror Force,
     Torrential, Sakuretsu, Scapegoat, Book of Moon o Call of the Haunted
     (media ~1,3 en la tabla), y un monstruo tapado suele ser un volteo o
     un Sangan (~1,25). Antes el bot LEÍA el código de la tapada y elegía
     objetivo con él; al quitarle esa trampa hace falta este previo, o
     prefiere romper una continua boca arriba de 1,0 antes que la tapada. */
  /* Un Call of the Haunted boca arriba sin monstruo no hace nada:
     romperlo no quita nada (ver `continuaMuerta` en view.js). */
  if(c?.muerta) return 0.05;
  if(!c?.nombre) return c?.tapadaDesconocida === "mt" ? 1.3
                      : c?.tapadaDesconocida === "monstruo" ? 1.25 : 1.0;
  return conocer(c.nombre, c.datos).valor ?? 1.0;
}
export function rolDe(c){
  if(!c?.nombre) return "desconocido";
  return conocer(c.nombre, c.datos).rol;
}
export function infoDe(c){
  if(!c?.nombre) return {};
  return conocer(c.nombre, c.datos);
}

/* Ventaja de cartas: la métrica que decide las partidas de Goat. */
export function ventaja(v){
  const mias  = v.mano.length + v.monstruos.length + v.backrow.length;
  const suyas = v.manoRival.cuantas + v.monstruosRival.length + v.backrowRival.length;
  return mias - suyas;
}

/* Presión en el campo, contando solo lo que se puede ver. */
export function presion(v){
  const mio   = v.monstruos.reduce((s,c)=>s+poder(c),0);
  const suyo  = v.monstruosRival.reduce((s,c)=>s + (c.bocaAbajo?1200:poder(c)),0);
  return (mio - suyo)/1000;
}

export function evaluar(v){
  return ventaja(v)*3.0 + presion(v)*1.2 + (v.lp.mio - v.lp.rival)/2500;
}

/* ¿Puedo matar a este monstruo en combate sin perder el mío? */
/* ══════════════════════════════════════════════════════════════════
   ATACAR A UNA TAPADA ES UNA APUESTA, Y LAS APUESTAS SE CALCULAN

   Esto era `atk(atacante) > 1600`: un número escrito a ojo. E lo
   reportó dos turnos seguidos —«no ataca a mi monstruo en defensa con
   sus monstruos»— y tenía toda la razón: tenía un Magician of Faith
   tapado, 300/400, y enfrente un Flying Kamakiri de 1400 que se quedó
   quieto. Con 1400 de ataque el umbral decía que no, y en realidad 1400
   se lleva por delante el 61% de lo que se coloca tapado en este
   formato.

   Así que en vez de un umbral hay una TABLA, medida sobre lo que de
   verdad se juega: los monstruos de nivel ≤4 de los 20 mazos que se
   colocan boca abajo (los de volteo y los que tienen más defensa que
   ataque), contando copias. 140 copias, 28 monstruos distintos. Se
   regenera con el script del comentario de abajo si cambian los mazos.

   La bandera de "estoy en el pool" no es información oculta: es el
   formato, y lo sabe cualquiera que haya jugado dos partidas. Lo que
   NO se mira es la decklist concreta del rival — eso sigue siendo
   trampa y sigue vetado en `ai/view.js`.

   Regenerar:
     node -e 'const c=require("./out/cards.subset.json"),
       m=require("../data/mazos.json"); …'   (ver el historial de git)
   ══════════════════════════════════════════════════════════════════ */
const DEFENSAS_TAPADAS = [[400,24],[500,4],[600,18],[700,10],[800,6],[900,4],
  [1000,18],[1200,1],[1400,22],[1500,4],[1600,9],[1800,5],[1900,5],[2000,10]];
const COPIAS_TAPADAS = DEFENSAS_TAPADAS.reduce((s,x)=>s+x[1],0);

/* Qué sale de atacar a una tapada de la que no sé nada:
     · `prob`  — con qué frecuencia mi ataque se la lleva
     · `daño`  — cuántos LP me como de media cuando NO se la lleva
   Las dos salen de la misma tabla, así que suben y bajan juntas. */
export function apuestaContraTapada(atkMio){
  let mata = 0, rebote = 0, copiasRebote = 0;
  for(const [d, copias] of DEFENSAS_TAPADAS){
    if(atkMio > d) mata += copias;
    else if(d > atkMio){ rebote += (d - atkMio) * copias; copiasRebote += copias; }
    /* def === atk: no muere nadie y no hay daño. Ni suma ni resta. */
  }
  return { prob: mata / COPIAS_TAPADAS,
           daño: copiasRebote ? rebote / copiasRebote : 0 };
}

/* ══════════════════════════════════════════════════════════════════
   EL ATAQUE QUE PONE LA CARTA NO ES SIEMPRE EL ATAQUE QUE PEGA

   Injection Fairy Lily tiene 400. Cuando la atacas, su dueño paga 2000
   puntos de vida y pega con 3400. E lo vio en la partida 3: el bot
   invocó un volteo en ataque y le pegó a la Lily «porque 400 < lo mío»,
   y se quedó sin monstruo y con la mesa peor.

   Se asume que el rival PAGA si puede: no es pesimismo, es que pagar ahí
   es la jugada evidente. Si no le llegan los puntos, la carta es lo que
   pone. `lp` es el del DUEÑO del monstruo. */
export function atkEnCombate(c, lp = Infinity){
  const inf = infoDe(c);
  const extra = inf.atkSiPaga ?? 0;
  if(extra && lp > (inf.costeLPAtaque ?? 0)) return atk(c) + extra;
  return atk(c);
}

export function ganaCombate(atacante, defensor, lpDefensor){
  /* Para el resto del cerebro sigue siendo un sí o un no, pero ahora el
     corte es "más probable que no" en vez de un número inventado. */
  if(defensor.bocaAbajo) return apuestaContraTapada(atk(atacante)).prob > 0.5;
  return defensor.defensa ? atk(atacante) > def(defensor)
                          : atk(atacante) > atkEnCombate(defensor, lpDefensor);
}
export function muereAtacando(atacante, defensor, lpDefensor){
  if(defensor.bocaAbajo) return false;
  return !defensor.defensa && atkEnCombate(defensor, lpDefensor) >= atk(atacante);
}

/* ══════════════════════════════════════════════════════════════════
   ¿Y DESPUÉS QUÉ? — lo que el rival puede hacerme en su turno.

   Esto es lo que faltaba y lo que E describía: "la IA a veces invoca en
   ataque por invocar, sin darse cuenta de que yo tengo un monstruo con
   más ataque y que le haré daño al siguiente turno". El bot puntuaba la
   jugada por lo que conseguía AHORA y no miraba el tablero que dejaba.

   No hay simulación: ocgcore no deja clonar un duelo. Pero no hace falta
   simular para saber que un 1400 boca arriba delante de un 1900 está
   muerto. Basta con estimar con qué puede pegar el rival.
   ══════════════════════════════════════════════════════════════════ */

/* ATK más alto que el rival puede poner sobre la mesa en su turno.
   Cuenta lo que ya tiene boca arriba y, si le quedan cartas en la mano,
   la invocación típica del formato: en Goat casi todo el mundo juega
   monstruos de nivel 4 de 1700-1900. Es una estimación, y ser prudente
   aquí es gratis: como mucho el bot coloca en vez de invocar. */
export function pegaMasFuerte(v, { conMano = true } = {}){
  let mx = 0;
  for(const c of v.monstruosRival){
    if(c.bocaAbajo) continue;              // no se sabe, no se cuenta
    if(c.atado) continue;                  // bajo Spellbinding Circle no ataca
    /* Injection Fairy Lily pega con 3400 si su dueño puede pagar 2000
       (E, 02-10: la IA la trataba como un 400 al decidir qué dejar de
       frente). */
    mx = Math.max(mx, atkEnCombate(c, v.lp?.rival ?? Infinity));
  }
  if(conMano && v.manoRival.cuantas > 0) mx = Math.max(mx, 1800);
  return mx;
}

/* ¿Este monstruo aguanta boca arriba hasta mi siguiente turno? */
export function sobrevive(carta, v, opciones){
  return atk(carta) > pegaMasFuerte(v, opciones);
}

/* Lo que me cuesta que me lo maten: la carta, más el daño que me llevo.

   OJO CON PASARSE DE PRUDENTE. La primera versión metía en el mismo saco
   lo que el rival tiene EN LA MESA y lo que PODRÍA sacar de la mano, así
   que mientras le quedara una carta el bot no invocaba nada de frente: lo
   colocaba todo, las partidas se alargaban tres turnos y medía dos puntos
   de victoria PEOR. Un jugador de verdad invoca su 1900 y ya veremos.
   Así que son dos cosas distintas: lo de la mesa es un hecho y decide;
   lo de la mano es un riesgo y solo inclina. */
export function costeDeQueMuera(carta, v){
  const enMesa = pegaMasFuerte(v, { conMano:false });
  if(atk(carta) > enMesa){
    const deMano = v.manoRival.cuantas >= 2 ? 1800 : 0;
    return atk(carta) > deMano ? 0 : 0.35;     // riesgo, no certeza
  }
  const dano = Math.max(0, enMesa - atk(carta));
  return valorCarta(carta) + dano/1200;
}

/* ══════════════════════════════════════════════════════════════════
   SISTEMA A · EL EVALUADOR DE POSICIÓN

   Cinco reportes distintos de E eran el MISMO bug:

     · Sangan (1000/600) en ataque delante de La Jinn de 1800;
     · Sangan otra vez, sin ni siquiera atacar;
     · Spirit Reaper acabando en ataque;
     · Black Dragon's Chick invocada de frente sin razón;
     · monstruos pequeños delante de un Luster Dragon de 1900.

   Y la causa era una sola línea. Para agacharse, el bot exigía
   `def(c) > atk(c)`:

       else if(exp("posicionSegura") && def(c) > atk(c) && !sobrevive(c,v))

   Sangan tiene 1000 de ataque y 600 de defensa, así que NUNCA entraba
   por ahí y terminaba el turno de frente regalando 800 de daño cada
   turno. Pero la defensa no hay que compararla con el ataque PROPIO:
   en defensa, un monstruo que pierde el combate te hace perder CERO
   puntos de vida —no hay perforación en casi nada del formato—,
   mientras que de frente te comes la diferencia entera. Da igual que
   su defensa sea 600 o 2000: contra un golpe que no puedes ganar, la
   defensa siempre pierde menos.

   Lo único que hay que mirar de verdad es: ¿voy a ganar algo estando
   de frente? Atacar con provecho, o sobrevivir al golpe. Si no,
   agacharse es gratis.
   ══════════════════════════════════════════════════════════════════ */
export function evaluarPosicion(carta, v, opciones = {}){
  const {
    puedeAtacarYa = false,     // ¿queda Battle Phase y este monstruo puede atacar?
    inmuneCombate = false,     // Spirit Reaper y compañía: no mueren en batalla
    perfora       = false,     // si perfora, la defensa del rival no le protege
  } = opciones;

  const miAtk = atk(carta), miDef = def(carta);
  const golpeRival = pegaMasFuerte(v, { conMano:false });
  /* ¿Aguanto de frente? Con ataques iguales mueren los dos, así que
     "aguantar" es estrictamente mayor. */
  const aguantaDeFrente = miAtk > golpeRival;

  /* ¿Consigo algo atacando ESTE turno? Campo rival vacío es daño
     directo; si no, hace falta ganarle a alguno de sus monstruos. */
  /* ══ LA POSTURA Y EL ATAQUE TIENEN QUE USAR LA MISMA REGLA ══
     Aquí las tapadas se descartaban (`!r.bocaAbajo`), igual que en el
     ataque: el bot ni atacaba a la tapada ni se agachaba, así que se
     quedaba de frente sin hacer nada. E lo vio por los dos lados a la
     vez: «no ataca a mi monstruo en defensa… entonces por qué los deja
     en ataque?». La respuesta era que sí debía atacar, y ahora las dos
     decisiones preguntan a la MISMA tabla medida. */
  const hayGolpe = puedeAtacarYa && (
    v.monstruosRival.length === 0 ||
    v.monstruosRival.some(r => r.bocaAbajo
      ? apuestaContraTapada(miAtk).prob > 0.5
      : (perfora ? miAtk > def(r) : miAtk > (r.defensa ? def(r) : atkEnCombate(r, v.lp?.rival ?? Infinity)))));

  /* Lo que me cuesta quedarme de frente: la diferencia que me comería
     el rival en su turno. En defensa eso es cero. */
  const dañoGratis = Math.max(0, golpeRival - miAtk);

  /* Un cuerpo que no muere en combate NO deja de cobrar daño: en
     ataque, cada golpe le quita a su dueño la diferencia. Por eso los
     inmunes quieren defensa todavía más que los demás. */
  if(inmuneCombate && !hayGolpe)
    return { quiere:"defensa", peso: 2.2 + dañoGratis/1500,
             por:"no muere en combate, pero de frente cobra daño gratis" };

  if(hayGolpe)
    return { quiere:"ataque", peso: 1.4 + miAtk/2500, golpe:true,
             por:"tiene un ataque que merece la pena" };

  if(aguantaDeFrente)
    return { quiere:"ataque", peso: 0.6,
             por:"aguanta lo que hay enfrente" };

  /* Ni ataca ni aguanta: de frente solo sirve para regalar puntos de
     vida. El peso crece con lo que me ahorro, para que gane a otras
     jugadas menores cuando el daño evitado es grande. */

  /* ══ Y EN DEFENSA TAMBIÉN IMPORTA SI EL CUERPO SOBREVIVE ══
     Está escrito arriba —y es verdad— que en defensa el daño que te
     comes es CERO mida lo que mida la defensa. Pero de ahí se coló la
     idea de que la defensa daba igual, y no: un 2300/0 agachado se
     muere contra CUALQUIER cosa y encima has renunciado a sus 2300;
     un 1200/2000 se queda ahí bloqueando turno tras turno. Lo primero
     es perder una carta, lo segundo es ganar tiempo, y las dos cosas
     puntuaban idéntico.
     Importa sobre todo cuando hay VARIOS monstruos que podrían
     agacharse: el que tiene que hacerlo es el que menos pierde por
     hacerlo. E lo describió con el Goblin Attack Force, que es
     justamente 2300 de ataque y 0 de defensa. */
  const aguantaAgachado = def(carta) >= golpeRival;
  const extra = aguantaAgachado ?  0.6      // ahí se queda, bloqueando
              : def(carta) < atk(carta)/2 ? -0.5   // se muere igual y sin sus números
              : 0;
  return { quiere:"defensa", peso: 1.3 + dañoGratis/1200 + extra,
           por: dañoGratis > 0
             ? `de frente le regalo ${dañoGratis} de daño cada turno` +
               (aguantaAgachado ? ", y agachado aguanta" : "")
             : "de frente no consigue nada" };
}

/* ¿Merece la pena atacar CON este monstruo aunque pierda el combate,
   solo por lo que consigue su efecto? Es el caso de Hyper Hammerhead:
   ataca a algo más grande, se lo lleva a la mano y tú pagas la
   diferencia en puntos de vida. Contra un monstruo gordo eso es un
   cambio buenísimo; contra un 1500 cualquiera es tirar el cuerpo. */
export function valeAtaqueSuicida(atacante, defensor, v, opciones = {}){
  const { rebota = false, destierra = false } = opciones;
  if(!rebota && !destierra) return null;
  const daño = Math.max(0, poder(defensor) - atk(atacante));
  if(daño >= v.lp.mio) return null;               // eso es perder la partida
  /* Lo que me llevo por delante: cuánto vale su monstruo, y cuánto más
     grande es que el mío (lo que no podría matar de otra forma). */
  const premio = valorCarta(defensor) + Math.max(0, poder(defensor) - atk(atacante))/900;
  /* Y lo que me cuesta: mi cuerpo si muere, más los puntos de vida.
     Rebotar NO mata al mío si el suyo se va antes del cálculo, pero
     Hyper Hammerhead rebota DESPUÉS del daño, así que el mío muere. */
  const coste = valorCarta(atacante) + daño/1100;
  return { vale: premio - coste, premio, coste, daño };
}
