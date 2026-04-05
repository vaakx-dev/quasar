// Istrolid module loader
// Sets up globals and loads all game modules in dependency order

// Load fix.js to set up browser shims
require('./fix.js');

// Load modules in dependency order
require('./lib/mtwist.js');
require('./core/hspace.js');
require('./core/protocol.js');
require('./core/maths.js');
require('./core/maps.js');
require('./core/sim.js');
require('./core/things.js');
require('./core/unit.js');
require('./core/parts.js');
require('./core/ai.js');
require('./core/aidata.js');
require('./core/grid.js');
require('./core/colors.js');
require('./core/utils.js');
require('./core/zjson.js');
require('./core/survival.js');

module.exports = global;
