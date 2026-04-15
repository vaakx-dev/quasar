/**
 * Mode command - change game mode.
 * @module server/commands/mode
 */

module.exports = {
	name: "mode",
	prefix: ".",
	description: "Change game mode (1v1, 2v2, 3v3, sandbox, survival)",
	hostOverride: true, // Host can always use this command

	schema: {
		args: [
			{
				name: 'mode',
				type: 'enum',
				required: true,
				enum: ['1v1', '2v2', '3v3', 'sandbox', 'survival'],
				description: 'Game mode to set'
			}
		]
	},

	execute({ sim, player, say }, args) {
		const { mode } = args;

		if (sim.state === "running") return say("Can't change mode while game is running");
		if (!player.host) return say("Only the host can change the game mode");

		sim.configGame(player, { type: mode });
	},
};
