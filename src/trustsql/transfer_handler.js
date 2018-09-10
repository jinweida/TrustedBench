var txapi = require('./transaction.js');
var cryptoapi = require('./cryptoapi.js');
var sender = require('./sender.js');
var parser = require('./parser.js');

function gen_transfer_request_data(config) {
    for(let i = 0; i < config['inputs'].length; i++) {
        // calculate sender's address_bytes and ops_list, used to calculate inputs[i].connected_script
        var address_bytes = "";
        if(config["inputs"][i].hasOwnProperty("address_bytes")) {
            address_bytes = config["inputs"][i]["address_bytes"];
        }
        else {
            address_bytes = cryptoapi.address_to_address_bytes(config['inputs'][i]['address']);
        }
        config['inputs'][i]['output_point']['address_bytes'] = address_bytes
        config['inputs'][i]['output_point']['ops_list'] = [ 'OP_DUP', 'OP_HASH160', txapi.get_push_data_bytes(address_bytes), 'OP_EQUALVERIFY', 'OP_CHECKSIG' ];

        // calculate sender's public_key, used to calculate inputs[i].voucher
        if(config["inputs"][i].hasOwnProperty("hex_pubkey")) {
            config['inputs'][i]['hex_pubkey'] = config["inputs"][i]["hex_pubkey"]; 
        }
        else {
            config['inputs'][i]['hex_pubkey'] = cryptoapi.privkey_to_compress_hex_pubkey(config['inputs'][i]['b58_privkey']);
        }
    }
    for(let i = 0; i < config['outputs'].length; i++) {
        // calculate recver's address_bytes and ops_list, used to calcuate outputs[i].connection
        if(config["outputs"][i].hasOwnProperty("address_bytes")) {
            config['outputs'][i]['address_bytes'] = config["outputs"][i]["address_bytes"]; 
        }
        else {
            config['outputs'][i]['address_bytes'] = cryptoapi.address_to_address_bytes(config['outputs'][i]['address']);
        }
        config['outputs'][i]['ops_list'] =  [ 'OP_DUP', 'OP_HASH160', txapi.get_push_data_bytes(config["outputs"][i]["address_bytes"]), 'OP_EQUALVERIFY', 'OP_CHECKSIG' ];

        // set default value
        if(!config['outputs'][i].hasOwnProperty('data')) {
            config['outputs'][i]['data'] = '{}';
        }
    }
    return parser.parse_transaction(config);
}
module.exports.gen_transfer_request_data = gen_transfer_request_data;

module.exports.handle_transfer = function(config) {
    return sender.send_request(gen_transfer_request_data(config));
}
