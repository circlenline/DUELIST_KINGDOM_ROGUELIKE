/**
 * Utility function to check if the specified card matches the opcode sequence.
 * @param card - The card to check against
 * @param opcodes - The opcode sequence
 */
export declare function cardMatchesOpcode(card: OcgCardData, opcodes: OcgOpCode[]): boolean;

/**
 * Instantiate the basic interface to use ocgcore.
 * @param options - Options.
 */
declare function createCore(options?: InitializerAsync): Promise<OcgCore>;

declare function createCore(options: InitializerSync): Promise<OcgCoreSync>;
export default createCore;

declare const DuelHandleSymbol: unique symbol;

/**
 * The initializer to create a core. If both {@link Initializer.locateFile} and
 * {@link Initializer.wasmBinary} are missing then it will be imported
 * automatically.
 */
export declare interface Initializer {
    /** Override the stdout print */
    print?(str: string): void;
    /** Override the stderr print */
    printErr?(str: string): void;
    /** {@link https://emscripten.org/docs/api_reference/module.html#Module.locateFile} */
    locateFile?(url: string, scriptDirectory: string): string;
    /** The binary of the wasm module */
    wasmBinary?: ArrayBuffer;
    /** Whether to use the sync interface or not. Defaults to false (async). */
    sync?: boolean;
}

/** Initializer for the async version */
export declare type InitializerAsync = Omit<Initializer, "sync"> & {
    sync?: false;
};

/** Initializer for the sync version */
export declare type InitializerSync = Omit<Initializer, "sync"> & {
    sync: true;
};

/** Internal utility to convert an async function to a normal one. */
export declare type InternalDepromisifyFunction<Fn> = Fn extends (...args: infer Args) => infer Ret ? (...args: Args) => Awaited<Ret> : Fn;

/** Internal typing for type-safe Map objects. */
export declare type InternalMappedMap<E extends readonly (readonly [any, any])[]> = Omit<Map<E[any][0], E[any][1]>, "get"> & {
    get<K extends E[any][0]>(this: InternalMappedMap<E>, key: K): Extract<E[any], readonly [K, any]>[1];
};

/** Monster card attribute. */
export declare type OcgAttribute = (typeof OcgAttribute)[keyof typeof OcgAttribute];

/** Monster card attribute. */
export declare const OcgAttribute: {
    /** Earth. */
    readonly EARTH: 1;
    /** Water. */
    readonly WATER: 2;
    /** Fire. */
    readonly FIRE: 4;
    /** Wind. */
    readonly WIND: 8;
    /** Light. */
    readonly LIGHT: 16;
    /** Dark. */
    readonly DARK: 32;
    /** Divine. */
    readonly DIVINE: 64;
};

/**
 * Parse a {@link (OcgAttribute:type)} mask and return the matching attributes.
 * @param attribute - The mask to parse.
 */
export declare function ocgAttributeParse(attribute: OcgAttribute): OcgAttribute[];

/**
 * Convert a {@link (OcgAttribute:type)} to its string representation.
 */
export declare const ocgAttributeString: InternalMappedMap<readonly [readonly [1, "earth"], readonly [2, "water"], readonly [4, "fire"], readonly [8, "wind"], readonly [16, "light"], readonly [32, "dark"], readonly [64, "divine"]]>;

/**
 * Card data definition. These values should be imported as is from the
 * cards.cdb of the card database you want to use. These will be requested
 * in {@link OcgDuelOptions#cardReader}.
 *
 * EdoPro card database: {@link https://github.com/ProjectIgnis/BabelCDB}
 */
export declare interface OcgCardData {
    /** Passcode. */
    code: number;
    /** The passcode alias, 0 if it doesn't have any. */
    alias: number;
    /** Codes of all the sets (archetypes) this card is a part of. */
    setcodes: number[];
    /** Card type. */
    type: OcgType | (number & {});
    /** Level, rank or link rating, 0 if not applicable. */
    level: number;
    /** Monster attribute, 0 if not applicable. */
    attribute: OcgAttribute | (number & {});
    /** Monster race, 0 if not applicable. */
    race: OcgRace | (bigint & {});
    /** Monster card attack, 0 if not applicable. */
    attack: number;
    /** Monster card defense, 0 if not applicable. */
    defense: number;
    /** Left pendulum scale, 0 if not applicable. */
    lscale: number;
    /** Right pendulum scale, 0 if not applicable. */
    rscale: number;
    /** Link markers bitmask. */
    link_marker: OcgLinkMarker | (number & {});
}

export declare enum OcgCardHintType {
    TURN = 1,
    CARD = 2,
    RACE = 3,
    ATTRIBUTE = 4,
    NUMBER = 5,
    DESC_ADD = 6,
    DESC_REMOVE = 7
}

/**
 * Convert a {@link OcgCardHintType} to its string representation.
 */
export declare const ocgCardHintTypeStrings: InternalMappedMap<readonly [readonly [OcgCardHintType.TURN, "turn"], readonly [OcgCardHintType.CARD, "card"], readonly [OcgCardHintType.RACE, "race"], readonly [OcgCardHintType.ATTRIBUTE, "attribute"], readonly [OcgCardHintType.NUMBER, "number"], readonly [OcgCardHintType.DESC_ADD, "desc_add"], readonly [OcgCardHintType.DESC_REMOVE, "desc_remove"]]>;

/** Card passcode, location. */
export declare interface OcgCardLoc {
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
}

/** Card passcode, location, effect activation info. */
export declare interface OcgCardLocActive extends OcgCardLoc {
    description: bigint;
    client_mode: OcgEffectClientMode;
}

/** Card passcode, location, attack info. */
export declare interface OcgCardLocAttack extends OcgCardLoc {
    can_direct: boolean;
}

/** Card passcode, location, battle stats. */
export declare interface OcgCardLocBattle extends OcgLocPos {
    attack: number;
    defense: number;
    destroyed: boolean;
}

/** Card passcode, location, counter info. */
export declare interface OcgCardLocCounter extends OcgCardLoc {
    count: number;
}

/** Card passcode, location, position. */
export declare interface OcgCardLocPos extends OcgCardLoc {
    position: OcgPosition;
    overlay_sequence?: number;
}

/** Card passcode, location, position, activation info. */
export declare interface OcgCardLocPosActive extends OcgCardLocPos {
    description: bigint;
    client_mode: OcgEffectClientMode;
}

/** Card passcode, location, sum info */
export declare interface OcgCardLocSum extends OcgCardLoc {
    amount: number;
}

/** Card passcode, location, tribute info. */
export declare interface OcgCardLocTribute extends OcgCardLoc {
    release_param: number;
}

/** Card passcode and position. */
export declare interface OcgCardPos {
    code: number;
    position: OcgPosition;
}

export declare type OcgCardQueryInfo = {
    /** Passcode, requested by {@link OcgQueryFlags#CODE}. */
    code?: number;
    /** Position, requested by {@link OcgQueryFlags#POSITION}. */
    position?: OcgPosition;
    /** Alias, requested by {@link OcgQueryFlags#ALIAS}. */
    alias?: number;
    /** Type, requested by {@link OcgQueryFlags#TYPE}. */
    type?: OcgType;
    /** Level, requested by {@link OcgQueryFlags#LEVEL}. */
    level?: number;
    /** Rank, requested by {@link OcgQueryFlags#RANK}. */
    rank?: number;
    /** Attribute, requested by {@link OcgQueryFlags#ATTRIBUTE}. */
    attribute?: OcgAttribute;
    /** Race, requested by {@link OcgQueryFlags#RACE}. */
    race?: OcgRace;
    /** Attack, requested by {@link OcgQueryFlags#ATTACK}. */
    attack?: number;
    /** Defense, requested by {@link OcgQueryFlags#DEFENSE}. */
    defense?: number;
    /** Base attack, requested by {@link OcgQueryFlags#BASE_ATTACK}. */
    baseAttack?: number;
    /** Base defense, requested by {@link OcgQueryFlags#BASE_DEFENSE}. */
    baseDefense?: number;
    /** Reason, requested by {@link OcgQueryFlags#REASON}. */
    reason?: number;
    /** Cover, requested by {@link OcgQueryFlags#COVER}. */
    cover?: number;
    /** Reason card, requested by {@link OcgQueryFlags#REASON_CARD}. */
    reasonCard?: OcgCardQueryInfoCard | null;
    /** Equip card, requested by {@link OcgQueryFlags#EQUIP_CARD}. */
    equipCard?: OcgCardQueryInfoCard | null;
    /** Target cards, requested by {@link OcgQueryFlags#TARGET_CARD}. */
    targetCards?: OcgCardQueryInfoCard[];
    /** Overlay card codes, requested by {@link OcgQueryFlags#OVERLAY_CARD}. */
    overlayCards?: number[];
    /** Counters, requested by {@link OcgQueryFlags#COUNTERS}. */
    counters?: Record<number, number>;
    /** Owner, requested by {@link OcgQueryFlags#OWNER}. */
    owner?: number;
    /** Status, requested by {@link OcgQueryFlags#STATUS}. */
    status?: number;
    /** Is public, requested by {@link OcgQueryFlags#IS_PUBLIC}. */
    isPublic?: boolean;
    /** Left scale, requested by {@link OcgQueryFlags#LSCALE}. */
    leftScale?: number;
    /** Right scale, requested by {@link OcgQueryFlags#RSCALE}. */
    rightScale?: number;
    /** Link arrows, requested by {@link OcgQueryFlags#LINK}. */
    link?: {
        /** Rating. */
        rating: number;
        /** Link arrows mask. */
        marker: OcgLinkMarker;
    };
    /** Is hidden, requested by {@link OcgQueryFlags#IS_HIDDEN}. */
    isHidden?: boolean;
};

/** Returned cards by {@link OcgCardQueryInfo}. */
export declare interface OcgCardQueryInfoCard {
    /** Controller. */
    controller: 0 | 1;
    /** Location. */
    location: OcgLocation;
    /** Sequence. */
    sequence: number;
    /** Position. */
    position: OcgPosition;
}

/** Card passcode, location, position, chain info. */
export declare interface OcgChain extends OcgCardLocPos {
    triggering_controller: 0 | 1;
    triggering_location: OcgLocation;
    triggering_sequence: number;
    description: bigint;
}

