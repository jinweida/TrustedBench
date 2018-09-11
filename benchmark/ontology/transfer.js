'use strict';

module.exports.info = 'transfer';
const Util = require('../../src/comm/util.js');
const log = Util.log;
const readline = require('readline');
const fs = require('fs');

let txNum, txIndex;
let bc;
let txHash = [], txData = [];
let sendTx = true; // false means that client monitor only
let cxt;

// read tx from file, or use sdk to generate tx
module.exports.init = async function (blockchain, context, args) {
    if (!args.hasOwnProperty('sendTx')) {
        return Promise.reject(new Error('sendTx init - "sendTx" is missed in the arguments'));
    }
    sendTx = args.sendTx;
    bc = blockchain;
    cxt = context;
    txIndex = -1;
    bc.bcObj.monitorOnly = !sendTx;
    if (sendTx) {
        await bc.bcObj.initAsset();
    }
    txNum = args.txNum;
    log('start read %d transfer tx', txNum);
    log('args client index is', args.clientIndex);
    if (sendTx) {
        const read = readline.createInterface({
            input: fs.createReadStream('./transfer' + args.clientIndex + '.txt')
        });
        read.on('line', (line) => {
            let lineContent = line.split(',');
            txHash.push(lineContent[0]);
            txData.push(lineContent[1]);
        });
        while (txData.length < txNum) {
            await Util.sleep(1000).then(() => {
            });
        }
        read.close();
    } else {
        for (let i = 0; i < txNum; i++) {
            // if the client only monitor, push a fake tx hash
            // the fake hash is not queried in chain
            txHash.push('fbbc71163e20c95f7a33643b74f7e73fba68983caa95a71e6f929b1e686acb1e');
        }
    }
    log('read transfer tx %d down', txData.length);
    return Promise.resolve();
};


// should sendTx one time in one invoke
module.exports.run = function () {
    txIndex++;
    if (sendTx) {
        return bc.sendTx(cxt, txHash[txIndex], txData[txIndex]);
    } else {
        return bc.sendNon(cxt, txHash[txIndex]);
    }
};

module.exports.end = function () {
    txHash = [];
    txData = [];
    return Promise.resolve();
};
