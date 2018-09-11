'use strict';

const BlockchainInterface = require('../comm/blockchain-interface.js');
const TxStatus = require('../comm/transaction');
const Util = require('../comm/util.js');
const log = Util.log;
const NetUtil = require('./net_util.js');
const fs = require('fs');
const ontSdk = require('ontology-ts-sdk');

/**
 * Implements {BlockchainInterface} for a Fabric backend.
 */
class Ontology extends BlockchainInterface {
    /**
     * Create a new instance of the {Fabric} class.
     * @param {string} config_path The path of the Fabric network configuration file.
     */
    constructor(config_path) {
        super(config_path);
        let blockChainConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        this.contractConfig = blockChainConfig.ontology.contract;
        this.peerWallets = blockChainConfig.ontology.peers;
        this.server = blockChainConfig.ontology.server;
        this.querySever = this.getRandomServerAddr();
        this.password = blockChainConfig.ontology.password; // peers and self password is same
        let walletFileContent = fs.readFileSync(blockChainConfig.ontology.wallet, 'utf-8');
        this.wallet = ontSdk.Wallet.parseJson(walletFileContent);
        this.account = this.wallet.accounts[0];
        try {
            const saltHex = Buffer.from(this.account.salt, 'base64').toString('hex');
            const encryptedPrivateKeyObj = new ontSdk.Crypto.PrivateKey(this.account.encryptedKey.key);
            let decryptParam = {
                cost: this.wallet.scrypt.n,
                blockSize: this.wallet.scrypt.r,
                parallel: this.wallet.scrypt.p,
                size: this.wallet.scrypt.dkLen
            };
            this.privateKey = encryptedPrivateKeyObj.decrypt(this.password,
                this.account.address, saltHex, decryptParam);
        } catch (err) {
            throw Error('decrypt wallet failed');
        }
        this.monitorOnly = true;
    }

    /**
     * ontology no need init
     * @return {Promise} The return promise.
     */
    init() {
        return Promise.resolve();
    }

    /**
     * retrun a random server address, for request load balance
     * @return {string} server address
     */
    getRandomServerAddr() {
        let serverIndex = Math.floor(Math.random() * this.server.length);
        return this.server[serverIndex];
    }

    /**
     * sendTx ont to a specific account
     */
    async initAsset() {
        const pks = [];
        const pris = [];
        for (const peerWallet of this.peerWallets) {
            let wallet = ontSdk.Wallet.parseJson(fs.readFileSync(peerWallet, 'utf-8'));
            pks.push(new ontSdk.Crypto.PublicKey(wallet.accounts[0].publicKey));
            const p = new ontSdk.Crypto.PrivateKey(wallet.accounts[0].encryptedKey.key);
            let params = {
                cost: wallet.scrypt.n,
                blockSize: wallet.scrypt.r,
                parallel: wallet.scrypt.p,
                size: wallet.scrypt.dkLen
            };
            pris.push(p.decrypt(this.password, wallet.accounts[0].address, wallet.accounts[0].salt, params));
        }
        let multiSignNum = Math.floor((5 * this.peerWallets.length + 6) / 7);
        const mulAddr = ontSdk.Crypto.Address.fromMultiPubKeys(multiSignNum, pks);
        log('mulAddr is ', mulAddr.toBase58());
        const transferOntTx = ontSdk.OntAssetTxBuilder.makeTransferTx('ONT', mulAddr, this.account.address, 1000000000,
            '0', '20000', mulAddr);
        const amount = 20000 * 1e9; // multiply 1e9 to set the precision
        const transferOngTx = ontSdk.OntAssetTxBuilder.makeWithdrawOngTx(mulAddr, this.account.address, amount, mulAddr,
            '0', '20000');
        for (let i = 0; i < multiSignNum; i++) {
            ontSdk.TransactionBuilder.signTx(transferOntTx, multiSignNum, pks, pris[i]);
            ontSdk.TransactionBuilder.signTx(transferOngTx, multiSignNum, pks, pris[i]);
        }
        NetUtil.postTx(this.getRandomServerAddr(), transferOntTx.serialize());
        await this.waitABlock();
        log('after transfer ont, balance is ', await NetUtil.getBalance(this.getRandomServerAddr(),
            this.account.address.toBase58()));
        NetUtil.postTx(this.getRandomServerAddr(), transferOngTx.serialize());
        await this.waitABlock();
        log('after transfer ong, balance is ', await NetUtil.getBalance(this.getRandomServerAddr(),
            this.account.address.toBase58()));
    }

