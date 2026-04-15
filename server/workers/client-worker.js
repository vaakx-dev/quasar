/**
 * Per-client connection handler.
 * Manages player lifecycle, command routing, rate limiting, and authentication.
 * @module server/workers/client-worker
 */

const { Listener } = require("../lib/listener");
const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");
const bans = require("../lib/bans");

/** @constant {number} Rate limit window in ms */
const RATE_LIMIT_WINDOW = 1000;
/** @constant {number} Max messages per rate limit window */
const RATE_LIMIT_MAX = 60;
/** @constant {number} Auth timeout in ms */
const VALIDATION_TIMEOUT = 10000;

/** @constant {Set<string>} Allowed game commands (O(1) lookup) */
const cmds = new Set([
	"mouseMove",
	"playerSelected",
	"setRallyPoint",
	"buildRq",
	"stopOrder",
	"holdPositionOrder",
	"followOrder",
	"selfDestructOrder",
	"moveOrder",
	"configGame",
	"startGame",
	"addAi",
	"switchSide",
	"kickPlayer",
	"surrender",
]);

/**
 * Handles a single client WebSocket connection.
 * Routes commands to sim, validates players via bus, enforces rate limits.
 */
class ClientWorker {
	/**
	 * @param {WebSocket} ws - Client WebSocket connection
	 * @param {string} id - Unique connection ID
	 * @param {string} clientIp - Client IP address
	 * @param {Object} context - Shared context
	 * @param {Object} context.players - Active players map
	 * @param {Object} context.sim - Game simulation instance
	 */
	constructor(ws, id, clientIp, context) {
		this.id = id;
		this.clientIp = clientIp;
		this.context = context; // { players, sim }
		this.player = null;
		this.pendingPlayer = null; // Stores join args until validation completes
		this.validated = false;
		this.rateLimiter = null; // { count, windowStart }

		this.listener = new Listener({
			ws,
			validCommands: new Set([...cmds, "playerJoin", "gameKey"]),
			messageParser: (msg) => this._parseMessage(msg),
		});

		// Bind handlers for bus events
		this._kickHandler = (data) => this._handleKick(data);

		// Attach command handlers
		this.listener.on("open", () => this._onOpen());
		this.listener.on("playerJoin", (data) => this._onPlayerJoin(data));
		this.listener.on("gameKey", (data) => this._onGameKey(data));

		// Generic handler for allowed commands
		cmds.forEach((cmd) => this.listener.on(cmd, (data) => this._onCommand(cmd, data)));

		this.listener.on("close", ({ code }) => this._onClose(code));
		this.listener.on("error", (err) => this._onError(err));

		// Listen for bus events
		bus.on("player:kick", this._kickHandler);
	}

	// === PRIVATE METHODS ===

	/** @private Parse binary message, enforce rate limit, return {cmd, args}. */
	_parseMessage(msg) {
		// Rate limiting
		if (!this._checkRateLimit()) {
			logger.warn("Rate limit exceeded", {
				id: this.id,
				ip: this.clientIp,
			});
			throw new Error("Rate limited");
		}

		const packet = new DataView(new Uint8Array(msg).buffer);
		const data = this.context.sim.zJson.loadDv(packet);

		// Input validation
		if (!Array.isArray(data) || typeof data[0] !== "string") throw new Error("Invalid message format");

		const [cmd, ...args] = data;
		return { cmd, args };
	}

	/** @private Create player after validation passes, or store args if pending validation. */
	_onPlayerJoin({ args }) {
		if (!this.validated) return this.pendingPlayer = args;
		// Already validated - accept join immediately
		this.player = this.context.sim.playerJoin("playerJoin", ...args);
		this.player.ws = this.listener.ws;
		this.context.players[this.id] = this.player;
		this.context.sim.clearNetState();
	}

	/** @private Check bans, then request validation from RootWorker via bus. */
	_onGameKey({ args }) {
		if (!this.pendingPlayer) return;

		// playerJoin signature: (_, pid, name, color, buildBar, aiRules, ai, update)
		const name = this.pendingPlayer[1];
		const gameKey = args[1];

		// First check if banned (local check - fast fail)
		const banReason = this._checkBan(name, this.clientIp);
		if (banReason) return this._rejectPlayer(banReason);

		// Then validate with root server
		this._requestValidation(name, gameKey);
	}

	/**
	 * @private Check if name or IP is banned.
	 * @returns {string|null} Ban reason or null if not banned
	 */
	_checkBan(name, ip) {
		const nameReason = bans.check(name);
		const ipReason = bans.check(ip);

		if (!nameReason && !ipReason) return null;
		logger.info("Banned player attempted to join", {
			name,
			ip,
			reason: nameReason || ipReason
		});
		return nameReason || ipReason;
	}