/** OcgCore interface. */
export declare interface OcgCore {
    /**
     * Request the ocgcore version.
     * @returns The [major, minor] version tuple.
     */
    getVersion(): readonly [number, number];
    /**
     * Create a duel instance.
     * @param options - Creation options.
     * @returns null if the creation failed, a duel handle otherwise.
     */
    createDuel(options: OcgDuelOptions): Promise<OcgDuelHandle | null>;
    /**
     * Deallocates the specified duel.
     * @param handle - A duel handle.
     */
    destroyDuel(handle: OcgDuelHandle): void;
    /**
     * Add a new card to the duel.
     * @param handle - A duel handle.
     * @param cardInfo - The card that will be added.
     */
    duelNewCard(handle: OcgDuelHandle, cardInfo: OcgNewCardInfo): Promise<void>;
    /**
     * Triggers the start of the duel.
     * @param handle - A duel handle.
     */
    startDuel(handle: OcgDuelHandle): Promise<void>;
    /**
     * Performs a process step of the duel.
     * @param handle - A duel handle.
     * @returns The result of the process step.
     *
     * ```ts
     * while (true) {
     *   const status = await lib.duelProcess(handle);
     *   const messages = lib.duelGetMessage(handle);
     *   // handle messages
     *   if (status === OcgProcessResult.END) break;
     *   if (status === OcgProcessResult.CONTINUE) continue;
     *   // reply
     * }
     * ```
     */
    duelProcess(handle: OcgDuelHandle): Promise<OcgProcessResult>;
    /**
     * Get the list of the messages between the last two {@link OcgCore#duelProcess} calls.
     * @param handle - A duel handle.
     * @returns A list of messages.
     */
    duelGetMessage(handle: OcgDuelHandle): OcgMessage[];
    /**
     * Sets the response, called after {@link OcgCore#duelProcess} returns {@link OcgProcessResult#WAITING}.
     * @param handle - A duel handle.
     * @param response - Response object.
     */
    duelSetResponse(handle: OcgDuelHandle, response: OcgResponse): void;
    /**
     * Make the core load and execute the specified script.
     * @param handle - A duel handle
     * @param name - Name of the loaded script.
     * @param content - Contents of the loaded script.
     */
    loadScript(handle: OcgDuelHandle, name: string, content: string): Promise<boolean>;
    /**
     * Counts the number of card of the specified player and location.
     * @param handle - A duel handle
     * @param team - The player to query
     * @param location - The location to query
     * @returns The number of cards.
     */
    duelQueryCount(handle: OcgDuelHandle, team: number, location: OcgLocation): number;
    /**
     * Queries a specific card pulling only the requested informations ({@link OcgQuery#flags})
     * @param handle - A duel handle
     * @param query - The query request
     * @returns An object with all the requested infos.
     */
    duelQuery(handle: OcgDuelHandle, query: OcgQuery): Partial<OcgCardQueryInfo> | null;
    /**
     * Like {@link OcgCore.duelQuery} but for all the cards in the specified location.
     * @param handle - A duel handle
     * @param query - The query request
     * @returns A list of objects with all the requested infos.
     */
    duelQueryLocation(handle: OcgDuelHandle, query: OcgQueryLocation): (Partial<OcgCardQueryInfo> | null)[];
    /**
     * Queries the current field state.
     * @param handle - A duel handle
     * @returns The current field state.
     */
    duelQueryField(handle: OcgDuelHandle): OcgFieldState;
}

export declare type OcgCoreSync = {
    [F in keyof Omit<OcgCore, "createDuel">]: InternalDepromisifyFunction<OcgCore[F]>;
} & {
    createDuel: (options: OcgDuelOptionsSync) => OcgDuelHandle | null;
};

/**
 * Internal representation of a duel.
 */
export declare interface OcgDuelHandle {
    [DuelHandleSymbol]: number;
}

/** Duel creation options. */
export declare type OcgDuelMode = (typeof OcgDuelMode)[Exclude<keyof typeof OcgDuelMode, `MODE_${string}`>];

/** Duel creation options. */
export declare const OcgDuelMode: {
    /** Speed duel ruleset. */
    readonly MODE_SPEED: bigint;
    /** Rush duel ruleset. */
    readonly MODE_RUSH: bigint;
    /** Goat ruleset. */
    readonly MODE_GOAT: bigint;
    /** Master Rule 2 ruleset */
    readonly MODE_MR2: bigint;
    /** Master Rule 3 ruleset */
    readonly MODE_MR3: bigint;
    /** New Master Rule ruleset */
    readonly MODE_MR4: bigint;
    /** New Master Rule (April 2020) ruleset */
    readonly MODE_MR5: bigint;
    /** Master Rule 1 ruleset. */
    readonly MODE_MR1: bigint;
    /** @deprecated Unused. */
    readonly TEST_MODE: 1n;
    /** Allow battle phase in the first turn. */
    readonly ATTACK_FIRST_TURN: 2n;
    /** Continuous traps effects cannot be activated until the end of the chain they're flipped in. */
    readonly USE_TRAPS_IN_NEW_CHAIN: 4n;
    /** After damage calculation substep actually separated sub steps. */
    readonly SIX_STEP_BATLLE_STEP: 8n;
    /** Disable decks shuffling. */
    readonly PSEUDO_SHUFFLE: 16n;
    /** Searching the deck doesn't require knowledge checking. */
    readonly TRIGGER_WHEN_PRIVATE_KNOWLEDGE: 32n;
    /** Automate some responses with a simple AI. */
    readonly SIMPLE_AI: 64n;
    /** Is tag duel. */
    readonly RELAY: 128n;
    /** Master Rule 1 obsolete ignition effects. */
    readonly OBSOLETE_IGNITION: 256n;
    /** Draw on the first turn. */
    readonly FIRST_TURN_DRAW: 512n;
    /** Only allow a single face-up field spell. */
    readonly ONE_FACEUP_FIELD: 1024n;
    /** Enable pendulum zones. */
    readonly PZONE: 2048n;
    /** Pendulum zones are separated from S/T zones. */
    readonly SEPARATE_PZONE: 4096n;
    /** Enable extra monster zone. */
    readonly EMZONE: 8192n;
    /** Fusion, synchro and xyz from the extra deck can go into the main monster zones. */
    readonly FSX_MMZONE: 16384n;
    /** Trap monsters do not take a spell/trap zone aswell as a main monster zone. */
    readonly TRAP_MONSTERS_NOT_USE_ZONE: 32768n;
    /** Return to main deck or extra deck do not trigger "leaving the field" effects. */
    readonly RETURN_TO_DECK_TRIGGERS: 65536n;
    /** Trigger effect cannot be activated if the card is moved to other place. */
    readonly TRIGGER_ONLY_IN_LOCATION: 131072n;
    /** Negated summons and special summons count towards any limit. */
    readonly SPSUMMON_ONCE_OLD_NEGATE: 262144n;
    /** Negated summons and special summons count towards any limit. */
    readonly CANNOT_SUMMON_OATH_OLD: 524288n;
    /** Disable standby phase (rush duels). */
    readonly NO_STANDBY_PHASE: 1048576n;
    /** Disable main phase 2 (rush and speed duels). */
    readonly NO_MAIN_PHASE_2: 2097152n;
    /** Only 3 main monster zones and spell/trap zones (rush and speed duels). */
    readonly THREE_COLUMNS_FIELD: 4194304n;
    /** In draw phase draw until 5 cards in hand (rush duels). */
    readonly DRAW_UNTIL_5: 8388608n;
    /** Disable hand limit checks. */
    readonly NO_HAND_LIMIT: 16777216n;
    /** Remove limit of 1 normal summon per turn (rush duels). */
    readonly UNLIMITED_SUMMONS: 33554432n;
    /** Inverted quick effects priority (rush duels). */
    readonly INVERTED_QUICK_PRIORITY: 67108864n;
    /** The to be equipped monster is not sent to the grave if the equip target is no longer valid (goat duels). */
    readonly EQUIP_NOT_SENT_IF_MISSING_TARGET: 134217728n;
    /** If a 0 atk monster attacks a 0 atk monster, both get destroyed (goat duels). */
    readonly ZERO_ATK_DESTROYED: 268435456n;
    /** Attack replays can be used later (goat duels). */
    readonly STORE_ATTACK_REPLAYS: 536870912n;
    /** One chain per damage sub step (goat duels). */
    readonly SINGLE_CHAIN_IN_DAMAGE_SUBSTEP: 1073741824n;
    /** Cards can be repositioned if the control changed (goat duels). */
    readonly CAN_REPOS_IF_NON_SUMPLAYER: 2147483648n;
    /** TCG Simultaneous Effects Go On Chain for non public knowledge. */
    readonly TCG_SEGOC_NONPUBLIC: 4294967296n;
    /** TCG Simultaneous Effects Go On Chain. */
    readonly TCG_SEGOC_FIRSTTRIGGER: 8589934592n;
};

/**
 * Parse a {@link (OcgDuelMode:type)} mask and return the matching options.
 * @param mode - The mask to parse.
 */
export declare function ocgDuelModeParse(mode: OcgDuelMode): OcgDuelMode[];

/**
 * Convert a {@link (OcgDuelMode:type)} to its string representation.
 */
export declare const ocgDuelModeString: InternalMappedMap<readonly [readonly [1n, "test_mode"], readonly [2n, "attack_first_turn"], readonly [4n, "use_traps_in_new_chain"], readonly [8n, "six_step_batlle_step"], readonly [16n, "pseudo_shuffle"], readonly [32n, "trigger_when_private_knowledge"], readonly [64n, "simple_ai"], readonly [128n, "relay"], readonly [256n, "obsolete_ignition"], readonly [512n, "first_turn_draw"], readonly [1024n, "one_faceup_field"], readonly [2048n, "pzone"], readonly [4096n, "separate_pzone"], readonly [8192n, "emzone"], readonly [16384n, "fsx_mmzone"], readonly [32768n, "trap_monsters_not_use_zone"], readonly [65536n, "return_to_extra_deck_triggers"], readonly [131072n, "trigger_only_in_location"], readonly [262144n, "spsummon_once_old_negate"], readonly [524288n, "cannot_summon_oath_old"], readonly [1048576n, "no_standby_phase"], readonly [2097152n, "no_main_phase_2"], readonly [4194304n, "three_columns_field"], readonly [8388608n, "draw_until_5"], readonly [16777216n, "no_hand_limit"], readonly [33554432n, "unlimited_summons"], readonly [67108864n, "inverted_quick_priority"], readonly [134217728n, "equip_not_sent_if_missing_target"], readonly [268435456n, "zero_atk_destroyed"], readonly [536870912n, "store_attack_replays"], readonly [1073741824n, "single_chain_in_damage_substep"], readonly [2147483648n, "can_repos_if_non_sumplayer"], readonly [4294967296n, "tcg_segoc_nonpublic"], readonly [8589934592n, "tcg_segoc_firsttrigger"], readonly [bigint, "mode_speed"], readonly [bigint, "mode_rush"], readonly [bigint, "mode_goat"], readonly [bigint, "mode_mr2"], readonly [bigint, "mode_mr3"], readonly [bigint, "mode_mr4"], readonly [bigint, "mode_mr5"]]>;

/**
 * Duel creation options.
 */
export declare interface OcgDuelOptions {
    /** Duel flags */
    flags: OcgDuelMode | (bigint & {});
    /** Xoshiro256** seed. Don't use [0n,0n,0n,0n] */
    seed: [bigint, bigint, bigint, bigint];
    /** Team 1 settings. */
    team1: OcgDuelOptionsTeam;
    /** Team 2 settings. */
    team2: OcgDuelOptionsTeam;
    /** Requests card infos for the given passcode. */
    cardReader: (card: number) => Promise<OcgCardData | null> | OcgCardData | null;
    /** Requests the script contents for the given path. */
    scriptReader: (name: string) => Promise<string | null> | string | null;
    /** Handle script or core errors. */
    errorHandler?: (type: OcgLogType, text: string) => void;
}

/**
 * Remapped options for the sync version of the core.
 */
export declare type OcgDuelOptionsSync = {
    [F in keyof OcgDuelOptions]: InternalDepromisifyFunction<OcgDuelOptions[F]>;
};

/**
 * Duel creation team settings.
 */
export declare interface OcgDuelOptionsTeam {
    /** Starting life points. */
    startingLP: number;
    /** Initial hand size. */
    startingDrawCount: number;
    /** How many cards are drawn per turn. */
    drawCountPerTurn: number;
}

export declare enum OcgEffectClientMode {
    NORMAL = 0,
    RESOLVE = 1,
    RESET = 2
}

/**
 * Convert a {@link OcgEffectClientMode} to its string representation.
 */
