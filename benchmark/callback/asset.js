/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

module.exports.info  = "trustsql test";

var cryptoapi = require('../../src/trustsql/cryptoapi.js');
const fs = require("fs");

var bc, contx;
var utxos = {};
var ips = [];
var port = 0;
var timeout = 0;

let keys = [];
let privkeys_id = 0;
let init_privkeys_id = 0;
let process_count = 0;
let issue_number = 0;
let current_issue_number = 0;

let read_file = false;

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
    bc = blockchain;
    contx = context;
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
        issue_number = args["issue_number"];
    }
    return Promise.resolve();
}

// generate test data
// for issue_asset, following data needs to be provided
// 1. trustsql server ip and port
// 2. issuer's privkey(base58 encoded)
// 3. issue_no(unique)
// 4. recver's privkey(base58 encoded)
// 5. the amount to be issued 
function update_config(input_keys, output_keys) {
    var config = {};

    do {
        config["ip"] = ips[cryptoapi.random_number(0, ips.length - 1)];
    }while(config["ip"] === undefined);

    config["port"] = port;
    config["timeout"] = timeout;
    config['inputs'] = [
        {
            "b58_privkey": input_keys["privkey"], 
            "hex_pubkey": input_keys["pubkey"],
            "hex_pubkey_hash": input_keys["pubkey_hash"],
            "hex_pubkey_hash_b58check": input_keys["pubkey_hash_b58check"],
            "address": input_keys["address"],
            "address_bytes": input_keys["address_bytes"],
            "issue_no": cryptoapi.random_issue_no() 
        }
    ];
    config['outputs'] = [
        {
            "b58_privkey": output_keys["privkey"], 
            "hex_pubkey": output_keys["pubkey"],
            "hex_pubkey_hash": output_keys["pubkey_hash"],
            "hex_pubkey_hash_b58check": output_keys["pubkey_hash_b58check"],
            "address": output_keys["address"],
            "address_bytes": output_keys["address_bytes"],
            "amount": cryptoapi.random_number(0, 100) 
        }
    ];
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
    let input_keys = JSON.parse(keys[privkeys_id][0]);
    let output_keys = JSON.parse(keys[privkeys_id][1]);

    let config = update_config(input_keys, output_keys);

    current_issue_number++;
    if(current_issue_number >= issue_number) {
        privkeys_id += process_count;
        if(privkeys_id >= keys.length) {
            privkeys_id = init_privkeys_id;
        }
        current_issue_number = 0;
    }
    
    return bc.invokeSmartContract(config, 'simple', 'v0', { type: 0 }, 30)
        .then((stats) => {
            // save utxo
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
            return Promise.resolve(err);
        });
}

module.exports.run = function() {
    if(read_file) {
        let config = update_config_for_read_file();
        return bc.invokeSmartContract(config, 'simple', 'v0', { type: 0 }, 30)
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

module.exports.utxos = utxos;
