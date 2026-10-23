/* ════════════════════════════════════════════════════════════════
   IDIOMAS

   El código sigue escrito en español —es el idioma en el que se piensa
   el proyecto— y la traducción se aplica en los pocos sitios por donde
   pasa TODO el texto: los paneles, los avisos, los menús y las
   etiquetas del tablero. Así no hay que tocar doscientas llamadas ni
   inventarse claves: la clave es la propia frase en español.

   Los nombres y textos de las cartas ya vienen en inglés de la base, que
   es justo lo que espera la comunidad de Goat.

   Para las frases con datos dentro ("Cadena 2: Sangan") hay reglas con
   expresión regular, porque una tabla de frases exactas no puede
   cubrirlas.
   ════════════════════════════════════════════════════════════════ */

const EN = {
  /* ── barra superior y menús ── */
  "Goat Format":"Goat Format",
  "motor ocgcore · reglas 2005":"ocgcore engine · 2005 rules",
  /* ── Reino de los Duelistas ── */
  /* Los ocho encuentros de la isla: los textos viven en
     engine/data/story/eventos.json y están escritos en español. */
  "El consejo del abuelo":"Grandpa's advice",
  "El abuelo te llama por el comunicador. «Un mazo no se gana con la carta más fuerte, Yugi. Se gana con la que sabes cuándo jugar.»":"Grandpa calls you on the radio. \"A deck isn't won with the strongest card, Yugi. It's won with the one you know when to play.\"",
  "Escuchar su consejo":"Listen to him",
  "El abuelo te manda una carta de su colección.":"Grandpa sends you a card from his collection.",
  "«Ya lo sé, abuelo»":"\"I know, Grandpa\"",
  "Cuelgas, pero algo se te queda dentro: la próxima recompensa la verás con otros ojos.":"You hang up, but it sticks: you'll look at your next reward differently.",
  "Joey quiere cambiar cromos":"Joey wants to trade",
  "«Eh, colega. Me sobran cartas y a ti también. ¿Hacemos un cambio a ciegas?»":"\"Hey, pal. I've got spare cards and so do you. Blind trade?\"",
  "Cambiar a ciegas":"Blind trade",
  "Joey te da dos cartas y se va tan contento.":"Joey hands you two cards and walks off happy.",
  "Mejor no":"Better not",
  "Joey se encoge de hombros y sigue su camino.":"Joey shrugs and moves on.",
  "El Cazador de Raras":"The Rare Hunter",
  "Una figura encapuchada te corta el paso. «Una Star Chip. Solo una. Y te enseño lo que llevo dentro de la gabardina.»":"A hooded figure blocks your path. \"One Star Chip. Just one. And I'll show you what's under this coat.\"",
  "Apostar una ficha":"Bet one chip",
  "Abre la gabardina.":"He opens the coat.",
  "Seguir de largo":"Walk past",
  "No te fías, y haces bien.":"You don't trust him, and you're right.",
  "El truco de Weevil":"Weevil's trick",
  "Weevil sonríe demasiado. «Te dejo mirar mi caja de cartas. Total, tú no sabrías qué hacer con ellas.»":"Weevil is smiling too much. \"Go on, look in my card box. You wouldn't know what to do with them anyway.\"",
  "Mirar la caja":"Look in the box",
  "Coges tres cartas antes de que se arrepienta.":"You grab three cards before he changes his mind.",
  "Desconfiar":"Don't trust him",
  "Weevil se marcha refunfuñando. Habría sido una trampa.":"Weevil stomps off grumbling. It would have been a trap.",
  "Un baúl abandonado":"An abandoned trunk",
  "En la playa hay un baúl reventado, lleno de cartas mojadas. La mayoría no valen nada. La mayoría.":"There's a broken trunk on the beach, full of damp cards. Most of them are worthless. Most.",
  "Vaciarlo entero":"Empty it",
  "Cuarenta cartas a la mochila. Ya verás qué haces con ellas.":"Forty cards into the bag. You'll figure them out later.",
  "Dejarlo":"Leave it",
  "Pesa demasiado.":"Too heavy.",
  "Doble o nada":"Double or nothing",
  "«Dos fichas contra dos. Sin duelo, a una carta. La más alta gana.» Se le ve muy seguro.":"\"Two chips against two. No duel, one card each. Highest wins.\" He looks far too sure.",
  "Aceptar: dos fichas":"Accept: two chips",
  "Cortáis la baraja.":"You both cut the deck.",
  "No juegas a eso":"You don't play that game",
  "«Cobarde», dice. Te da igual.":"\"Coward,\" he says. You don't care.",
  "Mai se aburre":"Mai is bored",
  "«¿Sabes cuál es tu problema? Que juegas lo que te sale, no lo que necesitas. Toma, quédate esto y piénsalo.»":"\"You know your problem? You play what you draw, not what you need. Here, keep this and think about it.\"",
  "Quedarte la carta":"Keep the card",
  "Mai te lanza una carta sin mirarte.":"Mai tosses you a card without looking.",
  "Preguntarle por la isla":"Ask her about the island",
  "Te cuenta por dónde no ir. Ganas una ficha de las suyas.":"She tells you where not to go. You win one of her chips.",
  "Kaiba pasa de largo":"Kaiba walks past",
  "«¿Tú? ¿En el castillo?» Kaiba ni se para. «Toma. Con eso a lo mejor duras dos turnos contra Pegasus.»":"\"You? At the castle?\" Kaiba doesn't even stop. \"Here. That might buy you two turns against Pegasus.\"",
  "Aceptar la carta":"Take the card",
  "Te tira una carta y sigue andando.":"He throws you a card and keeps walking.",
  "«Guárdatela»":"\"Keep it\"",
  "Kaiba sonríe de lado. Por una vez, con respeto.":"Kaiba smirks. For once, with respect.",
  /* Los mazos iniciales y las familias de sobres viven en datos (en
     personajes.json y en recompensas.js) y están escritos en español,
     así que sus nombres y descripciones tienen que estar aquí o el modo
     entero sale medio en español con el juego en inglés. Lo reportó E. */
  "El Mago Oscuro":"Dark Magician",
  "Hechiceros y trampas clásicas. Skilled Dark Magician, Kycoo y Magician of Faith sostienen lo que el resto del mazo no.":
    "Spellcasters and classic traps. Skilled Dark Magician, Kycoo and Magician of Faith carry what the rest of the deck can't.",
  "Los guerreros del Rey":"The King's Warriors",
  "Guerreros y Magnet Warriors, con Reinforcement of the Army y dos fusiones temáticas.":
    "Warriors and Magnet Warriors, with Reinforcement of the Army and two themed fusions.",
  "El Soldado del Lustre Negro":"Black Luster Soldier",
  "Ritual y puente Luz-Oscuridad: buscadores, reclutadores y Chaos Sorcerer.":
    "Ritual and a LIGHT-DARK bridge: searchers, recruiters and Chaos Sorcerer.",
  "Artes arcanas":"Arcane Arts",
  "Lanzadores de conjuros, control por volteo y rituales":"Spellcasters, flip control and rituals",
  "Arsenal del guerrero":"Warrior Arsenal",
  "Guerreros, buscadores y presión de TIERRA":"Warriors, searchers and EARTH pressure",
  "El rugido del dragón":"Dragon's Roar",
  "Ojos Azules, Ojos Rojos y dragones grandes":"Blue-Eyes, Red-Eyes and big dragons",
  "Frente de reclutas":"Recruiter Front",
  "Agua, viento e insectos: cadenas de reclutadores":"Water, wind and insects: recruiter chains",
  "Tácticas prohibidas":"Forbidden Tactics",
  "Cabras, Metamorphosis, Caos y cementerio":"Goats, Metamorphosis, Chaos and graveyard",
  /* campamento */
  "+1000 puntos de vida en los próximos 3 duelos":"+1000 life points for the next 3 duels",
  "Recuperar una Star Chip perdida":"Recover a lost Star Chip",
  "No has perdido ninguna ficha todavía":"You haven't lost any chips yet",
  "Sacrificar una carta y elegir entre tres del escalón siguiente":
    "Sacrifice a card and choose from three of the next tier up",
  "Elige qué sacrificas":"Choose what you sacrifice",
  "Elige tu recompensa":"Choose your reward",
  "Guardar y salir":"Save and quit",
  "Partida guardada":"Run saved",
  "Continuar":"Continue",
  "Aventura a medias":"Run in progress",
  "Se te ha cobrado":"You paid",
  "cartas":"cards",
  "Reino de los Duelistas":"Duelist Kingdom",
  "Duelo libre":"Free duel",
  "Retos: gana a los 20 mazos":"Challenges: beat all 20 decks",
  /* ── los avatares que tienen nombre en español ── */
  "Contraseña del modo depuración":"Debug mode password",
  "Continuar (responde el juego por mí)":"Continue (the game answers for me)",
  "No se ha podido continuar: manda el log, por favor":"Couldn't continue: please send the log",
  "Forzando avance…":"Forcing the game forward…",
  "Resolviendo la jugada…":"Resolving the play…",
  "tuyo":"yours",
  "Tus datos":"Your data", "Guardar copia":"Save backup", "Cargar copia":"Load backup",
  "Tus mazos, tu progreso en el Reino y tus torneos se guardan en este navegador, en este dispositivo. Guarda una copia de vez en cuando: si borras los datos del navegador se pierden, y con la copia también puedes pasarlo todo a otro navegador o al móvil.":
    "Your decks, your Kingdom progress and your tournaments are saved in this browser, on this device. Save a backup now and then: they are lost if you clear the browser's data, and the backup also lets you move everything to another browser or to your phone.",
  "Ese archivo no es una copia del juego.":"That file isn't a backup of the game.",
  "¿Cargar la copia? Sustituye tus mazos, tu progreso y tus torneos de este navegador por los del archivo.":
    "Load the backup? It replaces the decks, progress and tournaments in this browser with the ones in the file.",
  "No se ha podido cargar la copia: el navegador no deja guardar.":"Couldn't load the backup: the browser won't let the game save.",
  "Intercambio de monstruos":"Monsters swap control",
  "¿Salir? La sala se cierra.":"Leave? The room will close.",
  "Importar .ydk":"Import .ydk", "Pegar lista":"Paste list", "Exportar .ydk":"Export .ydk", "Vaciar":"Clear",
  "Pool provisional: se muestran todas las cartas de la base de datos. Falta la lista oficial de Goat para restringirlo — mira el README.":
    "Provisional pool: every card in the database is shown. The official Goat list is missing to restrict it — see the README.",
  "Lumis y Umbra":"Lumis and Umbra", "Faraón Atem":"Pharaoh Atem", "Téa Gardner":"Téa Gardner",
  /* ── reportar en GitHub ── */
  "Reportar":"Report",
  "Reportar un fallo o una jugada rara de la IA en GitHub":"Report a bug or an odd AI play on GitHub",
  "Fallo del juego":"Game bug", "Jugada rara de la IA":"Odd AI play",
  "Se descarga el log de este duelo y se abre GitHub con el reporte casi relleno. Arrastra el log al recuadro «Log» y envíalo. Hace falta una cuenta de GitHub (gratis).":
    "The log of this duel is downloaded and GitHub opens with the report almost filled in. Drag the log into the \"Log\" box and submit it. You need a GitHub account (free).",
  "Arrastra el log descargado al recuadro «Log» del formulario":"Drag the downloaded log into the form's \"Log\" box",
  /* ── jugar con un amigo (salas) ── */
  "Jugar con un amigo":"Play with a friend",
  "Crea una sala y pásale el código a tu amigo, o entra en la suya. Cada uno juega desde su navegador, en el PC o en el móvil.":
    "Create a room and send the code to your friend, or join theirs. Each of you plays from your own browser, on PC or phone.",
  "Tu nombre":"Your name", "Crear sala":"Create room", "o entra en la de tu amigo":"or join your friend's",
  "Código":"Code", "Unirme":"Join", "Código de la sala":"Room code",
  "Copiar código":"Copy code", "Copiar enlace":"Copy link", "Código copiado":"Code copied", "Enlace copiado":"Link copied",
  "Gratis y sin cuentas: los dos navegadores se conectan directamente. Quien crea la sala ejecuta el duelo, así que su pestaña tiene que seguir abierta.":
    "Free and no accounts: the two browsers connect directly. Whoever creates the room runs the duel, so their tab has to stay open.",
  "Abriendo la sala…":"Opening the room…", "Buscando la sala…":"Looking for the room…",
  "Pásale el código a tu amigo: lo escribe en «Jugar con un amigo» → «Unirme». Esperando a que entre…":
    "Send the code to your friend: they type it in \"Play with a friend\" → \"Join\". Waiting for them to come in…",
  "La sala se cierra si sales de esta pantalla o cierras la pestaña.":"The room closes if you leave this screen or close the tab.",
  "Cerrar la sala":"Close the room", "Salir de la sala":"Leave the room",
  "Anfitrión":"Host", "Invitado":"Guest", "Amigo":"Friend",
  "Empezar el duelo":"Start the duel", "Revancha":"Rematch",
  "Empieza quien perdió el último duelo.":"Whoever lost the last duel goes first.",
  "Esperando a que el anfitrión empiece el duelo…":"Waiting for the host to start the duel…",
  "Conexión perdida. Reconectando…":"Connection lost. Reconnecting…", "Conexión recuperada":"Connection restored",
  "¿Salir de la sala? Tu amigo verá que te has ido.":"Leave the room? Your friend will see that you left.",
  "El anfitrión ha cerrado la sala.":"The host has closed the room.", "La sala se ha cerrado.":"The room has closed.",
  "Se ha perdido la conexión con la sala":"The connection to the room was lost",
  "Se ha perdido la conexión con la sala.":"The connection to the room was lost.",
  "Tu amigo ha vuelto":"Your friend is back", "Tu amigo se ha desconectado":"Your friend disconnected",
  "Tu amigo se ha rendido":"Your friend conceded", "DUELO INTERRUMPIDO":"DUEL INTERRUPTED",
  "Esa sala ya tiene dos jugadores.":"That room already has two players.",
  "Ese código de sala ya está en uso.":"That room code is already in use.",
  "Este navegador no permite conexiones directas (WebRTC). Prueba con Chrome, Firefox, Edge o Safari actualizados.":
    "This browser doesn't allow direct connections (WebRTC). Try an up-to-date Chrome, Firefox, Edge or Safari.",
  "La sala no responde. Comprobad los dos la conexión y volved a intentarlo.":
    "The room isn't responding. Both of you check your connection and try again.",
  "No hay ninguna sala con ese código. ¿Está bien escrito y tu amigo sigue en la pantalla de la sala?":
    "There's no room with that code. Is it typed correctly, and is your friend still on the room screen?",
  "No se ha podido conectar directamente con tu amigo. Pasa en algunas redes muy cerradas (wifi de empresa o de universidad): probad con otra red, por ejemplo los datos del móvil.":
    "Couldn't connect directly to your friend. This happens on some very locked-down networks (office or university wifi): try another network, for example mobile data.",
  "No se puede contactar con el servidor de salas. Revisa la conexión a internet.":
    "Can't reach the room server. Check your internet connection.",
  "El mazo no se ha podido leer.":"The deck couldn't be read.",
  "Tu amigo ha salido de la sala":"Your friend left the room",
  "Los dos podéis jugar con los mazos de quien crea la sala: los suyos del deck builder y los predefinidos. Si entras en la sala de tu amigo, eliges dentro y también puedes usar los tuyos.":
    "You can both play with the decks of whoever creates the room: their own from the deck builder and the preset ones. If you join your friend's room, you pick inside, and you can use your own decks too.",
  "Tu amigo elegirá su mazo entre los tuyos, los predefinidos y los suyos propios.":"Your friend will pick their deck from yours, the preset ones and their own.",
  "Los dos podéis jugar con los mazos del anfitrión: los suyos y los predefinidos. Tú, además, con los tuyos del deck builder.":
    "You can both play with the host's decks: their own and the preset ones. You can also use your own from the deck builder.",
  "Mazo de tu amigo":"Your friend's deck",
  "Tus mazos":"Your decks", "Mazos del anfitrión":"Host's decks", "Predefinidos":"Preset decks",
  "Se ha cortado la conexión con tu amigo. Esperando a que vuelva…":"The connection to your friend dropped. Waiting for them to come back…",
  "Se ha cortado la conexión. Reconectando…":"The connection dropped. Reconnecting…",
  /* el match y el reloj de la sala */
  "Formato":"Format", "Al mejor de tres":"Best of three", "Duelos sueltos":"Single duels",
  "Tiempo por decisión":"Time per decision", "Sin límite":"No limit", "por decisión":"per decision",
  "Sin límite de tiempo":"No time limit",
  "¡Has ganado el match!":"You won the match!", "Tu amigo ha ganado el match.":"Your friend won the match.",
  "empiezas tú: perdiste la anterior":"you go first: you lost the last game",
  "empieza tu amigo: perdió la anterior":"your friend goes first: they lost the last game",
  "Nuevo match":"New match", "Empezar la partida":"Start game",
  "Tu amigo está listo.":"Your friend is ready.", "Tu amigo está con su side deck…":"Your friend is siding…",
  "Estoy listo":"I'm ready",
  "Esperando a que el anfitrión empiece otro match…":"Waiting for the host to start another match…",
  "Listo. Esperando a que el anfitrión empiece la partida…":"Ready. Waiting for the host to start the game…",
  "Tu amigo":"Your friend",
  "Tiempo agotado: contesta el juego por ti":"Time's up: the game answers for you",
  "Se te ha acabado el tiempo tres veces seguidas":"You ran out of time three times in a row",
  "A tu amigo se le ha acabado el tiempo tres veces seguidas":"Your friend ran out of time three times in a row",
  "Tenéis versiones distintas del simulador: actualizad los dos la página.":
    "You're on different versions of the simulator: both of you reload the page.",
  /* ── torneo suizo ── */
  "Torneo suizo · Bo3":"Swiss tournament · Bo3",
  "Torneo suizo":"Swiss tournament",
  "32 jugadores · 5 rondas suizas al mejor de tres · top 16 eliminatorio":"32 players · 5 Swiss rounds, best of three · top 16 single elimination",
  "Tu nombre en el torneo":"Your name in the tournament",
  "El mazo que registras es el de todo el torneo: entre partidas solo puedes mover cartas entre el main y el side.":
    "The deck you register is your deck for the whole tournament: between games you can only move cards between the main and the side.",
  "Inscribirme":"Register",
  "Octavos":"Round of 16", "Cuartos":"Quarterfinals", "Semifinal":"Semifinals", "Final":"Final",
  "Récord":"Record", "Suizo":"Swiss", "Puntos":"Points", "Puesto":"Place", "Mesa":"Table", "Mesas":"Tables",
  "Has ganado":"You won", "Has perdido":"You lost",
  "Te has retirado: el torneo sigue sin ti.":"You dropped: the tournament goes on without you.",
  "Estás fuera del cuadro: el resto del torneo se juega solo.":"You're out of the bracket: the rest of the tournament plays itself.",
  "Ver el corte":"See the cut", "Siguiente ronda":"Next round", "Simular hasta el final":"Simulate to the end",
  "Clasificación":"Standings", "Clasificación final del suizo":"Final Swiss standings",
  "Retirarme del torneo":"Drop from the tournament", "Empezar otro torneo":"Start another tournament",
  "El rival ha cambiado":"Your opponent sided in",
  "Empieza el rival: perdió la anterior.":"Your opponent goes first: they lost the last game.",
  "Abandonar el match":"Concede the match",
  "¿Abandonar el match? Cuenta como derrota.":"Concede the match? It counts as a loss.",
  "Jugador":"Player", "V-D":"W-L", "Pts":"Pts",
  "Porcentaje de victorias de tus rivales":"Your opponents' match-win percentage",
  "Porcentaje de partidas ganadas":"Game-win percentage",
  "Desempates: puntos, porcentaje de victorias de los rivales (OMW) y porcentaje de partidas ganadas (GW). Los 16 primeros pasan al cuadro.":
    "Tiebreakers: points, opponents' match-win percentage (OMW) and game-win percentage (GW). The top 16 make the bracket.",
  "Tus matches":"Your matches",
  "Campeón":"Champion", "¡Has ganado el torneo!":"You won the tournament!", "Tu puesto":"Your place",
  "retirado":"dropped", "Mazos del top 16":"Top 16 decks", "Nuevo torneo":"New tournament",
  "¿Retirarte del torneo? Las rondas que te queden cuentan como derrotas y el torneo sigue sin ti.":
    "Drop from the tournament? Your remaining rounds count as losses and the tournament goes on without you.",
  "¿Dejar este torneo y empezar otro? El que está a medias se pierde.":
    "Leave this tournament and start another? The one in progress will be lost.",
  /* ── torneo meta (Bo3) ── */
  "Torneo meta · Bo3":"Meta tournament · Bo3",
  "Torneo meta":"Meta tournament",
  "Al mejor de tres contra la IA en experto. Empieza la partida siguiente quien pierde la anterior.":"Best of three against the AI on expert. The loser of each game goes first in the next one.",
  "Mazo de la IA":"AI deck",
  "Empezar ronda":"Start round",
  "Historial":"History",
  "Descargar resumen":"Download summary",
  "Borrar historial":"Clear history",
  "Empezar torneo de cero":"Start a fresh tournament",
  "Torneo":"Tournament",
  "¿Empezar un torneo nuevo? La ronda a medias queda como abandonada. No se borra nada.":"Start a fresh tournament? The round in progress will be recorded as dropped. Nothing is deleted.",
  "¿Empezar un torneo nuevo? El marcador vuelve a cero y lo jugado se queda en el historial.":"Start a fresh tournament? The score goes back to zero and everything played stays in the history.",
  "Matches":"Matches",
  "Partidas":"Games",
  "empezando":"on the play",
  "robando":"on the draw",
  "Ronda":"Round",
  "gano":"win",
  "pierdo":"loss",
  "Tus mazos del Deck Builder salen al final, con «(tuyo)».":"Your Deck Builder decks are at the end, marked «(yours)».",
  "¿No está?":"Not there?",
  "Importar .ydk":"Import .ydk",
  "Ese archivo no es un mazo válido: el main deck tiene que tener al menos 40 cartas.":"That file isn't a valid deck: the main deck needs at least 40 cards.",
  "cartas no son del formato Goat":"cards aren't in the Goat format",
  "cartas no son del formato Goat y se han quitado.":"cards aren't in the Goat format and were removed.",
  "Cartas del rival":"Opponent's cards",
  "Mirando hacia ti":"Looking at you",
  "Mirando hacia el rival":"Looking at the opponent",
  "Mágica":"Spell", "Trampa":"Trap",
  "Añadir a la mano":"Add to hand", "Mandar al Cementerio":"Send to the Graveyard",
  "Descartar 1 Mágica":"Discard 1 Spell", "No descartar":"Don't discard",
  "Ganada":"Won",
  "Perdida":"Lost",
  "Partida":"Game",
  "Partida 1: se sortea quién empieza.":"Game 1: a coin toss decides who goes first.",
  "Empiezas tú: perdiste la anterior.":"You go first: you lost the last game.",
  "Empieza la IA: perdió la anterior.":"The AI goes first: it lost the last game.",
  "Notas de esta ronda: jugadas raras de la IA, turnos, cartas…":"Notes for this round: odd AI plays, turns, cards…",
  "Notas del match: qué hizo raro la IA, en qué turno, con qué cartas…":"Match notes: what the AI did wrong, on which turn, with which cards…",
  "Descargar match (notas + log)":"Download match (notes + log)",
  "Se descarga con el registro de":"Includes the full log of",
  "partidas":"games",
  "Falta el registro de alguna partida: se jugó con una versión anterior o se borraron los datos del navegador.":"Some game logs are missing: they were played with an older version or the browser data was cleared.",
  "registro":"log",
  "lo que se vio en la mesa":"what was visible on the table",
  "(el registro de estas partidas no se guardó)":"(the logs of these games were not saved)",
  "(el registro de esta partida no se guardó)":"(this game's log was not saved)",
  "Jugar partida":"Play game",
  "Abandonar ronda":"Drop round",
  "¿Abandonar la ronda? Queda apuntada como abandonada.":"Drop this round? It will be recorded as dropped.",
  "Todavía no hay rondas terminadas.":"No finished rounds yet.",
  "empiezo yo":"I go first",
  "empieza la IA":"AI goes first",
  "victoria":"win",
  "derrota":"loss",
  "abandonada":"dropped",
  "abandonados":"dropped",
  "en juego":"in progress",
  "turnos":"turns",
  "Notas":"Notes",
  "Señala":"Targets",
  "una carta tuya tapada":"one of your set cards",
  "¿Borrar todo el historial del torneo? No se puede deshacer.":"Clear the whole tournament history? This can't be undone.",
  "Uno de los dos mazos ya no existe. Abandona la ronda y empieza otra.":"One of the two decks no longer exists. Drop the round and start another.",
  "Retos":"Challenges",
  "Llega al castillo con diez Star Chips y gana a Pegasus. Cada duelo que ganas te da una carta; cada uno que pierdes te cuesta una ficha. A cero fichas, se acabó.":
    "Reach the castle with ten Star Chips and beat Pegasus. Every duel you win gives you a card; every one you lose costs you a chip. At zero chips, the run is over.",
  "Continuar la partida":"Continue run",
  "Elige con qué empiezas":"Choose your starting deck",
  "Semilla (opcional)":"Seed (optional)",
  "Empezar la aventura":"Start the run",
  "Copiar la semilla":"Copy the seed",
  "Semilla copiada":"Seed copied",
  "clasificado":"qualified",
  "Mazo y binder":"Deck and binder",
  "Binder":"Binder",
  "Tu mazo":"Your deck",
  "Monstruos":"Monsters", "Mágicas":"Spells", "Trampas":"Traps",
  "Editar el mazo":"Edit deck",
  "Extra Deck":"Extra Deck", "Fusiones":"Fusions",
  "Todavía no has ganado ninguna carta.":"You haven't won any cards yet.",
  "Pasa el ratón por una carta para ver su texto":"Hover a card to read it",
  "MONSTRUO":"MONSTER", "MAGICA":"SPELL", "TRAMPA":"TRAP",
  "Nivel":"Level", "Continuar":"Continue",
  "Le das":"You give", "cartas":"cards",
  "Salir":"Quit",
  "Se acabó el camino.":"The road ends here.",
  "Ver el resultado":"See the result",
  "Duelo":"Duel",
  "Duelista de élite":"Elite duelist",
  /* La chapa del nodo del mapa. Se escapó de las dos comprobaciones: es
     una palabra de cuatro letras, en mayúsculas, sin acentos y sin
     artículos, así que el cazador de español no la vio. De ahí que
     `check-ingles` mire ahora TODAS las llamadas a T() del bundle. */
  "JEFE":"BOSS",
  /* ── el contador de uso, en Opciones ── */
  "Estadísticas de uso":"Usage stats",
  "Enviar":"Send", "No enviar":"Don't send",
  "Sin cookies y sin datos personales: solo cuántas partidas se juegan y hasta dónde llegan, para poder ajustar la dificultad. Nunca viaja tu mazo, tu progreso ni tu semilla.":
    "No cookies, no personal data: just how many games are played and how far they get, so the difficulty can be tuned. Your deck, your progress and your seed never leave your browser.",
  /* Trozos que se pegan con un número al lado. Salen del cazador
     estático de `check-ingles`, que mira las llamadas a T() del código
     en vez de lo que acaba en pantalla. */
  "y":"and",
  "Turno":"Turn",
  "Jefe":"Boss",
  "Sobre de cartas":"Card pack",
  "Mercader":"Merchant",
  "Campamento":"Camp",
  "Encuentro":"Encounter",
  "En juego":"At stake",
  "ganas":"win",
  "pierdes":"lose",
  "Empiezas con":"You start with",
  "Arreglar el mazo":"Fix the deck",
  "¡Duelo!":"Duel!",
  "← Volver al mapa":"← Back to the map",
  "Seguir sin usarlo":"Move on without using it",
  "Elige un sobre":"Choose a pack",
  "Diez cartas, todas tuyas":"Ten cards, all yours",
  "Al binder":"To the binder",
  "El mercader":"The merchant",
  "Aquí no hay dinero: se paga con cartas del binder.":"No money here: you pay with cards from your binder.",
  "10 cartas de relleno → una carta buena":"10 filler cards → one good card",
  "15 de la misma clase → una buena de esa clase":"15 of the same kind → a good one of that kind",
  "20 cartas de relleno → una carta muy buena":"20 filler cards → one very good card",
  "2 muy buenas + 2 buenas → una carta de las gordas":"2 very good + 2 good → one of the big ones",
  "2 de la misma rareza → otra de esa rareza":"2 of the same rarity → another of that rarity",
  "Cambiar":"Trade",
  "Ver el cambio":"See the trade",
  "Ver otro cambio":"See another trade",
  "El cambio":"The trade",
  "Le das":"You give",
  "Y eliges una de estas:":"And you pick one of these:",
  "Elige tu carta":"Choose your card",
  "Cambio hecho":"Trade done",
  "Elige una sola cosa.":"Pick one thing only.",
  "Elige una carta":"Choose a card",
  "Star Chips":"Star Chips",
  "Mazo":"Deck",
  "Toca una carta para leerla":"Tap a card to read it",
  /* Deck builder con el dedo */
  "Toca una carta para ver su texto.":"Tap a card to read it.",
  "Arrastra una carta del buscador al mazo, y del mazo al buscador para quitarla. Un toque abre su ficha.":
    "Drag a card from the browser into your deck, and from the deck back to the browser to remove it. A tap opens its sheet.",
  "Quitar del mazo":"Remove from deck",
  "Añadir al mazo":"Add to deck",
  "Añadir al Side":"Add to Side",
  "Ya llevas el máximo de copias":"You already have the maximum copies",
  "Toca una carta para verla aquí, y toca este panel para leerla entera.":
    "Tap a card to see it here, then tap this panel to read the whole thing.",
  "En Main Phase, arrastra una carta de tu mano al tablero para jugarla. Mantén pulsada cualquier carta para verla grande.":
    "In Main Phase, drag a card from your hand onto the field to play it. Press and hold any card to see it full size.",
  "Toca para leerla":"Tap to read",
  "Elegir esta carta":"Take this card",
  "Quitar de la selección":"Remove from selection",
  "Elige":"Choose", "carta(s)":"card(s)", "elegida(s)":"selected",
  /* Portada y careo */
  "Torneo de":"Tournament of",
  /* Exportar e importar el progreso */
  "Tu progreso":
    "Your progress",
  "Exportar progreso":
    "Export progress",
  "Importar progreso":
    "Import progress",
  "Progreso descargado":
    "Progress downloaded",
  "Progreso importado":
    "Progress imported",
  "con partida a medias":
    "with a run in progress",
  "No hay nada que exportar todavía":
    "There's nothing to export yet",
  "No se pudo leer el archivo":
    "Couldn't read the file",
  "No se pudo descargar":"Download failed",
  /* ── asomarse a un sobre antes de abrirlo ── */
  "Pasa el ratón por un sobre para ver qué lleva dentro.":
    "Hover a pack to see what's inside.",
  "Toca «Ver qué sale» para leer el sobre antes de abrirlo.":
    "Tap \"See what's inside\" to read a pack before opening it.",
  "Ver qué sale":"See what's inside",
  "Ver la guía completa de sobres":"Open the full pack guide",
  "Qué sale en cada sobre":"What's in each pack",
  "Cerrar":"Close",
  /* la lupa del panel de carta */
  "Pulsa aquí para verla en grande":"Click here to enlarge",
  "Toca aquí para verla en grande":"Tap here to enlarge",
  "no tienes las cartas que pide":"you don't have the cards it asks for",
  "necesitas dos cartas de la misma rareza":"you need two cards of the same rarity",
  "ya la has usado en esta visita":"you already used this one on this visit",
  "Un archivo con tu maestría, lo desbloqueado y la partida a medias. Sirve para llevarlo a otro navegador o a otro móvil.":
    "A file with your mastery, your unlocks and any run in progress. Use it to move everything to another browser or phone.",
  "El archivo no es JSON válido":
    "That file isn't valid JSON",
  "El archivo no tiene lo que hace falta":
    "That file doesn't have what's needed",
  "Ese guardado es de una versión más nueva del juego":
    "That save is from a newer version of the game",
  "El archivo no lleva ni progreso ni partida":
    "The file has neither progress nor a run",
  "El progreso del archivo está corrupto":
    "The progress in that file is corrupt",
  "La partida guardada del archivo no se puede leer":
    "The saved run in that file can't be read",
  "Abandonar":
    "Give up run",
  "¿Seguro? Se pierde esta aventura. Pulsa otra vez para confirmar.":
    "Are you sure? You'll lose this run. Press again to confirm.",
  "Arrastra una carta de un lado al otro. Mantén el ratón encima para leerla.":
    "Drag a card from one side to the other. Hover a card to read it.",
  "Todavía no tienes cartas de Extra Deck.":
    "No Extra Deck cards yet.",
  "Mazo":
    "Deck",
  /* Maestría y ventajas */
  "Maestría":
    "Mastery",
  "Sin maestría":
    "No mastery yet",
  "Al ganar a Pegasus":
    "Beat Pegasus to unlock",
  "Gana el torneo con este duelista para desbloquear su primera ventaja.":
    "Win the tournament with this duelist to unlock their first perk.",
  "Elige una ventaja":
    "Choose a perk",
  "Elige tu carta":
    "Choose your card",
  "Elige la familia del sobre":
    "Choose the pack family",
  "Empezarás con":
    "You'll start with",
  "La carta del maestro":
    "The master's card",
  "Antes de empezar, elige una de diez cartas de tu especialidad y añádela al mazo.":
    "Before you start, pick one of ten cards from your specialty and add it to your deck.",
  "Contactos en la isla":
    "Contacts on the island",
  "Empiezas la aventura con un sobre de la familia que elijas, ya abierto.":
    "You start the run with a pack of your chosen family, already opened.",
  "Mano firme":
    "Steady hand",
  "Las tres recompensas de cada duelo suben un escalón de rareza.":
    "All three duel rewards go up one rarity step.",
  /* Los doce mazos de salida nuevos (Joey, Mai, Keith, Kaiba) */
  "El Dragón Negro de Ojos Rojos":
    "The Red-Eyes Black Dragon",
  "El mazo del anime: Red-Eyes, Baby Dragon, Time Wizard y la fusión de Flame Swordsman.":
    "The anime deck: Red-Eyes, Baby Dragon, Time Wizard and the Flame Swordsman fusion.",
  "La brigada de guerreros":
    "The warrior brigade",
  "Guerreros de pelea limpia: Gearfried, Goblin Attack Force y Marauding Captain.":
    "Straight-up warriors: Gearfried, Goblin Attack Force and Marauding Captain.",
  "Criador de dragones":
    "Dragon breeder",
  "Baby Dragon y Time Wizard buscando al Ojos Rojos, con dragones que ya pegan.":
    "Baby Dragon and Time Wizard hunting for Red-Eyes, with dragons that already hit.",
  "Las Damas Arpía":
    "The Harpie Ladies",
  "Harpie Lady y sus hermanas, con Elegant Egotist y el Campo de Caza.":
    "Harpie Lady and her sisters, with Elegant Egotist and the Hunting Ground.",
  "La mascota de las arpías":
    "The harpies' pet",
  "Harpie's Pet Dragon y dragones grandes sostenidos por el Campo de Caza.":
    "Harpie's Pet Dragon and big dragons held up by the Hunting Ground.",
  "Vuelo rasante":
    "Low flight",
  "Viento y velocidad: arpías, Amazonas y Kamakiri para no parar de atacar.":
    "Wind and speed: harpies, Amazoness and Kamakiri that never stop attacking.",
  "El Dragón de Cañones":
    "The Barrel Dragon",
  "Barrel Dragon, Mechanicalchaser y un Limiter Removal esperando su momento.":
    "Barrel Dragon, Mechanicalchaser and one Limiter Removal waiting for its moment.",
  "Chatarra pesada":
    "Heavy scrap",
  "Máquinas baratas y dos Limiter Removal: todo o nada en un solo turno.":
    "Cheap machines and two Limiter Removals: all or nothing in a single turn.",
  "La máquina tragaperras":
    "The slot machine",
  "Slot Machine y Barrel Dragon: monstruos grandes y una moneda que decide.":
    "Slot Machine and Barrel Dragon: big monsters and a coin that decides.",
  "Los Ojos Azules":
    "The Blue-Eyes",
  "Blue-Eyes con Lord of D. y la Flauta para sacarlos sin sacrificar.":
    "Blue-Eyes with Lord of D. and the Flute to bring them out without tributing.",
  "Rugido de dragón blanco":
    "White dragon's roar",
  "Tres Ojos Azules y Kaibaman: el dragón sale sí o sí.":
    "Three Blue-Eyes and Kaibaman: the dragon comes out no matter what.",
  "La guardia de KaibaCorp":
    "The KaibaCorp guard",
  "Battle Ox, La Jinn y compañía: cuerpos grandes desde el primer turno.":
    "Battle Ox, La Jinn and friends: big bodies from turn one.",
  "Algo falló al resolver el encuentro":
    "Something went wrong resolving the encounter",
  /* Torre del castillo y personajes jugables */
  "Elige duelista":"Choose your duelist",
  "El castillo de Pegasus":"Pegasus Castle",
  "Peldaño":"Step",
  "El dueño de la isla":"The owner of the island",
  "DERROTADO":"DEFEATED",
  "COMPLETO":"COMPLETE",
  "AQUÍ":"YOU ARE HERE",
  "CERRADO":"LOCKED",
  "TE ESPERA":"UP NEXT",
  "buscar por nombre…":"search by name…", "Filtrar":"Filter",
  "Todo":"All", "Todos":"All", "Monstruos":"Monsters", "Mágicas":"Spells", "Trampas":"Traps",
  "Quitar filtros":"Clear filters", "Ninguna carta pasa el filtro.":"No card matches the filter.",
  "Tipo de monstruo":"Monster type", "Atributo":"Attribute",
  "Vaciar mazo":"Empty deck", "¿Seguro?":"Are you sure?",
  "cartas vuelven al binder y el mazo se queda vacío.":"cards go back to the binder and the deck is left empty.",
  "Sí, vaciar el mazo":"Yes, empty the deck", "cartas vuelven al binder":"cards went back to the binder",
  "Nivel 1-4":"Level 1-4", "Tributo 5+":"Tribute 5+", "Normal":"Normal", "Efecto":"Effect",
  "Volteo":"Flip", "Ritual":"Ritual", "Fusión":"Fusion",
  "Invocación especial":"Special Summon", "Rápida":"Quick-Play", "Continua":"Continuous",
  "Equipo":"Equip", "Campo":"Field", "Contador":"Counter",
  "Historial del duelista":"Duelist record",
  "Todavía no hay nada que contar.":"Nothing to show yet.",
  "Aventuras":"Runs",
  "Empezadas":"Started", "Completadas":"Completed", "Perdidas":"Lost",
  "Abandonadas":"Surrendered",
  "Porcentaje de torneos ganados":"Tournament win rate",
  "Duelos":"Duels", "Jugados":"Played", "Ganados":"Won", "Perdidos":"Lost",
  "Porcentaje de victorias":"Win rate",
  "Star Chips ganadas":"Star Chips won",
  "Sobres abiertos":"Packs opened", "Encuentros resueltos":"Events resolved",
  "Cartas jugadas":"Cards played", "Total":"Total", "Monstruos":"Monsters",
  "Mágicas":"Spells", "Trampas":"Traps",
  "Por duelista":"Per duelist", "torneos":"tournaments", "en duelos":"in duels",
  "maestría":"mastery", "de":"of",
  "Torneos ganados con cada ventaja":"Tournaments won with each perk",
  "Logros":"Achievements", "Volver":"Back",
  "carta-de-maestro":"Master card", "primer-sobre":"Island contacts",
  "mano-firme":"Steady hand",
  "Campeón del Reino":"Kingdom champion",
  "Gana el torneo por primera vez.":"Win the tournament for the first time.",
  "Los cinco duelistas":"All five duelists",
  "Gana el torneo con los cinco protagonistas.":"Win the tournament with all five main duelists.",
  "Nadie sabe quién eres":"Nobody knows who you are",
  "Gana el torneo con el Duelista libre.":"Win the tournament with the Custom Duelist.",
  "Maestría completa":"Full mastery",
  "Desbloquea las tres ventajas de un duelista.":"Unlock all three perks for one duelist.",
  "De las tres maneras":"All three ways",
  "Gana el torneo una vez con cada una de las tres ventajas.":"Win the tournament once with each of the three perks.",
  "Veterano de la isla":"Island veteran",
  "Juega cien duelos en el modo historia.":"Play a hundred duels in story mode.",
  "Coleccionista":"Collector",
  "Abre cincuenta sobres.":"Open fifty packs.",
  "Sin una sola derrota":"Flawless",
  "Gana el torneo sin perder ni un duelo.":"Win the tournament without losing a single duel.",
  "Sobres":"Packs",
  "Qué cartas puede dar cada sobre":"What each pack can give you",
  "Qué hay en cada sobre":"What's in each pack",
  "Cada sobre da diez cartas: dos de poder genérico, una de tu tipo de monstruo, dos de la familia elegida, tres jugables, una de otra estrategia y una premium.":"Every pack gives ten cards: two generic power, one of your monster type, two from the family you pick, three playables, one from another strategy and one premium.",
  "Buscar una carta":"Search for a card",
  "nombre de la carta…":"card name…",
  "Buscar":"Search",
  "Nada que se parece a":"Nothing like",
  "Nada que se parezca a":"Nothing like",
  "cualquier sobre":"any pack",
  "casilla":"slot",
  "no sale en ningún sobre: solo en recompensas de duelo o en el mercader":"not in any pack: only from duel rewards or the trader",
  "Los cinco sobres":"The five packs",
  "Cartas de la familia":"Family cards",
  "Las dos casillas temáticas del sobre salen de aquí.":"The pack's two themed slots come from here.",
  "Puede caer por rareza":"Can drop by rarity",
  "Las dos primeras casillas de CUALQUIER sobre tiran de las listas de rareza.":"The first two slots of ANY pack pull from the rarity lists.",
  "Premium":"Premium",
  "La décima casilla: fusiones y cartas de remate.":"The tenth slot: fusions and finishers.",
  "más":"more",
  "Elige tu cara":"Pick your face",
  "Elige la cara de tu duelista antes de empezar":"Pick your duelist's face before you start",
  "Duelista libre":"Custom Duelist",
  "Nadie sabe quién eres. Todavía.":"Nobody knows who you are. Yet.",
  "Duelistas que quedan en la isla":"Duelists remaining on the island",
  "Última oportunidad para las Star Chips":"Last chance for Star Chips",
  "El torneo no ha terminado. Puedes retarlos las veces que haga falta: cada victoria te acerca a las diez, cada derrota te cuesta una ficha.":"The tournament is not over. Challenge them as many times as you need: every win brings you closer to ten, every loss costs you a chip.",
  "Duelista":"Duelist",
  "ahora tienes":"you now have",
  "Has ganado la apuesta":"You won the bet",
  "Has perdido la apuesta":"You lost the bet",
  "Tu próxima recompensa será de mejor calidad":"Your next reward will be better quality",
  "carta al binder":"card to the binder",
  "cartas al binder":"cards to the binder",
  "más en el binder":"more in the binder",
  "Elige tu carta de maestro antes de empezar":"Pick your master card before you start",
  "Elige la familia del sobre antes de empezar":"Pick the pack family before you start",
  "Preparación":"Preparation",
  "Preparación del castillo":"Castle preparation",
  "Antes de subir el siguiente peldaño puedes hacer una cosa. Solo una.":
    "Before you climb the next step you can do one thing. Just one.",
  "Abrir un sobre":"Open a pack",
  "Diez cartas de la familia que elijas":"Ten cards from the family you pick",
  "Ir al mercader":"Visit the trader",
  "Cambiar cartas que no usas por una que sí":"Trade cards you don't use for one you will",
  "Acampar":"Make camp",
  "Puntos de vida extra, recuperar una ficha o refinar":
    "Extra life points, recover a chip or refine a card",
  "Un último sobre antes del jefe":"One last pack before the boss",
  "Prepárate: sobre, mercader o campamento":"Get ready: pack, trader or camp",
  /* Ficha de carta */
  "En el mazo":"In deck", "En el binder":"In binder", "Máximo":"Max",
  "Extra":"Extra",
  "Añadir al mazo":"Add to deck",
  "TIERRA":"EARTH","AGUA":"WATER","FUEGO":"FIRE","VIENTO":"WIND",
  "LUZ":"LIGHT","OSCURIDAD":"DARK","DIVINO":"DIVINE",
  "Arrastra una carta de un lado al otro. Mantén el dedo encima para leerla.":
    "Drag a card from one side to the other. Press and hold a card to read it.",
  "Tu mazo está vacío.":"Your deck is empty.",
  "Juega a pantalla completa":"Play fullscreen",
  "En el móvil, la barra del navegador se come un tercio del tablero. A pantalla completa se ve todo y no se descoloca nada.":
    "On a phone the browser bar eats a third of the field. Fullscreen shows everything and nothing shifts around.",
  "A pantalla completa":"Go fullscreen",
  "Así está bien":"It's fine like this",
  "Ganar sin jugar (pruebas)":"Win without playing (testing)",
  "Perder sin jugar (pruebas)":"Lose without playing (testing)",
  "Te esperan en la isla":"Waiting for you on the island",
  "En juego":"At stake",
  "Si ganas":"If you win",
  "Si pierdes":"If you lose",
  "Su mazo":"Their deck",
  "de aficionado":"amateur stuff",
  "de torneo":"tournament grade",
  "afilado":"razor sharp",
  "Al jefe hay que ganarle para pasar de acto. Vuelve a entrar.":
    "You have to beat the boss to move on. Go back in.",

  /* ── LOS DUELISTAS ──
     Los nombres propios no se traducen (Weevil es Weevil en los dos
     idiomas), pero SÍ los títulos de jefe y las frases: son lo que le
     da carácter al careo antes del duelo, y en español dentro de una
     partida en inglés cantan más que cualquier botón. */
  "Hermanos Paradoja":"Paradox Brothers",
  "Los guardianes de la puerta":"The Gatekeepers",
  "El campeón americano":"The American Champion",
  "Los insectos siempre ganan. Solo hay que esperar.":
    "Insects always win. You just have to wait.",
  "Mis dinosaurios no saben retroceder.":
    "My dinosaurs don't know how to back down.",
  "El mar me lo dio todo. Y a ti no te va a dar nada.":
    "The sea gave me everything. It'll give you nothing.",
  "¡No me voy de esta isla sin las diez fichas!":
    "I'm not leaving this island without all ten chips!",
  "Sé lo que vas a robar antes que tú.":
    "I know what you're going to draw before you do.",
  "El miedo es una carta más, y yo llevo tres.":
    "Fear is just another card, and I'm running three.",
  "Mis muertos se levantan más veces que tus monstruos.":
    "My dead get up more often than your monsters do.",
  "En América jugamos para ganar, crío.":
    "In America we play to win, kid.",
  "Tres Ojos Azules. No necesito nada más.":
    "Three Blue-Eyes. I don't need anything else.",
  "Nadie sale del laberinto sin nuestro permiso.":
    "Nobody leaves the labyrinth without our say-so.",
  "Ya sé lo que llevas en la mano, muchachito.":
    "I already know what's in your hand, my boy.",
  "Vas a ver los Ojos Azules antes de lo que crees.":
    "You'll be seeing the Blue-Eyes sooner than you think.",
  "El impostor de los Ojos Azules":"The Blue-Eyes Impostor",

  /* Los cinco mazos del Duelista libre: los de los protagonistas ya
     están traducidos más arriba, con los datos de personajes.json. */
  "Control por volteo":"Flip Control",
  "Bichos boca abajo que hacen algo al voltearse. Aguanta y desgasta.":
    "Face-down monsters that do something when they flip. Hold the line and grind.",
  "Ritual de Relinquished":"Relinquished Ritual",
  "Busca la mágica ritual, invoca a Relinquished y róbale su monstruo.":
    "Find the ritual spell, summon Relinquished and take their monster.",
  "Fusión":"Fusion",
  "Junta las piezas y saca monstruos grandes del Extra Deck.":
    "Assemble the pieces and bring big monsters out of the Extra Deck.",
  "Necrovalley":"Necrovalley",
  "Cierra los cementerios y pega con los guardianes de la tumba.":
    "Shut down both graveyards and beat down with the Gravekeepers.",
  "Zombis":"Zombies",
  "Pyramid Turtle saca lo grande y el cementerio nunca se vacía.":
    "Pyramid Turtle fetches the big ones and the graveyard never runs dry.",

  /* ── quién te habla en un encuentro ── */
  "Cazador de Raras":"Rare Hunter",
  "Baúl abandonado":"Abandoned trunk",
  "Duelista anónimo":"A nameless duelist",

  "Victoria":"Victory",
  "Derrota":"Defeat",
  "Seguir":"Continue",
  "Descargar log":"Download log",
  "Cargando el núcleo de reglas":"Loading the rules core",
  "El motor no ha arrancado":"The engine didn't start",
  "El núcleo de reglas no ha terminado de cargar. Recarga la página; si vuelve a pasar, mándale una captura de la consola (F12) a Claude.":
    "The rules core never finished loading. Reload the page; if it happens again, send Claude a screenshot of the console (F12).",
  "Volver al mapa":"Back to the map",
  "Otra partida":"New run",
  "Duelos jugados":"Duels played",
  "¡Has ganado el torneo!":"You won the tournament!",
  "Se acabó la aventura":"The run is over",
  "SINERGIA":"SYNERGY", "CALIDAD":"QUALITY", "PIVOTE":"PIVOT",
  "Las orillas":"The shores",
  "El interior de la isla":"The island interior",
  "El castillo de Pegasus":"Pegasus Castle",
  "Tirada de moneda":"Coin toss",
  "Cara":"Heads", "Cruz":"Tails", "Dado":"Dice",
  "Turnos contados":"Turns counted",
  "Puntos de vida pagados":"Life points paid",
  "Contadores":"Counters",
  "Cadenas":"Chains",
  "Cadenas: automáticas":"Chains: automatic",
  "Cadenas: preguntar siempre":"Chains: always ask",
  "Cadenas: no activar nada":"Chains: never activate",
  "Descargar log":"Download log",
  "Descarga el historial para enviarlo":"Download the match log to report a bug",
  "Desatascar":"Force advance",
  "Solo para depurar":"Debug only",
  "Pantalla completa":"Fullscreen",
  "Rendirse":"Surrender",
  "Termina el duelo como derrota":"Ends the duel as a loss",
  "Salir al menú":"Back to menu",
  "Motor de reglas de EDOPro · formato de abril de 2005":
    "EDOPro rules engine · April 2005 format",
  "Duelo VS":"VS Duel",
  "Modo Bots":"Bot Mode",
  "Deck Builder":"Deck Builder",
  "Opciones":"Options",
  /* ── modo depuración (Opciones) ── */
  "Modo depuración":"Debug mode",
  "Contraseña":"Password",
  /* OJO: "Activar" YA EXISTE más abajo como "Activate" (activar una
     carta en el duelo). Una clave repetida en un objeto literal gana la
     última y en silencio — está escrito en CLAUDE.md y `check-idioma` lo
     caza. Aquí el botón dice otra cosa, así que lleva su propia clave en
     vez de pelearse por la genérica. */
  "Activar depuración":"Enable debug",
  "Desactivar depuración":"Disable debug",
  "Desbloquea los atajos de prueba del Reino y del torneo suizo (ganar o perder un duelo sin jugarlo). Para desarrollo: no hace falta para jugar.":
    "Unlocks the testing shortcuts of the Kingdom and the Swiss tournament (win or lose a duel without playing it). For development: not needed to play.",
  "Modo depuración ACTIVO: en el Reino y en el torneo suizo salen los botones de ganar o perder sin jugar.":
    "Debug mode ON: the Kingdom and the Swiss tournament show the win/lose-without-playing buttons.",
  "← Volver":"← Back",
  "Dificultad del rival":"Opponent difficulty",
  "Tu avatar":"Your avatar",
  "Tu mazo":"Your deck",
  "Mazo del rival":"Opponent deck",
  "Empezar duelo":"Start duel",
  "Al azar entre los incluidos":"Random from the included decks",
  "El mismo que el tuyo":"Same as yours",
  "Gana a cada uno de los mazos.":"Beat every one of the decks.",
  "Jugar":"Play",
  /* ── side deck del torneo ── */
  "Side deck":"Side deck",
  "contra":"vs",
  "Toca una carta para moverla. Del Main al Side y al revés: no se pueden meter cartas que no registraste.":
    "Tap a card to move it. Main to Side and back: you can't add cards you didn't register.",
  "Main deck":"Main deck",
  "Listo":"Done",
  "Dejarlo como estaba":"Reset to registered",
  "La IA ha cambiado":"The AI swapped",
  "cartas de su side deck":"cards from its side deck",
  "Ventanas de respuesta":"Response windows",
  "Automáticas":"Automatic",
  "Preguntar siempre":"Always ask",
  "No activar nada":"Never activate",
  "Con \"automáticas\" solo se te pregunta cuando hay algo real a lo que responder. En el turno del rival siempre se pregunta.":
    "With \"automatic\" you are only asked when there is something real to respond to. On the opponent's turn you are always asked.",
  "Tiempo para responder":"Response timer",
  "Sin límite":"No limit",
  "Idioma":"Language",
  "Español":"Spanish",
  "Inglés":"English",
  "Cargando el núcleo de reglas…":"Loading the rules core…",
  "Gira el móvil":"Rotate your phone",
  "El tablero de Goat necesita pantalla apaisada. Pon el teléfono en horizontal para jugar.":
    "The Goat board needs a landscape screen. Turn your phone sideways to play.",
  "Error al arrancar":"Failed to start",
  "Novato":"Rookie", "Normal":"Normal", "Duro":"Tough", "Experto":"Expert",
  "Pasa el ratón por una carta para ver su texto completo aquí.":
    "Hover a card to read its full text here.",
  "En Main Phase, arrastra una carta de tu mano al tablero para jugarla.":
    "In Main Phase, drag a card from your hand onto the field to play it.",

  /* ── tablero ── */
  "Deck":"Deck", "Extra":"Extra", "Campo":"Field", "Monstruo":"Monster",
  "M/T":"S/T", "Cementerio":"Graveyard", "Desterradas":"Banished",
  "Mano":"Hand",
  "Oponente":"Opponent", "Tú":"You", "tú":"you", "rival":"opponent",
  "Siguiente fase":"Next phase", "Terminar turno":"End turn",
  "Battle Phase":"Battle Phase", "Main Phase 2":"Main Phase 2",
  "Sorteo…":"Coin toss…", "Empiezas tú":"You go first", "Empieza el rival":"Opponent goes first",
  "Robo":"Draw", "Mantenimiento":"Standby", "¡A la batalla!":"To battle!",
  "Fin del turno":"End of turn",
  "Cerrar":"Close", "No hay cartas aquí":"No cards here",
  "Extra Deck":"Extra Deck", "Cartas desterradas":"Banished cards",
  "No puedes ver el Extra Deck del rival":"You can't look at your opponent's Extra Deck",

  /* ── decisiones ── */
  "Main Phase":"Main Phase",
  "Main Phase 1":"Main Phase 1",
  "Battle Step":"Battle Step",
  "¿Activar el efecto?":"Activate the effect?",
  "Arrastra para jugar o reordenar tu mano · ✦ = efecto disponible":
    "Drag to play or reorder your hand · ✦ = effect available",
  "Arrastra para jugar · mantén pulsada una carta para verla · ✦ = efecto disponible":
    "Drag to play · press and hold a card to read it · ✦ = effect available",
  "Ver la carta grande":"View card full size",
  "No tienes jugadas disponibles":"No plays available",
  "Ver todas las acciones":"Show all actions",
  "Todas las acciones":"All actions",
  "Volver":"Back",
  "Invocación normal":"Normal Summon",
  "Invocación especial":"Special Summon",
  "Invocación por volteo":"Flip Summon",
  "Colocar boca abajo":"Set face-down",
  "Colocar tapada":"Set",
  "Activar":"Activate",
  "Cambiar posición":"Change position",
  "Cancelar":"Cancel",
  "Esa carta no se puede jugar ahora":"That card can't be played right now",
  "Los monstruos van en la zona de monstruos":"Monsters go in the Monster Zone",
  "Las Mágicas y Trampas van en la zona de M/T":"Spells and Traps go in the Spell/Trap Zone",
  "Haz clic en un monstruo tuyo para declarar ataque":
    "Click one of your monsters to declare an attack",
  "No puedes atacar":"You can't attack",
  "Ataque declarado":"Attack declared",
  "Ataque directo declarado":"Direct attack declared",
  "Ataque anulado":"Attack negated",
  "¿Quieres responder?":"Respond?",
  "Efecto obligatorio — elige":"Mandatory effect — choose",
  "No responder":"Don't respond",
  "Prioridad":"Priority",
  "Usar ya el efecto de":"Use now the effect of",
  "Pasar la prioridad":"Pass priority",
  "Puedes usar el efecto antes de que el rival responda a la invocación. Si pasas, el rival responde primero y después ya no hay otra ventana.":
    "You can use the effect before your opponent responds to the summon. If you pass, your opponent responds first and there is no other window afterwards.",
  "Si no contestas, se pasa sola":"If you don't answer, it passes on its own",
  "Tiempo agotado: no se responde":"Time's up: no response",
  "¿Confirmas?":"Confirm?",
  "Sí":"Yes", "No":"No",
  "Elige una opción":"Choose an option",
  "Con sacrificios (la forma normal)":"With Tributes (the normal way)",
  "¿En qué posición?":"In which position?",
  "Ataque":"Attack", "Defensa":"Defense", "Defensa boca abajo":"Face-down Defense",
  "Haz clic en las cartas marcadas, en el campo o en tu mano":
    "Click the highlighted cards, on the field or in your hand",
  "Hay cartas fuera del tablero: ábrelas para verlas":
    "Some cards are off the field: open them to look",
  "👁 Ver las cartas":"👁 Look at the cards",
  "Terminar":"Finish",
  "Declara una carta":"Declare a card",
  "Escribe un nombre…":"Type a name…",
  "Declara un Tipo":"Declare a Type",
  "Declara un Atributo":"Declare an Attribute",
  "Declara un número":"Declare a number",
  "Se revela la mano del rival":"Your opponent's hand is revealed",
  "Carta boca abajo":"Face-down card",
  "Toca una carta para verla":"Tap a card to view it",
  "Se ha roto algo":"Something broke",
  "Descargar log y avisar":"Download the log and report it",
  "Continuar":"Continue",

  /* ── momentos de la cadena ── */
  "Declaración de ataque":"Attack declaration",
  "Damage Step":"Damage Step",
  "Damage Step · cálculo de daño":"Damage Step · damage calculation",
  "Tras el combate":"After damage",
  "Fin del Battle Step":"End of Battle Step",
  "Inicio de la Battle Phase":"Start of Battle Phase",
  "Fin de la Battle Phase":"End of Battle Phase",
  "Final de la Main Phase":"End of Main Phase",
  "Final de la cadena":"End of chain",
  "Al colocar monstruo":"On Set monster",
  "Al colocar M/T":"On Set Spell/Trap",
  "Cambio de posición":"On position change",
  "Al destruirse":"On destruction",
  "Al ir al cementerio":"On sent to Graveyard",
  "Al ir a la mano":"On returned to hand",
  "Draw Phase":"Draw Phase", "Standby Phase":"Standby Phase", "End Phase":"End Phase",

  /* ── final del duelo y rendición ── */
  "VICTORIA":"VICTORY", "DERROTA":"DEFEAT",
  "¡HAS GANADO!":"YOU WIN!", "HAS PERDIDO":"YOU LOSE",
  "TE RINDES":"YOU SURRENDER",
  "Nuevo duelo":"New duel", "Ver el tablero":"Look at the board",
  "¿Seguro que quieres rendirte?":"Surrender this duel?",
  "El duelo termina ahora mismo y cuenta como derrota.":
    "The duel ends right now and counts as a loss.",
  "Seguir jugando":"Keep playing", "Sí, rendirme":"Yes, surrender",
  "Te has rendido":"You surrendered",
  "Te has rendido — derrota":"You surrendered — defeat",
  "Puntos de vida a cero":"Life Points reached zero",
  "Se quedó sin cartas en el Deck":"Deck out",
  "Efecto de una carta":"Card effect",
  "Rendición":"Surrender",
  "Se acabó el tiempo":"Time ran out",

  /* ── deck builder ── */
  "← Menú principal":"← Main menu",
  "Nombre del mazo":"Deck name",
  "Guardar":"Save", "Guardar como nuevo":"Save as new", "Nuevo":"New",
  "Mis mazos":"My decks",
  "Clic izquierdo: añadir al mazo.":"Left click: add to the deck.",
  "Clic derecho: añadir al Side.":"Right click: add to the Side.",
  "Buscar por nombre o texto…":"Search by name or text…",
  "Todos":"All", "Monstruos":"Monsters", "Mágicas":"Spells", "Trampas":"Traps",
  "Main Deck":"Main Deck", "Extra Deck":"Extra Deck", "Side Deck":"Side Deck",
  "Aún no has guardado ningún mazo":"You haven't saved any deck yet",
  "Mazo sin nombre":"Untitled deck",
  "Mazo borrado":"Deck deleted",
  "Mazo válido":"Valid deck",
  "El mazo está vacío":"The deck is empty",
  "Exportar para el simulador":"Export for the simulator",
  "Importar":"Import",
  "Pega aquí la lista (YDK o nombres, uno por línea):":
    "Paste the list here (YDK or card names, one per line):",
  "carta desconocida":"unknown card",
  "no identificadas:":"not recognised:",
  "prohibida en Goat":"forbidden in Goat",
  "solo monstruos de Fusión":"Fusion monsters only",
  "va al Extra Deck":"goes to the Extra Deck",
  "el Main Deck está lleno (60)":"the Main Deck is full (60)",
  "el Extra está lleno (15)":"the Extra Deck is full (15)",
  "el Side está lleno (15)":"the Side Deck is full (15)",
  "No se pudo guardar (almacenamiento del navegador)":
    "Couldn't save (browser storage)",
  "Fusión":"Fusion", "Psíquico":"Psychic",
  "Importado":"Imported", "Guardado":"Saved", "Nuevo mazo":"New deck",
  "Acciones":"Actions", "Plegar el panel":"Fold the panel away",
  /* Se colaban en el deck builder: son texto fijo de la plantilla y no
     estaban en la tabla. Los encontró la barrida de check-idioma. */
  "Pasa el ratón por una carta para ver su texto.":
    "Hover a card to read its text.",
  "Clic en una carta del mazo: quitarla.":
    "Click a card in the deck to remove it.",
  "No hay combinación posible":"No valid combination",
  "Sacrifica para sumar":"Tribute to total",
  "Las combinaciones que suman justo salen ya hechas":"Valid combinations are worked out for you",
  "por nombre":"by name", "adaptadas a Goat":"switched to the Goat version",
  "sin identificar":"not recognised",
  "Hay cartas que no son legales en Goat y no funcionarían":
    "Some cards are not legal in Goat and would do nothing",
  "Mis mazos":"My decks", "Buscar":"Search",

  /* ── zonas y tipos (para los textos de las cartas) ── */
  "Carta Mágica":"Spell Card", "Carta de Trampa":"Trap Card",
  "MÁGICA":"SPELL", "TRAMPA":"TRAP",
  "FUEGO":"FIRE","AGUA":"WATER","TIERRA":"EARTH","VIENTO":"WIND",
  "LUZ":"LIGHT","OSCURIDAD":"DARK","DIVINO":"DIVINE",
  "Guerrero":"Warrior","Mago":"Spellcaster","Hada":"Fairy","Demonio":"Fiend",
  "Zombi":"Zombie","Máquina":"Machine","Aqua":"Aqua","Piro":"Pyro","Roca":"Rock",
  "Bestia Alada":"Winged Beast","Planta":"Plant","Insecto":"Insect","Trueno":"Thunder",
  "Dragón":"Dragon","Bestia":"Beast","Bestia Guerrero":"Beast-Warrior",
  "Dinosaurio":"Dinosaur","Pez":"Fish","Serpiente Marina":"Sea Serpent","Reptil":"Reptile",
  "mano":"hand","campo":"field","desterradas":"banished",
};

