var sync_request = require('sync-request');
var http = require('http');
const sd = require("silly-datetime");
const fs = require("fs");
const Logger = require("./log.js");

const parser = require("./parser.js");

function  sync_send_json_to_server(ip, port, json_data) {
    var url = 'http://' + ip + ':';
    if(typeof port === 'number') {
        url += port.toString();
    }
    else {
        url += port;
    }
    var start_time = Date.now();
    var response = sync_request('POST', url, { json: JSON.parse(json_data) });
    var end_time = Date.now();
    console.log('send json.......', (end_time - start_time) / 1000);

    try {
        var body = response.getBody().toString();
        return { 'status': 'success', "data": JSON.parse(body), "start_time": start_time, "end_time": end_time };
    }
    catch(error) {
        return { 'status': 'failed', 'data': error };
    }
}
module.exports.sync_send_json_to_server = sync_send_json_to_server;

/**
 * send json data to trustsql server and wait response(include { start_time, end_time, body })
 * @param {String} ip trustsql server ip
 * @param {Number} port trustsql server port
 * @param {Json} json_data request data
 * @return {Promise} promise value that indicates response promise({ start_time, end_time, body })
 */
async function send_request_by_json_rpc(ip, port, json_data) {
    json_data = JSON.stringify(json_data);
    let agent = new http.Agent({ maxSockets: 1, keepAlive: true });
    var options = {
        host: ip,
        port: port,
        method: "POST",
        json: true,
        body: (json_data),
        headers: {
            "content-type": "application/json",
            "content-length": json_data.length,
            "connection": "keep-alive"
        },
        agent: agent
    };  

    var promise = new Promise((resolve, reject) => {
        setTimeout(()=>{
            let start_time = Date.now();
            let req = http.request(options, function(res) {
                let body = '';
                res.on('data', (data) => {
                    body += data;
                });
                res.on('end', () => {
                    // console.log(body);
                    var end_time = Date.now();
                    var res = { "data": JSON.parse(body), "start_time": start_time,  "end_time": end_time };
                    return resolve(res);                
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            req.write(json_data);
            req.end();
        },0);    
       
    }).catch(err => {
        return Promise.reject(err);
    })
    return promise;
}
module.exports.send_request_by_json_rpc = send_request_by_json_rpc;

/**
 * send sql data to trustsql server and wait response(include { start_time, end_time, body })
 * @param {MySQLClientCluster} mysql_cluster mysql client cluster
 * @param {String} sql sql request data 
 * @param {Number} query_timeout query timeout
 * @return {Promise} promise value that indicates response promise({ start_time, end_time, body })
 */
async function send_request_by_mysql_client_cluster(mysql_cluster, sql, query_timeout) {
    let promise = new Promise((resolve, reject) => {
       mysql_cluster.getConnection(function(error, connection) {
           if(error) {
               reject(error);
           }
           else {
                let start_time = Date.now();
                let query;
                if(query_timeout != 0 && query_timeout != undefined) {
                    query = { sql: sql, timeout: query_timeout };
                }
                else {
                    query = { sql: sql };
                }
                connection.query(query, function(err, results, fields)  {
                    connection.release();
                    var end_time = Date.now();
                    if(err) {
                        reject(err);
                    }
                    else {
                        let res = { "data": { 'result': JSON.parse(results['message'].toString().substr(1)) }, "start_time": start_time, "end_time": end_time}; 
                        resolve(res);
                    }
                })
           }
       })
    }).catch(error => {
        return Promise.reject(error);
    })
    return promise;
}
module.exports.send_request_by_mysql_client_cluster = send_request_by_mysql_client_cluster;

/**
 * send sql data to trustsql server and wait response(include { start_time, end_time, body })
 * @param {MySQLClientPool} mysql_clients mysql client pool 
 * @param {String} sql sql request data 
 * @param {Number} query_timeout query timeout
 * @return {Promise} promise value that indicates response promise({ start_time, end_time, body })
 */
async function send_request_by_mysql_client_pool(mysql_clients, sql, query_timeout) {
    console.log(sql);
    let promise = new Promise((resolve, reject) => {
        let start_time = Date.now();
        let query;
        if(query_timeout != 0) {
            query = { sql: sql, timeout: query_timeout };
        }
        else {
            query = { sql: sql };
        }
        mysql_clients.query(query, (err, results, fields) => {
            let end_time = Date.now();
            if(err) {
                reject(err + " " + (end_time - start_time).toString());
            }
            else {
                let res = { "data": { 'result': JSON.parse(results['message'].toString().substr(1)) }, "start_time": start_time, "end_time": end_time };
                resolve(res);
            }
        })

        // mysql_clients.getConnection((error, connection) => {
        //     if(error) {
        //         reject(error);
        //     }
        //     else {
        //         let start_time = Date.now();
        //         let query;
        //         if(query_timeout != 0) {
        //             query = { sql: sql, timeout: query_timeout };
        //         }
        //         else {
        //             query = { sql: sql };
        //         }
        //         connection.query(query, (err, results, fields) => {
        //             connection.release();
        //             let end_time = Date.now();
        //             if(err) {
        //                 // connection.destroy();
        //                 reject(err + " " + (end_time - start_time).toString());
        //             }
        //             else {
        //                 // connection.release();
        //                 let res = { "data": { 'result': JSON.parse(results['message'].toString().substr(1)) }, "start_time": start_time, "end_time": end_time };
        //                 resolve(res);
        //             }
        //         })
        //     }
        // })
    }).catch(error => {
        return Promise.reject(error);
    })
    return promise;
}
module.exports.send_request_by_mysql_client_pool = send_request_by_mysql_client_pool;



function send_request(tx_json) {
    let config = tx_json['config'];
    let trans = tx_json['trans'];
    let toutputs = tx_json['toutputs'];

    let promise;
    if(config.hasOwnProperty('mysql_client_cluster')) {
        promise = send_request_by_mysql_client_cluster(config['mysql_client_cluster'], trans.to_sql(), config["timeout"]);
    }
    else if(config.hasOwnProperty('mysql_client_pool')) {
        promise = send_request_by_mysql_client_pool(config['mysql_client_pool'], trans.to_sql(), config['timeout']);
    }
    else {
        promise = send_request_by_json_rpc(config['ip'], config['port'], trans.to_json());
    }

    return promise.then(res => {
        return Promise.resolve(parser.pack_response(config, toutputs, res));
    }).catch(error => {
        return Promise.resolve({ "status": "failed", "reason": error })
    });
}
module.exports.send_request = send_request;