export declare const ocgEffectClientModeStrings: InternalMappedMap<readonly [readonly [OcgEffectClientMode.NORMAL, "normal"], readonly [OcgEffectClientMode.RESOLVE, "resolve"], readonly [OcgEffectClientMode.RESET, "reset"]]>;

export declare interface OcgFieldCard {
    position: OcgPosition;
    materials: number;
}

export declare interface OcgFieldPlayer {
    monsters: [
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard
    ];
    spells: [
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard,
    OcgFieldCard
    ];
    deck_size: number;
    hand_size: number;
    grave_size: number;
    banish_size: number;
    extra_size: number;
    extra_faceup_count: number;
}

export declare type OcgFieldState = {
    flags: OcgDuelMode;
    players: [OcgFieldPlayer, OcgFieldPlayer];
    chain: OcgChain[];
};

/**
 * Convert a {@link (OcgHintType:type)} to its string representation.
 */
export declare const ocgHintString: InternalMappedMap<readonly [readonly [1, "event"], readonly [2, "message"], readonly [3, "selectmsg"], readonly [4, "opselected"], readonly [5, "effect"], readonly [6, "race"], readonly [7, "attrib"], readonly [8, "code"], readonly [9, "number"], readonly [10, "card"], readonly [11, "zone"]]>;

/** Timing hints */
export declare type OcgHintTiming = (typeof OcgHintTiming)[keyof typeof OcgHintTiming];

/** Timing hints */
export declare const OcgHintTiming: {
    /** In draw phase */
    readonly DRAW_PHASE: 1;
    /** In standby phase */
    readonly STANDBY_PHASE: 2;
    /** Before end of main */
    readonly MAIN_END: 4;
    /** In battle phase */
    readonly BATTLE_START: 8;
    /** After battle */
    readonly BATTLE_END: 16;
    /** In end phase */
    readonly END_PHASE: 32;
    /** After summon */
    readonly SUMMON: 64;
    /** After special summon */
    readonly SPSUMMON: 128;
    /** After flip summon */
    readonly FLIPSUMMON: 256;
    /** After monster set */
    readonly MSET: 512;
    /** After spell set */
    readonly SSET: 1024;
    /** After pos change */
    readonly POS_CHANGE: 2048;
    /** In attack declaration */
    readonly ATTACK: 4096;
    /** In damage step */
    readonly DAMAGE_STEP: 8192;
    /** In damage calculation */
    readonly DAMAGE_CAL: 16384;
    /** After chain resolved */
    readonly CHAIN_END: 32768;
    /** After card draw */
    readonly DRAW: 65536;
    /** After damage */
    readonly DAMAGE: 131072;
    /** After recover */
    readonly RECOVER: 262144;
    /** After destroy */
    readonly DESTROY: 524288;
    /** After banis */
    readonly REMOVE: 1048576;
    /** After card added to the hand */
    readonly TOHAND: 2097152;
    /** After card sent to the deck */
    readonly TODECK: 4194304;
    /** After card sent to the graveyard */
    readonly TOGRAVE: 8388608;
    /** Battle phase */
    readonly BATTLE_PHASE: 16777216;
    /** After equip */
    readonly EQUIP: 33554432;
    /** Battle step end */
    readonly BATTLE_STEP_END: 67108864;
    /** Battled */
    readonly BATTLED: 134217728;
};

/**
 * Parse a {@link (OcgHintTiming:type)} mask and return the matching timings.
 * @param timing - The mask to parse.
 */
export declare function ocgHintTimingParse(timing: OcgHintTiming): OcgHintTiming[];

/**
 * Convert a {@link (OcgHintTiming:type)} to its string representation.
 */
export declare const ocgHintTimingString: InternalMappedMap<readonly [readonly [1, "draw_phase"], readonly [2, "standby_phase"], readonly [4, "main_end"], readonly [8, "battle_start"], readonly [16, "battle_end"], readonly [32, "end_phase"], readonly [64, "summon"], readonly [128, "spsummon"], readonly [256, "flipsummon"], readonly [512, "mset"], readonly [1024, "sset"], readonly [2048, "pos_change"], readonly [4096, "attack"], readonly [8192, "damage_step"], readonly [16384, "damage_cal"], readonly [32768, "chain_end"], readonly [65536, "draw"], readonly [131072, "damage"], readonly [262144, "recover"], readonly [524288, "destroy"], readonly [1048576, "remove"], readonly [2097152, "tohand"], readonly [4194304, "todeck"], readonly [8388608, "tograve"], readonly [16777216, "battle_phase"], readonly [33554432, "equip"], readonly [67108864, "battle_step_end"], readonly [134217728, "battled"]]>;

/** Hint type. */
export declare type OcgHintType = (typeof OcgHintType)[keyof typeof OcgHintType];

/** Hint type. */
export declare const OcgHintType: {
    /** Event. */
    readonly EVENT: 1;
    /** Message. */
    readonly MESSAGE: 2;
    /** Select message. */
    readonly SELECTMSG: 3;
    /** Operation selected. */
    readonly OPSELECTED: 4;
    /** Effect. */
    readonly EFFECT: 5;
    /** Race. */
    readonly RACE: 6;
    /** Attribute. */
    readonly ATTRIB: 7;
    /** Card code. */
    readonly CODE: 8;
    /** Number. */
    readonly NUMBER: 9;
    /** Card. */
    readonly CARD: 10;
    /** Zone. */
    readonly ZONE: 11;
};

/** Link monster markers positions. */
export declare type OcgLinkMarker = number;

/** Link monster markers positions. */
export declare const OcgLinkMarker: {
    BOTTOM_LEFT: number;
    BOTTOM: number;
    BOTTOM_RIGHT: number;
    LEFT: number;
    RIGHT: number;
    TOP_LEFT: number;
    TOP: number;
    TOP_RIGHT: number;
};

/**
 * Parse a {@link (OcgLinkMarker:type)} mask and return the matching markers.
 * @param marker - The mask to parse.
 */
export declare function ocgLinkMarkerParse(marker: OcgLinkMarker): OcgLinkMarker[];

/**
 * Convert a {@link (OcgLinkMarker:type)} to its string representation.
 */
export declare const ocgLinkMarkerString: InternalMappedMap<readonly [readonly [number, "bottom_left"], readonly [number, "bottom"], readonly [number, "bottom_right"], readonly [number, "left"], readonly [number, "right"], readonly [number, "top_left"], readonly [number, "top"], readonly [number, "top_right"]]>;

/** Location of a card. */
export declare type OcgLocation = (typeof OcgLocation)[keyof typeof OcgLocation];

/** Location of a card. */
export declare const OcgLocation: {
    /** Main deck. */
    readonly DECK: 1;
    /** Hand. */
    readonly HAND: 2;
    /** Monster zone. */
    readonly MZONE: 4;
    /** Spell/Trap zone. */
    readonly SZONE: 8;
    /** Graveyard. */
    readonly GRAVE: 16;
    /** Banished (removed from play). */
    readonly REMOVED: 32;
    /** Extra deck. */
    readonly EXTRA: 64;
    /** Xyz material. */
    readonly OVERLAY: 128;
    /** Field spell zone. */
    readonly FZONE: 256;
    /** Pendulum zone. */
    readonly PZONE: 512;
    /** Onfield mask. */
    readonly ONFIELD: 12;
    /** All possible locations mask. */
    readonly ALL: 1023;
};

/**
 * Convert a {@link (OcgLocation:type)} to its string representation.
 */
export declare const ocgLocationString: InternalMappedMap<readonly [readonly [1, "deck"], readonly [2, "hand"], readonly [4, "mzone"], readonly [8, "szone"], readonly [16, "grave"], readonly [32, "removed"], readonly [64, "extra"], readonly [128, "overlay"], readonly [256, "fzone"], readonly [512, "pzone"], readonly [12, "onfield"], readonly [1023, "all"]]>;

/** Location and position. */
export declare interface OcgLocPos {
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
    overlay_sequence?: number;
}

/** Log type. */
export declare type OcgLogType = (typeof OcgLogType)[keyof typeof OcgLogType];

/** Log type. */
export declare const OcgLogType: {
    /** Error. */
    readonly ERROR: 0;
    /** From script. */
    readonly FROM_SCRIPT: 1;
    /** Debug. */
    readonly FOR_DEBUG: 2;
    /** Undefined. */
    readonly UNDEFINED: 3;
};

/**
 * Convert a {@link (OcgLogType:type)} to its string representation.
 */
export declare const ocgLogTypeString: InternalMappedMap<readonly [readonly [0, "error"], readonly [1, "from_script"], readonly [2, "for_debug"], readonly [3, "undefined"]]>;

export declare type OcgMessage = OcgMessageRetry | OcgMessageHint | OcgMessageWaiting | OcgMessageStart | OcgMessageWin | OcgMessageUpdateData | OcgMessageUpdateCard | OcgMessageRequestDeck | OcgMessageSelectBattleCMD | OcgMessageSelectIdlecmd | OcgMessageSelectEffectYN | OcgMessageSelectYesno | OcgMessageSelectOption | OcgMessageSelectCard | OcgMessageSelectChain | OcgMessageSelectPlace | OcgMessageSelectPosition | OcgMessageSelectTribute | OcgMessageSortChain | OcgMessageSelectCounter | OcgMessageSelectSum | OcgMessageSelectDisfield | OcgMessageSortCard | OcgMessageSelectUnselectCard | OcgMessageConfirmDeckTop | OcgMessageConfirmCards | OcgMessageShuffleDeck | OcgMessageShuffleHand | OcgMessageRefreshDeck | OcgMessageSwapGraveDeck | OcgMessageShuffleSetCard | OcgMessageReverseDeck | OcgMessageDeckTop | OcgMessageShuffleExtra | OcgMessageNewTurn | OcgMessageNewPhase | OcgMessageConfirmExtratop | OcgMessageMove | OcgMessagePosChange | OcgMessageSet | OcgMessageSwap | OcgMessageFieldDisabled | OcgMessageSummoning | OcgMessageSummoned | OcgMessageSpsummoning | OcgMessageSpsummoned | OcgMessageFlipsummoning | OcgMessageFlipsummoned | OcgMessageChaining | OcgMessageChained | OcgMessageChainSolving | OcgMessageChainSolved | OcgMessageChainEnd | OcgMessageChainNegated | OcgMessageChainDisabled | OcgMessageCardSelected | OcgMessageRandomSelected | OcgMessageBecomeTarget | OcgMessageDraw | OcgMessageDamage | OcgMessageRecover | OcgMessageEquip | OcgMessageLPUpdate | OcgMessageCardTarget | OcgMessageCancelTarget | OcgMessagePayLPCost | OcgMessageAddCounter | OcgMessageRemoveCounter | OcgMessageAttack | OcgMessageBattle | OcgMessageAttackDisabled | OcgMessageDamageStepStart | OcgMessageDamageStepEnd | OcgMessageMissedEffect | OcgMessageBeChainTarget | OcgMessageCreateRelation | OcgMessageReleaseRelation | OcgMessageTossCoin | OcgMessageTossDice | OcgMessageRockPaperScissors | OcgMessageHandRes | OcgMessageAnnounceRace | OcgMessageAnnounceAttrib | OcgMessageAnnounceCard | OcgMessageAnnounceNumber | OcgMessageCardHint | OcgMessageTagSwap | OcgMessageReloadField | OcgMessageAiName | OcgMessageShowHint | OcgMessagePlayerHint | OcgMessageMatchKill | OcgMessageCustomMsg | OcgMessageRemoveCards;

