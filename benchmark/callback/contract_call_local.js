/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

module.exports.info  = "trustsql contract";
var util = require('../../src/trustsql/contract_handler.js');

var bc, contx;
var utxos = [];

var ips = [];
var port;
module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    contx = context;
    ips = context['ips'];
    port = context['port'];

    if(!contx.hasOwnProperty('contractaddress')) {
        console.log('installSmartContract');
        var config = util.createContractConfig(contx);
        await util.handle_create_contract(config).then(res =>{
             config['contractaddress'] = res['contractaddress'];
        });
    }
    return Promise.resolve(); 
}

function updateConfig() {
    var config = contx;
    config['ip'] = ips[util.random_number(0, ips.length - 1)];
    config['port'] = port;

    var to = contx['contractaddress'];
    // console.log("to : " + to );

    // 配置合约调用的参数(本地调用eth_call)
    config['params'] = 
        {
            "from":'',
            "to": to,
            "gas": '0x300000',
            "data": '0xcfae3217'
             
        };

    return config;
}

module.exports.run = function() {
    var config = updateConfig();
    // 这里type 2：合约创建，3：合约调用，4:合约本地调用
    return bc.invokeSmartContract(config, 'simple', 'v0', { type: 4 }, 30)
        .then((response) => {
            return Promise.resolve(response);
        })
        .catch(err => {
            return Promise.reject(err);
        });
}

module.exports.end = function(results) {
    return Promise.resolve();
}


