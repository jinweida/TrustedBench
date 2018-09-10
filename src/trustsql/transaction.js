
var cryptoapi = require('./cryptoapi.js');

let OPCODE_NAMES = { 'OP_DUP': 0x76, 'OP_HASH160': 0xa9, 'OP_EQUALVERIFY': 0x88, 'OP_CHECKSIG': 0xac, 
                     'OP_PUSHDATA1': 0x4c, 'OP_PUSHDATA2': 0x4d, 'OP_PUSHDATA4': 0x4e, 
                     'OP_CREATE': 0xc1, 'OP_CALL': 0xc2 };

class TransactionOutput {
    
    constructor(index, address, id, amount, data, address_bytes, condition = undefined, condition_bytes = undefined) {
        this.index = index;
        this.address = address;
        this.address_bytes = address_bytes;
        this.id = id;
        this.amount = amount;
        this.data = data;
        this.condition = condition;
        this.condition_bytes = condition_bytes;
    }

    /**
     * generate output json data for sending to trustsql server
     * @return {Json} json value that indicates output json
     */
    to_json() {
        var json = {};
        json['condition'] = this.condition;
        json['amount'] = this.amount;
        json['address'] = this.address;
        json['data'] = this.data;
        json['index'] = this.index;
        json['id'] = this.id;

        return json;

    }

    /**
     * Calculate output_bytes
     * @return {Binary} string value that indicates output_bytes
     */
    serialize_to_bytes() {
        var output_bytes = '';
        if(this.condition != null) {
            output_bytes = cryptoapi.get_bin_varint_and_val(cryptoapi.hex_to_bin(this.condition_bytes));
        }
        else {
            output_bytes = cryptoapi.varint_to_bin(0);
        }

        output_bytes += cryptoapi.uint32_to_bin(this.index);
        output_bytes += cryptoapi.get_bin_varint_and_val(cryptoapi.hex_to_bin(this.address_bytes));
        output_bytes += cryptoapi.get_bin_varint_and_val(this.id);
        output_bytes += cryptoapi.uint64_to_bin(this.amount);
        output_bytes += cryptoapi.get_bin_varint_and_val(this.data);

        return output_bytes;
    }
}

let ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class TransactionOutputPoint {

    constructor(hash, index, issue_no = undefined) {
        this.hash = hash;
        this.index = index;
        this.issue_no = issue_no;
        this.bin_hash = cryptoapi.hex_to_bin(this.hash);
    }

    /**
     * calculate output_point_bytes for prevouts_hash
     * @return {Binary} string value that indicates output_point_bytes
     */
    serialize_to_bytes(reversed = false) {
        var output_point_bytes = '';
        if(this.index === -1 && (!reversed)) {
            output_point_bytes = this.bin_hash;
        }
        else {
            output_point_bytes = cryptoapi.reverse(this.bin_hash);
        }
        output_point_bytes += cryptoapi.uint32_to_bin(this.index);

        if(this.index === -1 && this.hash === ZERO_HASH && this.issue_no != undefined) {
            output_point_bytes += cryptoapi.get_bin_varint_and_val(this.issue_no);
        }
        return output_point_bytes;
    }

    to_json() {
        var json = {};
        json['index'] = this.index;
        json['hash'] = this.hash;
        if(this.issue_no != undefined) {
            json['issueNo'] = this.issue_no;
        }
        
        
        var keys = new Array();
        for(var key in json) {
            keys.push(key);
        }
        keys = keys.sort(function(a, b) { return a > b; });
        var sorted_json = {};
        for(var index in keys) {
            var key = keys[index];
            sorted_json[key] = json[key];
        }
        return sorted_json;
    }
}
class TransactionInput {

    constructor(output_point, index, voucher, script_bytes = undefined) {
        this.output_point = output_point;
        this.index = index;
        this.script_bytes = script_bytes;
        this.voucher = voucher;
    }

    serialize_to_bytes(reversed = false) {
        let bytes = this.output_point.serialize_to_bytes(reversed);
        bytes += cryptoapi.uint32_to_bin(this.index);
        return bytes;
    }

    to_json() {
        var json = {};
        json['index'] = this.index;
        json['output_point'] = this.output_point.to_json();
        json['voucher'] = this.voucher;
        return (json);
    }
}

class Transaction {

    constructor(node_name = undefined) {
        this.jsonrpc = '2.0';
        this.method = '';
        this.params = {
            'Fversion': 0,
            'Fmeta': '{}',
            'Finputs': [],
            'Foutputs': [],
            'Flocktime': 0
        };
        this.sign_type = 1;
        this.sign = '';
        this.script_type = 2;
        this.script_version = 1;
        this.height = -1;
        this.index = -1;
        this.fee = 0;
        this.txid = 0;

        this.txhash_from_server = "";
    }

