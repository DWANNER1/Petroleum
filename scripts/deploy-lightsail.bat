@echo off
setlocal

set "KEY=C:\Users\deepa\.ssh\LightsailDefaultKey-us-east-1.pem"
set "HOST=ubuntu@44.222.49.26"
set "REMOTE_HOME=/home/ubuntu"
set "REMOTE_REPO=/home/ubuntu/wl-portal"
set "ROOT=%~dp0.."
set "ZIP=%ROOT%\web-mui-dist.zip"

echo Building web-mui...
set "VITE_API_BASE_URL="
call npm.cmd --prefix "%ROOT%" --workspace apps/web-mui run build
if errorlevel 1 goto :fail

echo Repacking web-mui-dist.zip...
powershell -NoProfile -Command "if (Test-Path '%ZIP%') { Remove-Item -Force '%ZIP%' }; Compress-Archive -Path '%ROOT%\apps\web-mui\dist\*' -DestinationPath '%ZIP%'"
if errorlevel 1 goto :fail

echo Uploading frontend bundle...
scp -i "%KEY%" "%ZIP%" %HOST%:%REMOTE_HOME%/
if errorlevel 1 goto :fail

echo Uploading API source...
scp -r -i "%KEY%" "%ROOT%\apps\api" %HOST%:%REMOTE_REPO%/apps/
if errorlevel 1 goto :fail

echo Uploading root package files...
scp -i "%KEY%" "%ROOT%\package.json" %HOST%:%REMOTE_REPO%/
if errorlevel 1 goto :fail
scp -i "%KEY%" "%ROOT%\package-lock.json" %HOST%:%REMOTE_REPO%/
if errorlevel 1 goto :fail

echo Uploading workspace package files...
scp -i "%KEY%" "%ROOT%\apps\web-mui\package.json" %HOST%:%REMOTE_REPO%/apps/web-mui/
if errorlevel 1 goto :fail
scp -i "%KEY%" "%ROOT%\apps\web\package.json" %HOST%:%REMOTE_REPO%/apps/web/
if errorlevel 1 goto :fail
scp -i "%KEY%" "%ROOT%\apps\api\package.json" %HOST%:%REMOTE_REPO%/apps/api/
if errorlevel 1 goto :fail

echo Uploading nginx config...
scp -i "%KEY%" "%ROOT%\wl-portal.nginx.conf" %HOST%:%REMOTE_REPO%/
if errorlevel 1 goto :fail

echo Deploying on Lightsail...
ssh -i "%KEY%" %HOST% "bash -lc 'set -e; echo [1/8] unzip frontend; unzip_status=0; unzip -o %REMOTE_HOME%/web-mui-dist.zip -d %REMOTE_REPO%/apps/web-mui/dist || unzip_status=$?; if [ $unzip_status -gt 1 ]; then exit $unzip_status; fi; echo [2/8] npm install; cd %REMOTE_REPO% && npm install; echo [3/8] seed base data; npm --workspace apps/api run seed; echo [4/8] seed workbook pricing; npm --workspace apps/api run seed:pricing-workbook; echo [5/8] seed allied transactions; npm --workspace apps/api run allied:generate -- --seed-db; echo [6/8] install nginx config; sudo cp %REMOTE_REPO%/wl-portal.nginx.conf /etc/nginx/sites-available/wl-portal; sudo ln -sf /etc/nginx/sites-available/wl-portal /etc/nginx/sites-enabled/wl-portal; echo [7/8] restart api and reload nginx; fuser -k 4000/tcp || true; cd %REMOTE_REPO% && nohup env NODE_OPTIONS=--max-old-space-size=256 node apps/api/src/server.js > api.log 2>&1 & sleep 3; sudo nginx -t; sudo systemctl reload nginx; echo [8/8] health check; curl http://127.0.0.1:4000/health'"
if errorlevel 1 goto :fail

echo Deployment complete.
goto :eof

:fail
echo Deployment failed.
exit /b 1