/* Frases con datos dentro. El orden importa: gana la primera que encaje. */
const REGLAS = [
  /* El mazo de la sala (sala.js · validarMazo) */
  [/^El Main Deck tiene (\d+) cartas: hacen falta 40\.$/, m=>`The Main Deck has ${m[1]} cards: it needs 40.`],
  [/^El Main Deck tiene (\d+) cartas: el máximo son 60\.$/, m=>`The Main Deck has ${m[1]} cards: the maximum is 60.`],
  [/^El Extra Deck tiene (\d+) cartas: el máximo son 15\.$/, m=>`The Extra Deck has ${m[1]} cards: the maximum is 15.`],
  [/^El Side Deck tiene (\d+) cartas: el máximo son 15\.$/, m=>`The Side Deck has ${m[1]} cards: the maximum is 15.`],
  [/^Log descargado \((\d+) entradas\)$/, m=>`Log downloaded (${m[1]} entries)`],
  [/^Decisión no soportada \((\d+)\)$/, m=>`Unsupported decision (${m[1]})`],
  /* El deck builder: contadores y avisos con el número dentro. */
  [/^(\d+)(\+?) cartas$/, m=>`${m[1]}${m[2]} card${m[1]==="1"&&!m[2]?"":"s"}`],
  [/^Faltan (\d+) cartas?$/, m=>`${m[1]} card${m[1]==="1"?"":"s"} missing`],
  [/^Sobran (\d+)$/, m=>`${m[1]} too many`],
  [/^(\d+) monstruos · (\d+) mágicas · (\d+) trampas$/, m=>`${m[1]} monsters · ${m[2]} spells · ${m[3]} traps`],
  [/^máximo (\d+) copia\(s\)$/, m=>`max ${m[1]} cop${m[1]==="1"?"y":"ies"}`],
  [/^Hay (\d+) carta\(s\) que no son legales en Goat\.$/, m=>`${m[1]} card(s) are not legal in Goat.`],
  [/^(.+): lleva (\d+) y el límite es (\d+)\.$/, m=>`${m[1]}: ${m[2]} copies, the limit is ${m[3]}.`],

  /* ══ AVISOS DEL MAZO, CON SU PLURAL ══
     "Te faltan 1 cartas para las 40" salía en español y encima mal: son
     frases con un número dentro, así que no pueden estar en la tabla de
     frases exactas. Y el singular importa — "1 more card", no "1 more
     cards". */
  [/^Te faltan (\d+) cartas? para las (\d+)$/,
   m => `You need ${m[1]} more card${m[1]==="1"?"":"s"} to reach ${m[2]}.`],
  [/^Te sobran (\d+) cartas?$/,
   m => `You have ${m[1]} card${m[1]==="1"?"":"s"} too many.`],
  [/^El Extra Deck pasa de (\d+)$/,
   m => `Your Extra Deck is over ${m[1]}.`],
  [/^(.+): llevas (\d+) y el límite es (\d+)$/,
   m => `${m[1]}: you have ${m[2]} and the limit is ${m[3]}.`],
  /* Botones con un símbolo delante: "→ Terminar turno". La flecha no se
     traduce, pero la frase sí, y como clave exacta no encajaba se quedaba
     en español. Lo encontró la barrida de `check-idioma`. */
  [/^([→▶►▼«»▸·•]+\s*)(.+)$/,             m=>m[1] + T(m[2])],
  /* El mercader dice POR QUÉ no puedes hacer un cambio, y el motivo lleva
     el número dentro: como clave exacta no encaja nunca y se quedaba en
     español dentro de una partida en inglés. Lo pilló la barrida que
     recorre las pantallas del Reino en inglés (`check-ingles.mjs`). */
  [/^tienes (\d+) de las (\d+) que pide$/,
                                          m=>`you have ${m[1]} of the ${m[2]} it asks for`],
  [/^te faltan cartas de una misma categoría \((\d+)\)$/,
                                          m=>`you need ${m[1]} cards of the same kind`],
  [/^Turno (\d+) — Tú$/,                 m=>`Turn ${m[1]} — You`],
  [/^Turno (\d+) — Oponente$/,           m=>`Turn ${m[1]} — Opponent`],
  [/^Cadena (\d+): (.+)$/,               m=>`Chain ${m[1]}: ${m[2]}`],
  [/^Invoca: (.+)$/,                     m=>`Summon: ${m[1]}`],
  [/^Invocación especial: (.+)$/,        m=>`Special Summon: ${m[1]}`],
  [/^Invocación por volteo: (.+)$/,      m=>`Flip Summon: ${m[1]}`],
  [/^Desterrada: (.+)$/,                 m=>`Banished: ${m[1]}`],
  [/^Invocar (.+)$/,                     m=>`Summon ${m[1]}`],
  [/^Inv\. especial (.+)$/,              m=>`Special Summon ${m[1]}`],
  [/^Colocar tapada (.+)$/,              m=>`Set ${m[1]}`],
  [/^Colocar (.+)$/,                     m=>`Set ${m[1]}`],
  [/^Activar (.+)$/,                     m=>`Activate ${m[1]}`],
  [/^Atacar con (.+)$/,                  m=>`Attack with ${m[1]}`],
  [/^Encadenar (.+)$/,                   m=>`Chain ${m[1]}`],
  [/^¿Activar el efecto de (.+)\?$/,     m=>`Activate the effect of ${m[1]}?`],
  [/^Selecciona (.+) carta\(s\)$/,       m=>`Select ${m[1]} card(s)`],
  [/^Elige (.+) carta\(s\)$/,            m=>`Choose ${m[1]} card(s)`],
  [/^Confirmar \((\d+)\)$/,              m=>`Confirm (${m[1]})`],
  [/^Se revelan (\d+) carta\(s\)$/,      m=>`${m[1]} card(s) revealed`],
  [/^Opción (\d+)$/,                     m=>`Option ${m[1]}`],
  [/^¿En qué posición pones (.+)\?$/,   m=>`In which position do you summon ${m[1]}?`],
  [/^Cartas reveladas · tu mazo$/,       ()=>`Revealed cards · your deck`],
  [/^Cartas reveladas · mazo del rival$/,()=>`Revealed cards · opponent's deck`],
  [/^Cementerio tu — (\d+) carta\(s\)$/, m=>`Your Graveyard — ${m[1]} card(s)`],
  [/^Cementerio del rival — (\d+) carta\(s\)$/, m=>`Opponent's Graveyard — ${m[1]} card(s)`],
  [/^Extra Deck tu — (\d+) carta\(s\)$/, m=>`Your Extra Deck — ${m[1]} card(s)`],
  [/^Cartas desterradas (?:tu|del rival) — (\d+) carta\(s\)$/,
                                          m=>`Banished cards — ${m[1]} card(s)`],
  [/^(.+) — (\d+) carta\(s\)$/,          m=>`${T(m[1])} — ${m[2]} card(s)`],
  [/^Fin del duelo — victoria$/,          ()=>"Duel over — victory"],
  [/^Fin del duelo — derrota$/,           ()=>"Duel over — defeat"],
  [/^Nivel (\d+)$/,                       m=>`Level ${m[1]}`],
  [/^Turno (\d+)$/,                       m=>`Turn ${m[1]}`],
  [/^(\d+) turnos · (.+)$/,               m=>`${m[1]} turns · ${m[2]}`],
  [/^(\d+) turnos$/,                      m=>`${m[1]} turns`],
  [/^(\d+) de (\d+) retos superados$/,    m=>`${m[1]} of ${m[2]} challenges beaten`],
  [/^el Main tiene (\d+): hacen falta (\d+)$/, m=>`the Main deck has ${m[1]}: it needs ${m[2]}`],
  [/^el Main tiene (\d+): el tope son (\d+)$/, m=>`the Main deck has ${m[1]}: the cap is ${m[2]}`],
  [/^el Side tiene (\d+): el tope son (\d+)$/, m=>`the Side deck has ${m[1]}: the cap is ${m[2]}`],
  [/^no son las cartas que registraste al empezar la ronda$/, ()=>`those aren't the cards you registered at the start of the round`],
  [/^(\d+)\/(\d+) dificultades$/,         m=>`${m[1]}\/${m[2]} difficulties`],
  [/^(.+) cartas · validado contra la lista oficial$/,
                                          m=>`${m[1]} cards · checked against the official list`],
  [/^(.+) · (Novato|Normal|Duro|Experto)$/, m=>`${m[1]} · ${T(m[2])}`],
  [/^TU TURNO$/,                          ()=>"YOUR TURN"],
  [/^TURNO RIVAL$/,                       ()=>"OPPONENT'S TURN"],
];