    /**
     * ontology no need install smart contract
     * @return {Promise} The return promise.
     */
    async installSmartContract() {
        this.contractConfig.forEach((item, index) => {
            let name = item.name;
            let codeVersion = item.version;
            let author = item.author;
            let email = item.email;
            let desp = item.description;
            let needStorage = item.needStorage;
            let vmCode = fs.readFileSync(item.path, 'utf-8');
            let tx = ontSdk.TransactionBuilder.makeDeployCodeTransaction(vmCode, name, codeVersion, author, email, desp,
                needStorage, '0', '20000000', this.account.address);
            ontSdk.TransactionBuilder.signTransaction(tx, this.privateKey);
            NetUtil.postTx(this.getRandomServerAddr(), tx.serialize());
        });
        await this.waitABlock();
        return Promise.resolve();
    }

    /**
     * ontology no need context
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Fabric context.
     */
    getContext(name, args) {
        return Promise.resolve();
    }

    /**
     * ontology no need context
     * @param {object} context The Fabric context to release.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        return Promise.resolve();
    }

    /**
     * send transaction
     * @param {Object} context context object
     * @param {string} txHash transaction data
     * @param {string} txData transaction hash
     * @return {TxStatus}The txStatus for the transaction
     */
    sendTx(context, txHash, txData) {
        if (context.engine) {
            context.engine.submitCallback(1);
        }
        let invokeStatus = new TxStatus(txHash);
        return NetUtil.postTx(this.getRandomServerAddr(), txData).then((result) => {
            if (result < 0) {
                invokeStatus.SetStatusFail();
                log('tx failed', invokeStatus.GetID());
            }
            return invokeStatus;
        });
    }

    /**
     * generate invoke smart contract/submit transactions
     * @param {AbiInfo} abiInfo contract abi info
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments for multiple transactions
     * @return {Transaction} invoke smart contract transaction
     */
    genInvokeSmartContractTx(abiInfo, contractVer, args) {
        let abiFunc = abiInfo.getFunction(args.func);
        if (typeof abiFunc === 'undefined') {
            throw new Error('not define invoke contract func!');
        }
        for (let i = 0; i < abiFunc.parameters.length; i++) {
            let param = new ontSdk.Parameter(abiFunc.parameters[i].getName(), abiFunc.parameters[i].getType(),
                args.args[i]);
            abiFunc.setParamsValue(param);
        }
        let tx = ontSdk.TransactionBuilder.makeInvokeTransaction(abiFunc.name, abiFunc.parameters,
            ontSdk.Crypto.Address.fromVmCode(abiInfo.vmCode), '0', '20000000', this.account.address);
        ontSdk.TransactionBuilder.signTransaction(tx, this.privateKey);
        return tx;
    }

    /**
     * get current height
     * @return {int} current height
     */
    getHeight() {
        // in case of block height not sync problem, fix request server
        return NetUtil.getHeight(this.querySever);
    }

    /**
     * get tx hashes of this height
     * @param {int} height block height
     * @return {string[]} all tx hashes in the block
     */
    getBlockTxHashes(height) {
        // in case of block height not sync problem, fix request server
        return NetUtil.getBlockTxHashes(this.querySever, height);
    }

    /**
     * insure tx
     * @param {string} txHash tx hash
     * @return {Promise} tx is success or failed
     */
    insureTx(txHash) {
        // in case of block height not sync problem, fix request server
        return NetUtil.insureTx(this.querySever, txHash);
    }

    /**
     * wait a block to catch up destHeight
     * @param {int} destHeight start height
     * @return {Promise} empty promise
     */
    async waitABlock(destHeight) {
        if (typeof destHeight === 'undefined') {
            let curr = await this.getHeight();
            destHeight = curr + 1;
            log('wait a block, current height is', curr, ', destHeight is', destHeight);
        }
        let newHeight;
        while (true) {
            newHeight = await this.getHeight();
            log('wait a block, current height is', newHeight, ', destHeight is', destHeight);
            if (newHeight >= destHeight) {
                break;
            }
            await Util.sleep(1000).then(() => {
            });
        }
        return Promise.resolve();
    }

    /**
     * wait two continuous empty block
     */
    async waitTwoEmptyBlock() {
        let emptyBlockNum = 0;
        while (emptyBlockNum < 2) {
            await this.waitABlock();
            let currentHeight = await this.getHeight();
            let txHashes = await this.getBlockTxHashes(currentHeight);
            let txNum = 0;
            if (typeof txHashes === 'undefined' || txHashes.length === 0) {
                emptyBlockNum++;
            } else {
                emptyBlockNum = 0;
                txNum = txHashes.length;
            }
            log('wait two empty block, current height is', currentHeight, 'txs is ', txNum);
        }
    }

    /**
     * get block generated time
     * @param{int} height is block height
     * @return {Promise} block timestamp
     */
    getBlockGenerateTime(height) {
        return NetUtil.getBlock(this.getRandomServerAddr(), height).then((block) => {
            return block.Header.Timestamp;
        });
    }
}

module.exports = Ontology;