    /**
     * calculate prevouts_hash
     * @return {Binary} string value that indicates prevouts_hash
     */
    get_prevouts_hash() {
        var prevouts_bytes = '';
        for(let i = 0; i < this.params['Finputs'].length; i++) {
            prevouts_bytes += this.params['Finputs'][i].output_point.serialize_to_bytes();
        }
        // console.log('prevouts_bytes: ', cryptoapi.bin_to_hex(prevouts_bytes));
        // console.log('........................................');
        return cryptoapi.reverse(cryptoapi.bin_dbl_sha256(prevouts_bytes));
    }

    /**
     * calculate sequence_hash
     * @return {Binary} string value that indicates sequence_hash
     */
    get_sequence_hash() {
        var sequence_bytes = '';
        for(let i = 0; i < this.params['Finputs'].length; i++) {
            var input = this.params['Finputs'][i];
            sequence_bytes += cryptoapi.uint32_to_bin(input.index);
        }
        // console.log('sequence_bytes: ', cryptoapi.bin_to_hex(sequence_bytes));
        // console.log('........................................');
        return cryptoapi.reverse(cryptoapi.bin_dbl_sha256(sequence_bytes));
    }

    /**
     * calculate outputs_hash
     * @return {Binary} string value that indicates outputs_hash
     */
    get_outputs_hash() {
        var output_bytes='';
        for(let i = 0; i < this.params['Foutputs'].length; i++) {
            output_bytes += this.params['Foutputs'][i].serialize_to_bytes();
        }    
        
        return cryptoapi.reverse(cryptoapi.bin_dbl_sha256(output_bytes));
    }

    /**
     * calculate txhash
     * @param {Number} input_index the index of inputs used to calculate sign at this time
     * @return {Binary} string value that indicates txhash
     */
    get_txhash_for_signature(input_index = 0) {
        var tx_bytes = '';

        tx_bytes = cryptoapi.uint32_to_bin(this.params['Fversion']);
        tx_bytes += this.get_prevouts_hash();
        tx_bytes += this.get_sequence_hash();

        var output_point_bytes = '';
        var connected_script_bytes = '';
        for(let i = 0; i < this.params['Finputs'].length; i++) {
            var input = this.params['Finputs'][i];
            if(input_index === input.index) {
                output_point_bytes = input.output_point.serialize_to_bytes();
                connected_script_bytes = cryptoapi.hex_to_bin(input.script_bytes);
            }
        }
        tx_bytes += output_point_bytes;
        tx_bytes += connected_script_bytes;

        tx_bytes += cryptoapi.uint32_to_bin(input_index);
 
        var outputs_hash = this.get_outputs_hash();
        tx_bytes += outputs_hash;


        tx_bytes += cryptoapi.get_bin_varint_and_val(this.params['Fmeta']);
        tx_bytes += cryptoapi.uint32_to_bin(this.params['Flocktime']);
        tx_bytes += cryptoapi.uint32_to_bin(this.sign_type);
        // console.log('tx_bytes: ', cryptoapi.bin_to_hex(tx_bytes));
        // console.log('........................................');

        var tx_hash = cryptoapi.bin_dbl_sha256(tx_bytes);
       
        // console.log('........................................');

        this.txid = cryptoapi.bin_to_hex(tx_hash);
        // console.log('txid: ', this.txid);
        // console.log('........................................');

        this.txhash_from_server = this.get_txhash_from_server();
        return tx_hash;
    }

    /**
     * calculate signature according to privkey and txhash
     * @param {Hex} privkey private key
     * @param {Number} input_index the index of inputs used to calculate sign at this time
     * @return {Hex} string value that indicates sign
     */
    get_sign(priv_key, input_index) {
        var txhash = this.get_txhash_for_signature(input_index);
        var hex_txhash = cryptoapi.bin_to_hex(txhash);
        return cryptoapi.ecdsa_sign(hex_txhash, priv_key);
    }

    /**
     * calculate input's voucher
     * @param {Hex} priv_key private key
     * @param {Hex} pub_key public key
     * @param {Number} input_index the index of inputs used to calculate voucher at this time
     * @return {Base58} string value that indicates voucher
     */
    get_voucher(priv_key, pub_key, input_index) {

        var voucher_bytes = cryptoapi.uint16_to_bin(this.script_type);
        voucher_bytes += cryptoapi.uint16_to_bin(this.script_version);

        var sign = this.get_sign(priv_key, input_index);
        var sign_bytes = cryptoapi.hex_to_bin(sign) + cryptoapi.uint8_to_bin(this.sign_type);
        voucher_bytes += cryptoapi.get_bin_varint_and_val(sign_bytes);

        voucher_bytes += cryptoapi.get_bin_varint_and_val(cryptoapi.hex_to_bin(pub_key));
        let res = cryptoapi.bin_to_base58(voucher_bytes);
        return res;
    }

