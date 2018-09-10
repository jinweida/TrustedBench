
/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for TrustSQL
*/


'use strict'
var BlockchainInterface = require('../comm/blockchain-interface.js')
var Logger = require("./log.js");
const TxStatus = require('../comm/transaction');

const issue_handler = require("./issue_handler.js");
const transfer_handler = require("./transfer_handler.js");
const util = require('./util.js');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

class Trustsql extends BlockchainInterface{
    constructor(config_path) {
        super(config_path);

        this.pool = false;
        this.mysql_client_pool = {};

        this.cluster = false;
        this.mysql_client_cluster = undefined;

        this.read_file = false;
        this.remove_file = false;
        this.file_path = '';
        this.state_log_path = "state.log";
        this.error_log_path = "error.log";

        this.current_file_id = 0;
        this.current_file_offet = 0;
        this.total_clients = 0;

        this.sqls = [];
        this.pending = 0;

        var config = require(this.configPath);
        var context = config.trustsql.context;
        if(context.hasOwnProperty("logs")) {
            let logs = context["logs"];
            Logger.set_state_log_path(path.join(__dirname, get_value(logs, "state_log_path", "state.log")));
            Logger.set_error_log_path(path.join(__dirname, get_value(logs, "error_log_path", "error.log")));
            if(logs["debug"]) {
                Logger.enable_debug_log();
            }
            else {
                Logger.disable_debug_log();
            }
        }
    }

    init() {
        process.on('unhandledRejection', (reason, p) => {
            Logger.debug('unhandled_rejection at promise: ', p, ' reason: ', reasom);
        })
        process.on('uncaughtException', (error) => {
            Logger.debug('unhandled_exception: ', error);
        })

        Logger.debug("init");
    	return Promise.resolve();
    }

    /**
     * parse config file and init requester(cluster/pool/rpc/readfile)
     * @param {Json} context config file 
     * @param {String} name label
     */
    parse_config(context) {
    
        // default use mysql_client_pool to send request
        let method = get_value(context, 'method', 'pool');
        let connection = get_value(context, 'connection', {});

        if(context.hasOwnProperty('file')) {
            let file = context['file']; 
            this.read_file = get_value(file, 'read_file', false);
            this.remove_file = get_value(file, 'remove_file', false);
            this.file_path = get_value(file, 'sql_path', ".");
            // TODO: auto calculating by [ls -l sqls | awk '{print $9}' | cut -d '.'-f 1 | cut -c 4- | sort -n | tail -1]
            this.current_file_id += get_value(file, 'file_start_id', 0);
        }
        if(method === "pool") {
            this.pool = true;
        }
        else if(method === "cluster") {
            this.cluster = true;
        }

        if((this.cluster || this.pool) && (!context.hasOwnProperty('nodes'))) {
            Logger.debug('please enter node_contexts for cluster or poll in context_file: ', this.configPath);
            return;
        }

        let node_configs = context['nodes'];
        var connection_limit = get_value(connection, 'connection_limit', 0); 
        var acquire_timeout = get_value(connection, 'acquire_timeout', 0);
        var queue_limit = get_value(connection, 'queue_limit', 0);
        var connect_timeout = get_value(connection, 'connect_timeout', 0);

        // init mysql_client_cluster or mysql_client_pool
        if(this.cluster) {
            this.mysql_client_cluster = mysql.createPoolCluster();
            node_configs.forEach((node_config, item) => {
                node_config['connectionLimit'] = connection_limit;
                node_config['acquireTimeout'] = acquire_timeout;
                node_config['queueLimit'] = queue_limit;
                node_config['connectTimeout'] = connect_timeout;
                this.mysql_client_cluster.add(node_config['host'], node_config);
            });
        }
        else if(this.pool) {
            node_configs.forEach((node_config, item) => {
                node_config['connectionLimit'] = connection_limit;
                node_config['acquireTimeout'] = acquire_timeout;
                node_config['queueLimit'] = queue_limit;
                node_config['connectTimeout'] = connect_timeout;
                this.mysql_client_pool[node_config['host']] = mysql.createPool(node_config);
            });
        }
        else {
            // use json-rpc
        }
    }
    
    /**
    * create needed materials for multiple clients, e.g create account for each client and return the key pairs
    * @number, number of clients
    * @return {Promise}, array of generated JSON object for each client. The array length should be equal to the input number
    *                    Each object should be passed to corresponding client and be used as a argument of getContext
    */
    prepareClients (number) {
        // assign id for every client, then they can read their files according to id and total_clients 
        let clients_args = [];
        for(let i = 0; i < number; i++) {
            clients_args.push({ 'id': i, 'total_clients': number });
        }
        return Promise.resolve(clients_args);
    }

    installSmartContract() {
        Logger.debug('installSmartContract');
        return Promise.resolve();
    }
    
    // obtain current client id and parse config file
    getContext(name, args) {
        this.current_file_id = args['id'];
        this.total_clients = args['total_clients'];

        var config = require(this.configPath);
        var context = config.trustsql.context;
        this.parse_config(context);

        context[name]["id"] = this.current_file_id;
        context[name]["process_count"] = this.total_clients;
        context[name]["read_file"] = this.read_file;
    	return Promise.resolve(context[name]);
    }

