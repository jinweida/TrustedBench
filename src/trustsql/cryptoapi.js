const struct = require('python-struct');
const binascii = require('binascii');
const sha256 = require('sha256')
const base58check = require('base58check')
const bs58 = require('bs58');
const crypto = require('crypto');
const RIPEMD160 = require('ripemd160')

function uint8_to_bin(value) {
    return struct.pack('<B', value).toString('binary');
}
function uint16_to_bin(value) {
    return struct.pack('<h', value).toString('binary');
}
function uint32_to_bin(value) {
    return struct.pack('<i', value).toString('binary');
}
function uint64_to_bin(value) {
    return struct.pack('<q', value).toString('binary');
}
function uint8_to_hex(value) {
    return struct.pack('<B', value).toString('hex');
}
function uint16_to_hex(value) {
    return struct.pack('<h', value).toString('hex');
}
function uint32_to_hex(value) {
    return struct.pack('<i', value).toString('hex');
}
function uint64_to_hex(value) {
    return struct.pack('<q', value).toString('hex');
}

function sizeof(value) {
    // if negative, it's actually a very large unsigned long value
    if (value < 0) return 9; // 1 marker + 8 data bytes
    if (value < 253)  return 1; // 1 data byte 
    if (value <= 0xFFFF)  return 3; // 1 marker + 2 data bytes 
    if (value <= 0xFFFFFFFF)  return 5; // 1 marker + 4 data bytes 
    return 9; // 1 marker + 8 data bytes 
}

/**
 * convert varint to binary 
 * @param {Number} value 
 * @return {Binary} binary value 
 */
function varint_to_bin(value) {
    switch(sizeof(value)) {
        case 1:
            var buffer = Buffer.alloc(1);
            buffer.writeUInt8((value & ((1 << 8) - 1)), 0);
            return buffer.toString('binary');
        case 3:
            var buffer = Buffer.alloc(3);
            buffer.writeUInt8(253, 0);
            buffer.writeUInt8((value & ((1 << 8) - 1)), 1);
            buffer.writeUInt8((value >> 8), 2);
            return buffer.toString('binary');
        case 5:
            var buffer = Buffer.alloc(5);
            buffer.writeUInt8(254, 0);
            buffer.writeUInt8((value & 0xFF), 1);
            buffer.writeUInt8(((value >> 8) & 0xFF), 2);
            buffer.writeUInt8(((value >> 16) & 0xFF), 3);
            buffer.writeUInt8(((value >> 24) & 0xFF), 4);
            return buffer.toString('binary');
        default:
            var buffer = Buffer.alloc(9);
            buffer.writeUInt8(255, 0);
            buffer.writeUInt8((value & 0xFF), 1);
            buffer.writeUInt8(((value >> 8) & 0xFF), 2);
            buffer.writeUInt8(((value >> 16) & 0xFF), 3);
            buffer.writeUInt8(((value >> 24) & 0xFF), 4);
            buffer.writeUInt8(((value >> 32) & 0xFF), 5);
            buffer.writeUInt8(((value >> 40) & 0xFF), 6);
            buffer.writeUInt8(((value >> 48) & 0xFF), 7);
            buffer.writeUInt8(((value >> 56) & 0xFF), 8);
            return buffer.toString('binary');
    }
}
function get_bin_varint_and_val(value) {
    return varint_to_bin(value.length) + value;
}
function hex_to_bin(value) {
    return binascii.unhexlify(value)
}
function bin_to_hex(value) {
    return binascii.hexlify(value)
}
function bin_dbl_sha256(value) {
    var res =  sha256(sha256(value, { asString: true }), { asString: true })
    return res;
}

/**
 * calculate hash160
 * @param {Hex} key 
 * @return {Array} array value that indicates inputs
 */
