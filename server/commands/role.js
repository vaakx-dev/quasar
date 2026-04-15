/**
 * Role command - Add/remove a player from a role.
 * @module server/commands/role
 */

const roles = require("../lib/roles");

module.exports = {
	name: "role",
	prefix: ".",
	description: "Add/remove a player from a role",
	requiredRole: "owner",

	execute({ sim, player, say }, args) {
		if (args.length < 3) return say("Usage: .role <add|remove> <player> <role>");

		const action = args[0];
		const name = args[1];
		const role = args[2];

		// Check if role exists
		if (roles.level(role) === -1) {
			return say(`Role "${role}" does not exist`);
		}

		switch (action) {
			case 'add':
				roles.add(name, role);
				return say(`Added ${name} to ${role}`);
			case 'remove':
				roles.remove(name, role);
				return say(`Removed ${name} from ${role}`);
			default:
				return say("Action must be 'add' or 'remove'");
		}
	},
};
