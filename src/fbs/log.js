const log4js = require('log4js');
log4js.configure({
  appenders: { fbs: { type: 'file', filename: 'log.log' } },
  categories: { default: { appenders: ['fbs'], level: 'debug' } }
});


const logger = log4js.getLogger('fbs');
 
exports.logger = logger;