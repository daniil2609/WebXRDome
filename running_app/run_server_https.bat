@ECHO OFF

cd /d %~dp0..
python ./running_app/https_server.py --cert ./running_app/cert.pem --key ./running_app/key.pem --port 8080

pause