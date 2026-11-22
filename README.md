# Duelist Kingdom: GOAT Format Roguelike + Bo3 Tournament Mode + Friend Rooms, running in your browser

![Duelist Kingdom](docs/img/banner.jpg)

**[▶ Play in your browser](https://circlenline.github.io/DUELIST_KINGDOM_ROGUELIKE/)** ·
**[⬇ Download to play offline](https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/raw/main/DUELIST_KINGDOM_ROGUELIKE.zip)** ·
**[🐞 Report a bug or an AI misplay](https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues/new/choose)**

A Yu-Gi-Oh! **GOAT Format** (April 2005) simulator that runs in a web browser, on PC
and on phones. It plays against you with a bot built to play like a GOAT player, and
it has a Duelist Kingdom roguelike, a Swiss tournament with top cut, and rooms to play
against your friends. Free, no install, no account. **Build 1.3.**

[![Watch the trailer](docs/img/trailer-readme.jpg)](https://circlenline.github.io/DUELIST_KINGDOM_ROGUELIKE/#trailer)

---

## Build 1.3 — a smarter AI and more decks

- **The AI studied 122 tournament replays.** It was put in every position of real Dueling Book
  games from top players and compared with what they did. From that it now draws and searches
  before committing, clears the board before summoning, plans the whole Battle Phase instead of
  one attack at a time, bluffs with a set spell, sets its backrow gradually instead of all at
  once, and saves Snatch Steal and Tribe-Infecting Virus for the turns that decide the game.
- **It thinks about consequences, not only ATK.** It reads what happens when a monster dies
  (floaters, Sangan, Relinquished's equip shield), how exposed its attacker is left after the
  battle, and adds burn damage up over the turns.
- **Thousand-Eyes Restrict and Relinquished** are now the first thing it removes with Book of
  Moon, Tsukuyomi, Chaos Sorcerer, Ring and the rest, instead of hitting another monster because
  they "only" have 0 ATK. With its own TER it knows to Book of Moon it to attack with the rest,
  then flip it back in Main Phase 2.
- **Scapegoat** waits for a direct attack or for the card that would destroy it, and is only
  chained in your End Phase when it needs the tokens on its turn.
- **Tsukuyomi and Book of Moon** are used for value: Tsukuyomi on your Kycoo and then it attacks
  (no Nobleman wasted), never Tsukuyomi on itself, and Tsukuyomi, Asura Priest or a floater +
  Creature Swap to steal your monster for free.
- **Floaters:** it crashes its own Giant Rat or Pyramid Turtle when what comes out of the deck
  solves the board, and only kills your Pyramid Turtle if it has a set card ready for what
  comes out.
- **New response mode: "When it makes sense".** You're only asked when one of your cards can
  actually do something: Waboku or Mirror Force when an attack is declared, Trap Hole after a
  summon, everything else when your opponent does something or in their End Phase, and always if
  one of your cards is about to be destroyed. "Automatic", "Always ask" and "Never" are still
  there (Options, or the chain button during a duel).
- **4 new meta decks:** Earth Aggro, Warrior Aggro, Umi (Water Aggro with A Legendary Ocean) and
  Relinquished Control. The Swiss tournament has much more variety now (fewer Goat Control and
  Chaos mirrors, more aggro), with the matchup table measured again over 27,600 games.
- **Avatars in the tournament:** pick yours when you register; every bot has its own face.

## Build 1.2 — fixes from your GitHub issues

Thanks for every issue and comment. Most of the "the game crashed" reports from Build 1.0
(Gravekeeper's Spy, Tribe-Infecting Virus, Tsukuyomi, Don Zaloog, searches) were the same bug,
fixed in 1.1 below. This build adds:

- **Coin tosses were rigged by accident.** Fairy Box (and every coin toss) came out Tails every
  time because of how the rules engine was seeded. Now it's a real 50/50, and the AI no longer
  always calls Heads.
- **Pegasus "gaining" 1000 LP with Toon World.** He starts with 10,000 LP; the screen showed 8,000
  until the first change. The starting LP are now shown correctly.
- **Cyber Jar** now shows the cards revealed from both decks, and every "which position?" question
  (Cyber Jar, Reasoning, Monster Gate, Dimension Fusion…) names the monster.
- **Fusilier Dragon** shows "With Tributes / Normal Summon without Tribute" instead of "Option 1/2".
- **A folded side panel no longer hides questions** ("activate the effect?", "respond?"), which made
  the game look stuck in the Battle Step while each window timed out.
- **During your own attack** every response window is offered (e.g. Limiter Removal in the Damage
  Step after another chain).
- **AI:** raises its defense-position monsters to attack for lethal on an empty board, plays Forest
  and other type-boosting fields before attacking, doesn't Rescue Cat for two Pandas with nothing to
  do with them, doesn't waste Book of Moon on a monster that already attacked, and doesn't walk into
  an empty Battle Phase with only set cards.

## Build 1.1 — fixes from the first week of feedback

Thanks to everyone who played and reported on Reddit. This build fixes:

- **The opponent's hand could be read** by tapping it (the card showed up in the info panel). Fixed.
- **Search effects "crashing"** (Mystic Tomato, Manju…): a card image loading late after the
  card list closed was taking over the whole screen with an error. Fixed, and a stray error can
  no longer cover the game.
- **Berserk Gorilla froze the duel** when it had to attack into something bigger. The AI now
  attacks when the rules say it must.
- **Double Coston** now counts as two tributes for a DARK monster.
- **Vampire Lord** (and other cards that ask you to pick an option) show the real choices
  (Monster / Spell / Trap) instead of "Option 1-3".
- **AI:** no more Breaker on a face-up Call of the Haunted that isn't holding anything, and no
  more attacking with everything after your Waboku has resolved.
- **Opponent's cards can face them instead of you**, like at a real table (Options → Opponent's
  cards → Looking at the opponent).
- **Changed ATK/DEF are easier to read**: bigger, always upright (also in defense position), and
  shown in the card info panel too.
- **Bigger text on phones**, and long-pressing a card no longer opens the browser's
  "save image" menu.
- **Big screens:** the board is centered vertically instead of stuck at the top.
- **Your decks:** if a deck from the Deck Builder doesn't show up, you can now import its `.ydk`
  directly in Free Duel ("Not there? Import .ydk").

## What's new

Since the original project got so much positive feedback, I kept upgrading it: a
smarter AI to play against, more features and new game modes.

The goal is two things at once. A single-player experience that is fun and
challenging for new players but especially for experienced ones. And a way to play
GOAT meta decks against a machine or against friends, with everything automated, so
you can train for locals or tournament brackets without the manual interaction of
Dueling Book.

The main upgrade from the last version, besides the new game modes, is a **much
smarter AI**, with a bank of **almost 400 positions taken from real misplays** that guides its decisions so it
plays like a real player as well as it can. I'm happy with its level for this
release, but the goal is to keep improving it, so any feedback or misplay report you
send through this GitHub page is very much appreciated and will be used to improve the
simulator.

## Features

- **Runs in a web browser on PC and phone.** Play it hosted here on GitHub, or
  download it and play locally on your device.
- **PvE modes**
  - **Duelist Kingdom** — a roguelike run across the island, up to Pegasus.
  - **Free Duel (Bo1)** — 24 premade meta decks ready to play, or your own.
  - **Swiss Tournament (Bo3)** — Swiss rounds and a top cut, with side decking.
- **PvP mode**
  - **Play with a friend** — custom decks, Bo1 or Bo3, with side decking.
- **Deck builder** with the 1,685 cards legal in the format and the real GOAT banlist.
- **Languages:** English and Spanish.

![Main menu](docs/img/menu.jpg)

---

## Game modes

### Duelist Kingdom (roguelike)

Pick a duelist (Yugi, Joey, Mai, Bandit Keith, Kaiba, or a Free Duelist you name
yourself) and one of their starter decks. You start with 2 **Star Chips** and need
**10** to enter Pegasus Castle. Win a duel and you get a chip and a card; lose one and
you pay a chip. At zero, the run is over.

The island is three acts of branching maps: duels, elites, bosses, card packs, a
merchant who takes cards instead of money, camps and encounters. Your deck grows as you
go: every win offers three cards, packs give ten, and everything you don't play goes
to your binder.

Reach the castle with 10 chips and it's a tower of duelists, then Pegasus at 10000 LP.
Beat him and that duelist unlocks a **Mastery**, a permanent advantage for later runs.

![The castle tower](docs/img/torre.jpg)

### Free Duel

Any of the 24 meta decks (Goat Control, Chaos Turbo, Warrior, Chaos Control, Zombie,
Earth Aggro, Warrior Aggro, Umi, Relinquished, Burn, Horus, Phoenix, Monarch, Gravekeeper,
Empty Jar, Library FTK…) or one you built,
against any of them, at four difficulties. There's also a challenge board: every deck
against every difficulty, with a medal for each one you beat.

![The duel board](docs/img/duelo.jpg)

### Swiss Tournament

A local tournament against bots: **32 players, 5 Swiss rounds of best of three, then a top 16 single
elimination**. You register your deck and your side deck, and you side between games
like at a real event. The other 31 players are bots with meta decks, weighted by how
much each deck is played in real tournament replays, so the top 16 looks like a real
GOAT top cut. Your table is a real Bo3; the other tables are resolved with a matchup
table measured over 27,600 bot-vs-bot games.

![Swiss tournament](docs/img/torneo.jpg)

### Play with a friend

Create a room and send the code (or the link) to a friend. Each of you plays from your
own browser, on PC or phone, Bo1 or Bo3 with side decking, with a time limit per
decision. The guest can play one of the host's decks, a premade one, or their own deck
saved on their device (the host checks it's legal before starting).

![A room with two players](docs/img/sala.jpg)

How it works, in short:

- **No server of mine.** Browsers connect directly to each other (WebRTC). The free
  public PeerJS service is only used so the two browsers can find each other.
- **The host runs the duel**, and sends the guest only what the guest is allowed to
  see. Nobody can read the other player's hand from the browser console.
- It works the same from the **GitHub page** and from a **downloaded copy**, on PC or
  phone, and you can mix them (one on the page, the other from the zip). Both players
  need an internet connection and the same version of the game.
- Very strict networks (some corporate or mobile networks) can block direct
  connections. If that happens the game tells you; trying another network (Wi-Fi
  instead of mobile data, for example) usually fixes it.

---

## The AI

- **It sees only what a player would see.** A boundary module trims what the bot is
  allowed to know: it literally cannot see your face-down cards or your hand.
- **A plan per deck** for the 24 meta decks: what each one wins with, how much to risk,
  which cards are the heavy hitters.
- **It simulates its options** before picking a play, instead of only following rules
  of thumb.
- **2005 priority.** It knows when to hold priority with Black Luster Soldier, Chaos
  Sorcerer, Tribe-Infecting Virus or Breaker, and it punishes you when you pass it.
- **Tuned against real games.** It learned from 122 tournament replays from Dueling
  Book, and it's tested against a bench of fixed positions with the known-correct play,
  each one taken from a real misplay. Every misplay you report can become one more.

---

## Rules engine

The rules are not hand-written. The simulator runs **ocgcore**, the engine EDOPro uses,
compiled to WebAssembly and started in GOAT mode. SEGOC, damage-step timings, attack
replays and the shared Field Spell all resolve the way they did in 2005, because it's
the actual engine.

---

## Deck builder

A second page with the 1,685 legal cards: search, copy limits from the real banlist,
main, extra and side deck, and `.ydk` import and export. Anything you build there shows
up in the game's deck lists, in every mode.

---

## Where your decks and progress are saved

Everything is saved **in your own browser, on your own device**: your decks, your
Duelist Kingdom run and Masteries, your tournament and your options. Nothing is sent to
any server and there is no account.

That means:

- The GitHub page and a downloaded copy keep **separate** data, and so do two different
  browsers or devices.
- If you clear your browser's data, your decks go with it. Safari (on iPhone
  and Mac) can also delete a site's data after some days without visiting it.

To keep your data safe or move it to another device, go to **Options → Your data →
Save backup**. It downloads a small file with everything; **Load backup** on the other
device restores it. Decks can also be exported one by one as `.ydk` from the deck
builder.

---

## Playing offline

Download **[DUELIST_KINGDOM_ROGUELIKE.zip](DUELIST_KINGDOM_ROGUELIKE.zip)**, unzip it and
open `goat-simulador.html` by double-clicking (keep `deckbuilder.html` in the same
folder). The engine, the card scripts, the decks and the portraits all travel inside
the file. The only thing fetched from the internet is card artwork; offline you still
play, with cards drawn as tiles with name, ATK/DEF and level. Rooms with friends need
an internet connection.

---

## Running with Docker

The game can also be self-hosted with Docker. The included `Dockerfile` packages the
browser version with a lightweight Nginx web server, and `docker-compose.yml` provides
a simple way to build and run it.

With Docker and Docker Compose installed:

```bash
git clone https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE.git
cd DUELIST_KINGDOM_ROGUELIKE
docker compose up -d --build
```

Then open: 
```
http://localhost:2002
```

---

## Reporting bugs and AI misplays

There's a **Report** button in the duel's top bar and on the end-of-duel screen. It
downloads the duel log and opens a form here on GitHub with most fields already filled
in. Drag the log file into the form and send it. You need a (free) GitHub account.

With the log, I can replay the duel exactly, move by move. Without it, I'm guessing.

---

## Disclaimer

- The engine is **ocgcore (EDOPro)** with some custom adjustments, like establishing
  priority when playing cards such as Tribe-Infecting Virus, Black Luster Soldier or
  Breaker. Even after all my testing there may be rulings or plays the engine doesn't
  handle yet. If you see a weird play by the AI, or an interaction that doesn't work the
  way GOAT rulings say it should, please report it with the **Report** button.
- This whole project was **vibe coded with the help of Claude**, guiding it through
  different steps and upgrade stages. Testing was done mainly by me over several
  months, plus Claude simulating bot-vs-bot duels.
- I don't have an **iPhone**. All my testing was on PC and Android. If you find UI bugs
  or other weird behaviour on iPhone or other iOS devices, please send a report through
  the GitHub page.

---

## Building from source

The sources are in `engine/`. With Node.js installed:

```bash
cd engine/browser
node build-html.mjs           # the game → out/goat.html
cd ../deckbuilder
node build.mjs                # the deck builder → deckbuilder.html
```

The engine, the card scripts and the card data the build needs are already in
`engine/browser/out/`. `engine/rebuild.sh` regenerates those too, from the card
database (it needs the
[BabelCDB](https://github.com/ProjectIgnis/BabelCDB) and
[CardScripts](https://github.com/ProjectIgnis/CardScripts) repositories next to it) and
runs the checks.

## Usage stats

The hosted page can count visits and a few gameplay events with
[GoatCounter](https://www.goatcounter.com): no cookies, no personal data. It ships
**off**, a downloaded copy never sends anything, and it can be turned off in Options.
See [docs/ANALITICA.md](docs/ANALITICA.md).

## Credits and license

- Rules engine (**ocgcore**) and card scripts: [Project Ignis](https://github.com/ProjectIgnis)
  (EDOPro), AGPL-3.0. Card database: BabelCDB.
- Peer-to-peer rooms: [PeerJS](https://peerjs.com), MIT.
- Card artwork is loaded from [YGOPRODeck](https://ygoprodeck.com) and is not
  redistributed here.

Because the engine is AGPL-3.0, this project is **AGPL-3.0** too. See [LICENSE](LICENSE).

Yu-Gi-Oh! and all card names, artwork and text are property of Konami. This is a free,
non-commercial fan project, not affiliated with or endorsed by Konami.
