执行Kafka测试的话，要先启动网络（步骤1），启动成功后等待约10s，再执行测试（步骤2）

1、docker-compose -f network/fabric/kafka/docker-compose-kafka.yaml up -d
  
2、node benchmark/simple/main.js -c config-fabric-kafka.json -n fabric-kafka.json
