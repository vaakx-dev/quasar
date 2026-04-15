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

	execute({ sim, player, say }, args) {
		if (!args.length) return say("Usage: .ban <add|list|remove> [name|ip] [reason]");

		const action = args[0].toLowerCase();

		if (action === "list") {
			return this._listBans(say);
		}

		if (action === "add") {
			return this._addBan(sim, say, args.slice(1), player);
		}

		if (action === "remove") {
			return this._removeBan(say, args.slice(1));
		}

		return say("Usage: .ban <add|list|remove> [name|ip] [reason]");
	},

	_addBan(sim, say, args, sender) {
		if (!args.length) return say("Usage: .ban add <name|ip> [reason]");

		const name = args[0];
		const reason = args.slice(1).join(" ") || "Banned";
		const type = IP_REGEX.test(name) ? 'ip' : 'name';
		const senderName = sender?.name;

		// Permission check for name bans
		if (type === 'name' && senderName && name) {
			if (senderName === name) {
				return say("You cannot ban yourself");
			}
			const senderRank = roles.rank(senderName);
			const targetRank = roles.rank(name);
			// If target has no role, anyone with a role can ban
			// Otherwise sender must have higher role (lower number)
			if (targetRank === -1 ? senderRank === -1 : senderRank >= targetRank) {
				return say(`Cannot ban ${name}: insufficient permissions`);
			}
		}

		// Check if already banned
		if (bans.has(name)) {
			return say(`${name} is already banned`);
		}

		// Add ban and save with reason
		bans.add(name, reason);

		// Kick if online
		bus.emit('player:kick', { target: name, reason });

		say(`Banned ${name}: ${reason}`);
	},

	_removeBan(say, args) {
		if (!args.length) return say("Usage: .ban remove <name|ip>");

		const name = args[0];

		if (!bans.remove(name)) {
			return say(`${name} is not banned`);
		}

		say(`Unbanned ${name}`);
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