export declare interface OcgMessageAddCounter {
    type: OcgMessageType.ADD_COUNTER;
    counter_type: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    count: number;
}

export declare interface OcgMessageAiName {
    type: OcgMessageType.AI_NAME;
    name: string;
}

export declare interface OcgMessageAnnounceAttrib {
    type: OcgMessageType.ANNOUNCE_ATTRIB;
    player: number;
    count: number;
    available: OcgAttribute;
}

export declare interface OcgMessageAnnounceCard {
    type: OcgMessageType.ANNOUNCE_CARD;
    player: number;
    opcodes: OcgOpCode[];
}

export declare interface OcgMessageAnnounceNumber {
    type: OcgMessageType.ANNOUNCE_NUMBER;
    player: number;
    options: bigint[];
}

export declare interface OcgMessageAnnounceRace {
    type: OcgMessageType.ANNOUNCE_RACE;
    player: number;
    count: number;
    available: OcgRace;
}

export declare interface OcgMessageAttack {
    type: OcgMessageType.ATTACK;
    card: OcgLocPos;
    target: OcgLocPos | null;
}

export declare interface OcgMessageAttackDisabled {
    type: OcgMessageType.ATTACK_DISABLED;
}

export declare interface OcgMessageBattle {
    type: OcgMessageType.BATTLE;
    card: OcgCardLocBattle;
    target: OcgCardLocBattle | null;
}

export declare interface OcgMessageBeChainTarget {
    type: OcgMessageType.BE_CHAIN_TARGET;
}

export declare interface OcgMessageBecomeTarget {
    type: OcgMessageType.BECOME_TARGET;
    cards: OcgLocPos[];
}

export declare interface OcgMessageCancelTarget {
    type: OcgMessageType.CANCEL_TARGET;
    card: OcgLocPos;
    target: OcgLocPos;
}

export declare interface OcgMessageCardHint {
    type: OcgMessageType.CARD_HINT;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
    overlay_sequence?: number;
    card_hint: OcgCardHintType;
    description: bigint;
}

export declare interface OcgMessageCardSelected {
    type: OcgMessageType.CARD_SELECTED;
    cards: OcgLocPos[];
}

export declare interface OcgMessageCardTarget {
    type: OcgMessageType.CARD_TARGET;
    card: OcgLocPos;
    target: OcgLocPos;
}

export declare interface OcgMessageChainDisabled {
    type: OcgMessageType.CHAIN_DISABLED;
    chain_size: number;
}

export declare interface OcgMessageChained {
    type: OcgMessageType.CHAINED;
    chain_size: number;
}

export declare interface OcgMessageChainEnd {
    type: OcgMessageType.CHAIN_END;
}

export declare interface OcgMessageChaining {
    type: OcgMessageType.CHAINING;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
    overlay_sequence?: number;
    triggering_controller: 0 | 1;
    triggering_location: OcgLocation;
    triggering_sequence: number;
    description: bigint;
    chain_size: number;
}

export declare interface OcgMessageChainNegated {
    type: OcgMessageType.CHAIN_NEGATED;
    chain_size: number;
}

export declare interface OcgMessageChainSolved {
    type: OcgMessageType.CHAIN_SOLVED;
    chain_size: number;
}

export declare interface OcgMessageChainSolving {
    type: OcgMessageType.CHAIN_SOLVING;
    chain_size: number;
}

/** Confirm the list of cards before they go into unknown locations. */
export declare interface OcgMessageConfirmCards {
    type: OcgMessageType.CONFIRM_CARDS;
    player: number;
    cards: OcgCardLoc[];
}

/** Confirm the list of excavated cards. */
export declare interface OcgMessageConfirmDeckTop {
    type: OcgMessageType.CONFIRM_DECKTOP;
    player: number;
    cards: OcgCardLoc[];
}

export declare interface OcgMessageConfirmExtratop {
    type: OcgMessageType.CONFIRM_EXTRATOP;
    player: number;
    cards: OcgCardLoc[];
}

export declare interface OcgMessageCreateRelation {
    type: OcgMessageType.CREATE_RELATION;
}

export declare interface OcgMessageCustomMsg {
    type: OcgMessageType.CUSTOM_MSG;
}

export declare interface OcgMessageDamage {
    type: OcgMessageType.DAMAGE;
    player: number;
    amount: number;
}

export declare interface OcgMessageDamageStepEnd {
    type: OcgMessageType.DAMAGE_STEP_END;
}

export declare interface OcgMessageDamageStepStart {
    type: OcgMessageType.DAMAGE_STEP_START;
}

/** Card on top of the deck changed. */
export declare interface OcgMessageDeckTop {
    type: OcgMessageType.DECK_TOP;
    player: number;
    count: number;
    code: number;
    position: OcgPosition;
    overlay_sequence?: number;
}

export declare interface OcgMessageDraw {
    type: OcgMessageType.DRAW;
    player: number;
    drawn: {
        code: number;
        position: OcgPosition;
    }[];
}

export declare interface OcgMessageEquip {
    type: OcgMessageType.EQUIP;
    card: OcgLocPos;
    target: OcgLocPos;
}

export declare interface OcgMessageFieldDisabled {
    type: OcgMessageType.FIELD_DISABLED;
    field_mask: number;
}

export declare interface OcgMessageFlipsummoned {
    type: OcgMessageType.FLIPSUMMONED;
}

export declare interface OcgMessageFlipsummoning {
    type: OcgMessageType.FLIPSUMMONING;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
}

export declare interface OcgMessageHandRes {
    type: OcgMessageType.HAND_RES;
    results: readonly [OcgRPS, OcgRPS];
}

/** Additional information, usually card specific or for things that don't belong to a specific message. */
export declare interface OcgMessageHint {
    type: OcgMessageType.HINT;
    hint_type: OcgHintType;
    player: number;
    hint: bigint;
}

export declare interface OcgMessageLPUpdate {
    type: OcgMessageType.LPUPDATE;
    player: number;
    lp: number;
}

export declare interface OcgMessageMatchKill {
    type: OcgMessageType.MATCH_KILL;
    card: number;
}

export declare interface OcgMessageMissedEffect {
    type: OcgMessageType.MISSED_EFFECT;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
    overlay_sequence?: number;
}

export declare interface OcgMessageMove {
    type: OcgMessageType.MOVE;
    card: number;
    from: OcgLocPos;
    to: OcgLocPos;
}

export declare interface OcgMessageNewPhase {
    type: OcgMessageType.NEW_PHASE;
    phase: OcgPhase;
}

export declare interface OcgMessageNewTurn {
    type: OcgMessageType.NEW_TURN;
    player: number;
}

export declare interface OcgMessagePayLPCost {
    type: OcgMessageType.PAY_LPCOST;
    player: number;
    amount: number;
}

export declare interface OcgMessagePlayerHint {
    type: OcgMessageType.PLAYER_HINT;
    player: number;
    player_hint: OcgPlayerHintType;
    description: bigint;
}

export declare interface OcgMessagePosChange {
    type: OcgMessageType.POS_CHANGE;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    prev_position: OcgPosition;
    position: OcgPosition;
}

export declare interface OcgMessageRandomSelected {
    type: OcgMessageType.RANDOM_SELECTED;
    player: number;
    cards: OcgLocPos[];
}

export declare interface OcgMessageRecover {
    type: OcgMessageType.RECOVER;
    player: number;
    amount: number;
}

/** @deprecated Not used. */
export declare interface OcgMessageRefreshDeck {
    type: OcgMessageType.REFRESH_DECK;
}

export declare interface OcgMessageReleaseRelation {
    type: OcgMessageType.RELEASE_RELATION;
}

export declare interface OcgMessageReloadField extends OcgFieldState {
    type: OcgMessageType.RELOAD_FIELD;
}

export declare interface OcgMessageRemoveCards {
    type: OcgMessageType.REMOVE_CARDS;
    cards: OcgLocPos[];
}

export declare interface OcgMessageRemoveCounter {
    type: OcgMessageType.REMOVE_COUNTER;
    counter_type: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    count: number;
}

/** @deprecated Not used. */
export declare interface OcgMessageRequestDeck {
    type: OcgMessageType.REQUEST_DECK;
}

/** Sent when an invalid response was provided. */
export declare interface OcgMessageRetry {
    type: OcgMessageType.RETRY;
}

/** Deck order was reversed for both players. */
export declare interface OcgMessageReverseDeck {
    type: OcgMessageType.REVERSE_DECK;
}

export declare interface OcgMessageRockPaperScissors {
    type: OcgMessageType.ROCK_PAPER_SCISSORS;
    player: number;
}

/** Available battle step actions. */
export declare interface OcgMessageSelectBattleCMD {
    type: OcgMessageType.SELECT_BATTLECMD;
    player: number;
    /** Activatable cards. */
    chains: OcgCardLocActive[];
    /** Cards that can attack. */
    attacks: OcgCardLocAttack[];
    /** Can go to main phase 2. */
    to_m2: boolean;
    /** Can go to end phase. */
    to_ep: boolean;
}

/** Select a card. */
export declare interface OcgMessageSelectCard {
    type: OcgMessageType.SELECT_CARD;
    player: number;
    can_cancel: boolean;
    min: number;
    max: number;
    selects: OcgCardLocPos[];
}

/** Select to chain in response (if possible). */
export declare interface OcgMessageSelectChain {
    type: OcgMessageType.SELECT_CHAIN;
    player: number;
    spe_count: number;
    forced: boolean;
    hint_timing: OcgHintTiming;
    hint_timing_other: OcgHintTiming;
    selects: OcgCardLocPosActive[];
}

/** Select counters from cards on the field. */
export declare interface OcgMessageSelectCounter {
    type: OcgMessageType.SELECT_COUNTER;
    player: number;
    counter_type: number;
    count: number;
    cards: OcgCardLocCounter[];
}

/** Select a place on the field to disable. */
export declare interface OcgMessageSelectDisfield {
    type: OcgMessageType.SELECT_DISFIELD;
    player: number;
    count: number;
    field_mask: number;
}

/** Select a response (yes or no) to a card effect. */
export declare interface OcgMessageSelectEffectYN {
    type: OcgMessageType.SELECT_EFFECTYN;
    player: number;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
    overlay_sequence?: number;
    description: bigint;
}

/** Choose a main phase (1 or 2) action. */
export declare interface OcgMessageSelectIdlecmd {
    type: OcgMessageType.SELECT_IDLECMD;
    player: number;
    /** Summonable cards. */
    summons: OcgCardLoc[];
    /** Special summonable cards. */
    special_summons: OcgCardLoc[];
    /** Cards that can change battle position. */
    pos_changes: OcgCardLoc[];
    /** Settable monster cards. */
    monster_sets: OcgCardLoc[];
    /** Settable spell/trap cards. */
    spell_sets: OcgCardLoc[];
    /** Activatable cards. */
    activates: OcgCardLocActive[];
    /** Can go to battle phase. */
    to_bp: boolean;
    /** Can go to end phase. */
    to_ep: boolean;
    /** Can manually shuffle. */
    shuffle: boolean;
}

/** Select an option. */
export declare interface OcgMessageSelectOption {
    type: OcgMessageType.SELECT_OPTION;
    player: number;
    options: bigint[];
}

/** Select a place on the field. */
export declare interface OcgMessageSelectPlace {
    type: OcgMessageType.SELECT_PLACE;
    player: number;
    count: number;
    field_mask: number;
}

