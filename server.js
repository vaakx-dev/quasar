const { performance } = require("perf_hooks");
const config = require("./config.json");
const WebSocket = require("ws");
const { logger } = require("./lib/logger");
const { ClientWorker } = require("./workers/client-worker");
const { RootWorker } = require("./workers/root-worker");

require("./fix");
require("./istrolid.js");

global.sim = new Sim();
sim.serverType = "sandbox";
sim.start();

const DESIRED_TPS = 16;
const TICK_LENGTH = 1000 / DESIRED_TPS;
const INFO_INTERVAL = 15000;

global.Server = function () {
	// Shared state
	const players = {};
	const clientWorkers = {}; // id → ClientWorker instance

	// Create WebSocket.Server
	const wss = new WebSocket.Server({ port: process.env.PORT || config.port });

	// WebSocket server error handler
	wss.on("error", (err) => {
		logger.error("WebSocket server error", { error: err.message });
	});

	// Handle client connections
	wss.on("connection", (ws, req) => {
		const rawIp = req.socket.remoteAddress;
		const clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp;
		const id = req.headers["sec-websocket-key"];
		logger.info("Client connected", { ip: clientIp, id });

		// Create ClientWorker for this connection
		const worker = new ClientWorker(ws, id, clientIp, {
			players,
			sim
		});

		clientWorkers[id] = worker;

		// Cleanup on close
		worker.listener.on("close", () => {
			delete clientWorkers[id];
		});
	});

	// Create RootWorker (single instance)
	const rootWorker = new RootWorker(sim, config);
	rootWorker.start();

	// Public API (backwards compatibility)
	this.send = (player, data) => {
		let packet = sim.zJson.dumpDv(data);
		let client = player.ws;
		if (client && client.readyState === WebSocket.OPEN) {
			client.send(packet);
		}
	};

	this.sendToRoot = (data) => {
		rootWorker.send(data);
	};

	this.stop = () => {
		logger.info("Stopping server");

		// Stop game loop
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}

		// Close all client workers
		Object.values(clientWorkers).forEach(w => w.listener.close());

		// Close WebSocket server
		wss.close();

		// Stop root worker
		rootWorker.stop();
	};

	this.say = (msg) => {
		rootWorker.say(msg);
	};

	// Game loop
	let lastInfoTime = performance.now();
	let lastTickTime = performance.now();
	let accumulator = 0;
	let timeout = null;

	const tick = () => {
		try {
			const now = performance.now();
			let delta = now - lastTickTime;
			if (delta > 1000) delta = 1000; // Clamp to prevent huge catch-up spikes

			accumulator += delta;
			lastTickTime = now;

			// Run all queued simulation ticks
			while (accumulator >= TICK_LENGTH) {
				if (!sim.paused) {
					sim.simulate();
				} else {
					sim.startingSim();
				}

				const packet = sim.send();

				// Broadcast to all connected clients
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(packet);
					}
				});

				accumulator -= TICK_LENGTH;
			}

			if (now - lastInfoTime > INFO_INTERVAL) {
				const info = {
					name: config.name,
					address: "ws://" + config.addr + ":" + config.port,
					observers: sim.players.filter((p) => p.connected && !p.ai).length,
					players: sim.players
						.filter((p) => p.connected && !p.ai)
						.map((p) => {
							return {
								name: p.name,
								side: p.side,
								ai: false,
							};
						}),
					type: sim.serverType,
					version: 0,
					state: sim.state,
				};
				rootWorker.sendInfo(info);
				lastInfoTime = now;
			}

			const delay = Math.min(50, Math.max(0, TICK_LENGTH - accumulator));
			timeout = setTimeout(tick, Math.round(delay));
		} catch (e) {
			logger.error("Critical error in game tick", { error: e.message, stack: e.stack });
			// Restart tick loop to prevent complete server hang
			timeout = setTimeout(tick, TICK_LENGTH);
		}
	};

	tick();
};

global.server = new Server();
