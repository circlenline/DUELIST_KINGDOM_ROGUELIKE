# Duelist Kingdom: GOAT Format Roguelike + Bo3 Tournament Mode + Friend Rooms, running in your browser

![Duelist Kingdom](docs/img/banner.jpg)

**[▶ Play in your browser](https://circlenline.github.io/DUELIST_KINGDOM_ROGUELIKE/)** ·
**[⬇ Download to play offline](https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/raw/main/DUELIST_KINGDOM_ROGUELIKE.zip)** ·
**[🐞 Report a bug or an AI misplay](https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues/new/choose)**

A Yu-Gi-Oh! **GOAT Format** (April 2005) simulator that runs in a web browser, on PC
and on phones. It plays against you with a bot built to play like a GOAT player, and
it has a Duelist Kingdom roguelike, a Swiss tournament with top cut, and rooms to play
against your friends. Free, no install, no account. **Build 1.0.**

[![Watch the trailer](docs/img/trailer-readme.jpg)](https://circlenline.github.io/DUELIST_KINGDOM_ROGUELIKE/#trailer)

---

## What's new

Since the original project got so much positive feedback, I kept upgrading it: a
smarter AI to play against, more features and new game modes.

The goal is two things at once. A single-player experience that is fun and
challenging for new players but especially for experienced ones. And a way to play
GOAT meta decks against a machine or against friends, with everything automated, so
you can train for locals or tournament brackets without the manual interaction of
Dueling Book.

The main upgrade from the last version, besides the new game modes, is a **much
smarter AI**, with a bank of **over 100 meta plays** that guides its decisions so it
plays like a real player as well as it can. I'm happy with its level for this
release, but the goal is to keep improving it, so any feedback or misplay report you
send through this GitHub page is very much appreciated and will be used to improve the
simulator.

## Features

- **Runs in a web browser on PC and phone.** Play it hosted here on GitHub, or
  download it and play locally on your device.
- **PvE modes**
  - **Duelist Kingdom** — a roguelike run across the island, up to Pegasus.
  - **Free Duel (Bo1)** — 20 premade meta decks ready to play, or your own.
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

Any of the 20 meta decks (Goat Control, Chaos Turbo, Warrior, Chaos Control, Zombie,
Burn, Horus, Phoenix, Monarch, Gravekeeper, Empty Jar, Library FTK…) or one you built,
against any of them, at four difficulties. There's also a challenge board: every deck
against every difficulty, with a medal for each one you beat.

![The duel board](docs/img/duelo.jpg)

### Swiss Tournament

A local tournament against bots: **32 players, 5 Swiss rounds of best of three, then a top 16 single
elimination**. You register your deck and your side deck, and you side between games
like at a real event. The other 31 players are bots with meta decks, weighted by how
much each deck is played in real tournament replays, so the top 16 looks like a real
GOAT top cut. Your table is a real Bo3; the other tables are resolved with a matchup
table measured over 19,000 bot-vs-bot games.

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
- **A plan per deck** for the 20 meta decks: what each one wins with, how much to risk,
  which cards are the heavy hitters.
- **It simulates its options** before picking a play, instead of only following rules
  of thumb.
- **2005 priority.** It knows when to hold priority with Black Luster Soldier, Chaos
  Sorcerer, Tribe-Infecting Virus or Breaker, and it punishes you when you pass it.
- **Tuned against real games.** It learned from 101 tournament replays from Dueling
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
