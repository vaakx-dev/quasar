// Istrolid module loader
// Sets up globals and loads all game modules in dependency order

if (typeof window === 'undefined') {
    global.window = global;
}

// Load modules in dependency order
require('./src/lib/mtwist.js');
require('./src/src/hspace.js');
require('./src/src/protocol.js');
require('./src/src/maths.js');
require('./src/src/maps.js');
require('./src/src/sim.js');
require('./src/src/things.js');
require('./src/src/unit.js');
require('./src/src/parts.js');
require('./src/src/ai.js');
require('./src/src/aidata.js');
require('./src/src/grid.js');
require('./src/src/colors.js');
require('./src/src/utils.js');
require('./src/src/zjson.js');
require('./src/src/survival.js');

module.exports = global;
