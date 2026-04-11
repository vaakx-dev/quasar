/**
 * Unban command - Unban a name or IP.
 * @module server/commands/unban
 */

const { bus } = require("../lib/bus");

module.exports = {
	name: "unban",
	prefix: ".",
	description: "Unban a name or IP",
	requiredRole: "mod",

	execute({ sim, player, say }, args) {
		if (!args.length) return say("Usage: .unban <name|ip>");

		bus.emit('permissions:unban', {
			target: args[0],
			unbannedBy: player.name
		});

		say(`Unbanned ${args[0]}`);
	},
};
