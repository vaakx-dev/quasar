/**
 * Handles chat commands from root server messages.
 * Listens on bus for messages and routes to command modules.
 * @module server/workers/command-worker
 */

const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");
const { getCommand, getAllCommands } = require("../commands");
const bans = require("../lib/bans");
const roles = require("../lib/roles");
const { validateArgs, generateUsage } = require("../lib/args-validator");

/**
 * Check if a player can execute a command.
 * @private
 * @param {string} name - Player name
 * @param {Object} command - Command object
 * @param {Object} player - Player object from sim
 * @returns {boolean}
 */
function canExecuteCommand(name, command, player) {
	// First check if banned
	const banReason = bans.check(name);
	if (banReason) return false;

	// hostOverride: Host can always use this command
	if (command.hostOverride && player?.host) return true;

	// playerOverride: Any active player (not spectator) can use
	if (command.playerOverride && player && player.side !== "spectators") return true;

	// Check role requirement
	if (!command.requiredRole) return true;
	const playerLevel = roles.rank(name);
	if (playerLevel === -1) return false;

	const requiredLevel = roles.level(command.requiredRole);
	if (requiredLevel === -1) return false;

	// Player's level must be >= required level (lower index = higher)
	return playerLevel <= requiredLevel;
}

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
		if (!canExecuteCommand(message.name, command, player)) {
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

		// Validate args if schema exists
		if (command.schema?.args) {
			const commandName = `${command.prefix || "."}${command.name}`;
			const result = validateArgs(args, command.schema, context);

			if (!result.valid) {
				const usage = generateUsage(commandName, command.schema);
				context.say(`Usage: ${usage}`);
				if (result.error) {
					context.say(`Error: ${result.error}`);
				}
				logger.info("Command validation failed", { cmd: command.name, by: player?.name, error: result.error });
				return;
			}

			// Pass validated object instead of array
			try {
				command.execute(context, result.args, message);
				logger.info("Command executed", { cmd: command.name, by: player?.name });
			} catch (err) {
				logger.error("Command failed", { cmd: command.name, error: err.message });
			}
			return;
		}

		// Backward compatibility: commands without schema get raw array
		try {
			command.execute(context, args, message);
			logger.info("Command executed", { cmd: command.name, by: player?.name });
		} catch (err) {
			logger.error("Command failed", { cmd: command.name, error: err.message });
		}
	}
}

module.exports = { CommandWorker };
