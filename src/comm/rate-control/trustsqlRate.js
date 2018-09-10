
'use strict'

var RateInterface = require('./rateInterface.js')
var Logger = require("../../trustsql/log.js");
const fs = require("fs");
const sd = require("silly-datetime");

class BasicInterval extends RateInterface{
    constructor(blockchain, opts) {
        super(blockchain, opts);
    }

    /**
     * Initialise the rate controller with a passed msg object
     * - Only require the desired TPS from the standard msg options
     * @param {*} msg 
     */
    init(msg) {
        const tps = this.options.tps;
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = (tpsPerClient > 0) ? 1000/tpsPerClient : 0;

        this.sleep_time = this.options.sleep_time ? this.options.sleep_time : 100;
        this.unfinished_per_client = this.options.unfinished_per_client ? this.options.unfinished_per_client : 7000;
        this.last_count = 0;
        this.zero_succ_count = 0;

        this.total_sleep_time = 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.
    * - Sleep a suitable time according to the required transaction generation time
    * @param start {number}, generation time of the first test transaction
    * @param txSeq {number}, sequence number of the current test transaction
    * @param currentResults {Array}, current result set
    * @return {promise}
    */
    applyRateControl(start, idx, currentResults, resultStats) {
        if(this.sleepTime === 0 || idx < this.unfinished_per_client) {
            return Promise.resolve();
        }

        let diff = (this.sleepTime * idx - ((Date.now() - this.total_sleep_time) - start));
        if( diff > 5) {
            return new Promise(resolve => setTimeout(resolve, diff));
        }

        if(idx >= this.unfinished_per_client && resultStats.length === 0) {
            return new Promise(resolve => setTimeout(resolve, 0));
        }
        if(resultStats.length === 0) {
            return Promise.resolve();
        }

        let stats = resultStats[0];
        let unfinished = idx - (stats.succ + stats.fail);
        if(unfinished < this.unfinished_per_client / 2) {
            return Promise.resolve();
        }
        if(resultStats.length > 1 && resultStats[1].succ === 0) {
            this.zero_succ_count++;
            for(let i = 30; i > 0; --i) {
                if(this.zero_succ_count >= i) {
                    Logger.error("succ count is zero " + i.toString() + " times..., sleep_time: " + (i * this.sleep_time).toString() + " ms");
                    this.total_sleep_time += i * this.sleep_time;
                    return new Promise(resolve => setTimeout(resolve, i * this.sleep_time));
                }
            }
        }
        this.zero_succ_count = 0;

        for(let i = 10; i > 0; --i) {
            if(unfinished >= i * this.unfinished_per_client) {
                if(i > 1) {
                    Logger.error("unfinished > " + i.toString() + " * unfinished_per_client..., sleep_time: " + (i * this.sleep_time).toString() + " ms");
                }
                this.total_sleep_time += i * this.sleep_time;
                return new Promise(resolve => setTimeout(resolve, i * this.sleep_time));
            }
        }
        return Promise.resolve();
    }
}

module.exports = BasicInterval;