let idiomaActual = "en";
export function setIdioma(l){ idiomaActual = (l==="es") ? "es" : "en"; }
export function idioma(){ return idiomaActual; }

/* CAZADOR DE FUGAS. Cada frase que pasa por aquí y no encuentra
   traducción se apunta en `globalThis.__T_FUGAS__` si esa lista existe.
   No existe en el navegador —no cuesta nada— y `check-idioma.mjs` la
   activa, juega una partida entera en inglés y saca la lista de lo que
   sigue saliendo en español. Antes se buscaban a ojo y siempre quedaba
   alguna: un usuario reportó dos veces "it's partially in Spanish". */
export function T(s){
  if(idiomaActual === "es" || s == null) return s;
  const t = String(s);
  /* El texto escrito en el HTML trae saltos de línea y sangría (un
     párrafo partido en tres líneas): se compara con los espacios juntos,
     o la frase no se encontraba aunque estuviera en la tabla. */
  const clave = t.trim().replace(/\s+/g, " ");
  const exacto = EN[t.trim()] ?? EN[clave];
  if(exacto !== undefined) return t.trim() === clave ? t.replace(t.trim(), exacto) : exacto;
  for(const [re, fn] of REGLAS){
    const m = re.exec(t.trim()) ?? (clave !== t.trim() ? re.exec(clave) : null);
    if(m) return fn(m);
  }
  if(globalThis.__T_FUGAS__ && t.trim()) globalThis.__T_FUGAS__.add(t.trim());
  return s;
}

