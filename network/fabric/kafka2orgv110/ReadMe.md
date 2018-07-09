docker-compose -f network/fabric/kafka2orgv110/docker-compose-kafka.yaml up -d

node benchmark/simple/main.js -c config-fabric-kafka2orgv110.json -n fabric-kafka2orgv110.json