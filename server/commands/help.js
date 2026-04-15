/**
 * Help command - lists available commands.
 * @module server/commands/help
 */

module.exports = {
	name: "help",
	prefix: ".",
	description: "List available commands",

	/**
	 * @param {Object} context
	 * @param {Object} context.sim - Game simulation
	 * @param {Object} context.player - Player who sent command
	 * @param {Map} context.commands - All loaded commands
	 * @param {Function} context.say - Send chat message
	 * @param {Function} context.send - Send raw data to root
	 * @param {string[]} args - Command arguments
	 * @param {Object} message - Original message data
	 */
	execute({ commands, say }) {
		const names = [...commands.values()].map((c) => `${c.prefix}${c.name}`);
		say(`Commands: ${names.join(", ")}`);
	},
};
