docker-compose -f network/fabric/kafka1orgv120/docker-compose-kafka.yaml up -d

node benchmark/simple/main.js -c config-fabric-kafka1orgv120.json -n fabric-kafka1orgv120.json