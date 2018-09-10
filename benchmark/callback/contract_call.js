/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

module.exports.info  = "trustsql contract";
var util = require('../../src/trustsql/contract_handler.js');
var fs = require('fs'); 
var lineReader = require('line-reader');
var cryptoapi = require('../../src/trustsql/cryptoapi.js');

var bc, contx;
var utxos = [];

var ips = [];
var port;
var addresses = [];
var byte_code_arr=[];
var address_bytes;
var hex_pubkey;
var hex_pubkey_hash;
module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    contx = context;
    ips = context['ips'];
    port = context['port'];
    // 参数初始化
    address_bytes = cryptoapi.address_to_address_bytes('1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr');
    hex_pubkey = cryptoapi.privkey_to_compress_hex_pubkey('9BPE9cQPqMsonEzqDa3tz8hSrgX74vUH26xAigP93f7F');
    hex_pubkey_hash = cryptoapi.hash160(hex_pubkey);
   
    // 从文件读取合约执行的code
    var i = 0;
    lineReader.eachLine('./benchmark/config/code.txt', {encoding : 'utf8'},function(line, last) {
        byte_code_arr[i++] = line.split(",")[0];
      });
    
   
    // 发布合约
    var config = util.createContractConfig(contx);
    await util.handle_create_contract(config).then(res =>{
        if (res['contractaddress'] != null) {
            addresses =  res['contractaddress'].substring(2);
        }
    });
    
    return Promise.resolve();
} 

function updateConfig() {
    var config = contx;
    var byte_code = byte_code_arr[util.random_number(0, byte_code_arr.length - 1)];
    config['ip'] = ips[0];
    config['port'] = port;

        // 合约调用的参数 (通过交易调用)
        config['inputs'] = [
            {
                "b58_privkey": '9BPE9cQPqMsonEzqDa3tz8hSrgX74vUH26xAigP93f7F',
                "address_bytes": address_bytes,
                "hex_pubkey":hex_pubkey,
                "hex_pubkey_hash":hex_pubkey_hash
            }
        ];
        config['outputs'] = [
            {
                "contractaddress" : addresses,
                "address": '1KzBWDAcf66fyZ1qGb2r6YZp3CfuRgfdDr',
                "address_bytes": address_bytes,
                "amount": 0,
                "gas_limit": 3000000,
                "byte_code":byte_code
                // "byte_code": '01e3d7180000000000000000000000002610cc0a96865b1c85b3559a5d0dcfe070c8069d0000000000000000000000000000000000000000000000000000000000000001'
            }
        ];
    return config;
}

module.exports.run = function() {
    var config = updateConfig();
    // 这里type 2：合约创建，3：合约调用，4:合约本地调用
    return bc.invokeSmartContract(config, 'simple', 'v0', { type: 3 }, 30)
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