	/**
	 * @private Request validation from RootWorker via bus.
	 * Creates player after validation succeeds.
	 */
	_requestValidation(name, gameKey) {
		logger.info("Validation requested", { name, id: this.id });

		// Listen once for validation response (scoped to player name)
		bus.once(`player:validation:${name}`, (result) => this._onValidation(result));

		// Request validation from RootWorker
		bus.emit("player:validate", { name, gameKey });

		// Timeout fallback
		setTimeout(() => {
			logger.info("Validation timeout fired", {
				name: this.pendingPlayer?.[1],
				id: this.id,
				validated: this.validated,
			});
			if (this.pendingPlayer && !this.validated) this._rejectPlayer("Authentication timeout");
		}, VALIDATION_TIMEOUT);
	}

	/**
	 * @private Handle validation result from RootWorker.
	 * Creates player in sim after successful validation.
	 */
	_onValidation(result) {
		// Ignore if player was already rejected (e.g., by timeout)
		if (!this.pendingPlayer) return logger.warn(`Ignoring validation - player gone: ${this.id}`);

		const name = this.pendingPlayer[1];

		logger.info("Validation response received", {
			name,
			id: this.id,
			valid: result.valid,
		});

		if (!result.valid) return this._rejectPlayer(result.reason || "Invalid credentials");

		// All checks passed - create player in sim
		this._createPlayer();
	}

	/**
	 * @private Create player in sim after validation and ban checks pass.
	 */
	_createPlayer() {
		const args = this.pendingPlayer;
		this.player = this.context.sim.playerJoin("playerJoin", ...args);
		this.player.ws = this.listener.ws;
		this.context.players[this.id] = this.player;
		this.context.sim.clearNetState();
		this.validated = true;
		this.pendingPlayer = null; // Clear pending args

		logger.info("Player joined and validated", { id: this.id, name: this.player.name });
	}

	/** @private Handle kick event (e.g., after ban). */
	_handleKick(data) {
		const name = this.player?.name || this.pendingPlayer?.[1];
		if (!name) return;
		if (name !== data.target) return;
		this._rejectPlayer(data.reason || "Kicked");
	}

	/** @private Forward game command to sim. */
	_onCommand(cmd, { args }) {
		if (!this.player) return;
		if (!this.validated) return;
		this.context.sim[cmd].apply(this.context.sim, [this.player, ...args]);
	}

	/** @private Sliding window rate limiter. Returns false if over limit. */
	_checkRateLimit() {
		const now = Date.now();
		if (!this.rateLimiter) {
			this.rateLimiter = { count: 1, windowStart: now };
			return true;
		}

		if (now - this.rateLimiter.windowStart > RATE_LIMIT_WINDOW) {
			// New window
			this.rateLimiter.count = 1;
			this.rateLimiter.windowStart = now;
			return true;
		}

		this.rateLimiter.count++;
		if (this.rateLimiter.count > RATE_LIMIT_MAX) return false; // Rate limited
		return true;
	}

	/**
	 * @private Send error to client and disconnect.
	 * Handles both pending args and created player.
	 */
	_rejectPlayer(reason) {
		const ws = this.player?.ws || this.listener?.ws;
		if (ws && ws.readyState === 1) {
			// WebSocket.OPEN
			let errorPacket = this.context.sim.zJson.dumpDv(["error", reason]);
			ws.send(errorPacket, () => {
				setTimeout(() => {
					if (ws.readyState === 1) ws.close(1008, reason);
				}, 100);
			});
		}

		// Cleanup player if created in sim
		if (this.context.players[this.id]) {
			this.context.players[this.id].connected = false;
			delete this.context.players[this.id];
		}

		this.player = null;
		this.pendingPlayer = null;
		logger.info("Player rejected", { id: this.id, reason });
	}

	/** @private Cleanup player on disconnect. */
	_onClose(code) {
		logger.info("Client disconnected", { id: this.id, code });

		// Remove bus listener
		bus.off("player:kick", this._kickHandler);

		// Cleanup player
		if (this.context.players[this.id]) {
			this.context.players[this.id].connected = false;
			delete this.context.players[this.id];
		}

		this.player = null;
		this.pendingPlayer = null;
	}

	/** @private Log WebSocket errors. */
	_onError(err) {
		logger.error("Client WebSocket error", {
			id: this.id,
			error: err.message,
		});
	}
}

module.exports = { ClientWorker };
