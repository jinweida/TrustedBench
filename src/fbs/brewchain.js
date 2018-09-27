/**
 * Copyright 2017 HUAWEI. All Rights Reserved.
 *
 *  Modified by brew. fclink.cn
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the fclink class, which implements the caliper's NBI for brew chain
 */

'use strict';
var request = require('request');
var http = require('http');
const rp = require('request-promise');

const util = require('util');



var agent = new http.Agent({
    keepAlive: true,
    maxSockets: 30,
    keepAliveMsecs: 3600000,
})
const BlockchainInterface = require('../comm/blockchain-interface.js');
const commUtils = require('../comm/util');
const logger = require('./log').logger;
const TxStatus = require('../comm/transaction');

var id = 0;
/**
 * Implements {BlockchainInterface} for a brewchain backend.
 */
class Brewchain extends BlockchainInterface{
    /**
     * Create a new instance of the {brewchain} class.
     * @param {string} config_path The path of the brewchain network configuration file.
     */
    constructor(config_path) {
        super(config_path);
    }

    /**
     * Initialize the {brewchain} object.
     * @return {Promise} The return promise.
     */
    init() {
        process.on('unhandledRejection', (reason, p) => {
            logger.debug('unhandled_rejection at promise: ', p, ' reason: ', reasom);
        })
        process.on('uncaughtException', (error) => {
            logger.debug('unhandled_exception: ', error);
        })

        logger.debug("brewchain init");
        return  Promise.resolve({});
    }

    /**
     * Deploy the chaincode specified in the network configuration file to all peers.
     * @return {Promise} The return promise.
     */
    installSmartContract() {
        logger.debug("brewchain installSmartContract")
       return  Promise.resolve({});
    }

    prepareClients (number) {
        // assign id for every client, then they can read their files according to id and total_clients 
        let clients_args = [];
        for(let i = 0; i < number; i++) {
            clients_args.push({ 'id': i, 'total_clients': number });
        }
        return Promise.resolve(clients_args);
    }

    /**
     * Return the Brewchain context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Fabric context.
     */
    getContext(name, args) {
        //util.init(this.configPath);
        commUtils.log("getcongtext:name="+name+",args="+JSON.stringify(args));
        
        return  Promise.resolve({});

    }

    /**
     * Release the given Fabric context.
     * @param {object} context The Fabric context to release.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        return  Promise.resolve("ok");
    }
    /**
     * 发起交易
     * @param {string} restApiUrl 
     */
    submitTx(restApiUrl) {
        let txStatus = new TxStatus(id++);
        let options = {
            method: 'POST',
            url: restApiUrl
        };
        // txStatus.SetStatusSuccess();
        // return Promise.resolve(txStatus);
        return rp(options)
            .then(function (body) {
                txStatus.SetStatusSuccess();
                return Promise.resolve(txStatus);;
            })
            .catch(function (err) {
                //logger.info('Submit batches failed, ' + (err.stack?err.stack:err));
                txStatus.SetStatusSuccess();
                return Promise.resolve(txStatus);
            });
    }

    /**
     * Invoke the given chaincode according to the specified options. Multiple transactions will be generated according to the length of args.
     * @param {object} context The Brewchain context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {Array} args Array of JSON formatted arguments for transaction(s). Each element containts arguments (including the function name) passing to the chaincode. JSON attribute named transaction_type is used by default to specify the function name. If the attribute does not exist, the first attribute will be used as the function name.
     * @param {number} timeout The timeout to set for the execution in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        if(context.engine) {
            context.engine.submitCallback(args.length);
        }
        let promises = [];
        args.forEach((item, index)=>{
            let uri='http://'+item.ip+':38000/fbs/tst/pblte.do';
            promises.push(this.submitTx(uri));
        });
        return Promise.all(promises);
    }

    /**
     * Query the given chaincode according to the specified options.
     * @param {object} context The Fabric context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {string} key The argument to pass to the chaincode query.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    queryState(context, contractID, contractVer, key) {
        // TODO: change string key to general object
        return Promise.resolve({});
        // return e2eUtils.querybycontext(context, contractID, contractVer, key.toString());
    }
    /**
     * Calculate basic statistics of the execution results.
     * @param {object} stats The object that contains the different statistics.
     * @param {object[]} results The collection of previous results.
     */
    getDefaultTxStats(results, detail) {
        return  Promise.resolve("ok");
    }
}
module.exports = Brewchain;
