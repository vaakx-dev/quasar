global.window = global;
global.atob = function(a) {
    return Buffer.from(a).toString('base64');
};