    get_txhash_from_server() {
        let tx_bytes = cryptoapi.uint32_to_bin(this.params["Fversion"]);

        tx_bytes += cryptoapi.varint_to_bin(this.params["Finputs"].length);
        for(let i = 0; i < this.params["Finputs"].length; i++) {
            tx_bytes += this.params["Finputs"][i].serialize_to_bytes(true);
        }
        tx_bytes += cryptoapi.varint_to_bin(this.params["Foutputs"].length);
        for(let i = 0; i < this.params["Foutputs"].length; i++) {
            tx_bytes += this.params["Foutputs"][i].serialize_to_bytes();
        }

        tx_bytes += cryptoapi.get_bin_varint_and_val(this.params["Fmeta"]);
        tx_bytes += cryptoapi.uint32_to_bin(this.params["Flocktime"]);

        let tx_hash = cryptoapi.bin_to_hex(cryptoapi.reverse(cryptoapi.bin_dbl_sha256(tx_bytes)));
        return tx_hash;
    }

    to_json() {
        var json = {};
        json['jsonrpc'] = this.jsonrpc;
        json['method'] = this.method;
        
        var params = [];
        params.push(this.params['Fversion']);
        params.push(this.params['Fmeta']);

        var inputs = [];
        for(let i = 0; i < this.params['Finputs'].length; i++) {
            inputs.push(this.params['Finputs'][i].to_json());
        }
        params.push(inputs);

        var outputs = [];
        for(let i = 0; i < this.params['Foutputs'].length; i++) {
            outputs.push(this.params['Foutputs'][i].to_json());
        }
        params.push(outputs);
        params.push(0);

        json['params'] = params;
        json['id' ] = 1;
        return json;
    }

    to_sql() {
        var sql = "insert into t_transaction(Fversion,Fmeta,Finputs,Foutputs,Flocktime) values(";
        sql += this.params['Fversion'].toString() + ",";
        sql += "\'" + this.params['Fmeta'] + "\',";
        sql += "\'[";
        for(let i = 0; i < this.params['Finputs'].length; i++) {
            if(i != 0) {
                sql += ",";
            }
            let input = this.params['Finputs'][i];
            sql += "{";
            sql += "\"voucher\":\"" + input.voucher + "\",";
            sql += "\"index\":" + input.index.toString() + ",";
            sql += "\"output_point\":";
            sql += "{";
            sql += "\"index\":" + input.output_point.index.toString() + ",";
            if(input.output_point.issue_no != undefined) {
                sql += "\"issueNo\":\"" + input.output_point.issue_no.toString() + "\",";
            }
            sql += "\"hash\":\"" + input.output_point.hash.toString() + "\""; 
            sql += "}";
            sql += "}";
        }
        sql += "]\',";
        sql += "\'[";
        for(let i = 0; i < this.params['Foutputs'].length; i++) {
            if(i != 0) {
                sql += ",";
            }
            let output = this.params['Foutputs'][i];
            sql += "{";
            sql += "\"amount\":" + output.amount.toString() + ",";
            sql += "\"condition\":\"" + output.condition + "\",";
            sql += "\"address\":\"" + output.address + "\",";
            sql += "\"data\":\"" + output.data + "\",";
            sql += "\"index\":" + output.index.toString() + ",";
            sql += "\"id\":\"" + output.id + "\"";
            sql += "}";
        }
        sql += "]\',";
        sql += 0;
        sql += ");";
        // console.log(sql);
        return sql;
    }
}

/**
 * handle OP_PUSHDATA(data_bytes)
 * @param {Hex} data_bytes address_bytes
 * @return {Hex} string value that indicates OP_PUSHDATA(data_bytes)
 */
function get_push_data_bytes(data_bytes) {
    let bytes = '';
    let data_len = cryptoapi.hex_to_bin(data_bytes).length;
    // console.log('.......................data_bytes.....................', data_bytes);
    // console.log('.......................push_data_len:.................', data_len);

    if(data_len > 65536) {
        bytes += cryptoapi.uint8_to_bin(OPCODE_NAMES['OP_PUSHDATA4']);
        bytes += cryptoapi.uint32_to_bin(data_len);
    }
    else if(data_len > 256) {
        bytes += cryptoapi.uint8_to_bin(OPCODE_NAMES['OP_PUSHDATA2']);
        bytes += cryptoapi.uint16_to_bin(data_len);
    }
    else if(data_len > OPCODE_NAMES['OP_PUSHDATA1']) {
        bytes += cryptoapi.uint8_to_bin(OPCODE_NAMES['OP_PUSHDATA1']);
        bytes += cryptoapi.uint8_to_bin(data_len);
    }
    else {
        bytes += cryptoapi.uint8_to_bin(data_len);
    }
    
    return cryptoapi.bin_to_hex(bytes) + data_bytes;
}

