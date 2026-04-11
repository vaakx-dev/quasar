/**
 * WebSocket listener with heartbeat and command filtering.
 * Wraps a WebSocket connection and emits parsed commands as events.
 * @module server/lib/listener
 */

const { EventEmitter } = require("events");
const WebSocket = require("ws");

/**
 * WebSocket listener that handles heartbeat, message parsing, and command filtering.
 * Emits events for valid commands and connection lifecycle.
 *
 * @extends EventEmitter
 * @fires Listener#open - Connection opened
 * @fires Listener#close - Connection closed
 * @fires Listener#error - Connection error
 * @fires Listener#[cmd] - For each valid command received
 */
class Listener extends EventEmitter {
	/**
	 * @param {Object} options
	 * @param {WebSocket} options.ws - WebSocket instance to wrap
	 * @param {Set<string>} options.validCommands - Commands to accept (others ignored)
	 * @param {Function} options.messageParser - Parses raw message into {cmd, ...data}
	 */
	constructor({ ws, validCommands, messageParser }) {
		super();
		this.ws = ws;
		this.validCommands = validCommands;
		this.messageParser = messageParser;

		// Heartbeat state
		this.alive = false;
		this.heartbeatInterval = null;

		this._attachHandlers();

		// If already open (incoming connections), trigger open handler
		if (this.ws.readyState === WebSocket.OPEN) this._onOpen();
	}

	// === PUBLIC API ===

	/**
	 * Close the connection and stop heartbeat.
	 */
	close() {
		this._stopHeartbeat();
		if (this.ws) this.ws.close();
	}

	/**
	 * Send data to the connected WebSocket.
	 * @param {*} data - Data to send (string, Buffer, etc.)
	 * @returns {boolean} True if sent, false if not connected
	 */
	send(data) {
		if (!this.isConnected()) return false;
		this.ws.send(data);
		return true;
	}

	/**
	 * Check if WebSocket is open.
	 * @returns {boolean}
	 */
	isConnected() {
		return this.ws && this.ws.readyState === WebSocket.OPEN;
	}

	// === PRIVATE METHODS ===

	/** @private Attach WebSocket event handlers. */
	_attachHandlers() {
		this.ws.on("open", () => this._onOpen());
		this.ws.on("message", (msg) => this._onMessage(msg));
		this.ws.on("close", (code, reason) => this._onClose(code, reason));
		this.ws.on("error", (err) => this._onError(err));
		this.ws.on("pong", () => this._onPong());
	}

	/** @private Handle connection open - start heartbeat, emit event. */
	_onOpen() {
		this._startHeartbeat();
		this.emit("open");
	}

	/** @private Parse message, filter by validCommands, emit as event. */
	_onMessage(msg) {
		let parsed;
		try {
			parsed = this.messageParser(msg);
		} catch (e) {
			return;
		}

		if (!parsed || !parsed.cmd) return;
		if (!this.validCommands.has(parsed.cmd)) return;

		const { cmd, ...data } = parsed;
		this.emit(cmd, data);
	}

	/** @private Handle connection close - stop heartbeat, emit event. */
	_onClose(code, reason) {
		this._stopHeartbeat();
		this.emit("close", { code, reason });
	}

	/** @private Start 30s heartbeat ping interval. Terminates if no pong. */
	_startHeartbeat() {
		this.alive = true;
		this.heartbeatInterval = setInterval(() => {
			if (!this.alive) {
				this._stopHeartbeat();
				this.ws.terminate();
				return;
			}
			this.alive = false;
			if (this.isConnected()) this.ws.ping();
		}, 30000);
	}

	/** @private Clear heartbeat interval. */
	_stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/** @private Mark connection alive on pong response. */
	_onPong() {
		this.alive = true;
	}

	/** @private Handle error - stop heartbeat, emit event. */
	_onError(err) {
		this._stopHeartbeat();
		this.emit("error", err);
	}
}

module.exports = { Listener };
