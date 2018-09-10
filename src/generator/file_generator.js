
'use strict'

const child_process = require('child_process');

function get_file_start_id(sql_path) {
    try {
        if(parseInt(child_process.execSync("ls -l " + sql_path + " | wc -l").toString()) === 1) {
            return 0;
        }
        else {
            return parseInt(child_process.execSync("ls -l " + sql_path + " | grep ^[^d] | awk '{print $9}' | cut -d '.' -f 1 | cut -c 4- | sort -n | tail -1").toString()) + 1;
        }
    }
    catch(error) {
        return 0;
    }
}

function main() {

    var path = require('path');
    var fs = require('fs-extra');

    const config = require(path.join(__dirname, "config-generator.json"));

    const file_config = config["file"];
    const sql_path = path.join(__dirname, file_config["sql_path"]);
    const utxo_path = path.join(__dirname, file_config["utxo_path"]);
    const log_path = path.join(__dirname, config["log_path"]);
    const keys_path = path.join(__dirname, config["keys_path"]);

    if(!fs.existsSync(sql_path)) {
        fs.mkdirSync(sql_path);
    }
    if(!fs.existsSync(utxo_path)) {
        fs.mkdirSync(utxo_path);
    }

    config["file"]["file_start_id"] = get_file_start_id(sql_path);

    const process_count = config["process_count"];
    const callback = config["callback"];

    let children = [];
    for(let i = 0; i < process_count; i++) {
        let child = child_process.fork(path.join(__dirname, callback));
        children.push(child);
        child.send({ 
            'id': i,
            'process_count': process_count,
            "file": config["file"],
            "issue": config["issue"], 
            "transfer": config["transfer"],
            "monitor": config["monitor"],
            "start_privkey_index": config["start_privkey_index"],
            "log_path": log_path,
            "keys_path": keys_path 
        }); 
    }
}

main();