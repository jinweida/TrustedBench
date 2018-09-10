const cryptoapi = require("../trustsql/cryptoapi.js");
const issue_handler = require("../trustsql/issue_handler.js");
const transfer_handler = require("../trustsql/transfer_handler.js");
const parser = require("../trustsql/parser.js");

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const system_sleep = require("system-sleep");
const sd = require("silly-datetime");

function update_transfer_config(input_keys, output_keys, utxo) {
    if(utxo["b58_privkey"] === undefined) {
        console.log(utxo);
    }
    let config = {};
    config['inputs'] = [];
    config['inputs'].push({
        "output_point": {
            "hash": utxo['txhash'],
            "index": utxo['index']
        },
        "address": utxo['address'],
        "b58_privkey": utxo["b58_privkey"], 
        "address_bytes": input_keys["address_bytes"],
        "hex_pubkey": input_keys["pubkey"],
        "index": 0
    });

    config['outputs'] = [];
    config['outputs'].push({                
        "b58_privkey": output_keys["privkey"],
        "address": output_keys["address"], 
        "address_bytes": output_keys["address_bytes"],
        "asset_id": utxo['asset_id'],
        "index": 0,
        "amount": utxo['amount']
    });

    return config;
}

function update_config(input_keys, output_keys) {
    var config = {};

    config['inputs'] = [
        {
            "b58_privkey": input_keys["privkey"], 
            "hex_pubkey": input_keys["pubkey"],
            "hex_pubkey_hash": input_keys["pubkey_hash"],
            "hex_pubkey_hash_b58check": input_keys["pubkey_hash_b58check"],
            "address": input_keys["address"],
            "address_bytes": input_keys["address_bytes"],
            "issue_no": cryptoapi.random_issue_no() 
        }
    ];
    config['outputs'] = [
        {
            "b58_privkey": output_keys["privkey"], 
            "hex_pubkey": output_keys["pubkey"],
            "hex_pubkey_hash": output_keys["pubkey_hash"],
            "hex_pubkey_hash_b58check": output_keys["pubkey_hash_b58check"],
            "address": output_keys["address"],
            "address_bytes": output_keys["address_bytes"],
            "amount": cryptoapi.random_number(0, 100) 
        }
    ];
    return config;
}

function read_keys_from_file(keys_path) {

    let read_keys = fs.readFileSync(keys_path, { encoding: "utf8" }).split("\r\n");
    let keys = [];
    for(let i = 0; i < read_keys.length; i++) {
        let data = (read_keys[i].split("\r"));
        data.pop();
        let subkeys = [];
        for(let j = 0; j < data.length; j++) {
            let key = data[j].split(",");
            subkeys.push(key);
        }
        keys.push(subkeys);
    }
    return keys;
}


function get_file_lines(file_path) {
    // windows error: no command
    try {
        return parseInt(child_process.execSync("wc -l " + file_path).toString().split(" ")[0]);
    }
    catch(error) {
        return fs.readFileSync(file_path).toString().split("\r\n").length;
    }
}

function get_use_percent(id) {
    let record = child_process.execSync("df -h").toString().split("\n");
    let data_record = record[id + 1].split(" ");
    let data_percent_str = data_record[data_record.length - 2];
    let data_percent = parseInt(data_percent_str.substr(0, data_percent_str.length - 1));
    return data_percent;
}

function capacity_control(monitor) {
    let percent = get_use_percent(monitor["file_system_id"]);
    while(percent >= monitor["limit"]) {
        save_log_to_file(sd.format(new Date()) + "\t" + "[Info]: " +
                         "current file system use " + percent.toString() + "% sleep " + ((monitor["sleep_time"]) / 1000).toFixed(0).toString() + "s\r\n");
        system_sleep(monitor["sleep_time"]);
        percent = get_use_percent();
    }
}


let log_path = "generator.log";

