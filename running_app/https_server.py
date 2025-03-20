import http.server
import ssl
import argparse
import os

# Парсинг аргументов командной строки
parser = argparse.ArgumentParser(description="Запуск HTTPS-сервера.")
parser.add_argument('--cert', required=True, help="Путь к файлу сертификата (cert.pem)")
parser.add_argument('--key', required=True, help="Путь к файлу приватного ключа (key.pem)")
parser.add_argument('--port', type=int, default=8080, help="Порт для запуска сервера (по умолчанию: 8080)")
args = parser.parse_args()

# Проверка существования файлов
if not os.path.exists(args.cert):
    print(f"Ошибка: файл сертификата '{args.cert}' не найден.")
    exit(1)

if not os.path.exists(args.key):
    print(f"Ошибка: файл ключа '{args.key}' не найден.")
    exit(1)

# Настройки сервера
server_address = ('0.0.0.0', args.port)  # Адрес и порт
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

# Настройка SSL
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)  # Используем PROTOCOL_TLS_SERVER
context.load_cert_chain(certfile=args.cert, keyfile=args.key)  # Пути к сертификату и ключу из аргументов

# Применяем SSL-контекст к серверу
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

# Запуск сервера
print(f"Сервер запущен на https://localhost:{args.port}")
print(f"Используются сертификат: {args.cert}, ключ: {args.key}")
httpd.serve_forever()