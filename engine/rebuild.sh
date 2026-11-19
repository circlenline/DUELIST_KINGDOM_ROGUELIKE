#!/usr/bin/env bash
# Reconstruye el simulador y el deck builder desde cero.
# Requiere: node. Se ejecuta desde la carpeta engine/.
set -e
W="$(cd "$(dirname "$0")" && pwd)"
echo "── datos ──"
[ -f "$W/data/full_cards.json" ] || python3 "$W/data/export_cards.py"
echo "── Retro Pack 2 (modo draft) ──"
[ -d "$W/draft" ] && ( cd "$W/draft" && node importar-rp02.mjs | head -1 )
echo "── scripts Lua de todo el pool ──"
cd "$W/browser" && node build-scripts.mjs "$W/data/goat-pool.json"
echo "── simulador ──"
node build-html.mjs
echo "── deck builder ──"
cd "$W/deckbuilder" && node build.mjs
echo "── verificación ──"
cd "$W/browser"
node check-dom.mjs | tail -2
node check-activar.mjs | tail -1
node check-sync.mjs 2>&1 | tail -1
node check-ia-propias.mjs 2>&1 | tail -1
node check-ventanas.mjs 2>&1 | tail -1
node check-tapadas.mjs 2>&1 | tail -1
node check-mudas.mjs 2>&1 | tail -1
node check-cartas.mjs 2>&1 | tail -1
node check-contadores.mjs 2>&1 | tail -1
node check-historia.mjs 2>&1 | tail -1
node check-mapa.mjs 500 2>&1 | tail -1
node check-recompensas.mjs 500 2>&1 | tail -1
node check-utilidad.mjs 2>&1 | tail -1
node check-rivales.mjs 2>&1 | tail -1
node check-run.mjs 100 2>&1 | tail -1
node check-jefes.mjs 2>&1 | tail -1
node check-reino.mjs 2>&1 | tail -1
node check-encadenados.mjs 2>&1 | tail -1
node check-p0.mjs 2>&1 | tail -1
node check-pestanas.mjs 2>&1 | tail -1
node check-maestria.mjs 2>&1 | tail -1
node check-barajatapadas.mjs 2>&1 | tail -1
# Va después del deck builder a propósito: lee los DOS html construidos.
node check-movil.mjs 2>&1 | tail -1
# El juego en inglés tiene que estar en inglés: `check-idioma` mira el
# mecanismo, esto recorre las pantallas y LEE lo que sale.
node check-ingles.mjs 2>&1 | tail -1
node check-sobres.mjs 2>&1 | tail -1
node check-zona.mjs 2>&1 | tail -1
node check-fusiones.mjs 2>&1 | tail -1
# Que ningún mazo inicial se quede sin cartas que le sirvan en los sobres.
(cd ../story-tools && node soporte.mjs 2>&1 | tail -2)
node jugar.mjs 2>&1 | tail -2
# Que «Ver el tablero» al acabar un duelo no deje al jugador encerrado.
node check-salida.mjs 2>&1 | tail -1
# Que el contador de uso no filtre nada ni pueda tirar una partida.
node check-telemetria.mjs 2>&1 | tail -1
# Y que la carpeta que se sube tenga lo que dice tener.
node check-arte.mjs 2>&1 | tail -1
node check-depuracion.mjs 2>&1 | tail -1
node check-vinculos.mjs 2>&1 | tail -1
node check-lua.mjs 20 2>&1 | tail -1
node check-publicar.mjs 2>&1 | tail -1
# Que el bot no decida con información oculta, y que el motor se pueda rehacer.
node check-frontera.mjs 40 2>&1 | tail -1
node check-torneo.mjs 2>&1 | tail -1
node check-suizo.mjs 1000 2>&1 | tail -1
node check-red.mjs 2>&1 | tail -1
node check-sala.mjs 2>&1 | tail -1
node check-pensar.mjs 3 4 2>&1 | tail -1
node check-pensar-juego.mjs 2>&1 | tail -1
node check-reconstruir.mjs 4 2>&1 | tail -1
# Cómo acaba un duelo (se MIDE, no se supone) y qué carta señala un efecto.
node check-final.mjs 6 2>&1 | tail -1
# Las reglas de la guía de E, preguntadas AL MOTOR (no a la IA).
node check-reglas-guia.mjs 2>&1 | tail -1
# Un clic tardío (botón con el onclick de la pregunta anterior) no puede contestar a otra.
node check-clic-tardio.mjs 2>&1 | tail -1
# Los avisos de depuración no nombran lo que la IA tiene tapado.
node check-secretos.mjs 2>&1 | tail -1
# Decisiones estratégicas del formato (docs/ESTRATEGIA-GOAT.md).
node estrategia.mjs 2>&1 | tail -1
# Tsukuyomi y Book of Moon: los rulings que usa planTumbar, preguntados al motor.
node check-tsukuyomi.mjs 2>&1 | tail -1
# Floaters: Creature Swap con mi floater y el crash, preguntados al motor.
node check-floaters.mjs 2>&1 | tail -1
# Los rulings del torneo del 25-09 (Book of Moon a mi volteo, Threatening Roar, Book of Life y Kycoo).
node check-rulings-2509.mjs 2>&1 | tail -1
# La prioridad de 2005: el motor, la ventana del humano en «auto» y lo que la IA da por hecho.
node check-prioridad.mjs 2>&1 | tail -1
# La moneda (Fairy Box, Gatling Dragon…) tiene que salir cara a veces: semilla mezclada.
node check-moneda.mjs 2>&1 | tail -1
# Replays de torneo de DuelingBook: que el importador lea bien la final del GFCEU 2026 y el marcador se empaquete.
( cd "$W/replays" && node build-bookmarklet.mjs >/dev/null && node check-replays.mjs 2>&1 | tail -1 )
# Modo draft: la IA de picks, el constructor y el suizo (sin motor), y las 101 cartas EN el motor.
[ -f check-draft.mjs ] && node check-draft.mjs 2>&1 | tail -1
[ -f check-draft-cartas.mjs ] && node check-draft-cartas.mjs 40 2>&1 | tail -1
