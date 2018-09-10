/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

module.exports.info  = "trustsql test";
var cryptoapi = require('../../src/trustsql/cryptoapi.js');
var TrustSQL = require("../../src/trustsql/trustsql.js");
var Logger = require("../../src/trustsql/log.js");
const fs = require("fs");

var bc
var utxos = {};
var ips = [];
var port = 0;

let keys = [];
let privkeys_id = 0;
let init_privkeys_id = 0;
let process_count = 0;
let timeout = 0;
let read_file = false;

let current_utxo_offet = 0;
let current_input_keys = null;
let current_output_keys = null;
let current_round = 1;

function read_keys_from_file(keys_path) {
    let read_keys = fs.readFileSync(keys_path, { encoding: "utf8" }).split("\r\n");
    for(let i = 0; i < read_keys.length; i++) {
        let data = (read_keys[i].split("\r"));
        data.pop();
        let subkeys = [];
        for(let j = 0; j < data.length; j++) {
            let key = data[j].split(",");
            subkeys.push(key);
        }
        keys.push(subkeys);
    }
}

module.exports.init = function(blockchain, context, args) {
    console.log("transfer.js init")

    // get asset_module's utxos for transfer testing
    let asset_module = require('./asset.js');
    utxos = asset_module.utxos;

    bc = blockchain;
    if(!context.hasOwnProperty('ips')) {
        return Promise.reject('no ip list in context');
    }
    ips = context['ips'];
    port = context['port'];
    if(context.hasOwnProperty('query_timeout')) {
        timeout = context['query_timeout'];
    }

    read_file = context["read_file"];
    if(!read_file) {
        read_keys_from_file(context["keys_path"]);
        privkeys_id = context["id"];
        init_privkeys_id = context["id"];
        process_count = context["process_count"];
    }

    return Promise.resolve();
}

// generate test data for transfer testing
// for transfer, following data needs to be provided
// 1. trustsql server ip and port
// 2. sender's available utxos for this transfer
// 3. sender's address(hex encoded)
// 4. sender's privkey(base58 encoded)
// 5. index, such as the i in inputs[i]
function update_config() {
    let utxo = utxos[current_input_keys["privkey"]][current_utxo_offet];
    if(utxo["b58_privkey"] === undefined) {
        console.log(utxo);
    }
    let config = {};
    do {
        config["ip"] = ips[cryptoapi.random_number(0, ips.length - 1)];
    }while(config["ip"] === undefined);

    config["port"] = port;
    config["timeout"] = timeout;

    config['inputs'] = [];
    config['inputs'].push({
        "output_point": {
            "hash": utxo['txhash'],
            "index": utxo['index']
        },
        "address": utxo['address'],
        "b58_privkey": utxo["b58_privkey"], 
        "address_bytes": current_input_keys["address_bytes"],
        "hex_pubkey": current_input_keys["pubkey"],
        "index": 0
    });

    config['outputs'] = [];
    config['outputs'].push({                
        "b58_privkey": current_output_keys["privkey"],
        "address": current_output_keys["address"], 
        "address_bytes": current_output_keys["address_bytes"],
        "asset_id": utxo['asset_id'],
        "index": 0,
        "amount": utxo['amount']
    });
    return config;
}

function update_config_for_read_file() {
    let config = {};
    do {
        config["ip"] = ips[cryptoapi.random_number(0, ips.length - 1)];
    }while(config["ip"] === undefined);

    config["port"] = port;
    config["timeout"] = timeout;
    return config;
}


function handle_stat(stat) {
    if(stat.IsCommitted()) {
        let utxo = stat.Get("utxo");
        let base58_privkey = utxo["b58_privkey"];
        if(!utxos.hasOwnProperty(base58_privkey)) {
            utxos[base58_privkey] = [];
        }
        utxos[base58_privkey].push(utxo);
    }
}
function run_once() {
    if(current_input_keys === null) {
        let current_keys = keys[privkeys_id];
        current_input_keys = JSON.parse(current_keys[current_round]);
        if(current_round + 1 < keys[0].length) {
            current_output_keys = JSON.parse(current_keys[current_round + 1]);
        }
        else {
            current_output_keys = JSON.parse(current_keys[1]);
        }
        privkeys_id += process_count;
        if(privkeys_id >= keys.length) {
            privkeys_id = init_privkeys_id;
            current_round++;
            if(current_round >= keys[0].length) {
                current_round = 1;
            }
        }
    }
    if(!utxos.hasOwnProperty(current_input_keys["privkey"])) {
        Logger.error("cannot find utxo for ", current_input_keys["privkey"]);

        privkeys_id = init_privkeys_id;
        current_round++;
        if(current_round >= keys[0].length) {
            current_round = 1;
        }

        current_utxo_offet = 0;
        current_input_keys = null;
        current_output_keys = null;

        return TrustSQL.get_failed_status();
    }
    let config = update_config();

    current_utxo_offet++;
    if(current_utxo_offet >= utxos[current_input_keys["privkey"]].length) {
        current_utxo_offet = 0;
        delete utxos[current_input_keys["privkey"]];
        current_input_keys = null;
        current_output_keys = null;
    } 


    return bc.invokeSmartContract(config, 'simple', 'v0', { type: 1 }, 30)
        .then((stats) => {
            config = null;
            if(Array.isArray(stats)) {
                stats.forEach((stat) => {
                    handle_stat(stat);
                })
            }
            else {
                handle_stat(stats);
            }
            return Promise.resolve(stats);
        })
        .catch(err => {
            return Promise.reject(err);
        });

}
module.exports.run = function() {
    if(read_file) {
        let config = update_config_for_read_file();
        return bc.invokeSmartContract(config, 'simple', 'v0', { type: 1 }, 30)
            .then((stats) => {
                return Promise.resolve(stats);
            })
            .catch(err => {
                return Promise.resolve(err);
            });
    }
    return run_once();
}

module.exports.end = function(results) {
    return Promise.resolve();
}

