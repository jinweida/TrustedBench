docker-compose -f network/fabric/kafka1orgv110/docker-compose-kafka.yaml up -d

node benchmark/simple/main.js -c config-fabric-kafka1orgv110.json -n fabric-kafka1orgv110.json