/** Select a possible position from the mask. */
export declare interface OcgMessageSelectPosition {
    type: OcgMessageType.SELECT_POSITION;
    player: number;
    code: number;
    positions: OcgPosition;
}

/** Select a specific amount from cards. */
export declare interface OcgMessageSelectSum {
    type: OcgMessageType.SELECT_SUM;
    player: number;
    select_max: number;
    amount: number;
    min: number;
    max: number;
    selects_must: OcgCardLocSum[];
    selects: OcgCardLocSum[];
}

/** Select a list of tributes. */
export declare interface OcgMessageSelectTribute {
    type: OcgMessageType.SELECT_TRIBUTE;
    player: number;
    can_cancel: boolean;
    min: number;
    max: number;
    selects: OcgCardLocTribute[];
}

/** Select or unselect cards until the condition is satisfied. */
export declare interface OcgMessageSelectUnselectCard {
    type: OcgMessageType.SELECT_UNSELECT_CARD;
    player: number;
    can_finish: boolean;
    can_cancel: boolean;
    min: number;
    max: number;
    select_cards: OcgCardLocPos[];
    unselect_cards: OcgCardLocPos[];
}

/** Select a response (yes or no). */
export declare interface OcgMessageSelectYesno {
    type: OcgMessageType.SELECT_YESNO;
    player: number;
    description: bigint;
}

export declare interface OcgMessageSet {
    type: OcgMessageType.SET;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
}

export declare interface OcgMessageShowHint {
    type: OcgMessageType.SHOW_HINT;
    hint: string;
}

/** Deck of player was shuffled. */
export declare interface OcgMessageShuffleDeck {
    type: OcgMessageType.SHUFFLE_DECK;
    player: number;
}

export declare interface OcgMessageShuffleExtra {
    type: OcgMessageType.SHUFFLE_EXTRA;
    player: number;
    cards: number[];
}

/** Hand of player was shuffled. */
export declare interface OcgMessageShuffleHand {
    type: OcgMessageType.SHUFFLE_HAND;
    player: number;
    cards: number[];
}

/** The specified cards were shuffled face down. */
export declare interface OcgMessageShuffleSetCard {
    type: OcgMessageType.SHUFFLE_SET_CARD;
    location: OcgLocation;
    cards: {
        from: OcgLocPos;
        to: OcgLocPos;
    }[];
}

/** Select an order for the list of cards. */
export declare interface OcgMessageSortCard {
    type: OcgMessageType.SORT_CARD;
    player: number;
    cards: OcgCardLoc[];
}

/** Select how to sort the chain. */
export declare interface OcgMessageSortChain {
    type: OcgMessageType.SORT_CHAIN;
    player: number;
    cards: OcgCardLoc[];
}

export declare interface OcgMessageSpsummoned {
    type: OcgMessageType.SPSUMMONED;
}

export declare interface OcgMessageSpsummoning {
    type: OcgMessageType.SPSUMMONING;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
}

/** Duel start. */
export declare interface OcgMessageStart {
    type: OcgMessageType.START;
}

export declare interface OcgMessageSummoned {
    type: OcgMessageType.SUMMONED;
}

export declare interface OcgMessageSummoning {
    type: OcgMessageType.SUMMONING;
    code: number;
    controller: 0 | 1;
    location: OcgLocation;
    sequence: number;
    position: OcgPosition;
}

export declare interface OcgMessageSwap {
    type: OcgMessageType.SWAP;
    card1: OcgCardLocPos;
    card2: OcgCardLocPos;
}

/** Deck and grave of player were swapped. */
export declare interface OcgMessageSwapGraveDeck {
    type: OcgMessageType.SWAP_GRAVE_DECK;
    player: number;
    deck_size: number;
    returned_to_extra: number[];
}

export declare interface OcgMessageTagSwap {
    type: OcgMessageType.TAG_SWAP;
    player: number;
    deck_size: number;
    extra_faceup_count: number;
    deck_top_card: number | null;
    hand: OcgCardPos[];
    extra: OcgCardPos[];
}

export declare interface OcgMessageTossCoin {
    type: OcgMessageType.TOSS_COIN;
    player: number;
    results: boolean[];
}

export declare interface OcgMessageTossDice {
    type: OcgMessageType.TOSS_DICE;
    player: number;
    results: number[];
}

/** Message type enum. */
export declare enum OcgMessageType {
    RETRY = 1,
    HINT = 2,
    WAITING = 3,
    START = 4,
    WIN = 5,
    UPDATE_DATA = 6,
    UPDATE_CARD = 7,
    REQUEST_DECK = 8,
    SELECT_BATTLECMD = 10,
    SELECT_IDLECMD = 11,
    SELECT_EFFECTYN = 12,
    SELECT_YESNO = 13,
    SELECT_OPTION = 14,
    SELECT_CARD = 15,
    SELECT_CHAIN = 16,
    SELECT_PLACE = 18,
    SELECT_POSITION = 19,
    SELECT_TRIBUTE = 20,
    SORT_CHAIN = 21,
    SELECT_COUNTER = 22,
    SELECT_SUM = 23,
    SELECT_DISFIELD = 24,
    SORT_CARD = 25,
    SELECT_UNSELECT_CARD = 26,
    CONFIRM_DECKTOP = 30,
    CONFIRM_CARDS = 31,
    SHUFFLE_DECK = 32,
    SHUFFLE_HAND = 33,
    REFRESH_DECK = 34,
    SWAP_GRAVE_DECK = 35,
    SHUFFLE_SET_CARD = 36,
    REVERSE_DECK = 37,
    DECK_TOP = 38,
    SHUFFLE_EXTRA = 39,
    NEW_TURN = 40,
    NEW_PHASE = 41,
    CONFIRM_EXTRATOP = 42,
    MOVE = 50,
    POS_CHANGE = 53,
    SET = 54,
    SWAP = 55,
    FIELD_DISABLED = 56,
    SUMMONING = 60,
    SUMMONED = 61,
    SPSUMMONING = 62,
    SPSUMMONED = 63,
    FLIPSUMMONING = 64,
    FLIPSUMMONED = 65,
    CHAINING = 70,
    CHAINED = 71,
    CHAIN_SOLVING = 72,
    CHAIN_SOLVED = 73,
    CHAIN_END = 74,
    CHAIN_NEGATED = 75,
    CHAIN_DISABLED = 76,
    CARD_SELECTED = 80,
    RANDOM_SELECTED = 81,
    BECOME_TARGET = 83,
    DRAW = 90,
    DAMAGE = 91,
    RECOVER = 92,
    EQUIP = 93,
    LPUPDATE = 94,
    CARD_TARGET = 96,
    CANCEL_TARGET = 97,
    PAY_LPCOST = 100,
    ADD_COUNTER = 101,
    REMOVE_COUNTER = 102,
    ATTACK = 110,
    BATTLE = 111,
    ATTACK_DISABLED = 112,
    DAMAGE_STEP_START = 113,
    DAMAGE_STEP_END = 114,
    MISSED_EFFECT = 120,
    BE_CHAIN_TARGET = 121,
    CREATE_RELATION = 122,
    RELEASE_RELATION = 123,
    TOSS_COIN = 130,
    TOSS_DICE = 131,
    ROCK_PAPER_SCISSORS = 132,
    HAND_RES = 133,
    ANNOUNCE_RACE = 140,
    ANNOUNCE_ATTRIB = 141,
    ANNOUNCE_CARD = 142,
    ANNOUNCE_NUMBER = 143,
    CARD_HINT = 160,
    TAG_SWAP = 161,
    RELOAD_FIELD = 162,
    AI_NAME = 163,
    SHOW_HINT = 164,
    PLAYER_HINT = 165,
    MATCH_KILL = 170,
    CUSTOM_MSG = 180,
    REMOVE_CARDS = 190
}

/**
 * Convert a {@link OcgMessageType} to its string representation.
 */
export declare const ocgMessageTypeStrings: InternalMappedMap<readonly [readonly [OcgMessageType.RETRY, "retry"], readonly [OcgMessageType.HINT, "hint"], readonly [OcgMessageType.WAITING, "waiting"], readonly [OcgMessageType.START, "start"], readonly [OcgMessageType.WIN, "win"], readonly [OcgMessageType.UPDATE_DATA, "update_data"], readonly [OcgMessageType.UPDATE_CARD, "update_card"], readonly [OcgMessageType.REQUEST_DECK, "request_deck"], readonly [OcgMessageType.SELECT_BATTLECMD, "select_battlecmd"], readonly [OcgMessageType.SELECT_IDLECMD, "select_idlecmd"], readonly [OcgMessageType.SELECT_EFFECTYN, "select_effectyn"], readonly [OcgMessageType.SELECT_YESNO, "select_yesno"], readonly [OcgMessageType.SELECT_OPTION, "select_option"], readonly [OcgMessageType.SELECT_CARD, "select_card"], readonly [OcgMessageType.SELECT_CHAIN, "select_chain"], readonly [OcgMessageType.SELECT_PLACE, "select_place"], readonly [OcgMessageType.SELECT_POSITION, "select_position"], readonly [OcgMessageType.SELECT_TRIBUTE, "select_tribute"], readonly [OcgMessageType.SORT_CHAIN, "sort_chain"], readonly [OcgMessageType.SELECT_COUNTER, "select_counter"], readonly [OcgMessageType.SELECT_SUM, "select_sum"], readonly [OcgMessageType.SELECT_DISFIELD, "select_disfield"], readonly [OcgMessageType.SORT_CARD, "sort_card"], readonly [OcgMessageType.SELECT_UNSELECT_CARD, "select_unselect_card"], readonly [OcgMessageType.CONFIRM_DECKTOP, "confirm_decktop"], readonly [OcgMessageType.CONFIRM_CARDS, "confirm_cards"], readonly [OcgMessageType.SHUFFLE_DECK, "shuffle_deck"], readonly [OcgMessageType.SHUFFLE_HAND, "shuffle_hand"], readonly [OcgMessageType.REFRESH_DECK, "refresh_deck"], readonly [OcgMessageType.SWAP_GRAVE_DECK, "swap_grave_deck"], readonly [OcgMessageType.SHUFFLE_SET_CARD, "shuffle_set_card"], readonly [OcgMessageType.REVERSE_DECK, "reverse_deck"], readonly [OcgMessageType.DECK_TOP, "deck_top"], readonly [OcgMessageType.SHUFFLE_EXTRA, "shuffle_extra"], readonly [OcgMessageType.NEW_TURN, "new_turn"], readonly [OcgMessageType.NEW_PHASE, "new_phase"], readonly [OcgMessageType.CONFIRM_EXTRATOP, "confirm_extratop"], readonly [OcgMessageType.MOVE, "move"], readonly [OcgMessageType.POS_CHANGE, "pos_change"], readonly [OcgMessageType.SET, "set"], readonly [OcgMessageType.SWAP, "swap"], readonly [OcgMessageType.FIELD_DISABLED, "field_disabled"], readonly [OcgMessageType.SUMMONING, "summoning"], readonly [OcgMessageType.SUMMONED, "summoned"], readonly [OcgMessageType.SPSUMMONING, "spsummoning"], readonly [OcgMessageType.SPSUMMONED, "spsummoned"], readonly [OcgMessageType.FLIPSUMMONING, "flipsummoning"], readonly [OcgMessageType.FLIPSUMMONED, "flipsummoned"], readonly [OcgMessageType.CHAINING, "chaining"], readonly [OcgMessageType.CHAINED, "chained"], readonly [OcgMessageType.CHAIN_SOLVING, "chain_solving"], readonly [OcgMessageType.CHAIN_SOLVED, "chain_solved"], readonly [OcgMessageType.CHAIN_END, "chain_end"], readonly [OcgMessageType.CHAIN_NEGATED, "chain_negated"], readonly [OcgMessageType.CHAIN_DISABLED, "chain_disabled"], readonly [OcgMessageType.CARD_SELECTED, "card_selected"], readonly [OcgMessageType.RANDOM_SELECTED, "random_selected"], readonly [OcgMessageType.BECOME_TARGET, "become_target"], readonly [OcgMessageType.DRAW, "draw"], readonly [OcgMessageType.DAMAGE, "damage"], readonly [OcgMessageType.RECOVER, "recover"], readonly [OcgMessageType.EQUIP, "equip"], readonly [OcgMessageType.LPUPDATE, "lpupdate"], readonly [OcgMessageType.CARD_TARGET, "card_target"], readonly [OcgMessageType.CANCEL_TARGET, "cancel_target"], readonly [OcgMessageType.PAY_LPCOST, "pay_lpcost"], readonly [OcgMessageType.ADD_COUNTER, "add_counter"], readonly [OcgMessageType.REMOVE_COUNTER, "remove_counter"], readonly [OcgMessageType.ATTACK, "attack"], readonly [OcgMessageType.BATTLE, "battle"], readonly [OcgMessageType.ATTACK_DISABLED, "attack_disabled"], readonly [OcgMessageType.DAMAGE_STEP_START, "damage_step_start"], readonly [OcgMessageType.DAMAGE_STEP_END, "damage_step_end"], readonly [OcgMessageType.MISSED_EFFECT, "missed_effect"], readonly [OcgMessageType.BE_CHAIN_TARGET, "be_chain_target"], readonly [OcgMessageType.CREATE_RELATION, "create_relation"], readonly [OcgMessageType.RELEASE_RELATION, "release_relation"], readonly [OcgMessageType.TOSS_COIN, "toss_coin"], readonly [OcgMessageType.TOSS_DICE, "toss_dice"], readonly [OcgMessageType.ROCK_PAPER_SCISSORS, "rock_paper_scissors"], readonly [OcgMessageType.HAND_RES, "hand_res"], readonly [OcgMessageType.ANNOUNCE_RACE, "announce_race"], readonly [OcgMessageType.ANNOUNCE_ATTRIB, "announce_attrib"], readonly [OcgMessageType.ANNOUNCE_CARD, "announce_card"], readonly [OcgMessageType.ANNOUNCE_NUMBER, "announce_number"], readonly [OcgMessageType.CARD_HINT, "card_hint"], readonly [OcgMessageType.TAG_SWAP, "tag_swap"], readonly [OcgMessageType.RELOAD_FIELD, "reload_field"], readonly [OcgMessageType.AI_NAME, "ai_name"], readonly [OcgMessageType.SHOW_HINT, "show_hint"], readonly [OcgMessageType.PLAYER_HINT, "player_hint"], readonly [OcgMessageType.MATCH_KILL, "match_kill"], readonly [OcgMessageType.CUSTOM_MSG, "custom_msg"], readonly [OcgMessageType.REMOVE_CARDS, "remove_cards"]]>;