function hash160(key) {
    const hash = crypto.createHash('sha256');
    hash.update(key,'hex');
    return new RIPEMD160().update(hash.digest()).digest('hex');
}
function base58check_encode(value) {
    return base58check.encode(value);
}
function base58_encode(value) {
    return bs58.encode(Buffer.from((value), 'hex'));
}
function base58_decode(value) {
    return bs58.decode(value);
}
function base58_to_hex(value) {
    return bs58.decode(value).toString('hex');
}
function bin_to_base58(value) {
    return base58_encode(bin_to_hex(value));
}
function reverse(str) {
    return str.split("").reverse().join("");
}
function privkey_to_compress_pubkey(privkey, sign = false) {
    if(sign) {
        let seed = base58_decode(privkey);
        let keys = ed.createKeyPair(seed);
        return keys.publicKey;
    }
    else {
        const secp256k1 = require('secp256k1');
        return secp256k1.publicKeyCreate(Buffer.from(bs58.decode(privkey))).toString('hex')
    }
}
function privkey_to_compress_hex_pubkey(bs58_privkey, sign = false) {
    if(sign) {
        let seed = base58_decode(bs58_privkey);
        let keys = ed.createKeyPair(seed);
        return keys.publicKey.toString('hex');;
    }
    else {
        const secp256k1 = require('secp256k1');
        return secp256k1.publicKeyCreate(Buffer.from(bs58.decode(bs58_privkey))).toString('hex')
    }
}

function privkey_to_address(privkey) {
    let hex_pubkey = privkey_to_compress_hex_pubkey(base58_encode(privkey), true);
    let address_bytes = hash160(hex_pubkey);
    return base58check_encode(address_bytes);
}

function string_to_bin(value) {
    return hex_to_bin(value);
}
function json_to_bin(value) {
    return value;
}
function json_to_str(value) {
    return value;
}

function ecdsa_sign(msg, privkey, encoding = 'hex') {
    const ec = new require("elliptic").ec("secp256k1");
    let buffer = Buffer.from(ec.sign(msg, (privkey), {canonical: true}).toDER());
    if (['latin1','base64','hex'].indexOf(encoding)>-1){return buffer.toString(encoding)}
    return buffer;
}

function address_to_address_bytes(address) {
    return base58_decode(address).toString('hex').substr(2, 40);
}

function random_base58_secrety_privkey() {
    return base58_encode(ed.createSeed().toString('hex'));
}
function random_base58_privkey() {
    //return base58_encode(ed.createSeed().toString('hex'));
     let privkey;
     do {
         privkey = crypto.randomBytes(32).toString('hex');
     }while(privkey.length != 64);
    
     return base58_encode(privkey);
}
function random_base58_address() {
    let privkey;
    do {
        privkey = random_base58_privkey();
    } while(privkey.length != 44);
    var address_bytes = hash160(privkey);
    return base58check_encode(address_bytes);
}
function random_number(m, n){ 
    switch(arguments.length){ 
        case 1: 
            return parseInt(Math.random() * m + 1, 10); 
        case 2: 
            return parseInt(Math.random() * (n - m + 1 ) + m, 10); 
        default: 
            return 0; 
    } 
} 
function random_issue_no() {
    let time = Date.now().toString();
    let issue_no = time + ((Math.random() * 100000).toFixed(0)).toString();
    return issue_no;
}

module.exports = {
    uint8_to_bin: uint8_to_bin,
    uint16_to_bin: uint16_to_bin,
    uint32_to_bin: uint32_to_bin,
    uint64_to_bin: uint64_to_bin,
    varint_to_bin: varint_to_bin,
    uint8_to_hex: uint8_to_hex,
    uint16_to_hex: uint16_to_hex,
    uint32_to_hex: uint32_to_hex,
    uint64_to_hex: uint64_to_hex,
    get_bin_varint_and_val: get_bin_varint_and_val,
    hex_to_bin: hex_to_bin,
    bin_to_hex: bin_to_hex,
    bin_dbl_sha256: bin_dbl_sha256,
    hash160: hash160,
    base58_encode: base58_encode,
    base58_decode: base58_decode,
    bin_to_base58: bin_to_base58,
    reverse: reverse,
    privkey_to_compress_pubkey: privkey_to_compress_pubkey,
    string_to_bin: string_to_bin,
    json_to_bin: json_to_bin,
    json_to_str: json_to_str,
    ecdsa_sign: ecdsa_sign,
    base58_to_hex: base58_to_hex,
    privkey_to_compress_hex_pubkey: privkey_to_compress_hex_pubkey,
    base58check_encode: base58check_encode,
    address_to_address_bytes: address_to_address_bytes,
    random_base58_privkey: random_base58_privkey,
    random_base58_address: random_base58_address,
    random_number: random_number,
    random_issue_no: random_issue_no,
    random_base58_secrety_privkey: random_base58_secrety_privkey,
    privkey_to_address: privkey_to_address
};
