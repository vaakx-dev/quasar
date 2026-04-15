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

	schema: {
		args: [
			{
				name: 'action',
				type: 'enum',
				required: true,
				enum: ['add', 'remove'],
				description: 'Action to perform'
			},
			{
				name: 'player',
				type: 'string',
				required: true,
				description: 'Player name'
			},
				{
				name: 'role',
				type: 'enum',
				required: true,
				enum: () => roles.roles.map(r => r.name),
				description: 'Role to assign'
			}
		]
	},

	execute({ say }, args) {
		const { action, player: name, role: roleName } = args;

		// Check if role exists
		if (roles.level(roleName) === -1) return say(`Role "${roleName}" does not exist`);

		switch (action) {
			case 'add':
				roles.add(name, roleName);
				return say(`Added ${name} to ${roleName}`);
			case 'remove':
				roles.remove(name, roleName);
				return say(`Removed ${name} from ${roleName}`);
		}
	},
};
