const readline = require("readline");
const config = require("./config.json");
const { logger } = require("./server/lib/logger");
const { Server } = require("./server/server");

require("./game");

global.sim = new Sim();
sim.serverType = "sandbox";
sim.start();

global.server = new Server(sim, config);

// Command registry
const commands = {
    say: (args) => {
        server.say(args.join(" "));
    },

    stop: () => {
        server.stop();
    },

    start: () => {
        global.server = new Server(sim, config);
    },

    restart: () => {
        server.stop();
        global.server = new Server(sim, config);
    },

    status: () => {
        const uptime = Math.floor((Date.now() - server.startTime) / 1000);
        const playerCount = Object.keys(server.players).length;
        logger.info("Server status", {
            state: sim.state,
            mode: sim.serverType,
            players: playerCount,
            uptime: `${uptime}s`
        });
    },

    players: () => {
        const names = server.getPlayerNames();
        if (names.length === 0) return logger.info("No players connected");
        logger.info("Connected players", { players: names });
    },

    kick: (args) => {
        const name = args[0];
        if (!name) return logger.warn("Usage: kick <name>");
        if (!server.kick(name)) return logger.warn("Player not found", { name });
        logger.info("Kicked player", { name });
    },

    mode: (args) => {
        const newMode = args[0];
        if (!newMode) return logger.info("Current mode", { mode: sim.serverType });
        sim.serverType = newMode;
        logger.info("Mode changed", { mode: newMode });
    },

    help: () => {
        logger.info("Available commands", { commands: Object.keys(commands).join(", ") });
    },

    exit: () => {
        server.stop();
        process.exit(0);
    }
};

// Command input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on("line", (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const [command, ...args] = trimmed.split(" ");
    const handler = commands[command];
    if (!handler) return logger.warn("Unknown command", { command });
    handler(args);
});

// Graceful shutdown
process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down");
    server.stop();
    process.exit(0);
});
