'use strict';

const axios = require('axios');
const Util = require('../comm/util.js');
const log = Util.log;
const timeout = 10 * 1000;

/**
 * net util of ontology
 */
class NetUtil {
    /**
     * post tx to ontology
     * @param{string} server net address of request
     * @param {string} txData The Fabric context returned by {getContext}.
     * @return {Promise} post result
     */
    static postTx(server, txData) {
        return axios.post(server + '/api/v1/transaction', {
            'Action': 'sendrawtransaction',
            'Version': '1.0.0',
            'Data': txData
        }, {timeout: timeout}).then(function (response) {
            if (response.data.Error !== 0) {
                log('postTx response:', response.data, 'args is', txData);
                return -1;
            }
            return 1;
        }).catch(function (error) {
            log('postTx err:', error.message);
            return -1;
        });
    }

    /**
     * get network current height
     * @param{string} server net address of request
     * @return {Promise} the block height
     */
    static getHeight(server) {
        return axios.get(server + '/api/v1/block/height', {timeout: timeout})
            .then(function (response) {
                if (response.data.Error !== 0) {
                    log('getHeight response:', response.data, 'args is', server);
                    return 0;
                }
                return response.data.Result;
            })
            .catch(function (error) {
                log('getHeight err:', error.message);
                return 0;
            });
    }

    /**
     * get all tx hashes in the block
     * @param{string} server net address of request
     * @param {int} height block height
     * @return {string[]} all tx hashes in the block
     */
    static getBlockTxHashes(server, height) {
        return axios.get(server + '/api/v1/block/transactions/height/' + height, {timeout: timeout})
            .then(function (response) {
                if (response.data.Error !== 0) {
                    log('getBlockTxHashes response:', response.data, 'args is', height);
                    return;
                }
                return response.data.Result.Transactions;
            })
            .catch(function (error) {
                log('getBlockTxHashes err:', error.message);
            });
    }

    /**
     * insure tx is processed
     * @param{string} server net address of request
     * @param {string} txHash tx hash
     * @return {Promise} tx is confirmed or not
     */
    static insureTx(server, txHash) {
        return axios.get(server + '/api/v1/transaction/' + txHash, {timeout: timeout})
            .then(function (response) {
                return response.data.Error === 0;
            })
            .catch(function (error) {
                log('insureTx err:', error.message);
                return false;
            });
    }

    /**
     * get block by height
     * @param{string} server net address of request
     * @param{int} height is block height
     * @return {Promise} block
     */
    static getBlock(server, height) {
        return axios.get(server + '/api/v1/block/details/height/' + height, {timeout: timeout})
            .then(function (response) {
                if (response.data.Error !== 0) {
                    log('getBlock response:', response.data, 'args is', height);
                    return;
                }
                return response.data.Result;
            })
            .catch(function (error) {
                log('getBlock err:', error.message);
            });
    }

    /**
     * get block by height
     * @param{string} server net address of request
     * @param{string} addr is account base58 address
     * @return {Promise} balance json, contained ont and ong
     */
    static getBalance(server, addr) {
        return axios.get(server + '/api/v1/balance/' + addr, {timeout: timeout})
            .then(function (response) {
                if (response.data.Error !== 0) {
                    log('getBalance response:', response.data, 'args is', addr);
                    return 0;
                }
                return response.data.Result;
            })
            .catch(function (error) {
                log('getBlock err:', error.message);
                return 0;
            });
    }
}


module.exports = NetUtil;
