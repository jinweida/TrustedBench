const sender = require('./sender.js');
const parser = require("./parser.js");
const fs = require("fs");
const sd = require("silly-datetime");

module.exports.handle_request_from_file = function(config) {
    let promise;
    if(config.hasOwnProperty('mysql_client_cluster')) {
        promise = sender.send_request_by_mysql_client_cluster(config['mysql_client_cluster'], config['sql'], config['timeout']);
    }
    else if(config.hasOwnProperty('mysql_client_pool')) {
        promise = sender.send_request_by_mysql_client_pool(config['mysql_client_pool'], config['sql'], config['timeout']);
    }
    else {
        promise = sender.send_request_by_json_rpc(config['ip'], config['port'], config['json']);
    }
    return promise.then(res => {
        return Promise.resolve(parser.pack_response_without_utxo(res));
    }).catch(error => {
        return Promise.resolve({ 'status': 'failed', 'reason': error });
    });
}
