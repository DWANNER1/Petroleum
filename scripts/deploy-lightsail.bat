@echo off
setlocal

set "KEY=C:\Users\deepa\.ssh\LightsailDefaultKey-us-east-1.pem"
set "HOST=ubuntu@44.222.49.26"
set "REMOTE_HOME=/home/ubuntu"
set "REMOTE_REPO=/home/ubuntu/wl-portal"
set "ROOT=%~dp0.."
set "ZIP=%ROOT%\web-mui-dist.zip"

echo Building web-mui...
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

echo Uploading nginx config...
scp -i "%KEY%" "%ROOT%\wl-portal.nginx.conf" %HOST%:%REMOTE_REPO%/
if errorlevel 1 goto :fail

echo Deploying on Lightsail...
ssh -i "%KEY%" %HOST% "cd %REMOTE_REPO% && unzip -o %REMOTE_HOME%/web-mui-dist.zip -d %REMOTE_REPO%/apps/web-mui/dist && npm install && npm --workspace apps/api run seed && npm --workspace apps/api run seed:pricing-workbook && npm --workspace apps/api run allied:generate -- --seed-db && sudo cp %REMOTE_REPO%/wl-portal.nginx.conf /etc/nginx/sites-available/wl-portal && sudo ln -sf /etc/nginx/sites-available/wl-portal /etc/nginx/sites-enabled/wl-portal && sudo systemctl restart petroleum-api && sudo nginx -t && sudo systemctl reload nginx && curl http://127.0.0.1:4000/health"
if errorlevel 1 goto :fail

echo Deployment complete.
goto :eof

:fail
echo Deployment failed.
exit /b 1