/**
 * calculate OP_PUSHDATA when creating contract
 * @param {Number} value such as OP_PUSH_DATA(version_vm) and so on
 * @return {Hex} string value that indicates OP_PUSHDATA(value)
 */
function get_push_data_bytes_for_number(value) {
    var negative = value < 0;
    var absvalue = Math.abs(value);
    var results = [];
    
    while(absvalue != 0) {
        results.push(absvalue & 0xff);
        absvalue >>= 8;
    }
    if((results[0] & 0x80) != 0) {
        results.push((negative ? 0x80 : 0));
    }
    else if(negative) {
        var last_value = results[results.length - 1];
        results.slice(0, results.length - 1);
        results.push(last_value| 0x80);
    }
    var data = Buffer.from(results);
    return get_push_data_bytes(data.toString('hex'));
}
/**
 * calculate asset id
 * @param {Number} version asset version
 * @param {Number} txtype asset type
 * @param {Binary} data extra data
 * @param {Hex} pubkey_hash issuer's public key hash
 * @return {Base58} string value that indicates asset id
 */
function generate_id(version, txtype, data, pubkey_hash) {
    var id_bytes = cryptoapi.bin_to_hex(cryptoapi.varint_to_bin(version));
    id_bytes += cryptoapi.bin_to_hex(cryptoapi.varint_to_bin(txtype));
    id_bytes += pubkey_hash;
    id_bytes += cryptoapi.hash160(cryptoapi.bin_to_hex(data));

    var checksum = cryptoapi.bin_dbl_sha256(cryptoapi.hex_to_bin(id_bytes)).substr(0, 4);
    id_bytes += cryptoapi.bin_to_hex(checksum);
    return cryptoapi.base58_encode(id_bytes);
}

/**
 * calculate output's connection script
 * @param {Array} op_lists operation code list(OP_PUSH_DATA(address_bytes) code has been converted to string now)
 * @param {Number} script_type script type
 * @param {Number} script_version script version
 * @return {Array} array value that indicates [ condition_bytes(Hex), condition(Base58) ]
 */
function generate_condition(op_lists, script_type = 2, script_version = 1) {
    var condition_bytes = cryptoapi.uint16_to_hex(script_type)
    condition_bytes += cryptoapi.uint16_to_hex(script_version)
    for(let i = 0; i < op_lists.length; i++) {
        if(OPCODE_NAMES.hasOwnProperty(op_lists[i])) {
            condition_bytes += cryptoapi.uint8_to_hex(OPCODE_NAMES[op_lists[i]]);
        }
        else {
            condition_bytes += op_lists[i];
        }
    }
    return [ condition_bytes, cryptoapi.base58_encode(condition_bytes) ];
}

/**
 * calculate input's connection script
 * @param {Array} op_lists operation code list(OP_PUSH_DATA(address_bytes) code has been converted to string now)
 * @param {Number} script_type script type
 * @param {Number} script_version script version
 * @return {Hex} string value that indicates connected_script
 */
function generate_script_bytes(op_lists, script_type = 2, script_version = 1) {

    var code = cryptoapi.uint16_to_hex(script_type)
    code += cryptoapi.uint16_to_hex(script_version)
    for(let i = 0; i < op_lists.length; i++) {
        if(OPCODE_NAMES.hasOwnProperty(op_lists[i])) {
            code += cryptoapi.uint8_to_hex(OPCODE_NAMES[op_lists[i]]);
        }
        else {
            code += op_lists[i];
        }
    }
    return cryptoapi.bin_to_hex(cryptoapi.get_bin_varint_and_val(cryptoapi.hex_to_bin(code))) 
}

module.exports = {
    Transaction: Transaction,
    TransactionInput: TransactionInput,
    TransactionOutput: TransactionOutput,
    TransactionOutputPoint: TransactionOutputPoint,
    get_push_data_bytes: get_push_data_bytes,
    generate_id: generate_id,
    generate_condition: generate_condition,
    generate_script_bytes: generate_script_bytes,
    get_push_data_bytes_for_number: get_push_data_bytes_for_number
}
