const { createLogger, format, transports } = require('winston');
const { printf, combine, align, timestamp, json} = format;

const logFormat= printf(({level, message, timestamp, stack})=>{
    return `${timestamp} ${level}: ${stack || message}`;
});
module.exports = createLogger({
    level: 'debug',
    format:combine(
        timestamp({format: 'MMM-DD-YYYY HH:mm:ss'}),
        align(),
        logFormat,
    ),
    defaultMeta: {service: 'server-service'},
    transports: new transports.File({filename: 'logs/server.log'})
});