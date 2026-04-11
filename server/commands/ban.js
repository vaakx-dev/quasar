/**
 * Ban command - Ban a player by name or IP.
 * @module server/commands/ban
 */

const { bus } = require("../lib/bus");
const IP_REGEX = /^\d+\.\d+\.\d+\.\d+$/;

module.exports = {
	name: "ban",
	prefix: ".",
	description: "Ban a player by name or IP",
	requiredRole: "mod",

	execute({ sim, player, say }, args) {
		if (!args.length) return say("Usage: .ban <name|ip> [reason]");

		const target = args[0];
		const reason = args.slice(1).join(" ") || "Banned";
		const type = IP_REGEX.test(target) ? 'ip' : 'name';

		bus.emit('permissions:ban', {
			type,
			target,
			reason,
			bannedBy: player.name,
			targetName: type === 'name' ? target : undefined
		});

		return say(`Banned ${target}: ${reason}`);
	},
};
