/* ══ EL MODO DE CADENAS «CUANDO TIENE SENTIDO» (19-11) ══
   Lo pidió la comunidad (E lo trajo de Reddit): «uno de control total,
   como MTG Arena, que te pregunta en cada momento literal de respuesta;
   uno intermedio que solo te pregunta cuando es apropiado —como el
   Waboku: nadie lo activaría en otro momento que no sea el ataque—, y un
   tercero que nunca pregunte». Los otros dos ya existían («preguntar
   siempre», «no activar nada») y el «automáticas» de siempre se queda tal
   cual, que es el que usa E.

   Este módulo decide, para una ventana de cadena (SELECT_CHAIN), si ALGUNA
   de las cartas que el motor te ofrece tiene sentido AHORA. Si ninguna lo
   tiene, la ventana se pasa sola. Es deliberadamente generoso: ante la
   duda pregunta. Lo que nunca se salta:
     · lo que sale de tu cementerio y los disparadores (eso ya lo exime
       main.js antes de llegar aquí);
     · una carta tuya que está siendo objetivo o que se va a llevar un
       barrido (Heavy Storm, Harpie's Feather Duster): «úsala o piérdela».
   Y por tipo de carta, leyendo su texto (vale para las 1.685 del pool):
     · de batalla (Waboku, Mirror Force, Sakuretsu, Magic Cylinder, Negate
       Attack, Kuriboh…): solo con un ataque suyo declarado; las que
       impiden declarar ataques (Threatening Roar), también al empezar su
       Battle Phase;
     · contra-trampas (Solemn, Magic Jammer, Seven Tools): cuando él ha
       activado algo, o recién invocado si la carta habla de invocaciones;
     · contra la invocación (Trap Hole, Bottomless, Torrential): justo
       después de que él invoque;
     · contra su mano (Trap Dustshoot): también en su Draw y Standby;
     · el resto (MST, Book of Moon, Ring, Scapegoat, Call of the Haunted,
       Dust Tornado…): en su turno, cuando hace algo (cadena, invocación,
       ataque) y en su End Phase; en el tuyo, si él te ha respondido o hay
       un ataque tuyo en curso.

   Pura a propósito, como prioridad.js: main.js le pasa lo que hace falta
   y check-ventanas.mjs la prueba sin interfaz. */
const FASE = { DRAW:0x1, STANDBY:0x2, MAIN1:0x4, BATTLE_START:0x8, BATTLE_STEP:0x10,
               DAMAGE:0x20, DAMAGE_CAL:0x40, BATTLE:0x80, MAIN2:0x100, END:0x200 };
const EN_BATALLA = FASE.BATTLE_START | FASE.BATTLE_STEP | FASE.DAMAGE | FASE.DAMAGE_CAL | FASE.BATTLE;
const BARRIDOS = /destroy all spell (and|&|\/) ?trap|destroy all spells? (and|&|\/) ?traps?|return all spell/i;

export function clasificarCarta({ tipo = 0, texto = "" } = {}){
  const t = String(texto);
  /* Negate Attack es contra-trampa, pero responde a una declaración de
     ataque, que no es un eslabón: va con las de batalla. */
  if((tipo & 0x100000) && /declares an attack/i.test(t)) return "batalla";
  if(tipo & 0x100000) return "contra";                       // TYPE_COUNTER
  if(/cannot declare an attack|declare an attack this turn/i.test(t) && !/when (an|your) opponent'?s? monster declares an attack/i.test(t)) return "antiAtaque";
  if(/declares an attack|attack declaration|battle damage|attacking monster|destroyed by battle this turn|during damage calculation|being attacked|attack(s)? (on|against)|when .* attacks/i.test(t)) return "batalla";
  if(/(normal|flip|special|tribute)? ?summons? (a|1|one or more|exactly 1)? ?monsters?|is (normal |flip |special |tribute )?summoned|when (a|your opponent'?s?) monster(\(s\))? (is|are) (normal |flip |special )?summoned/i.test(t)
     && /when|if/i.test(t)) return "invocacion";
  if(/cards? in (their|your opponent'?s?) hand|look at your opponent'?s? hand/i.test(t)) return "mano";
  return "general";
}

export function valePreguntar(q, ctx){
  const { yo, turnPlayer, fase = 0, atacante = null, cadena = [], objetivos = new Set(),
          uidEn = () => null, info = () => ({}), recienInvocadaRival = false } = ctx;
  const sel = q?.selects ?? [];
  if(!sel.length) return { preguntar:false, motivo:"nada que ofrecer" };
  const suTurno = turnPlayer !== yo;
  const top = cadena.length ? cadena[cadena.length - 1] : null;
  const respondeEl = !!top && top.controller !== yo;
  const barrido = respondeEl && BARRIDOS.test(String(info(top.code)?.texto ?? ""));
  const suAtaque = !!atacante && atacante.controller !== yo;
  const miAtaque = !!atacante && atacante.controller === yo;
  const empiezaSuBatalla = suTurno && (fase & EN_BATALLA) && !atacante;

  for(const s of sel){
    if(s.location === 16) return { preguntar:true, motivo:"desde el cementerio" };
    const uid = uidEn(s);
    if(uid != null && objetivos.has(uid)) return { preguntar:true, motivo:"tu carta es objetivo" };
    if(barrido && s.location === 8) return { preguntar:true, motivo:"un barrido se la va a llevar" };
    const c = info(s.code) ?? {};
    const clase = clasificarCarta(c);
    switch(clase){
      case "batalla":
        if(suAtaque) return { preguntar:true, motivo:"ataque suyo declarado" };
        break;
      case "antiAtaque":
        if(suAtaque || empiezaSuBatalla) return { preguntar:true, motivo:"su Battle Phase" };
        break;
      case "contra":
        if(respondeEl) return { preguntar:true, motivo:"ha activado algo" };
        if(recienInvocadaRival && /summon/i.test(String(c.texto ?? ""))) return { preguntar:true, motivo:"acaba de invocar" };
        break;
      case "invocacion":
        if(recienInvocadaRival) return { preguntar:true, motivo:"acaba de invocar" };
        if(respondeEl) return { preguntar:true, motivo:"ha activado algo" };
        break;
      case "mano":
        if(suTurno && (fase & (FASE.DRAW | FASE.STANDBY))) return { preguntar:true, motivo:"acaba de robar" };
        // y además, como una carta general
      default:
        if(suTurno){
          if(respondeEl || recienInvocadaRival || suAtaque || (fase & FASE.END))
            return { preguntar:true, motivo: respondeEl ? "ha activado algo" : recienInvocadaRival ? "acaba de invocar"
                                             : suAtaque ? "ataque suyo declarado" : "su End Phase" };
        } else {
          if(respondeEl || miAtaque) return { preguntar:true, motivo: respondeEl ? "te ha respondido" : "tu ataque en curso" };
        }
    }
  }
  return { preguntar:false, motivo:"ninguna de tus cartas tiene sentido ahora" };
}