function save_log_to_file(log) {
    fs.appendFileSync(log_path, log, { encoding: "utf8" });
}
function run(context) {
    let keys = read_keys_from_file(context["keys_path"]);

    let monitor = context["monitor"];
    log_path = context["log_path"];

    let file_config = context["file"];
    let file_size = file_config["file_size"];
    let file_start_id = file_config["file_start_id"];
    let sqls_path = path.join(__dirname, file_config["sql_path"]);
    let utxos_path = path.join(__dirname, file_config["utxo_path"]);

    let id = context["id"];
    let process_count = context["process_count"];
    
    let current_file_size = 0;
    let current_file_id = id + file_start_id;
    let privkeys_id = id;

    /*
     * privkeys is a two-dimensional array such as [ [0, A, B, C], [1, D, E, F], [2, G, H, I], [3, J, K, L]... ], every one-dimensional array can be seen as a privkey pair.
     * issue asset:
     *      [0, 1, 2, 3, ...] is issuers' privkey(privkey_pair[0]) used to issue asset to next privkey(privkey_pair[1]).
     * transfer(one-to-one):
     *      all privkey_pairs is independent, transfer operation is a loop in every privkey_pair. 
     *       Round0   Round1   Round2   Round3   Round4   Round5  ...
     *      [A -> B] [B -> C] [C -> A] [A -> B] [B -> C] [C -> A] ...
     *      [D -> E] [E -> F] [F -> D] [D -> E] [E -> F] [F -> D] ...
     *      [G -> H] [H -> I] [I -> G] [G -> H] [H -> I] [I -> G] ...
     *      [J -> K] [K -> L] [L -> J] [J -> K] [K -> L] [L -> J] ...
     *      ...
     * utxo:
     *      every user's utxos are saved in file named by [it's privkey].utxo, in every transfer operation, only transfer current user's all utxos to next user
     * note:
     *      make sure the time interval between [A -> B] and [B -> C] is long enough to prevent [B -> C] reaches server earlier than [A -> B]
     *      by adding every user's asset number(10W) to prevent it
     */
    if(context["issue"]["enable"]) {
        let issue_asset_start_time = Date.now();
        let issue_number = context["issue"]["number"];
        // every process needs to handle a part of privkey_pairs that can be distrubted by process_id(not pid) and process_count
        while(privkeys_id < keys.length) {
            let input_keys = JSON.parse(keys[privkeys_id][0]);
            let output_keys = JSON.parse(keys[privkeys_id][1]);

            var start_time = Date.now();
            for(let j = 0; j < issue_number; j++) {
                // generate issue_asset sql and save to file
                let config = update_config(input_keys, output_keys);
                let data = issue_handler.gen_issue_assets_request_data(config);
                let trans = data['trans'];
                let issue_asset_sql = trans.to_sql();
                fs.appendFileSync(sqls_path + "/sql" + (current_file_id).toString() + ".data", (issue_asset_sql), { base58_encode: "utf8" });
                fs.appendFileSync(sqls_path + "/sql" + (current_file_id).toString() + ".data", "\r\n", { base58_encode: "utf8" });

                // control file size
                current_file_size++;
                if(current_file_size >= file_size) {
                    current_file_size = 0;
                    current_file_id += process_count;
                }

                // save utxo to file
                let txhash = trans.txhash_from_server;
                let res = { "data": { "result": { "rtnMsg": "ok", "txHash": txhash }, "start_time": 0, "end_time": 0 } };
                let utxo = parser.pack_response(data["config"], data["toutputs"], res)["utxo"];
                fs.appendFileSync(utxos_path + "/" + output_keys["privkey"] + ".utxo", JSON.stringify(utxo), { encoding: "utf8" });
                fs.appendFileSync(utxos_path + "/" + output_keys["privkey"] + ".utxo", "\r\n", { encoding: "utf8" });
            }
            privkeys_id += process_count;

            save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + "[Info]: " +
                             "[" + input_keys["privkey"] + "] issue [" + issue_number.toString() + "] assets to [" + output_keys["privkey"] + "] done. cost [" + ((Date.now() - start_time) / 1000).toString() + "] s\r\n");

            // sleep if hard disk capacity is full
            if(monitor["enable"]) {
                capacity_control(monitor);
            }
        }
        save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + "[Time]: " +
                         "issue asset cost [" + ((Date.now() - issue_asset_start_time) / 1000).toString() + "]s\r\n");
    }

    if(context["transfer"]["enable"]) {
        let transfer_start_time = Date.now();

        let transfer_number = context["transfer"]["number"];
        let start_privkey_index = context["transfer"]["start_privkey_index"];

        // TODO: index1 = 1;
        let index1 = start_privkey_index; 
        let index2 = index1 + 1;
        if(index1 + 1 === keys[0].length) {
            index2 = 1;
        }

        // transfer_number is used to control transfer round number
        for(let k = 0; k < transfer_number; k++) {
            // every process needs to handle a part of privkey_pairs that can be distrubted by process_id(not pid) and process_count
            privkeys_id = id;
            while(privkeys_id < keys.length) {
                let current_keys_pair = keys[privkeys_id];
                let input_keys = JSON.parse(current_keys_pair[index1]);
                let output_keys = JSON.parse(current_keys_pair[index2]);

                if(input_keys === undefined || output_keys === undefined) {
                    save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + "[Error]: privkey is undefined\r\n"); 
                    privkeys_id += process_count;
                    continue;
                }

                // if generator.js exit correctly, for every privkey_pairs, there is only one [privkey].utxo in utxos directory 
                // that indicates prevous user's all utxos have transfer to next user's utxos
                // but not, it's usually because of enterring CTRL-C when the generator.js is running, leading to when generator.js runs in next time, there will be
                // two [privkey].utxo in utxos directory for every privkey_pairs. in order to handle it, needing to judge whether prevouse user's utxo is existing or not 
                let current_utxo_path = utxos_path + "/" + input_keys["privkey"] + ".utxo";
                let next_utxo_path = utxos_path + "/" + output_keys["privkey"] + ".utxo";
                let prev_utxo_path = utxos_path + "/" + JSON.parse(current_keys_pair[((index1 === 1) ? (current_keys_pair.length - 1) : (index1 - 1))])["privkey"] + ".utxo";

                let input_utxo_path = "";
                let output_utxo_path = "";
                if(fs.existsSync(prev_utxo_path)) {
                    input_utxo_path = prev_utxo_path;
                    output_utxo_path = current_utxo_path;
                    input_keys = JSON.parse(current_keys_pair[((index1 === 1) ? (current_keys_pair.length - 1) : (index1 - 1))])["privkey"];
                    output_keys = JSON.parse(current_keys_pair[index1]);
                }
                else if(fs.existsSync(current_utxo_path)) {
                    input_utxo_path = current_utxo_path;
                    output_utxo_path = next_utxo_path;
                }
                else {
                    privkeys_id += process_count;
                    continue;
                }
                
                let utxo_offet = 0;
                if(fs.existsSync(output_utxo_path)) {
                    utxo_offet = get_file_lines(output_utxo_path);
                }

                let input_utxos = fs.readFileSync(input_utxo_path, { encoding: "utf8" });
                input_utxos = input_utxos.split("\r\n");
                // input_utxos.back() == "" 
                input_utxos.pop();

                var start_time = Date.now();
                // input_utxos[0 : utxo_offet-1] have transferred done
                for(let i = utxo_offet; i < input_utxos.length; i++) {
                    let utxo = {};
                    try {
                        utxo = JSON.parse(input_utxos[i]);
                    }
                    catch(error) {
                        save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + "[Error]: json parser. input_utxos[i]: " + input_utxos[i] + "\r\n"); 
                        continue;
                    }
                    let config = update_transfer_config(input_keys, output_keys, utxo);
                    let data = transfer_handler.gen_transfer_request_data(config); 
                    let trans = data['trans'];
                    let transfer_sql = trans.to_sql();
                    fs.appendFileSync(sqls_path + "/sql" + (current_file_id).toString() + ".data", (transfer_sql), { base58_encode: "utf8" });
                    fs.appendFileSync(sqls_path + "/sql" + (current_file_id).toString() + ".data", "\r\n", { base58_encode: "utf8" });

                    // control file size
                    current_file_size++;
                    if(current_file_size === file_size) {
                        current_file_size = 0;
                        current_file_id += process_count;
                    }

                    let txhash = trans.txhash_from_server;
                    let res = { "data": { "result": { "rtnMsg": "ok", "txHash": txhash }, "start_time": 0, "end_time": 0 } };
                    utxo = parser.pack_response(data["config"], data["toutputs"], res)['utxo'];
                    fs.appendFileSync(output_utxo_path, JSON.stringify(utxo), { encoding: "utf8" });
                    fs.appendFileSync(output_utxo_path, "\r\n", { encoding: "utf8" });
                }
                fs.unlinkSync(input_utxo_path);
                privkeys_id += process_count;

                save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + "[Info]: [Round" + k.toString() + "] " +
                                 "[" + input_keys["privkey"] + "] transfer [" + (input_utxos.length - utxo_offet).toString() + "] assets to [" + output_keys["privkey"] + "]. cost " + 
                                 "[" + ((Date.now() - start_time) / 1000).toString() + "]s.\r\n");

                if(monitor["enable"]) {
                    capacity_control(monitor);
                }
            }
            index1++;
            if(index1 >= keys[0].length) {
                index1 = 1;
            }
            index2++;
            if(index2 >= keys[0].length) {
                index2 = 1;
            }
        }
        save_log_to_file(sd.format(new Date(), "YYYY-MM-DD HH:mm:ss") + "\t" + 
                         "[Time]: transfer cost: [" + ((Date.now() - transfer_start_time) / 1000).toString() + "]s\r\n");
    }
}

process.on("message", (msg) => {
    run(msg);
    process.exit(0);
})
