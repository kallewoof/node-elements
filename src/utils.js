const deasync = require('deasync');

const utils = {
    deasyncObject(object, synchronousByNature = []) {
        const target = object.prototype || object;
        for (const m of Object.keys(target)) {
          if (!synchronousByNature[m] && m[m.length-1] !== 'O')
            target[`${m}S`] = deasync(target[m]);
        }
    },
};

module.exports = utils;
