НЕОБХОДИМ PYTHON:
для http:
    запустить файл ./running_app/run_server_http.bat (откроется окно командной строки, vr приложение будет доступно по пути http://localhost:8080), для остановки необходимо закрыть окно командной строки или нажать ctrl + c
или для https (начиная с Python 3.10):
    запустить файл ./running_app/run_server_https.bat (откроется окно командной строки, vr приложение будет доступно по пути https://localhost:8080), для остановки необходимо закрыть окно командной строки или нажать ctrl + c

ИЛИ

НЕОБХОДИМ PYTHON (запуск из корневой директории (\Dome_code\WebXRDome>)):
Для запуска необходимо открыть расположение проекта в терминале и запустить команду:
для http (vr приложение будет доступно по пути http://localhost:8080):
    python -m http.server 8080
или для https (начиная с Python 3.10) (vr приложение будет доступно по пути https://localhost:8080):
    python ./running_app/https_server.py --cert ./running_app/cert.pem --key ./running_app/key.pem --port 8080

ИЛИ

НЕОБХОДИМА NODE:
Если установлена node.js
Для запуска необходимо открыть расположение проекта в терминале и запустить команду:
для http (vr приложение будет доступно по пути http://localhost:8080):
    http-server .
или для https (vr приложение будет доступно по пути https://localhost:8080):
    http-server --ssl --cert ./running_app/cert.pem --key ./running_app/key.pem







установка сертификатов https (файлы cert.pem и key.pem):
    choco install openssl
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes



