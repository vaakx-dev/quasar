/**
 * Mode command - change game mode.
 * @module server/commands/mode
 */

const VALID_MODES = new Set(["1v1", "2v2", "3v3", "sandbox", "survival"]);

module.exports = {
	name: "mode",
	prefix: ".",
	description: "Change game mode (1v1, 2v2, 3v3, sandbox, survival)",

	execute({ sim, player, say }, args) {
		if (sim.state === "running") return say("Can't change mode while game is running");
		if (!player.host) return say("Only the host can change the game mode");
		if (!args.length) return say(`Usage: .mode <${[...VALID_MODES].join("|")}>`);

		const mode = args[0].toLowerCase();
		if (!VALID_MODES.has(mode)) return say(`Invalid mode. Valid: ${[...VALID_MODES].join(", ")}`);

		sim.configGame(player, { type: mode });
	},
};
