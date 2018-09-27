/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.info  = 'brewchain trans';

let accounts = [],tx=[];
let bc, contx,msg;

const logger = require('../../src/fbs/log.js').logger;


module.exports.init = function(blockchain, context, args) {

    bc = blockchain;
    contx = context;
    msg=args; 
    return Promise.resolve();   
};


module.exports.run = function() {
    return bc.invokeSmartContract(contx, 'simple', 'v0', {ip:msg.hostip,type:0}, 30);
};

module.exports.end = function(results) {
    return Promise.resolve();
};

module.exports.accounts = accounts;
