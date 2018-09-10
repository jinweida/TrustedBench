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
module.exports.init = function(blockchain, context, args) {
    bc = blockchain;
    contx = context;
    ips = context['ips'];
    port = context['port'];

    return Promise.resolve();
}

function random_number(m, n){ 
    switch(arguments.length){ 
        case 1: 
            return parseInt(Math.random() * m + 1, 10); 
        case 2: 
            return parseInt(Math.random() * (n - m + 1 ) + m, 10); 
        default: 
            return 0; 
    } 
} 

function updateConfig() {
    var config = contx;

    config['ip'] = ips[random_number(0, ips.length - 1)];
    config['port'] = port;

    // 合约创建的参数
        config['inputs'] = [
            {
                "b58_privkey": '9BPE9cQPqMsonEzqDa3tz8hSrgX74vUH26xAigP93f7F',
                "address": '1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr',
            }
        ];
        config['outputs'] = [
            {
                "address": '1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr',
                "amount": 0,
                "gas_limit": 4700000,
                "byte_code": '60806040526000600155336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555034600160008282540192505081905550610224806100686000396000f30060806040526004361061004c576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806301e3d7181461005157806341c0e1b514610091575b600080fd5b61008f600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506100a8565b005b34801561009d57600080fd5b506100a6610167565b005b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614801561010657508060015410155b15610163578173ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f19350505050158015610151573d6000803e3d6000fd5b50806001600082825403925050819055505b5050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614156101f6576000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16ff5b5600a165627a7a72305820eccec3d4217390cde2cc6015328bea87fa468a8185a12010463a92d108b8d14b0029'
            }
        ];

        // // 合约调用的参数 (通过交易调用)
        // config['inputs'] = [
        //     {
        //         "b58_privkey": '9BPE9cQPqMsonEzqDa3tz8hSrgX74vUH26xAigP93f7F',
        //         "address": '1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr',
        //     }
        // ];
        // config['outputs'] = [
        //     {
        //         "contractaddress" :"d59ffa3f65090366b52877d034ebe3382c8e9666",
        //         "address": '1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr',
        //         "amount": 0,
        //         "gas_limit": 4700000,
        //         "byte_code": 'a41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b68656c6c6f20776f726c64000000000000000000000000000000000000000000'
        //     }
        // ];
    return config;
}

module.exports.run = function() {
    var config = updateConfig();
    // 这里type 2：合约创建，3：合约调用，4:合约本地调用
    return bc.invokeSmartContract(config, 'simple', 'v0', { type: 2 }, 30)
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


