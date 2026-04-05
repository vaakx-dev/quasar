const WebSocket = require("ws");
const { logger } = require("./lib/logger");
const { bus } = require("./lib/bus");
const { ClientWorker } = require("./workers/client-worker");
const { RootWorker } = require("./workers/root-worker");
const { GameLoop } = require("./workers/game-loop");

class Server {
	constructor(sim, config) {
		this.sim = sim;
		this.config = config;
		this.players = {};
		this.clientWorkers = {};
		this.wss = null;
		this.rootWorker = null;
		this.gameLoop = null;
		this.startTime = Date.now();

		this._setupWebSocket();
		this._setupBusListeners();
		this._createWorkers();
	}

	// === PUBLIC API ===

	send(player, data) {
		const packet = this.sim.zJson.dumpDv(data);
		const client = player.ws;
		if (client && client.readyState === WebSocket.OPEN) {
			client.send(packet);
		}
	}

	sendToRoot(data) {
		bus.emit('root:send', data);
	}

	say(msg) {
		this.rootWorker.say(msg);
	}

	kick(name) {
		const player = Object.values(this.players).find(p => p.name === name);
		if (!player) return false;
		if (player.ws) player.ws.close();
		return true;
	}

	getPlayerNames() {
		return Object.values(this.players).map(p => p.name);
	}

	stop() {
		logger.info("Stopping server");
		this.gameLoop.stop();
		Object.values(this.clientWorkers).forEach(w => w.listener.close());
		this.wss.close();
		this.rootWorker.stop();
	}

	// === PRIVATE METHODS ===

	_setupWebSocket() {
		this.wss = new WebSocket.Server({ port: process.env.PORT || this.config.port });

		this.wss.on("error", (err) => {
			logger.error("WebSocket server error", { error: err.message });
		});

		this.wss.on("connection", (ws, req) => this._onConnection(ws, req));
	}

	_setupBusListeners() {
		bus.on('clients:broadcast', (packet) => this._broadcast(packet));
	}

	_createWorkers() {
		this.rootWorker = new RootWorker(this.sim, this.config);
		this.rootWorker.start();

		this.gameLoop = new GameLoop(this.sim, this.config);
		this.gameLoop.start();
	}

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

	_broadcast(packet) {
		this.wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(packet);
			}
		});
	}
}

module.exports = { Server };
