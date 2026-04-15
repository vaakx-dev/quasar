/**
 * Whoami command - Show your current role.
 * @module server/commands/whoami
 */

const roles = require("../lib/roles");

module.exports = {
	name: "whoami",
	prefix: ".",
	description: "Show your role",

	execute({ player, say }) {
		const role = roles.get(player.name);

		if (!role) return say("You have no special role");
		return say(`Your role: ${role}`);
	},
};
