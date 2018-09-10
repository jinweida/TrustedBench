test_peak() {
    echo "start test peak..."
    ../node/bin/node --max-old-space-size=8192 benchmark/simple/main.js -c ./../config/config-trustsql-peak.json -n ./../config/trustsql-server-peak.json &
}

test_stability() {
    echo "start test stability..."
    ../node/bin/node --max-old-space-size=8192 benchmark/simple/main.js -c ./../config/config-trustsql-stability.json -n ./../config/trustsql-server-stability.json &
}

generate_data() {
    echo "start generate test data...";
    ../node/bin/node src/generator/file_generator.js &
}

if [ "$1"x = "data"x ]
then 
    generate_data
elif [ "$1"x = "peak"x ]
then
    test_peak
else
    test_stability
fi