/* Traduce lo que ya está escrito en el HTML (menús, barra, pantalla de
   carga). Se llama al arrancar y cada vez que se repinta un menú. */
export function traducirDOM(raiz){
  if(idiomaActual === "es" || !raiz) return;
  const anda = nodo => {
    const hijos = nodo && nodo.childNodes ? [...nodo.childNodes] : [];
    for(const c of hijos){
      if(c.nodeType === 3){
        const crudo = c.nodeValue, limpio = crudo.trim();
        if(limpio){ const tr = T(limpio); if(tr !== limpio) c.nodeValue = crudo.replace(limpio, tr); }
      } else if(c.nodeType === 1){
        /* El código y los estilos no son texto que se lea. */
        if(c.nodeName === "SCRIPT" || c.nodeName === "STYLE") continue;
        for(const a of ["title","placeholder","alt","data-label","aria-label"]){
          const v = c.getAttribute && c.getAttribute(a);
          if(v) c.setAttribute(a, T(v));
        }
        anda(c);
      }
    }
  };
  try{ anda(raiz); }catch(e){}
}

/* Puente global: view.js y main.js viven en ámbitos separados dentro del
   HTML final, y en las pruebas de node ni siquiera existe este módulo.
   Con esto, allí donde no haya traducción el texto pasa tal cual. */
if(typeof globalThis !== "undefined"){
  globalThis.__T = T;
  globalThis.__traducirDOM = traducirDOM;
  globalThis.__setIdioma = setIdioma;
  globalThis.__idioma = idioma;
}
