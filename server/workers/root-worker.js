/**
 * Manages connection to root/lobby server.
 * Handles player validation requests, auto-reconnect, and chat relay.
 * @module server/workers/root-worker
 */

const WebSocket = require("ws");
const { Listener } = require("../lib/listener");
const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");

/** @constant {number} Initial reconnect delay in ms */
const RECONNECT_BASE_DELAY = 1000;
/** @constant {number} Max reconnect delay in ms */
const RECONNECT_MAX_DELAY = 30000;

/**
 * Connects to root server, validates players, relays chat.
 * Listens for bus events from ClientWorkers.
 *
 * @listens bus#player:validate
 * @listens bus#root:send
 * @fires bus#player:validation:[name]
 */
class RootWorker {
	/**
	 * @param {Object} sim - Game simulation instance
	 * @param {Object} config - Server config
	 * @param {string} config.root_addr - Root server WebSocket URL
	 * @param {string} config.name - Server name for chat
	 */
	constructor(sim, config) {
		this.sim = sim;
		this.config = config;
		this.listener = null;
		this.ws = null;
		this.reconnectAttempts = 0;
		this.connected = false;
		this.stopped = true;

		// Bind handlers so we can remove them later
		this._validateHandler = (request) => this._handleValidationRequest(request);
		this._sendHandler = (data) => this.send(data);
	}

	// === PUBLIC API ===

	/** Connect to root server and start listening for bus events. */
	start() {
		this.stopped = false;
		this._setupBusListeners();
		this._connect();
	}

	/** Disconnect and stop listening for bus events. */
	stop() {
		logger.info("Stopping RootWorker");
		this.stopped = true;
		this._removeBusListeners();

		if (this.listener) this.listener.close();
	}

	/**
	 * Send data to root server.
	 * @param {Array} data - Message array to send as JSON
	 */
	send(data) {
		if (!this.isConnected()) return logger.warn("Cannot send to root: not connected");
		this.listener.send(JSON.stringify(data));
	}

	/**
	 * Send chat message to root server.
	 * @param {string} msg - Message text
	 */
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

	/** @returns {boolean} True if connected to root */
	isConnected() {
		return this.connected && this.listener && this.listener.isConnected();
	}

	// === PRIVATE METHODS ===

	/** @private Subscribe to bus events. */
	_setupBusListeners() {
		bus.on("player:validate", this._validateHandler);
		bus.on("root:send", this._sendHandler);
	}

	/** @private Unsubscribe from bus events. */
	_removeBusListeners() {
		bus.off("player:validate", this._validateHandler);
		bus.off("root:send", this._sendHandler);
	}

	/** @private Parse JSON message from root into {cmd, data}. */
	_parseMessage(msg) {
		const data = JSON.parse(msg);
		if (!Array.isArray(data) || !data[0]) throw new Error("Invalid message format");
		const [cmd, ...args] = data;
		return { cmd, data: args[0] || {} };
	}

	/** @private Create WebSocket and Listener, attach handlers. */
	_connect() {
		this.ws = new WebSocket(this.config.root_addr);

		this.listener = new Listener({
			ws: this.ws,
			validCommands: new Set(["playerValid", "playerInvalid", "message"]),
			messageParser: (msg) => this._parseMessage(msg),
		});

		this.listener.on("open", () => this._onOpen());
		this.listener.on("close", () => this._onClose());
		this.listener.on("error", (err) => this._onError(err));
		this.listener.on("playerValid", (data) => this._onPlayerValid(data));
		this.listener.on("playerInvalid", (data) => this._onPlayerInvalid(data));
		this.listener.on("message", (data) => this._onMessage(data));
	}

	/** @private Register with root on connect. */
	_onOpen() {
		logger.info("Connected to root server");
		this.reconnectAttempts = 0;
		this.connected = true;
		this.send(["registerBot"]);
	}

	/** @private Reconnect with exponential backoff. */
	_onClose() {
		this.connected = false;
		if (this.stopped) return;

		const delay = Math.min(
			RECONNECT_MAX_DELAY,
			RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
		);
		this.reconnectAttempts++;
		logger.warn("Disconnected from root, retrying", {
			attempt: this.reconnectAttempts,
			delay: Math.round(delay),
		});
		setTimeout(() => this._connect(), delay);
	}

	/** @private Log connection errors. */
	_onError(err) {
		logger.error("Root connection error", { message: err.message });
	}

	/** @private Handle validation request from ClientWorker via bus. */
	_handleValidationRequest(request) {
		if (this.isConnected()) return this._checkPlayer(request.name, request.gameKey);
		else
			return bus.emit(`player:validation:${request.name}`, {
				valid: false,
				reason: "Authentication service unavailable",
			});
	}

	/** @private Send checkPlayer request to root. */
	_checkPlayer(name, gameKey) {
		this.send(["checkPlayer", name, gameKey]);
	}

	/** @private Emit validation success to ClientWorker via bus. */
	_onPlayerValid(data) {
		let name = data.data.name;
		bus.emit(`player:validation:${name}`, { valid: true, data: data.data });
		logger.info("Player validated by root", { name });
	}

	/** @private Emit validation failure to ClientWorker via bus. */
	_onPlayerInvalid(data) {
		let name = data.data.name;
		bus.emit(`player:validation:${name}`, { valid: false, reason: "Invalid credentials" });
		logger.info("Player rejected by root", { name });
	}

	/** @private Log chat messages from root. */
	_onMessage(data) {
		const messageData = data.data;
		logger.info(`[${messageData.channel}] ${messageData.name}: ${messageData.text}`);
	}
}

module.exports = { RootWorker };
