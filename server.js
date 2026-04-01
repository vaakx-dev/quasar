const { performance } = require("perf_hooks");
const config = require("./config.json");
const WebSocket = require("ws");
require("./fix");
require("./istrolid.js");
const { logIfBanMessage } = require("./ban-logger");

// Structured logger
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

const logger = {
	_format(level, msg, data) {
		const timestamp = new Date().toISOString();
		const base = `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
		return data ? `${base} ${JSON.stringify(data)}` : base;
	},
	debug(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.debug) console.log(this._format("debug", msg, data));
	},
	info(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.info) console.log(this._format("info", msg, data));
	},
	warn(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.warn) console.warn(this._format("warn", msg, data));
	},
	error(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.error) console.error(this._format("error", msg, data));
	},
};

// Use Set for O(1) lookup
const allowedCmds = new Set([
	"playerJoin",
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

global.sim = new Sim();
sim.serverType = "sandbox";
sim.start();

const DESIRED_TPS = 16;
const TICK_LENGTH = 1000 / DESIRED_TPS;
const INFO_INTERVAL = 15000;
const HEARTBEAT_INTERVAL = 30000;

// Reconnection config (exponential backoff)
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

// Rate limiting config
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 60; // max messages per window

global.Server = function () {
	const wss = new WebSocket.Server({ port: process.env.PORT || config.port });
	let root = null;
	let reconnectAttempts = 0;
	let heartbeatInterval = null;

	const players = {};
	const pendingValidations = {};
	const rateLimiters = {}; // Track message rates per client
	const VALIDATION_TIMEOUT = 10000;

	let lastInfoTime = performance.now();

	this.send = (player, data) => {
		let packet = sim.zJson.dumpDv(data);
		let client = player.ws;
		if (client && client.readyState === WebSocket.OPEN) {
			client.send(packet);
		}
	};

	this.sendToRoot = (data) => {
		if (root && root.readyState === WebSocket.OPEN) {
			root.sendData(data);
		} else {
			logger.warn("Cannot send to root: not connected");
		}
	};

	this.stop = () => {
		logger.info("Stopping server");

		// Stop game loop
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}

		// Stop heartbeat
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}

		// Close root connection
		if (root) {
			root.removeAllListeners();
			if (root.readyState === WebSocket.OPEN) {
				root.close();
			}
			root = null;
		}

		// Close all client connections
		wss.clients.forEach((client) => {
			client.terminate();
		});

		wss.close();
	};

	this.say = (msg) => {
		if (!root || root.readyState !== WebSocket.OPEN) {
			logger.warn("Cannot say message: root not connected");
			return;
		}
		root.sendData([
			"message",
			{
				text: msg,
				channel: config.name,
				color: "FFFFFF",
				name: "Server",
				server: true,
			},
		]);
	};

	const connectToRoot = () => {
		root = new WebSocket(config.root_addr);

		root.on("open", () => {
			logger.info("Connected to root server");
			reconnectAttempts = 0; // Reset on successful connection
			root.sendData(["registerBot"]); // Register with root server
			sendInfo();
			lastInfoTime = performance.now();
		});

		root.on("close", () => {
			// Exponential backoff with jitter
			const delay = Math.min(
				RECONNECT_MAX_DELAY,
				RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 1000
			);
			reconnectAttempts++;
			logger.warn("Disconnected from root, retrying", { attempt: reconnectAttempts, delay: Math.round(delay) });
			setTimeout(connectToRoot, delay);
		});

		root.on("error", (err) => {
			logger.error("Root connection error", { message: err.message });
		});

		root.on("message", (msg) => {
			try {
				let data = JSON.parse(msg);
				let cmd = data[0];
				if (cmd === "playerValid") {
					onPlayerValid(data[1]);
				} else if (cmd === "playerInvalid") {
					onPlayerInvalid(data[1]);
				} else if (cmd === "message") {
					logger.info(`[${data[1].channel}] ${data[1].name}: ${data[1].text}`);
					logIfBanMessage(data[1].channel, data[1].name, data[1].text);
				}
			} catch (e) {
				logger.error("Failed to parse root message", { error: e.message });
			}
		});

		root.sendData = (data) => {
			if (root.readyState === WebSocket.OPEN) {
				root.send(JSON.stringify(data));
			}
		};
	};

	const sendInfo = () => {
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
			version: VERSION,
			state: sim.state,
		};
		root.sendData(["setServer", info]);
	};

	const checkPlayer = (name, gameKey) => {
		root.sendData(["checkPlayer", name, gameKey]);
	};

	const onPlayerValid = (data) => {
		let name = data.name;
		for (let id in pendingValidations) {
			let player = players[id];
			if (player && player.name === name) {
				clearTimeout(pendingValidations[id].timeoutId);
				delete pendingValidations[id];
				player.validated = true;
				logger.info("Player validated", { name });
				return;
			}
		}
	};

	const onPlayerInvalid = (data) => {
		let name = data.name;
		for (let id in pendingValidations) {
			let player = players[id];
			if (player && player.name === name) {
				rejectPlayer(id, "Invalid credentials");
				return;
			}
		}
	};

	const rejectPlayer = (id, reason) => {
		let pending = pendingValidations[id];
		if (pending) {
			clearTimeout(pending.timeoutId);
			delete pendingValidations[id];
		}

		let player = players[id];
		if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
			let errorPacket = sim.zJson.dumpDv(["error", reason]);
			player.ws.send(errorPacket, () => {
				setTimeout(() => {
					if (player.ws.readyState === WebSocket.OPEN) {
						player.ws.close(1008, reason);
					}
				}, 100);
			});
		}

		if (player) {
			player.connected = false;
			delete players[id];
		}
		
		delete rateLimiters[id];

		logger.info("Player rejected", { reason });
	};

	// Rate limiting check
	const checkRateLimit = (id) => {
		const now = Date.now();
		if (!rateLimiters[id]) {
			rateLimiters[id] = { count: 1, windowStart: now };
			return true;
		}

		const limiter = rateLimiters[id];
		if (now - limiter.windowStart > RATE_LIMIT_WINDOW) {
			// New window
			limiter.count = 1;
			limiter.windowStart = now;
			return true;
		}

		limiter.count++;
		if (limiter.count > RATE_LIMIT_MAX) {
			return false; // Rate limited
		}
		return true;
	};

	connectToRoot();

	// WebSocket server error handler
	wss.on("error", (err) => {
		logger.error("WebSocket server error", { error: err.message });
	});

	wss.on("connection", (ws, req) => {
		const rawIp = req.socket.remoteAddress;
		const clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp;
		const id = req.headers["sec-websocket-key"];
		logger.info("Client connected", { ip: clientIp, id });

		// Setup heartbeat
		ws.isAlive = true;
		ws.on("pong", () => {
			ws.isAlive = true;
		});

		ws.on("message", (msg) => {
			// Rate limiting
			if (!checkRateLimit(id)) {
				logger.warn("Rate limit exceeded", { id, ip: clientIp });
				return;
			}

			try {
				const packet = new DataView(new Uint8Array(msg).buffer);
				const data = sim.zJson.loadDv(packet);

				// Input validation
				if (!Array.isArray(data) || typeof data[0] !== "string") {
					logger.warn("Invalid message format", { id });
					return;
				}

				const cmd = data[0];

				if (cmd === "playerJoin") {
					let player = sim.playerJoin(...data);
					player.ws = ws;
					player.validated = false;
					players[id] = player;
					sim.clearNetState();
				} else if (cmd === "gameKey") {
					let gameKey = data[2];
					let player = players[id];
					if (!player) return;

					// Check if root is connected
					if (!root || root.readyState !== WebSocket.OPEN) {
						rejectPlayer(id, "Authentication service unavailable");
						return;
					}

					// Set timeout for validation
					let timeoutId = setTimeout(() => {
						rejectPlayer(id, "Authentication timeout");
					}, VALIDATION_TIMEOUT);

					pendingValidations[id] = { timeoutId };
					checkPlayer(player.name, gameKey);
				} else if (cmd === "configGame") {
					let gameType = data[1]?.type;
					if (gameType) {
						sim.configGame(players[id], gameType);
					}
				} else if (allowedCmds.has(cmd)) {
					sim[cmd].apply(sim, [players[id], ...data.slice(1)]);
				}
			} catch (e) {
				logger.error("Failed to process client message", { id, error: e.message });
			}
		});

		ws.on("close", (code, reason) => {
			logger.info("Client disconnected", { id, code });

			// Cleanup pending validation
			if (pendingValidations[id]) {
				clearTimeout(pendingValidations[id].timeoutId);
				delete pendingValidations[id];
			}

			// Cleanup rate limiter
			delete rateLimiters[id];

			// Cleanup player
			if (players[id]) {
				players[id].connected = false;
				delete players[id];
			}
		});

		ws.on("error", (err) => {
			logger.error("Client WebSocket error", { id, error: err.message });
		});
	});

	// Heartbeat interval to detect dead connections
	heartbeatInterval = setInterval(() => {
		wss.clients.forEach((ws) => {
			if (ws.isAlive === false) {
				logger.debug("Terminating dead connection");
				return ws.terminate();
			}
			ws.isAlive = false;
			ws.ping();
		});
	}, HEARTBEAT_INTERVAL);

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
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(packet);
					}
				});

				accumulator -= TICK_LENGTH;
			}

			if (now - lastInfoTime > INFO_INTERVAL) {
				sendInfo();
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
