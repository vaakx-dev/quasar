/**
 * Role command - Add/remove a player from a role.
 * @module server/commands/role
 */

const { bus } = require("../lib/bus");

module.exports = {
	name: "role",
	prefix: ".",
	description: "Add/remove a player from a role",
	requiredRole: "owner",

	execute({ sim, player, say }, args) {
		if (args.length < 3) return say("Usage: .role <add|remove> <player> <role>");

		const action = args[0];
		const targetPlayer = args[1];
		const roleName = args[2];

		bus.emit('permissions:role', {
			action,
			player: targetPlayer,
			role: roleName,
			changedBy: player.name
		});

		switch (action) {
			case 'add':
				return say(`Added ${targetPlayer} to ${roleName}`);
			case 'remove':
				return say(`Removed ${targetPlayer} from ${roleName}`);
			default:
				return say("Action must be 'add' or 'remove'");
		}
	},
};
