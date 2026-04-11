/**
 * Roles command - List all roles and their members.
 * @module server/commands/roles
 */

const { getPlayerRole } = require("../lib/permissions");

module.exports = {
	name: "roles",
	prefix: ".",
	description: "List all roles and their members",
	requiredRole: "mod",

	execute({ permissions, say }) {
		const roles = permissions.getRoles();

		if (!roles || !roles.roles || !roles.roles.length) {
			return say("No roles configured");
		}

		for (const role of roles.roles) {
			const members = role.members?.join(", ") || "none";
			say(`${role.name}: ${members}`);
		}
	},
};
