/**
 * Command loader and registry.
 * Loads all command modules from this directory.
 * @module server/commands
 */

const fs = require("fs");
const path = require("path");
const { logger } = require("../lib/logger");

/** @type {Map<string, Object>} Command name -> command module */
const commands = new Map();

// Load all .js files in this directory (except index.js)
const commandFiles = fs.readdirSync(__dirname).filter(
	(f) => f.endsWith(".js") && f !== "index.js"
);

for (const file of commandFiles) {
	const command = require(path.join(__dirname, file));
	if (!command.name || !command.execute) {
		logger.warn("Invalid command module", { file });
		continue;
	}
	commands.set(command.name.toLowerCase(), command);
	logger.info("Loaded command", { name: command.name });
}

/**
 * Get a command by name.
 * @param {string} name - Command name (case-insensitive)
 * @returns {Object|undefined} Command module or undefined
 */
function getCommand(name) {
	return commands.get(name.toLowerCase());
}

/**
 * Get all loaded commands.
 * @returns {Map<string, Object>} All commands
 */
function getAllCommands() {
	return commands;
}

module.exports = { commands, getCommand, getAllCommands };
