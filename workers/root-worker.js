const WebSocket = require('ws');
const { Listener } = require('../lib/listener');
const { bus } = require('../lib/bus');
const { logger } = require('../lib/logger');

// Reconnection config (exponential backoff)
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

class RootWorker {
	constructor(sim, config) {
		this.sim = sim;
		this.config = config;
		this.listener = null;
		this.ws = null;
		this.reconnectAttempts = 0;
		this.connected = false;

		// Listen for validation requests from ClientWorker
		bus.on('player:validate', (request) => this._handleValidationRequest(request));
	}

	// === PUBLIC API ===

	start() {
		this._connect();
	}

	stop() {
		logger.info("Stopping RootWorker");
		if (this.listener) {
			this.listener.close();
		}
	}

	send(data) {
		if (!this.isConnected()) {
			logger.warn("Cannot send to root: not connected");
			return;
		}
		this.listener.send(JSON.stringify(data));
	}

	sendInfo(info) {
		this.send(["setServer", info]);
	}

	say(msg) {
		this.send([
			"message",
			{
				text: msg,
				channel: this.config.name,
				color: "FFFFFF",
				name: "Server",
				server: true,
			},
		]);
	}

	isConnected() {
		return this.connected && this.listener && this.listener.isConnected();
	}

	// === PRIVATE METHODS ===

	_parseMessage(msg) {
		const data = JSON.parse(msg);
		if (!Array.isArray(data) || !data[0]) {
			throw new Error("Invalid message format");
		}
		const [cmd, ...args] = data;
		return { cmd, data: args[0] || {} };
	}

	_connect() {
		this.ws = new WebSocket(this.config.root_addr);

		this.listener = new Listener({
			ws: this.ws,
			validCommands: new Set(["playerValid", "playerInvalid", "message"]),
			messageParser: (msg) => this._parseMessage(msg)
		});

		this.listener.on("open", () => this._onOpen());
		this.listener.on("close", () => this._onClose());
		this.listener.on("error", (err) => this._onError(err));
		this.listener.on("playerValid", (data) => this._onPlayerValid(data));
		this.listener.on("playerInvalid", (data) => this._onPlayerInvalid(data));
		this.listener.on("message", (data) => this._onMessage(data));
	}

	_onOpen() {
		logger.info("Connected to root server");
		this.reconnectAttempts = 0;
		this.connected = true;

		// Register with root server
		this.send(["registerBot"]);

		// Send initial info
		this._sendInitialInfo();
	}

	_onClose() {
		this.connected = false;

		// Exponential backoff with jitter
		const delay = Math.min(
			RECONNECT_MAX_DELAY,
			RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000
		);
		this.reconnectAttempts++;
		logger.warn("Disconnected from root, retrying", { attempt: this.reconnectAttempts, delay: Math.round(delay) });
		setTimeout(() => this._connect(), delay);
	}

	_onError(err) {
		logger.error("Root connection error", { message: err.message });
	}

	_handleValidationRequest(request) {
		// Check if root is connected
		if (!this.isConnected()) {
			bus.emit(`player:validation:${request.name}`, {
				valid: false,
				reason: "Authentication service unavailable"
			});
			return;
		}

		// Send validation request to root
		this._checkPlayer(request.name, request.gameKey);
	}

	_checkPlayer(name, gameKey) {
		this.send(["checkPlayer", name, gameKey]);
	}

	_onPlayerValid(data) {
		let name = data.data.name;

		// Emit validation success to specific player
		bus.emit(`player:validation:${name}`, {
			valid: true,
			data: data.data
		});

		logger.info("Player validated by root", { name });
	}

	_onPlayerInvalid(data) {
		let name = data.data.name;

		// Emit validation failure to specific player
		bus.emit(`player:validation:${name}`, {
			valid: false,
			reason: "Invalid credentials"
		});

		logger.info("Player rejected by root", { name });
	}

	_onMessage(data) {
		const messageData = data.data;
		logger.info(`[${messageData.channel}] ${messageData.name}: ${messageData.text}`);
	}

	_sendInitialInfo() {
		const info = {
			name: this.config.name,
			address: "ws://" + this.config.addr + ":" + this.config.port,
			observers: this.sim.players.filter((p) => p.connected && !p.ai).length,
			players: this.sim.players
				.filter((p) => p.connected && !p.ai)
				.map((p) => {
					return {
						name: p.name,
						side: p.side,
						ai: false,
					};
				}),
			type: this.sim.serverType,
			version: 0,
			state: this.sim.state,
		};
		this.sendInfo(info);
	}
}

module.exports = { RootWorker };