/** @deprecated Not used. */
export declare interface OcgMessageUpdateCard {
    type: OcgMessageType.UPDATE_CARD;
}

/** @deprecated Not used. */
export declare interface OcgMessageUpdateData {
    type: OcgMessageType.UPDATE_DATA;
}

/** Provide a response. */
export declare interface OcgMessageWaiting {
    type: OcgMessageType.WAITING;
}

/** Duel win. */
export declare interface OcgMessageWin {
    type: OcgMessageType.WIN;
    player: number;
    reason: number;
}

/**
 * Card creation definition. Used in {@link OcgCore#duelNewCard}.
 */
export declare interface OcgNewCardInfo {
    /** Owner team. */
    team: 0 | 1;
    /** Owner duelist index, always 0 unless it's a tag duel. */
    duelist: number;
    /** Card passcode. */
    code: number;
    /** Current controller of the card. Usually same as team. */
    controller: 0 | 1;
    /** Current location of the card. If duelist isn't 0 then it should always be {@link OcgLocation#DECK} or {@link OcgLocation#EXTRA} */
    location: OcgLocation;
    /**
     * Index of the card in the specified location.
     * If location is DECK then if sequence == 0 it's the top, if sequence == 1 it's the bottom, otherwise the deck is shuffled.
     * If location is EXTRA, REMOVED, GRAVE, or HAND it's ignored.
     */
    sequence: number;
    /** Position, may be automatically overriden depending on the location. */
    position: OcgPosition;
}

/** Opcode for the stack based card announcing process, used in {@link OcgMessageAnnounceCard}. */
export declare type OcgOpCode = (typeof OcgOpCode)[keyof typeof OcgOpCode];

/** Available Opcodes, any value that isn't a Opcode is added to the stack. */
export declare const OcgOpCode: {
    /** stack in: ... (A) (B); stack out: ... (A + B) */
    ADD: bigint;
    /** stack in: ... (A) (B); stack out: ... (A - B) */
    SUB: bigint;
    /** stack in: ... (A) (B); stack out: ... (A * B) */
    MUL: bigint;
    /** stack in: ... (A) (B); stack out: ... (A / B) */
    DIV: bigint;
    /** stack in: ... (A) (B); stack out: ... (A && B) */
    AND: bigint;
    /** stack in: ... (A) (B); stack out: ... (A || B) */
    OR: bigint;
    /** stack in: ... (A); stack out: ... (-A) */
    NEG: bigint;
    /** stack in: ... (A); stack out: ... (!A) */
    NOT: bigint;
    /** stack in: ... (A) (B); stack out: ... (A & B) */
    BAND: bigint;
    /** stack in: ... (A) (B); stack out: ... (A | B) */
    BOR: bigint;
    /** stack in: ... (A); stack out: ... (~A) */
    BNOT: bigint;
    /** stack in: ... (A) (B); stack out: ... (A ^ B) */
    BXOR: bigint;
    /** stack in: ... (A) (B); stack out: ... (A \<\< B) */
    LSHIFT: bigint;
    /** stack in: ... (A) (B); stack out: ... (A \>\> B) */
    RSHIFT: bigint;
    /** stack in: ...; stack out: ... */
    ALLOW_ALIASES: bigint;
    /** stack in: ...; stack out: ... */
    ALLOW_TOKENS: bigint;
    /** stack in: ... (A); stack out: ... (A == code) */
    ISCODE: bigint;
    /** stack in: ... (A); stack out: ... (setcodes includes A) */
    ISSETCARD: bigint;
    /** stack in: ... (A); stack out: ... (A == type) */
    ISTYPE: bigint;
    /** stack in: ... (A); stack out: ... (A == race) */
    ISRACE: bigint;
    /** stack in: ... (A); stack out: ... (A == attribute) */
    ISATTRIBUTE: bigint;
    /** stack in: ...; stack out: ... (code) */
    GETCODE: bigint;
    /** @deprecated Does nothing. */
    GETSETCARD: bigint;
    /** stack in: ...; stack out: ... (type) */
    GETTYPE: bigint;
    /** stack in: ...; stack out: ... (race) */
    GETRACE: bigint;
    /** stack in: ...; stack out: ... (attribute) */
    GETATTRIBUTE: bigint;
};

/**
 * Convert a {@link (OcgOpCode:type)} to its string representation.
 */
export declare const ocgOpCodeString: InternalMappedMap<readonly [readonly [bigint, "add"], readonly [bigint, "sub"], readonly [bigint, "mul"], readonly [bigint, "div"], readonly [bigint, "and"], readonly [bigint, "or"], readonly [bigint, "neg"], readonly [bigint, "not"], readonly [bigint, "band"], readonly [bigint, "bor"], readonly [bigint, "bnot"], readonly [bigint, "bxor"], readonly [bigint, "lshift"], readonly [bigint, "rshift"], readonly [bigint, "allow_aliases"], readonly [bigint, "allow_tokens"], readonly [bigint, "iscode"], readonly [bigint, "issetcard"], readonly [bigint, "istype"], readonly [bigint, "israce"], readonly [bigint, "isattribute"], readonly [bigint, "getcode"], readonly [bigint, "getsetcard"], readonly [bigint, "gettype"], readonly [bigint, "getrace"], readonly [bigint, "getattribute"]]>;

/** Turn phase. */
export declare type OcgPhase = (typeof OcgPhase)[keyof typeof OcgPhase];

/** Turn phase. */
export declare const OcgPhase: {
    /** Draw phase. */
    readonly DRAW: 1;
    /** Stand-by phase. */
    readonly STANDBY: 2;
    /** Main phase 1. */
    readonly MAIN1: 4;
    /** Battle phase: start step */
    readonly BATTLE_START: 8;
    /** Battle phase: battle step */
    readonly BATTLE_STEP: 16;
    /** Battle phase: damage step */
    readonly DAMAGE: 32;
    /** Battle phase: damage calculation */
    readonly DAMAGE_CAL: 64;
    /** Battle phase: end step */
    readonly BATTLE: 128;
    /** Main phase 2. */
    readonly MAIN2: 256;
    /** End phase. */
    readonly END: 512;
};

/**
 * Convert a {@link (OcgPhase:type)} to its string representation.
 */
export declare const ocgPhaseString: InternalMappedMap<readonly [readonly [1, "draw"], readonly [2, "standby"], readonly [4, "main1"], readonly [8, "battle_start"], readonly [16, "battle_step"], readonly [32, "damage"], readonly [64, "damage_cal"], readonly [128, "battle"], readonly [256, "main2"], readonly [512, "end"]]>;

export declare enum OcgPlayerHintType {
    DESC_ADD = 6,
    DESC_REMOVE = 7
}

/**
 * Convert a {@link OcgPlayerHintType} to its string representation.
 */
export declare const ocgPlayerHintTypeStrings: InternalMappedMap<readonly [readonly [OcgPlayerHintType.DESC_ADD, "desc_add"], readonly [OcgPlayerHintType.DESC_REMOVE, "desc_remove"]]>;

/** Position (faceup or facedown and defense or attack) of a card. */
export declare type OcgPosition = (typeof OcgPosition)[keyof typeof OcgPosition];

/** Position (faceup or facedown and defense or attack) of a card. */
export declare const OcgPosition: {
    /** FACEUP_ATTACK */
    readonly FACEUP_ATTACK: 1;
    /** FACEDOWN_ATTACK */
    readonly FACEDOWN_ATTACK: 2;
    /** FACEUP_DEFENSE */
    readonly FACEUP_DEFENSE: 4;
    /** FACEDOWN_DEFENSE */
    readonly FACEDOWN_DEFENSE: 8;
    /** FACEUP_ATTACK | FACEUP_DEFENSE */
    readonly FACEUP: 5;
    /** FACEDOWN_ATTACK | FACEDOWN_DEFENSE */
    readonly FACEDOWN: 10;
    /** FACEUP_ATTACK | FACEDOWN_ATTACK */
    readonly ATTACK: 3;
    /** FACEUP_DEFENSE | FACEDOWN_DEFENSE */
    readonly DEFENSE: 12;
};

/**
 * Parse a position mask and returns the list of actual positions it matches.
 * @param positionMask - The mask to parse
 */
export declare function ocgPositionParse(positionMask: OcgPosition): Extract<OcgPosition, 0x1 | 0x2 | 0x4 | 0x8>[];

