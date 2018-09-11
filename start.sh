pkill -9 ontology
rm -rf Chain Log
echo 'passwordtest' | ./ontology --testmode --networkid 3 --gaslimit 0 --gasprice 0 --rest --localrpc --loglevel 1 &
