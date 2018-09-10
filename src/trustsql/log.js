const fs = require("fs");
const sd = require("silly-datetime");

class Logger {
    constructor() {

    }

    static set_state_log_path(path) {
        Logger.state_log_path_ = path;
    }
    static set_error_log_path(path) {
        Logger.error_log_path_ = path;
    }
    static info(...msg) {
        Logger.__append_log(Logger.state_log_path_, Logger.__pack_message(...msg));
    }
    static error(...msg) {
        Logger.__append_log(Logger.error_log_path_, Logger.__pack_message(...msg));
    }
    static debug(...msg) {
        if(Logger.debug_) {
            console.log(...msg);
        }
    }
    static trace(msg) {

    }
    static fatal(...msg) {
        Logger.__append_log(Logger.error_log_path, Logger.__pack_message(...msg), true);
        process.exit(0);
    }
    static enable_debug_log() {
        Logger.debug_ = true;
    }
    static disable_debug_log() {
        Logger.debug_ = false;
    }

    static __append_log(log_path, log, sync = false) {
        if(sync) {
            fs.appendFileSync(log_path, log, { encoding: "utf8" }, () => {});
        }
        else {
            fs.appendFile(log_path, log, { encoding: "utf8" }, () => {});
        }
    }
    static __pack_message(...msg) {
        let all_msg = "";
        for(let i in msg) {
            if(typeof msg[i] === "number") {
                all_msg += msg[i].toString();
            }
            else {
                all_msg += msg[i];
            }
        }
        let log = sd.format(new Date()) + "\t" + all_msg + "\r\n";
        return log;
    }
}

Logger.state_log_path = "state.log";
Logger.error_log_path = "error.log";

module.exports = Logger;