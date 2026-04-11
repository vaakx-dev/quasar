/**
 * Whoami command - Show your current role.
 * @module server/commands/whoami
 */

const { getPlayerRole } = require("../lib/permissions");

module.exports = {
	name: "whoami",
	prefix: ".",
	description: "Show your role",

	execute({ player, permissions, say }) {
		const roles = permissions.getRoles();
		const role = getPlayerRole(roles, player.name);

		if (!role) return say("You have no special role");
		return say(`Your role: ${role}`);
	},
};
