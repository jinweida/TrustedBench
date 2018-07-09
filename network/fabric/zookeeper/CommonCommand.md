docker stop $(docker ps -q)
docker rm $(docker ps -aq)
npm install grpc@1.10.1

docker-compose -f network/fabric/kafka1orgv110/docker-compose-kafka.yaml up -d
node benchmark/simple/main.js -c config-fabric-kafka1orgv110.json -n fabric-kafka1orgv110.json

docker-compose -f network/fabric/kafka1orgv120/docker-compose-kafka.yaml up -d
node benchmark/simple/main.js -c config-fabric-kafka1orgv120.json -n fabric-kafka1orgv120.json

docker-compose -f network/fabric/kafka2orgv110/docker-compose-kafka.yaml up -d
node benchmark/simple/main.js -c config-fabric-kafka2orgv110.json -n fabric-kafka2orgv110.json

docker-compose -f network/fabric/kafka2orgv120/docker-compose-kafka.yaml up -d
node benchmark/simple/main.js -c config-fabric-kafka2orgv120.json -n fabric-kafka2orgv120.json

node benchmark/simple/main.js -c config-fabric-solo2orgv120.json -n fabric-solo2orgv120.json
node benchmark/simple/main.js -c config-fabric-solo2orgv110.json -n fabric-solo2orgv110.json
node benchmark/simple/main.js -c config-fabric-solo1orgv120.json -n fabric-solo1orgv120.json
node benchmark/simple/main.js -c config-fabric-solo1orgv110.json -n fabric-solo1orgv110.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper046.yaml up -d
docker-compose -f network/fabric/kafka1orgv110/docker-compose-kafka.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-kafka1orgv110-zookeeper.json -n fabric-kafka1orgv110.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper0410.yaml up -d
docker-compose -f network/fabric/kafka1orgv120/docker-compose-kafka.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-kafka1orgv120-zookeeper.json -n fabric-kafka1orgv120.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper046.yaml up -d
docker-compose -f network/fabric/kafka2orgv110/docker-compose-kafka.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-kafka2orgv110-zookeeper.json -n fabric-kafka2orgv110.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper0410.yaml up -d
docker-compose -f network/fabric/kafka2orgv120/docker-compose-kafka.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-kafka2orgv120-zookeeper.json -n fabric-kafka2orgv120.json


docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper046.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-solo1orgv110-zookeeper.json -n fabric-solo1orgv110.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper0410.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-solo1orgv120-zookeeper.json -n fabric-solo1orgv120.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper046.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-solo2orgv110-zookeeper.json -n fabric-solo2orgv110.json

docker-compose -f network/fabric/zookeeper/docker-compose-zookeeper0410.yaml up -d
npm run startclient -- localhost:1298
node benchmark/simple/main.js -c config-fabric-solo2orgv120-zookeeper.json -n fabric-solo2orgv120.json
