var txapi = require('./transaction.js');
var cryptoapi = require('./cryptoapi.js');
var sender = require('./sender.js');
var parser = require('./parser.js');

/**
 * generate issue asset request datqa
 * @param {Json} config test data
 * @return {Json} json value that indicates { trans, config, touputs }
 */
function gen_issue_assets_request_data(config) {
    for(let i = 0; i < config['inputs'].length; i++) {
        // calculate issuer's public_key, public_hash, used to calculate asset_id
        var hex_pubkey = "";
        var hex_pubkey_hash = "";
        if(config["inputs"][i].hasOwnProperty("hex_pubkey")) {
            hex_pubkey = config["inputs"][i]["hex_pubkey"];
        }
        else {
            hex_pubkey = cryptoapi.privkey_to_compress_hex_pubkey(config['inputs'][i]['b58_privkey']);
        }

        if(config["inputs"][i].hasOwnProperty("hex_pubkey_hash")) {
            hex_pubkey_hash = config["inputs"][i]["hex_pubkey_hash"];
        }
        else {
            hex_pubkey_hash = cryptoapi.hash160(hex_pubkey);
        }
        config['inputs'][i]['hex_pubkey'] = hex_pubkey;
        config['inputs'][i]['hex_pubkey_hash'] = hex_pubkey_hash;

        // set default value if needed
        if(!config['inputs'][i].hasOwnProperty('output_point')) {
            config['inputs'][i]['output_point'] = {};
        }
        if(!config['inputs'][i]['output_point'].hasOwnProperty('ops_list')) {
            config['inputs'][i]['output_point']['ops_list'] = [ 'OP_CHECKSIG'];
        }
        if(!config['inputs'][i]['output_point'].hasOwnProperty('hash')) {
            config['inputs'][i]['output_point']['hash'] = '0000000000000000000000000000000000000000000000000000000000000000';
        }
        if(!config['inputs'][i]['output_point'].hasOwnProperty('index')) {
            config['inputs'][i]['output_point']['index'] = -1;
        }       
    }

    for(let i = 0; i < config['outputs'].length; i++) {
        // calculate recver's public_key, address_bytes, used to calculate address
        var hex_pubkey = "";
        if(config["outputs"][i].hasOwnProperty("hex_pubkey")) {
            hex_pubkey = config["outputs"][i]["hex_pubkey"];
        }
        else {
            hex_pubkey = cryptoapi.privkey_to_compress_hex_pubkey(config['outputs'][i]['b58_privkey']);
        }
        var address_bytes = "";
        if(config["outputs"][i].hasOwnProperty("address_bytes")) {
            address_bytes = config["outputs"][i]["address_bytes"];
        }
        else {
            address_bytes = cryptoapi.hash160(hex_pubkey);
        }
        config['outputs'][i]['address_bytes'] = address_bytes;

        if(config["outputs"][i].hasOwnProperty("address")) {
            config['outputs'][i]['address'] = config["outputs"][i]["address"]; 
        }
        else {
            config['outputs'][i]['address'] = cryptoapi.base58check_encode(address_bytes);
        }

        // set ops_list, used to calculate outputs[i].connection
        config['outputs'][i]['ops_list'] = [
            'OP_DUP',
            'OP_HASH160',
            txapi.get_push_data_bytes(address_bytes),
            'OP_EQUALVERIFY',
            'OP_CHECKSIG'
        ];
        
        // set default value if needed
        if(!config['outputs'][i].hasOwnProperty('data')) {
            config['outputs'][i]['data'] = '{}';
        }

        // calculate asset_id
        var output = config['outputs'][i];
        var input_issue_idx = parser.get_value(output, 'input_issue_idx', 0);
        var data = output['data'];
        var asset_version = parser.get_value(output, 'asset_version', 0);
        var asset_type = parser.get_value(output, 'asset_type', 1);
        var hex_pubkey_hash = config['inputs'][input_issue_idx]['hex_pubkey_hash'];
        var asset_id = txapi.generate_id(asset_version, asset_type, data, hex_pubkey_hash);

        config['outputs'][i]['asset_id'] = asset_id;
    }
    var res = parser.parse_transaction(config);
    return res;
}
module.exports.gen_issue_assets_request_data = gen_issue_assets_request_data;

module.exports.handle_issue_assets = function(config) {
    return sender.send_request(gen_issue_assets_request_data(config));
}