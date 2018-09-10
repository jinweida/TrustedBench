@echo off
DEL /F /A /Q logs\*.*

if "%1"=="data" (
	echo ��ʼ��������
) else if "%1"=="peak" (
	echo ���ֵ����
) else if "%1"=="stability" (
	echo ���ֵ����
) else (	
	echo ����غ�Լ��ֵ����
)

if "%1"=="data" (
	node src/generator/file_generator.js
) else if "%1"=="peak" (
	node --max-old-space-size=8192 benchmark/simple/main.js -c ./../config/config-trustsql-peak.json -n ./../config/trustsql-server-peak.json
) else if "%1"=="stability" (
	node --max-old-space-size=8192 benchmark/simple/main.js -c ./../config/config-trustsql-stability.json -n ./../config/trustsql-server-stability.json
) else (	
	node --max-old-space-size=8192 benchmark/simple/main.js -c ./../config/config-trustsql-local-contract.json -n ./../config/trustsql-server-local-contract.json
)

