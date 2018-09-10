var txapi = require('./transaction.js');
var cryptoapi = require('./cryptoapi.js');
var Logger = require("./log.js");


function get_value(obj, name, res = '') {
    if(obj.hasOwnProperty(name)) {
        return obj[name];
    }
    else {
        return res;
    }
}
module.exports.get_value = get_value;

/**
 * parse inputs from config
 * @param {Json} config test data
 * @return {Array} array value that indicates inputs
 */
function parse_inputs(config) {
    var tinputs = [];
    for(let i = 0; i < config['inputs'].length; i++) {
        var tinput = config['inputs'][i];

        var output_point = get_value(tinput, 'output_point', {});  
        var hex_privkey = cryptoapi.base58_to_hex(tinput['b58_privkey']);
        var hex_pubkey = tinput['hex_pubkey'];
        var issue_no = tinput['issue_no'];
        var index = get_value(tinput, 'index', i);
        var output_point_hash = output_point['hash'];
        var output_point_index = output_point['index'];
        var ops_list = output_point['ops_list'];

        tinputs.push({
                'hex_privkey': hex_privkey,
                'hex_pubkey': hex_pubkey,
                'issue_no': issue_no,
                'index': index,
                'output_point_hash': output_point_hash,
                'output_point_index': output_point_index,
                'ops_list': ops_list
        });
    }
    return tinputs;
}

/**
 * parse inputs from config
 * @param {Json} config test data
 * @return {Array} array value that indicates outputs
 */
function parse_outputs(config) {
    var toutputs = [];
    for(let i = 0; i < config['outputs'].length; i++) {
        var toutput = config['outputs'][i];

        let privkey = toutput['b58_privkey'];
        let address = toutput['address'];
        let address_bytes = toutput['address_bytes'];
        var amount = toutput['amount'];
        var data = toutput['data'];
        var index = get_value(toutput, 'index', i);
        var asset_id = toutput['asset_id'];
        var ops_list = toutput['ops_list'];
        var res = txapi.generate_condition(ops_list);
        var condition_bytes = res[0];
        var condition = res[1];

        toutputs.push({
                  'b58_privkey': privkey,
                  'address_bytes': address_bytes,
                  'address': address,
                  'amount': amount,
                  'data': data,
                  'asset_id': asset_id,
                  'index': index,
                  'condition_bytes': condition_bytes,
                  'condition': condition
        });
    }
    return toutputs;
}

/**
 * generate transaction object
 * @param {Json} config test data
 * @return {Json} json value that indicates { trans, config, touputs }
 */
function parse_transaction(config) {
    var tinputs = parse_inputs(config);
    var toutputs = parse_outputs(config);

    var tx_inputs = [];
    for(let i = 0; i < tinputs.length; i++) {
        var tinput = tinputs[i];

        // calculate input.connected_script by concatting script_type, script_version and all string in tinput['ops_list']
        var script_bytes = txapi.generate_script_bytes(tinput['ops_list']); 
        var tx_output_point = new txapi.TransactionOutputPoint(tinput['output_point_hash'], tinput['output_point_index'], tinput['issue_no']);
        var tx_input = new txapi.TransactionInput(tx_output_point, tinput['index'], '', script_bytes);
        tx_inputs.push(tx_input);
    }

    var tx_outputs = [];
    for(let i = 0; i < toutputs.length; i++) {
        var toutput = toutputs[i];
        var asset_id = toutput['asset_id'];
        
        var tx_output = new txapi.TransactionOutput(toutput['index'], toutput['address'], asset_id, 
                                                    toutput['amount'],  toutput['data'], toutput['address_bytes'],
                                                    toutput['condition'], toutput['condition_bytes']);
        tx_outputs.push(tx_output);
    }

    var trans = new txapi.Transaction();
    trans.params['Fversion'] = get_value(config, 'version', 1);
    trans.params['Flocktime'] = get_value(config, 'locktime', 0);
    trans.params['Fmeta'] = get_value(config, 'meta', '{}');
    trans.params['Finputs'] = tx_inputs;
    trans.params['Foutputs'] = tx_outputs;
    trans.method = 'insertTransaction';

    for(let i = 0; i < tinputs.length; i++) {
        trans.params['Finputs'][i].voucher = trans.get_voucher(tinputs[i]['hex_privkey'], tinputs[i]['hex_pubkey'], tinputs[i]['index']);
    }

    for(let i = 0; i < toutputs.length; i++) {
        trans.params['Foutputs'][i].data = cryptoapi.base58_encode(cryptoapi.bin_to_hex(toutputs[i].data));
    }
    // put it here because calculating voucher needs to use the old Fmeta's value
    trans.params['Fmeta'] = cryptoapi.base58_encode(cryptoapi.bin_to_hex(trans.params['Fmeta']));
    return { 'trans': trans, 'config': config, 'toutputs': toutputs };
}
module.exports.parse_transaction = parse_transaction;


function pack_response_without_utxo(res) {
    let response = {};
    response['status'] = 'success';
    response['serv_response'] = res['data'];
    response['time_create'] = res['start_time'];
    response['time_final'] = res['end_time'];

    let body = res['data'];
    // request error
    if(body.hasOwnProperty('result') && body['result']['rtnMsg'].toLowerCase() != 'ok') {
        response['status'] = 'failed';
        response["reason"] = JSON.stringify(body["result"]);
    }
    return response;
}
module.exports.pack_response_without_utxo = pack_response_without_utxo;

function pack_response(config, toutputs, res) {
    let response = pack_response_without_utxo(res);

    // save utxos in response, application layer maybe use it to carry out next test
    // TODO: modify utxo's format
    if(config['inputs'][0].hasOwnProperty('address')) {
        for(let i = 0; i < toutputs.length; i++) {
            if(toutputs[i]['address'] === config["inputs"][0]["address"]) {
                response['extra_utxo'] = { 
                    'asset_id': toutputs[i]["asset_id"], 
                    'amount': toutputs[i]["amount"], 
                    'txhash': res["data"]['result']['txHash'],
                    'index':  toutputs[i]["index"],
                    'address': config["inputs"][0]["address"],
                    'b58_privkey': toutputs[i]['b58_privkey']
                };
            }
            else {
                response["utxo"] = {
                    "asset_id": toutputs[i]['asset_id'],
                    "amount": toutputs[i]['amount'],
                    "txhash": res["data"]["result"]['txHash'],
                    "index": toutputs[i]['index'],
                    "address": toutputs[i]['address'],
                    "b58_privkey": toutputs[i]['b58_privkey']
                }
            }
        }
    }
    else {
        response['utxo'] = { 
            'asset_id': toutputs[0]['asset_id'], 
            'amount': toutputs[0]['amount'], 
            'txhash': res["data"]['result']['txHash'],
            'index': toutputs[0]['index'],
            'address': toutputs[0]['address'],
            'b58_privkey': toutputs[0]['b58_privkey']
        };
    }
    return response;
}
module.exports.pack_response = pack_response;

