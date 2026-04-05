const { Listener } = require('../lib/listener');
const { bus } = require('../lib/bus');
const { logger } = require('../lib/logger');

// Rate limiting config
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 60; // max messages per window
const VALIDATION_TIMEOUT = 10000;

// Use Set for O(1) lookup
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

class ClientWorker {
	constructor(ws, id, clientIp, context) {
		this.id = id;
		this.clientIp = clientIp;
		this.context = context; // { players, sim }
		this.player = null;
		this.validated = false;
		this.rateLimiter = null; // { count, windowStart }

		this.listener = new Listener({
			ws,
			validCommands: new Set([...cmds, "playerJoin", "gameKey"]),
			messageParser: (msg) => this._parseMessage(msg)
		});

		// Attach command handlers
		this.listener.on("open", () => this._onOpen());
		this.listener.on("playerJoin", (data) => this._onPlayerJoin(data));
		this.listener.on("gameKey", (data) => this._onGameKey(data));

		// Generic handler for allowed commands
		cmds.forEach(cmd => this.listener.on(cmd, (data) => this._onCommand(cmd, data)));

		this.listener.on("close", ({ code }) => this._onClose(code));
		this.listener.on("error", (err) => this._onError(err));
	}

	// === PRIVATE METHODS ===

	_parseMessage(msg) {
		// Rate limiting
		if (!this._checkRateLimit()) {
			logger.warn("Rate limit exceeded", { id: this.id, ip: this.clientIp });
			throw new Error("Rate limited");
		}

		const packet = new DataView(new Uint8Array(msg).buffer);
		const data = this.context.sim.zJson.loadDv(packet);

		// Input validation
		if (!Array.isArray(data) || typeof data[0] !== "string") {
			throw new Error("Invalid message format");
		}

		const [cmd, ...args] = data;
		return { cmd, args };
	}

	_onPlayerJoin({ args }) {
		this.player = this.context.sim.playerJoin("playerJoin", ...args);
		this.player.ws = this.listener.ws;
		this.context.players[this.id] = this.player;
		this.context.sim.clearNetState();
		//logger.info("Player joined", { id: this.id, name: this.player.name });
	}

	_onGameKey({ args }) {
		if (!this.player) return;

		let gameKey = args[1];

		logger.info("Validation requested", { name: this.player.name, id: this.id });

		// Listen once for validation response (scoped to player name)
		bus.once(`player:validation:${this.player.name}`, (result) => this._onValidation(result));

		// Request validation from RootWorker
		bus.emit('player:validate', {
			name: this.player.name,
			gameKey: gameKey
		});

		// Timeout fallback
		setTimeout(() => {
			logger.info("Validation timeout fired", {
				name: this.player?.name,
				id: this.id,
				validated: this.validated,
				connected: this.player?.connected
			});
			if (this.player && !this.validated) {
				this._rejectPlayer("Authentication timeout");
			}
		}, VALIDATION_TIMEOUT);
	}

	_onValidation(result) {
		logger.info("Validation response received", {
			name: this.player?.name,
			id: this.id,
			valid: result.valid,
			hasPlayer: !!this.player,
			connected: this.player?.connected
		});

		// Ignore if player was already rejected (e.g., by timeout)
		if (!this.player || !this.player.connected) {
			logger.warn("Ignoring validation - player gone", { id: this.id });
			return;
		}

		if (!result.valid) {
			this._rejectPlayer(result.reason || "Invalid credentials");
			return;
		}

		this.validated = true;
		logger.info("Player validated", { name: this.player.name });
	}

	_onCommand(cmd, { args }) {
		if (!this.player) return;
		this.context.sim[cmd].apply(this.context.sim, [this.player, ...args]);
	}

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
		if (this.rateLimiter.count > RATE_LIMIT_MAX) {
			return false; // Rate limited
		}
		return true;
	}

	_rejectPlayer(reason) {
		if (this.player && this.player.ws && this.player.ws.readyState === 1) { // WebSocket.OPEN
			let errorPacket = this.context.sim.zJson.dumpDv(["error", reason]);
			this.player.ws.send(errorPacket, () => {
				setTimeout(() => {
					if (this.player.ws.readyState === 1) {
						this.player.ws.close(1008, reason);
					}
				}, 100);
			});
		}

		if (this.player) {
			this.player.connected = false;
			delete this.context.players[this.id];
		}

		logger.info("Player rejected", { id: this.id, reason });
	}

	_onClose(code) {
		logger.info("Client disconnected", { id: this.id, code });

		// Cleanup player
		if (this.context.players[this.id]) {
			this.context.players[this.id].connected = false;
			delete this.context.players[this.id];
		}
	}

	_onError(err) {
		logger.error("Client WebSocket error", { id: this.id, error: err.message });
	}
}

module.exports = { ClientWorker };
