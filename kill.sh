if [ "$1"x = "client"x ]
then
    echo "kill local-client.js"
    ps -aux | grep src/comm/client/local-client.js | grep -v grep | cut -c 9-15 | xargs kill -9
elif [ "$1"x = "worker"x ]
then
    echo "kill worker.js"
    ps -aux | grep node_modules/sync-rpc/lib/worker.js | grep -v grep | cut -c 9-15 | xargs kill -9
elif [ "$1"x = "generator"x ]
then
    echo "kill generator.js"
    ps -aux | grep /src/generator/generator.js | grep -v grep | cut -c 9-15 | xargs kill -9
else
    echo "please enter one of [client|worker|generator]"
fi

