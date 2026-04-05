const config = require("./config.json");
const WebSocket = require("ws");
const { logger } = require("./server/lib/logger");
const { bus } = require("./server/lib/bus");
const { ClientWorker } = require("./server/workers/client-worker");
const { RootWorker } = require("./server/workers/root-worker");
const { GameLoop } = require("./server/workers/game-loop");

require("./game");

global.sim = new Sim();
sim.serverType = "sandbox";
sim.start();

class Server {
	constructor() {
		this.players = {};
		this.clientWorkers = {};
		this.wss = null;
		this.rootWorker = null;
		this.gameLoop = null;

		this._setupWebSocket();
		this._setupBusListeners();
		this._createWorkers();
	}

	// === PUBLIC API ===

	send(player, data) {
		const packet = sim.zJson.dumpDv(data);
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

	stop() {
		logger.info("Stopping server");
		this.gameLoop.stop();
		Object.values(this.clientWorkers).forEach(w => w.listener.close());
		this.wss.close();
		this.rootWorker.stop();
	}

	// === PRIVATE METHODS ===

	_setupWebSocket() {
		this.wss = new WebSocket.Server({ port: process.env.PORT || config.port });

		this.wss.on("error", (err) => {
			logger.error("WebSocket server error", { error: err.message });
		});

		this.wss.on("connection", (ws, req) => this._onConnection(ws, req));
	}

	_setupBusListeners() {
		bus.on('clients:broadcast', (packet) => this._broadcast(packet));
	}

	_createWorkers() {
		this.rootWorker = new RootWorker(sim, config);
		this.rootWorker.start();

		this.gameLoop = new GameLoop(sim, config);
		this.gameLoop.start();
	}

	_onConnection(ws, req) {
		const rawIp = req.socket.remoteAddress;
		const clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp;
		const id = req.headers["sec-websocket-key"];
		logger.info("Client connected", { ip: clientIp, id });

		const worker = new ClientWorker(ws, id, clientIp, {
			players: this.players,
			sim
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

global.server = new Server();
