/**
 * Ping command - Show your connection latency.
 * @module server/commands/ping
 */

module.exports = {
	name: "ping",
	prefix: ".",
	description: "Show your connection latency",

	execute({ player, say }) {
		if (!player?.ws) return say("You are not connected");

		const startTime = Date.now();

		// Use WebSocket's built-in ping/pong mechanism to measure latency
		player.ws.ping();

		player.ws.once("pong", () => {
			const latency = Date.now() - startTime;
			say(`pong ${latency} ms`);
		});
	},
};
