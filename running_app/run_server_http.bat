@ECHO OFF

if "%1"  == "" ( :: no parameter, default port
	cd /d %~dp0..
	python -m http.server 8080
) else ( :: use specified port
	python -m http.server %1
)