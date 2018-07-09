#!/usr/bin/env bash
cryptogen generate --config=./crypto-config.yaml
configtxgen -profile TwoOrgsOrdererGenesis -outputBlock twoorgs.genesis.block
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx mychannel.tx -channelID mychannel