/**
 * Convert a {@link (OcgPosition:type)} to its string representation.
 */
export declare const ocgPositionString: InternalMappedMap<readonly [readonly [1, "faceup_attack"], readonly [2, "facedown_attack"], readonly [4, "faceup_defense"], readonly [8, "facedown_defense"], readonly [5, "faceup"], readonly [10, "facedown"], readonly [3, "attack"], readonly [12, "defense"]]>;

/** The result of each call to {@link OcgCore#duelProcess}. */
export declare type OcgProcessResult = (typeof OcgProcessResult)[keyof typeof OcgProcessResult];

/** The result of each call to {@link OcgCore#duelProcess}. */
export declare const OcgProcessResult: {
    /**
     * Duel ended, you can't no longer call {@link OcgCore#duelProcess}.
     */
    readonly END: 0;
    /**
     * Waiting for a player action, provide a response with {@link OcgCore#duelSetResponse}
     * before calling {@link OcgCore#duelProcess} again.
     */
    readonly WAITING: 1;
    /**
     * Intermidate processing step, you should call {@link OcgCore#duelProcess} again.
     */
    readonly CONTINUE: 2;
};

/**
 * Convert a {@link (OcgProcessResult:type)} to its string representation.
 */
export declare const ocgProcessResultString: InternalMappedMap<readonly [readonly [0, "end"], readonly [1, "waiting"], readonly [2, "continue"]]>;

/**
 * Query interface to request information about a location.
 */
export declare interface OcgQuery {
    /** Informations to requests. */
    flags: OcgQueryFlags;
    /** Controller of the card. */
    controller: 0 | 1;
    /** Card location. */
    location: OcgLocation;
    /** Index sequence in location.  */
    sequence: number;
    /** Overlay card sequence, used when `(location & OcgLocation.OVERLAY) != 0`. */
    overlaySequence: number;
}

/** Requested card properties, used when querying. */
export declare type OcgQueryFlags = (typeof OcgQueryFlags)[keyof typeof OcgQueryFlags];

/** Requested card properties, used when querying. */
export declare const OcgQueryFlags: {
    /** Code. */
    readonly CODE: 1;
    /** Position. */
    readonly POSITION: 2;
    /** Aliases. */
    readonly ALIAS: 4;
    /** Type. */
    readonly TYPE: 8;
    /** Level. */
    readonly LEVEL: 16;
    /** Rank. */
    readonly RANK: 32;
    /** Attribute. */
    readonly ATTRIBUTE: 64;
    /** Race. */
    readonly RACE: 128;
    /** Attack. */
    readonly ATTACK: 256;
    /** Defense. */
    readonly DEFENSE: 512;
    /** Base attack. */
    readonly BASE_ATTACK: 1024;
    /** Base defense. */
    readonly BASE_DEFENSE: 2048;
    /** Reason. */
    readonly REASON: 4096;
    /** Reason card. */
    readonly REASON_CARD: 8192;
    /** Equipped to card. */
    readonly EQUIP_CARD: 16384;
    /** Targeted card. */
    readonly TARGET_CARD: 32768;
    /** Overlayed card. */
    readonly OVERLAY_CARD: 65536;
    /** Counters. */
    readonly COUNTERS: 131072;
    /** Owner. */
    readonly OWNER: 262144;
    /** Status. */
    readonly STATUS: 524288;
    /** Is public knowledge. */
    readonly IS_PUBLIC: 1048576;
    /** Left pendulum scale. */
    readonly LSCALE: 2097152;
    /** Right pendulum scale. */
    readonly RSCALE: 4194304;
    /** Link arrows. */
    readonly LINK: 8388608;
    /** Is hidden. */
    readonly IS_HIDDEN: 16777216;
    /** Cover. */
    readonly COVER: 33554432;
};

/**
 * Convert a {@link (OcgQueryFlags:type)} to its string representation.
 */
export declare const ocgQueryFlagsString: InternalMappedMap<readonly [readonly [1, "code"], readonly [2, "position"], readonly [4, "alias"], readonly [8, "type"], readonly [16, "level"], readonly [32, "rank"], readonly [64, "attribute"], readonly [128, "race"], readonly [256, "attack"], readonly [512, "defense"], readonly [1024, "base_attack"], readonly [2048, "base_defense"], readonly [4096, "reason"], readonly [8192, "reason_card"], readonly [16384, "equip_card"], readonly [32768, "target_card"], readonly [65536, "overlay_card"], readonly [131072, "counters"], readonly [262144, "owner"], readonly [524288, "status"], readonly [1048576, "is_public"], readonly [2097152, "lscale"], readonly [4194304, "rscale"], readonly [8388608, "link"], readonly [16777216, "is_hidden"], readonly [33554432, "cover"]]>;

export declare type OcgQueryLocation = Omit<OcgQuery, "sequence" | "overlaySequence">;

/** Monster card race. */
export declare type OcgRace = (typeof OcgRace)[keyof typeof OcgRace];

/** Monster card race. */
export declare const OcgRace: {
    /** Warrior. */
    readonly WARRIOR: 1n;
    /** Spellcaster. */
    readonly SPELLCASTER: 2n;
    /** Fairy. */
    readonly FAIRY: 4n;
    /** Fiend. */
    readonly FIEND: 8n;
    /** Zombie. */
    readonly ZOMBIE: 16n;
    /** Machine. */
    readonly MACHINE: 32n;
    /** Aqua. */
    readonly AQUA: 64n;
    /** Pyro. */
    readonly PYRO: 128n;
    /** Rock. */
    readonly ROCK: 256n;
    /** Winged beast. */
    readonly WINGEDBEAST: 512n;
    /** Plant. */
    readonly PLANT: 1024n;
    /** Insect. */
    readonly INSECT: 2048n;
    /** Thunder. */
    readonly THUNDER: 4096n;
    /** Dragon. */
    readonly DRAGON: 8192n;
    /** Beast. */
    readonly BEAST: 16384n;
    /** Beast-warrior. */
    readonly BEASTWARRIOR: 32768n;
    /** Dinosaur. */
    readonly DINOSAUR: 65536n;
    /** Fish. */
    readonly FISH: 131072n;
    /** Seaserpent. */
    readonly SEASERPENT: 262144n;
    /** Reptile. */
    readonly REPTILE: 524288n;
    /** Psychic. */
    readonly PSYCHIC: 1048576n;
    /** Divine. */
    readonly DIVINE: 2097152n;
    /** Creator god. */
    readonly CREATORGOD: 4194304n;
    /** Wyrm. */
    readonly WYRM: 8388608n;
    /** Cyberse. */
    readonly CYBERSE: 16777216n;
    /** Illusion. */
    readonly ILLUSION: 33554432n;
    /** Cyborg. */
    readonly CYBORG: 67108864n;
    /** Magical knight. */
    readonly MAGICALKNIGHT: 134217728n;
    /** High dragon. */
    readonly HIGHDRAGON: 268435456n;
    /** Omega psychic. */
    readonly OMEGAPSYCHIC: 536870912n;
    /** Celestial warrior. */
    readonly CELESTIALWARRIOR: 1073741824n;
    /** Galaxy. */
    readonly GALAXY: 2147483648n;
};

/**
 * Parse a {@link (OcgRace:type)} mask and return the matching races.
 * @param race - The mask to parse.
 */
export declare function ocgRaceParse(race: OcgRace): OcgRace[];

/**
 * Convert a {@link (OcgRace:type)} to its string representation.
 */
export declare const ocgRaceString: InternalMappedMap<readonly [readonly [1n, "warrior"], readonly [2n, "spellcaster"], readonly [4n, "fairy"], readonly [8n, "fiend"], readonly [16n, "zombie"], readonly [32n, "machine"], readonly [64n, "aqua"], readonly [128n, "pyro"], readonly [256n, "rock"], readonly [512n, "winged_beast"], readonly [1024n, "plant"], readonly [2048n, "insect"], readonly [4096n, "thunder"], readonly [8192n, "dragon"], readonly [16384n, "beast"], readonly [32768n, "beast_warrior"], readonly [65536n, "dinosaur"], readonly [131072n, "fish"], readonly [262144n, "sea_serpent"], readonly [524288n, "reptile"], readonly [1048576n, "psychic"], readonly [2097152n, "divine"], readonly [4194304n, "creator_god"], readonly [8388608n, "wyrm"], readonly [16777216n, "cyberse"], readonly [33554432n, "illusion"], readonly [67108864n, "cyborg"], readonly [134217728n, "magical_knight"], readonly [268435456n, "high_dragon"], readonly [536870912n, "omega_psychic"], readonly [1073741824n, "celestial_warrior"], readonly [2147483648n, "galaxy"]]>;

export declare type OcgResponse = OcgResponseSelectBattleCMD | OcgResponseSelectIdleCMD | OcgResponseSelectEffectYN | OcgResponseSelectYesNo | OcgResponseSelectOption | OcgResponseSelectCard | OcgResponseSelectCardCodes | OcgResponseSelectUnselectCard | OcgResponseSelectChain | OcgResponseSelectDisfield | OcgResponseSelectPlace | OcgResponseSelectPosition | OcgResponseSelectCounter | OcgResponseSelectSum | OcgResponseSelectTribute | OcgResponseSortCard | OcgResponseAnnounceRace | OcgResponseAnnounceAttrib | OcgResponseAnnounceCard | OcgResponseAnnounceNumber | OcgResponseRockPaperScissors;

export declare type OcgResponseAnnounceAttrib = {
    type: OcgResponseType.ANNOUNCE_ATTRIB;
    attributes: OcgAttribute[];
};

export declare type OcgResponseAnnounceCard = {
    type: OcgResponseType.ANNOUNCE_CARD;
    card: number;
};

export declare type OcgResponseAnnounceNumber = {
    type: OcgResponseType.ANNOUNCE_NUMBER;
    value: number;
};

export declare type OcgResponseAnnounceRace = {
    type: OcgResponseType.ANNOUNCE_RACE;
    races: OcgRace[];
};

export declare type OcgResponseRockPaperScissors = {
    type: OcgResponseType.ROCK_PAPER_SCISSORS;
    value: 1 | 2 | 3;
};

export declare type OcgResponseSelectBattleCMD = {
    type: OcgResponseType.SELECT_BATTLECMD;
    action: SelectBattleCMDAction;
    index: number | null;
};

export declare type OcgResponseSelectCard = {
    type: OcgResponseType.SELECT_CARD;
    indicies: number[] | null;
};

export declare type OcgResponseSelectCardCodes = {
    type: OcgResponseType.SELECT_CARD_CODES;
    codes: number[] | null;
};

export declare type OcgResponseSelectChain = {
    type: OcgResponseType.SELECT_CHAIN;
    /**
     * If the index is null: cancel the selection. Otherwise chain the card
     * at that index from {@link OcgMessageSelectChain#selects}.
     */
    index: number | null;
};

export declare type OcgResponseSelectCounter = {
    type: OcgResponseType.SELECT_COUNTER;
    counters: number[];
};

export declare type OcgResponseSelectDisfield = {
    type: OcgResponseType.SELECT_DISFIELD;
    places: SelectFieldPlace[];
};

export declare type OcgResponseSelectEffectYN = {
    type: OcgResponseType.SELECT_EFFECTYN;
    yes: boolean;
};

export declare type OcgResponseSelectIdleCMD = {
    type: OcgResponseType.SELECT_IDLECMD;
    action: SelectIdleCMDAction;
    index: number | null;
};

