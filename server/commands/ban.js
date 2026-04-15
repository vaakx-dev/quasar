/**
 * Ban command - Manage bans (add, list, remove).
 * @module server/commands/ban
 */

const { bus } = require("../lib/bus");
const bans = require("../lib/bans");
const roles = require("../lib/roles");

const IP_REGEX = /^\d+\.\d+\.\d+\.\d+$/;

module.exports = {
	name: "ban",
	prefix: ".",
	description: "Manage bans (add, list, remove)",
	requiredRole: "mod",

	schema: {
		args: [
			{
				name: 'action',
				type: 'enum',
				required: true,
				enum: ['add', 'list', 'remove'],
				description: 'Action to perform'
			},
			{
				name: 'target',
				type: 'string',
				required: false,
				default: '',
				description: 'Player name or IP'
			},
			{
				name: 'reason',
				type: 'rest',
				required: false,
				default: [],
				description: 'Ban reason (captures remaining args)'
			}
		]
	},

	execute({ player, say }, args) {
		const { action, target, reason } = args;

		switch (action) {
			case 'list': return this._listBans(say);
			case 'add': return this._addBan(say, target, reason, player);
			case 'remove': return this._removeBan(say, target);
		}
	},

	_addBan(say, target, reason, sender) {
		if (!target) return say("Usage: .ban add <name|ip> [reason]");

		const reasonStr = Array.isArray(reason) ? reason.join(' ') : reason || "Banned";
		const type = IP_REGEX.test(target) ? 'ip' : 'name';
		const senderName = sender?.name;

		// Permission check for name bans
		if (type === 'name' && senderName && target) {
			if (senderName === target) return say("You cannot ban yourself");
			const senderRank = roles.rank(senderName);
			const targetRank = roles.rank(target);
			// If target has no role, anyone with a role can ban
			// Otherwise sender must have higher role (lower number)
			if (targetRank === -1 ? senderRank === -1 : senderRank >= targetRank) return say(`Cannot ban ${target}: insufficient permissions`);
		}

		// Check if already banned
		if (bans.has(target)) return say(`${target} is already banned`);

		// Add ban and save with reason
		bans.add(target, reasonStr);

		// Kick if online
		bus.emit('player:kick', { target, reason: reasonStr });

		say(`Banned ${target}: ${reasonStr}`);
	},

	_removeBan(say, target) {
		if (!target) return say("Usage: .ban remove <name|ip>");
		if (!bans.remove(target)) return say(`${target} is not banned`);

		say(`Unbanned ${target}`);
	},

	_listBans(say) {
		const parts = [];
		const nameEntries = Object.entries(bans.names);
		const ipEntries = Object.entries(bans.ips);

		if (nameEntries.length) {
			const formatted = nameEntries.map(([name, data]) => `${name} (${data.reason})`);
			parts.push(`Names: ${formatted.join(", ")}`);
		}
		if (ipEntries.length) {
			const formatted = ipEntries.map(([ip, data]) => `${ip} (${data.reason})`);
			parts.push(`IPs: ${formatted.join(", ")}`);
		}

		if (!parts.length) return say("No active bans");
		say(parts.join(" | "));
	},
};
