/**
 * Main game server. Manages WebSocket connections, workers, and game state.
 * @module server/server
 */

const WebSocket = require("ws");
const { logger } = require("./lib/logger");
const { bus } = require("./lib/bus");
const { ClientWorker } = require("./workers/client-worker");
const { RootWorker } = require("./workers/root-worker");
const { GameLoop } = require("./workers/game-loop");
const { CommandWorker } = require("./workers/command-worker");

/**
 * Orchestrates WebSocket server, client workers, root connection, and game loop.
 * @listens bus#clients:broadcast
 */
class Server {
	/**
	 * @param {Object} sim - Game simulation instance
	 * @param {Object} config - Server configuration
	 * @param {number} config.port - WebSocket port
	 * @param {string} config.addr - Server address
	 * @param {string} config.name - Server name
	 * @param {string} config.root_addr - Root server URL
	 */
	constructor(sim, config) {
		this.sim = sim;
		this.config = config;
		this.players = {};
		this.clientWorkers = {};
		this.wss = null;
		this.rootWorker = null;
		this.gameLoop = null;
		this.commandWorker = null;
		this.startTime = Date.now();

		// Bind handlers so we can remove them later
		this._broadcastHandler = (packet) => this._broadcast(packet);

		this._setupWebSocket();
		this._setupBusListeners();
		this._createWorkers();
	}

	// === PUBLIC API ===

	/**
	 * Send data to a specific player.
	 * @param {Object} player - Player object with ws property
	 * @param {Array} data - Data to serialize and send
	 */
	send(player, data) {
		const packet = this.sim.zJson.dumpDv(data);
		const client = player.ws;
		if (client && client.readyState === WebSocket.OPEN) client.send(packet);
	}

	/**
	 * Send data to root server via bus.
	 * @param {Array} data - Data to send
	 */
	sendToRoot(data) {
		bus.emit('root:send', data);
	}

	/**
	 * Send chat message to root server.
	 * @param {string} msg - Message text
	 */
	say(msg) {
		this.rootWorker.say(msg);
	}

	/**
	 * Kick a player by name.
	 * @param {string} name - Player name
	 * @returns {boolean} True if player was found and kicked
	 */
	kick(name) {
		const player = Object.values(this.players).find(p => p.name === name);
		if (!player) return false;
		if (player.ws) player.ws.close();
		return true;
	}

	/**
	 * Get list of connected player names.
	 * @returns {string[]}
	 */
	getPlayerNames() {
		return Object.values(this.players).map(p => p.name);
	}

	/** Stop server, close all connections, cleanup workers. */
	stop() {
		logger.info("Stopping server");
		this._removeBusListeners();

		this.gameLoop.stop();
		this.commandWorker.stop();
		Object.values(this.clientWorkers).forEach(w => w.listener.close());
		this.wss.close();
		this.rootWorker.stop();
	}

	// === PRIVATE METHODS ===

	/** @private Create WebSocket server, attach connection handler. */
	_setupWebSocket() {
		this.wss = new WebSocket.Server({ port: process.env.PORT || this.config.port });

		this.wss.on("error", (err) => {
			logger.error("WebSocket server error", { error: err.message });
		});

		this.wss.on("connection", (ws, req) => this._onConnection(ws, req));
	}

	/** @private Subscribe to bus events. */
	_setupBusListeners() {
		bus.on('clients:broadcast', this._broadcastHandler);
	}

	/** @private Unsubscribe from bus events. */
	_removeBusListeners() {
		bus.off('clients:broadcast', this._broadcastHandler);
	}

	/** @private Create and start workers. */
	_createWorkers() {
		this.rootWorker = new RootWorker(this.sim, this.config);
		this.rootWorker.start();

		this.commandWorker = new CommandWorker(this.sim);
		this.commandWorker.start();

		this.gameLoop = new GameLoop(this.sim, this.config);
		this.gameLoop.start();
	}

	/** @private Handle new client connection, create ClientWorker. */
	_onConnection(ws, req) {
		const rawIp = req.socket.remoteAddress;
		const clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp;
		const id = req.headers["sec-websocket-key"];
		logger.info("Client connected", { ip: clientIp, id });

		const worker = new ClientWorker(ws, id, clientIp, {
			players: this.players,
			sim: this.sim
		});

		this.clientWorkers[id] = worker;

		worker.listener.on("close", () => delete this.clientWorkers[id]);
	}

	/** @private Send packet to all connected clients. */
	_broadcast(packet) {
		this.wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(packet);
			}
		});
	}
}

module.exports = { Server };
