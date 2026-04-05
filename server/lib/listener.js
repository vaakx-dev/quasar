const { EventEmitter } = require('events');
const WebSocket = require('ws');

class Listener extends EventEmitter {
    constructor(options) {
        super();
        this.ws = options.ws;
        this.validCommands = options.validCommands;
        this.messageParser = options.messageParser;

        // Heartbeat state
        this.alive = false;
        this.heartbeatInterval = null;

        this._attachHandlers();

        // If already open (incoming connections), trigger open handler
        if (this.ws.readyState === WebSocket.OPEN) this._onOpen();
    }

    // === PUBLIC API ===

    close() {
        this._stopHeartbeat();
        if (this.ws) this.ws.close();
    }

    send(data) {
        if (!this.isConnected()) return false;
        this.ws.send(data);
        return true;
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // === PRIVATE METHODS ===

    _attachHandlers() {
        this.ws.on("open", () => this._onOpen());
        this.ws.on("message", (msg) => this._onMessage(msg));
        this.ws.on("close", (code, reason) => this._onClose(code, reason));
        this.ws.on("error", (err) => this._onError(err));
        this.ws.on("pong", () => this._onPong());
    }

    _onOpen() {
        this._startHeartbeat();
        this.emit("open");
    }

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

    _onClose(code, reason) {
        this._stopHeartbeat();
        this.emit("close", { code, reason });
    }

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

    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    _onPong() {
        this.alive = true;
    }

    _onError(err) {
        this._stopHeartbeat();
        this.emit("error", err);
    }
}

module.exports = { Listener };