export declare type OcgResponseSelectOption = {
    type: OcgResponseType.SELECT_OPTION;
    index: number;
};

export declare type OcgResponseSelectPlace = {
    type: OcgResponseType.SELECT_PLACE;
    places: SelectFieldPlace[];
};

export declare type OcgResponseSelectPosition = {
    type: OcgResponseType.SELECT_POSITION;
    position: OcgPosition;
};

export declare type OcgResponseSelectSum = {
    type: OcgResponseType.SELECT_SUM;
    indicies: number[];
};

export declare type OcgResponseSelectTribute = {
    type: OcgResponseType.SELECT_TRIBUTE;
    indicies: number[] | null;
};

export declare type OcgResponseSelectUnselectCard = {
    type: OcgResponseType.SELECT_UNSELECT_CARD;
    /**
     * If index is null: cancel the selection. If index is less then the length of
     * {@link OcgMessageSelectUnselectCard#select_cards}: select the card at the
     * specified index. Otherwise unselect a card of
     * {@link OcgMessageSelectUnselectCard#unselect_cards} at index -
     * {@link OcgMessageSelectUnselectCard#select_cards}.length
     */
    index: number | null;
};

export declare type OcgResponseSelectYesNo = {
    type: OcgResponseType.SELECT_YESNO;
    yes: boolean;
};

export declare type OcgResponseSortCard = {
    type: OcgResponseType.SORT_CARD;
    order: number[] | null;
};

/** Response type enum. */
export declare enum OcgResponseType {
    SELECT_BATTLECMD = 0,
    SELECT_IDLECMD = 1,
    SELECT_EFFECTYN = 2,
    SELECT_YESNO = 3,
    SELECT_OPTION = 4,
    SELECT_CARD = 5,
    SELECT_CARD_CODES = 6,
    SELECT_UNSELECT_CARD = 7,
    SELECT_CHAIN = 8,
    SELECT_DISFIELD = 9,
    SELECT_PLACE = 10,
    SELECT_POSITION = 11,
    SELECT_TRIBUTE = 12,
    SELECT_COUNTER = 13,
    SELECT_SUM = 14,
    SORT_CARD = 15,
    ANNOUNCE_RACE = 16,
    ANNOUNCE_ATTRIB = 17,
    ANNOUNCE_CARD = 18,
    ANNOUNCE_NUMBER = 19,
    ROCK_PAPER_SCISSORS = 20
}

/** Rock paper scissor. */
export declare type OcgRPS = number;

/** Rock paper scissor. */
export declare const OcgRPS: {
    /** Scissors. */
    SCISSORS: number;
    /** Rock. */
    ROCK: number;
    /** Paper. */
    PAPER: number;
};

/**
 * Convert a {@link (OcgRPS:type)} to its string representation.
 */
export declare const ocgRPSString: InternalMappedMap<readonly [readonly [number, "scissors"], readonly [number, "rock"], readonly [number, "paper"]]>;

/** Legality scope of a card. */
export declare type OcgScope = (typeof OcgScope)[keyof typeof OcgScope];

/** Legality scope of a card. */
export declare const OcgScope: {
    /** OCG legal. */
    readonly OCG: 1;
    /** TCG legal.*/
    readonly TCG: 2;
    /** Anime card.*/
    readonly ANIME: 4;
    /** Cannot be used in a duel.*/
    readonly ILLEGAL: 8;
    /** Video game card.*/
    readonly VIDEO_GAME: 16;
    /** Custom card.*/
    readonly CUSTOM: 32;
    /** Speed duel card.*/
    readonly SPEED: 64;
    /** Prerelease.*/
    readonly PRERELEASE: 256;
    /** Rush duel card.*/
    readonly RUSH: 512;
    /** Rush duel legend card.*/
    readonly LEGEND: 1024;
    /** Hidden.*/
    readonly HIDDEN: 4096;
};

/**
 * Convert a {@link (OcgScope:type)} to its string representation.
 */
export declare const ocgScopeString: InternalMappedMap<readonly [readonly [1, "ocg"], readonly [2, "tcg"], readonly [4, "anime"], readonly [8, "illegal"], readonly [16, "video_game"], readonly [32, "custom"], readonly [64, "speed"], readonly [256, "prerelease"], readonly [512, "rush"], readonly [1024, "legend"], readonly [4096, "hidden"]]>;

/** Card type (monster/spell/trap and additional properties in case of a monster). */
export declare type OcgType = (typeof OcgType)[keyof typeof OcgType];

/** Card type (monster/spell/trap and additional properties in case of a monster). */
export declare const OcgType: {
    /** Monster. */
    readonly MONSTER: 1;
    /** Spell. */
    readonly SPELL: 2;
    /** Trap. */
    readonly TRAP: 4;
    /** Normal monster. */
    readonly NORMAL: 16;
    /** Effect monster. */
    readonly EFFECT: 32;
    /** Fusion monster. */
    readonly FUSION: 64;
    /** Ritual monster. */
    readonly RITUAL: 128;
    /** Trap monster trap. */
    readonly TRAPMONSTER: 256;
    /** Spirit monster. */
    readonly SPIRIT: 512;
    /** Union monster. */
    readonly UNION: 1024;
    /** Gemini monster. */
    readonly GEMINI: 2048;
    /** Tuner monster. */
    readonly TUNER: 4096;
    /** Synchro monster. */
    readonly SYNCHRO: 8192;
    /** Token monster. */
    readonly TOKEN: 16384;
    /** Maximum monster. */
    readonly MAXIMUM: 32768;
    /** Quickplay spell. */
    readonly QUICKPLAY: 65536;
    /** Continuous spell or trap. */
    readonly CONTINUOUS: 131072;
    /** Equip spell. */
    readonly EQUIP: 262144;
    /** Field spell. */
    readonly FIELD: 524288;
    /** Counter trap. */
    readonly COUNTER: 1048576;
    /** Flip monster. */
    readonly FLIP: 2097152;
    /** Toon monster. */
    readonly TOON: 4194304;
    /** Xyz monster. */
    readonly XYZ: 8388608;
    /** Pendulum monster. */
    readonly PENDULUM: 16777216;
    /** Special summonable monster. */
    readonly SPSUMMON: 33554432;
    /** Link monster. */
    readonly LINK: 67108864;
};

/**
 * Parse a OcgType mask and return the matching types.
 * @param type - The mask to parse.
 */
export declare function ocgTypeParse(type: OcgType): OcgType[];

/**
 * Convert a {@link (OcgType:type)} to its string representation.
 */
export declare const ocgTypeString: InternalMappedMap<readonly [readonly [1, "monster"], readonly [2, "spell"], readonly [4, "trap"], readonly [16, "normal"], readonly [32, "effect"], readonly [64, "fusion"], readonly [128, "ritual"], readonly [256, "trapmonster"], readonly [512, "spirit"], readonly [1024, "union"], readonly [2048, "gemini"], readonly [4096, "tuner"], readonly [8192, "synchro"], readonly [16384, "token"], readonly [32768, "maximum"], readonly [65536, "quickplay"], readonly [131072, "continuous"], readonly [262144, "equip"], readonly [524288, "field"], readonly [1048576, "counter"], readonly [2097152, "flip"], readonly [4194304, "toon"], readonly [8388608, "xyz"], readonly [16777216, "pendulum"], readonly [33554432, "spsummon"], readonly [67108864, "link"]]>;

/**
 * Convert a {@link OcgResponseType} to its string representation.
 */
export declare const responseTypeStrings: InternalMappedMap<readonly [readonly [OcgResponseType.SELECT_BATTLECMD, "select_battlecmd"], readonly [OcgResponseType.SELECT_IDLECMD, "select_idlecmd"], readonly [OcgResponseType.SELECT_EFFECTYN, "select_effectyn"], readonly [OcgResponseType.SELECT_YESNO, "select_yesno"], readonly [OcgResponseType.SELECT_OPTION, "select_option"], readonly [OcgResponseType.SELECT_CARD, "select_card"], readonly [OcgResponseType.SELECT_CARD_CODES, "select_card_codes"], readonly [OcgResponseType.SELECT_UNSELECT_CARD, "select_unselect_card"], readonly [OcgResponseType.SELECT_CHAIN, "select_chain"], readonly [OcgResponseType.SELECT_DISFIELD, "select_disfield"], readonly [OcgResponseType.SELECT_PLACE, "select_place"], readonly [OcgResponseType.SELECT_POSITION, "select_position"], readonly [OcgResponseType.SELECT_TRIBUTE, "select_tribute"], readonly [OcgResponseType.SELECT_COUNTER, "select_counter"], readonly [OcgResponseType.SELECT_SUM, "select_sum"], readonly [OcgResponseType.SORT_CARD, "sort_card"], readonly [OcgResponseType.ANNOUNCE_RACE, "announce_race"], readonly [OcgResponseType.ANNOUNCE_ATTRIB, "announce_attrib"], readonly [OcgResponseType.ANNOUNCE_CARD, "announce_card"], readonly [OcgResponseType.ANNOUNCE_NUMBER, "announce_number"], readonly [OcgResponseType.ROCK_PAPER_SCISSORS, "rock_paper_scissors"]]>;

/** Battle command enum, used in {@link OcgResponseSelectBattleCMD}. */
export declare enum SelectBattleCMDAction {
    SELECT_CHAIN = 0,
    SELECT_BATTLE = 1,
    TO_M2 = 2,
    TO_EP = 3
}

/**
 * Convert a {@link SelectBattleCMDAction} to its string representation.
 */
export declare const selectBattleCMDActionStrings: InternalMappedMap<readonly [readonly [SelectBattleCMDAction.SELECT_CHAIN, "select_chain"], readonly [SelectBattleCMDAction.SELECT_BATTLE, "select_battle"], readonly [SelectBattleCMDAction.TO_M2, "to_m2"], readonly [SelectBattleCMDAction.TO_EP, "to_ep"]]>;

export declare type SelectFieldPlace = {
    player: number;
    location: OcgLocation;
    sequence: number;
};

/** Idle command enum, used in {@link OcgResponseSelectIdleCMD}. */
export declare enum SelectIdleCMDAction {
    SELECT_SUMMON = 0,
    SELECT_SPECIAL_SUMMON = 1,
    SELECT_POS_CHANGE = 2,
    SELECT_MONSTER_SET = 3,
    SELECT_SPELL_SET = 4,
    SELECT_ACTIVATE = 5,
    TO_BP = 6,
    TO_EP = 7,
    SHUFFLE = 8
}

/**
 * Convert a {@link SelectIdleCMDAction} to its string representation.
 */
export declare const selectIdleCMDActionStrings: InternalMappedMap<readonly [readonly [SelectIdleCMDAction.SELECT_SUMMON, "select_summon"], readonly [SelectIdleCMDAction.SELECT_SPECIAL_SUMMON, "select_special_summon"], readonly [SelectIdleCMDAction.SELECT_POS_CHANGE, "select_pos_change"], readonly [SelectIdleCMDAction.SELECT_MONSTER_SET, "select_monster_set"], readonly [SelectIdleCMDAction.SELECT_SPELL_SET, "select_spell_set"], readonly [SelectIdleCMDAction.SELECT_ACTIVATE, "select_activate"], readonly [SelectIdleCMDAction.TO_BP, "to_bp"], readonly [SelectIdleCMDAction.TO_EP, "to_ep"], readonly [SelectIdleCMDAction.SHUFFLE, "shuffle"]]>;

export { }
