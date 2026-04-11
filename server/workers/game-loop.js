/**
 * Fixed-timestep game loop with accumulator for consistent tick rate.
 * Broadcasts state to clients and server info to root.
 * @module server/workers/game-loop
 */

const { performance } = require("perf_hooks");
const { bus } = require('../lib/bus');
const { logger } = require('../lib/logger');

/** @constant {number} Target ticks per second */
const DESIRED_TPS = 16;
/** @constant {number} Milliseconds per tick */
const TICK_LENGTH = 1000 / DESIRED_TPS;
/** @constant {number} Server info broadcast interval in ms */
const INFO_INTERVAL = 15000;

/**
 * Runs simulation at fixed 16 TPS, broadcasts state to clients.
 * @fires bus#clients:broadcast - Game state packet each tick
 * @fires bus#root:send - Server info every 15s
 */
class GameLoop {
	/**
	 * @param {Object} sim - Game simulation instance
	 * @param {Object} config - Server config
	 * @param {string} config.name - Server name
	 * @param {string} config.addr - Server address
	 * @param {number} config.port - Server port
	 */
	constructor(sim, config) {
		this.sim = sim;
		this.config = config;

		this.lastTickTime = performance.now();
		this.lastInfoTime = performance.now();
		this.accumulator = 0;
		this.timeout = null;
		this.running = false;
	}

	// === PUBLIC API ===

	/** Start the game loop. */
	start() {
		this.running = true;
		this._tick();
	}

	/** Stop the game loop. */
	stop() {
		this.running = false;
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	// === PRIVATE METHODS ===

	/** @private Main loop - accumulates delta, runs fixed-step ticks. */
	_tick() {
		if (!this.running) return;

		try {
			const now = performance.now();
			let delta = now - this.lastTickTime;
			if (delta > 1000) delta = 1000;

			this.accumulator += delta;
			this.lastTickTime = now;

			while (this.accumulator >= TICK_LENGTH) {
				this._onTick();
				this.accumulator -= TICK_LENGTH;
			}

			if (now - this.lastInfoTime > INFO_INTERVAL) {
				this._sendInfo();
				this.lastInfoTime = now;
			}

			const delay = Math.min(50, Math.max(0, TICK_LENGTH - this.accumulator));
			this.timeout = setTimeout(() => this._tick(), Math.round(delay));
		} catch (e) {
			logger.error("Critical error in game tick", { error: e.message, stack: e.stack });
			this.timeout = setTimeout(() => this._tick(), TICK_LENGTH);
		}
	}

	/** @private Run one simulation step, broadcast state to clients. */
	_onTick() {
		if (!this.sim.paused) this.sim.simulate();
		else this.sim.startingSim();

		const packet = this.sim.send();
		bus.emit('clients:broadcast', packet);
	}

	/** @private Send server info to root for lobby display. */
	_sendInfo() {
		const info = {
			name: this.config.name,
			address: "ws://" + this.config.addr + ":" + this.config.port,
			observers: this.sim.players.filter((p) => p.connected && !p.ai).length,
			players: this.sim.players
				.filter((p) => p.connected && !p.ai)
				.map((p) => ({ name: p.name, side: p.side, ai: false })),
			type: this.sim.serverType,
			version: 0,
			state: this.sim.state,
		};
		bus.emit('root:send', ["setServer", info]);
	}
}

module.exports = { GameLoop };