    // release mysql_client_cluster or mysql_client_pool
    releaseContext(context) {
        Logger.debug('releaseContext')
        if(this.cluster) {
            this.mysql_client_cluster.end(() => { 
                Logger.debug('mysql_cluster quit...'); } 
            );
        }
        if(this.pool) {
            for(let i = 0; i < this.mysql_client_pool.length; i++) {
                this.mysql_client_pool[i].end(() => { })
            }
            Logger.debug("mysql client pool quit...");
        }

        // when client exit, this.sqls[this.current_file_offet : ] has all sqls don't send yet, these sqls need to save to file
        if(this.sqls.length != this.current_file_offet && this.remove_file) {
            // remove file first
            let file_path = path.join(__dirname, this.file_path) + (this.current_file_id - this.total_clients).toString() + ".data";
            if(fs.existsSync(file_path)) {
                fs.unlinkSync(file_path);
            }
            Logger.info("remove file: " + file_path);
            Logger.info("save last sqls to file_path: " + file_path);
            // save file
            for(let i = this.current_file_offet; i < this.sqls.length; i++) {
                fs.appendFileSync(file_path, this.sqls[i], { encoding: "utf8" });
                fs.appendFileSync(file_path, "\r\n", { encoding: "utf8" });
            }
        }
        return Promise.resolve();
    }

    /**
    * merge an array of default 'txStatistics', the merged result is in the first object
    * @ results {Array}, txStatistics array
    * @ return {Number}, 0 if failed; otherwise 1
    */
    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        var ip = context['ip'];
        if(this.cluster) {
            if(this.mysql_client_cluster === undefined) {
                Logger.error("Error: mysql_client_cluster doesn\'t init");
                let status = new TxStatus();
                status.SetStatusFail();
                return Promise.resolve(status);
            }
            context['mysql_client_cluster'] = this.mysql_client_cluster;
        }
        else if(this.pool) {
            if(!this.mysql_client_pool.hasOwnProperty(ip)) {
                Logger.error("Error: no connection pool with ip " + ip);
                let status = new TxStatus();
                status.SetStatusFail();
                return Promise.resolve(status);
            }
            context['mysql_client_pool'] = this.mysql_client_pool[ip];
        }
        else {
            // use json-rpc
        }

        let promises = [];
        args.forEach((arg, index) => {
            var type = arg['type'];

            let response;
            if(this.read_file) {
                do {
                    // read next file to this.sqls
                    if(this.sqls.length === this.current_file_offet) {
                        // remove prevous file if needed(enabled this.remove_file and send all sqls to server)
                        if(this.sqls.length != 0 && this.remove_file) {
                            let remove_file_path = path.join(__dirname, this.file_path) + (this.current_file_id - this.total_clients).toString() + ".data";
                            if(fs.existsSync(remove_file_path)) {
                                Logger.info('async remove file: ' + remove_file_path); 
                                fs.unlink(remove_file_path, (error) => { 
                                    if(error) {
                                        Logger.error(error);
                                    }
                                });
                            }
                        }
                        // read next file 
                        let filepath = path.join(__dirname, this.file_path) + this.current_file_id.toString() + '.data';
                        if(!fs.existsSync(filepath)) {
                            // read error, exit in advance
                            Logger.fatal("cannot read file: " + filepath + " maybe have read all files, exit client...");
                            // process.exit(0);

                            // ignore...
                            this.current_file_id += this.total_client;
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    resolve({ 'status': 'failed' });
                                }, 10);
                            })
                        }
                        Logger.info("read file: " + filepath);
                        // TODO: use fs.readFile(path, function) to avoid blocking
                        let file_buffer = fs.readFileSync(filepath, { encoding: 'utf8' });
                        this.sqls = file_buffer.split('\r\n');
                        this.current_file_id += this.total_clients;
                        this.current_file_offet = 0;
                    }
                    context['sql'] = this.sqls[this.current_file_offet];
                    this.current_file_offet++;
                } while(context['sql'] === undefined || context['sql'].length === 0);

                // this.pending record the request waiting response to control send rate, not used yet
                this.pending++;
                response = util.handle_request_from_file(context).then(res => {
                    this.pending--;
                    return Promise.resolve(res);
                });
            }
            else if(type === 0) {
                response = issue_handler.handle_issue_assets(context);
            }
            else if(type === 1) {
                response = transfer_handler.handle_transfer(context);
            }

            promises.push(response.then(res => {
                let status = new TxStatus();
                if(res['status'] === 'success') {
                    status.SetStatusSuccess();
                    status.Set("utxo", res["utxo"]);
                }
                else {
                    status.SetStatusFail();
                    Logger.error(res["reason"]);
                }
                status.Set('time_create', res['time_create']);
                status.Set('time_final', res['time_final']);
                return Promise.resolve(status);
            }));
        })
        return Promise.all(promises);
    }

    queryState(context, contractID, contractVer, key) {
        Logger.debug('queryState')
    	return Promise.resolve();
    }

    static get_failed_status() {
        let status = new TxStatus();
        status.SetStatusFail();
        return Promise.resolve(status);
    }
}
module.exports = Trustsql;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function get_value(m, k, d) {
    if(m.hasOwnProperty(k)) {
        return m[k];
    }
    else {
        return d;
    }
}