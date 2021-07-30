const mongoose = require('mongoose');
const config = require('config');
const db = config.get('mongoURI');
const logger=require('../logger/log');

const connectDB = async () => {
    try {
        await mongoose.connect(db, {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false});
        logger.info('Connected to mongodb');
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}

module.exports = connectDB;