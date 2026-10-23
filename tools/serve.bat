@echo off
rem Builds and serves the site locally. Open http://localhost:4000 when it is ready.
rem   serve          build and serve (reuses the previous build)
rem   serve clean    throw away the previous build first

rem The script lives in tools; the site is one folder up.
cd /d "%~dp0.."

if not defined JEKYLL_PORT set JEKYLL_PORT=4000
rem 127.0.0.1 is reachable from this computer only. Set JEKYLL_HOST=0.0.0.0
rem before running to let other devices on the network open it.
if not defined JEKYLL_HOST set JEKYLL_HOST=127.0.0.1

set JEKYLL_CLEAN=0
if /i "%~1"=="clean" set JEKYLL_CLEAN=1
if /i "%~1"=="--clean" set JEKYLL_CLEAN=1
if not "%~1"=="" if /i not "%~1"=="build" if "%JEKYLL_CLEAN%"=="0" (
    echo Unknown option "%~1". Use: serve or serve clean
    exit /b 1
)

if not exist "_config.yml" (
    echo Could not find _config.yml in "%cd%" - keep this .bat in the tools folder.
    pause
    exit /b 1
)
echo Site root: %cd%
echo.

if "%JEKYLL_CLEAN%"=="1" (
    echo Removing the previous build...
    if exist "_site" rmdir /s /q "_site"
    if exist ".jekyll-cache" rmdir /s /q ".jekyll-cache"
    if exist ".jekyll-metadata" del ".jekyll-metadata"
)

where bundle >nul 2>nul
if errorlevel 1 (
    echo Bundler was not found. Install Ruby+Devkit from https://rubyinstaller.org/ and run: gem install bundler
    pause
    exit /b 1
)

call bundle check >nul 2>nul
if errorlevel 1 (
    echo Installing gems...
    call bundle install
    if errorlevel 1 (
        echo.
        echo bundle install failed - see the messages above.
        pause
        exit /b 1
    )
    echo.
)

rem Stop an old server still holding the port, or it keeps serving the old build.
rem ":<port> " with the trailing space avoids matching ports such as 14000.
set FOUND_OLD=0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /c:":%JEKYLL_PORT% " ^| findstr /c:"LISTENING"') do (
    echo Stopping old server (PID %%P^)...
    taskkill /F /PID %%P >nul 2>nul
    set FOUND_OLD=1
)
if "%FOUND_OLD%"=="1" timeout /t 1 /nobreak >nul

echo Open http://localhost:%JEKYLL_PORT% when the server is ready. Press Ctrl+C to stop it.
echo Saving any file rebuilds the site; changing _config.yml restarts the server by itself.
echo.

rem Serves the site, rebuilding on every change and restarting when _config.yml changes.
ruby tools\serve.rb %JEKYLL_HOST% %JEKYLL_PORT%
pause
