/**
 * Handles chat commands from root server messages.
 * Listens on bus for messages and routes to command modules.
 * @module server/workers/command-worker
 */

const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");
const { getCommand, getAllCommands } = require("../commands");

/**
 * Routes chat messages to command handlers.
 * Listens for root:message events on bus.
 *
 * @listens bus#root:message
 */
class CommandWorker {
	/**
	 * @param {Object} sim - Game simulation instance
	 */
	constructor(sim) {
		this.sim = sim;

		this._messageHandler = (message) => this._onMessage(message);
	}

	// === PUBLIC API ===

	/** Start listening for messages on bus. */
	start() {
		bus.on("root:message", this._messageHandler);
		logger.info("CommandWorker started", { commands: getAllCommands().size });
	}

	/** Stop listening for messages. */
	stop() {
		bus.off("root:message", this._messageHandler);
		logger.info("CommandWorker stopped");
	}

	// === PRIVATE METHODS ===

	/**
	 * Handle incoming message from root.
	 * @private
	 * @param {Object} message - Message data
	 * @param {string} message.text - Message text
	 * @param {string} message.name - Sender name
	 * @param {string} message.channel - Channel name
	 */
	_onMessage(message) {
		if (!message.text) return;

		// Check each command for matching prefix
		for (const [name, command] of getAllCommands()) {
			const prefix = command.prefix || "!";
			const fullPrefix = prefix + name;

			if (!message.text.startsWith(fullPrefix)) continue;

			// Extract args (text after command name)
			const argsText = message.text.slice(fullPrefix.length).trim();
			const args = argsText ? argsText.split(/\s+/) : [];

			this._executeCommand(command, args, message);
			return;
		}
	}

	/**
	 * Execute a command.
	 * @private
	 * @param {Object} command - Command module
	 * @param {string[]} args - Parsed arguments
	 * @param {Object} message - Original message data
	 */
	_executeCommand(command, args, message) {
		const player = this.sim.players.find((p) => p.name === message.name);

		const context = {
			sim: this.sim,
			player,
			commands: getAllCommands(),
			send: (data) => bus.emit("root:send", data),
			say: (msg) => bus.emit("root:send", [
				"message",
				{
					text: msg,
					channel: message.channel,
					color: "FFFFFF",
					name: "Server",
					server: true,
				},
			]),
		};

		try {
			command.execute(context, args, message);
			logger.info("Command executed", { cmd: command.name, by: player.name });
		} catch (err) {
			logger.error("Command failed", { cmd: command.name, error: err.message });
		}
	}
}

module.exports = { CommandWorker };
