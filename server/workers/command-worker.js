/**
 * Handles chat commands from root server messages.
 * Listens on bus for messages and routes to command modules.
 * @module server/workers/command-worker
 */

const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");
const { getCommand, getAllCommands } = require("../commands");
const { canExecuteCommand } = require("../lib/permissions");

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
		this.permissionsWorker = null;

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

	/** Set permissions worker reference. @param {PermissionsWorker} permissionsWorker */
	setPermissionsWorker(permissionsWorker) {
		this.permissionsWorker = permissionsWorker;
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

		const parts = message.text.trim().split(/\s+/);
		if (!parts.length) return;

		const firstWord = parts[0];
		const args = parts.slice(1);

		// Find command by checking each prefix against first word
		for (const [name, command] of getAllCommands()) {
			const prefix = command.prefix || "!";
			if (firstWord.startsWith(prefix)) {
				const commandName = firstWord.slice(prefix.length);
				if (commandName === name) {
					this._executeCommand(command, args, message);
					return;
				}
			}
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

		// Permission check
		if (this.permissionsWorker) {
			const roles = this.permissionsWorker.getRoles();
			const bans = this.permissionsWorker.getBans();
			if (!canExecuteCommand(roles, bans, message.name, command, player)) {
				bus.emit("root:send", [
					"message",
					{
						text: "You don't have permission to use this command",
						channel: message.channel,
						color: "FF0000",
						name: "Server",
						server: true,
					},
				]);
				logger.warn("Permission denied", { cmd: command.name, player: message.name });
				return;
			}
		}

		const context = {
			sim: this.sim,
			player,
			commands: getAllCommands(),
			permissions: this.permissionsWorker,
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
			logger.info("Command executed", { cmd: command.name, by: player?.name });
		} catch (err) {
			logger.error("Command failed", { cmd: command.name, error: err.message });
		}
	}
}

module.exports = { CommandWorker };
