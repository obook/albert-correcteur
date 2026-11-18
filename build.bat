@echo off
rem Construit le paquet d'extension pour une cible donnée.
rem
rem Cibles :
rem   firefox      : firefox-release\albert-correcteur-firefox.xpi
rem   thunderbird  : thunderbird-release\albert-correcteur-thunderbird.xpi
rem   chromium        : chromium-release\albert-correcteur-chromium.zip
rem                   + chromium-release\albert-correcteur-chromium\ (dossier à charger)
rem   tout         : les trois (valeur par défaut si aucun argument)
rem
rem Chaque paquet est assemblé en empilant des dossiers sources : le code partagé
rem d'abord, les fichiers spécifiques ensuite (qui écrasent en cas de conflit).
rem
rem Usage : build.bat [cible], où cible vaut firefox, thunderbird, chromium ou tout.
rem Sans argument, les trois cibles sont construites.
rem
rem Equivalent Windows de build.sh. Le batch n'a pas d'équivalent de "set -e" :
rem chaque commande critique est donc suivie d'un test explicite d'ERRORLEVEL,
rem sans quoi un xcopy en échec produirait une archive incomplète sans le
rem signaler.

rem Passer la console en UTF-8 pour que les accents s'affichent correctement.
chcp 65001 > nul

setlocal
rem %~dp0 est le dossier du script, avec un antislash final.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

rem Sans argument : construire les trois cibles.
set "CIBLES=firefox thunderbird chromium"
if not "%~1"=="" set "CIBLES="
if /i "%~1"=="firefox"     set "CIBLES=firefox"
if /i "%~1"=="thunderbird" set "CIBLES=thunderbird"
if /i "%~1"=="chromium"       set "CIBLES=chromium"
if /i "%~1"=="tout"        set "CIBLES=firefox thunderbird chromium"
if /i "%~1"=="tous"        set "CIBLES=firefox thunderbird chromium"

if not defined CIBLES (
    echo Usage : build.bat [firefox^|thunderbird^|chromium^|tout]
    echo Sans argument, les trois cibles sont construites.
    exit /b 1
)

for %%C in (%CIBLES%) do (
    call :construire %%C
    if errorlevel 1 goto :erreur
)
exit /b 0


rem ---------------------------------------------------------------------------
rem Construit une cible. Argument : firefox, thunderbird ou chromium.
rem ---------------------------------------------------------------------------
:construire
setlocal
set "CIBLE=%~1"

if "%CIBLE%"=="firefox" (
    set "SOURCES=sources-commun sources-firefox"
    set "OUT_DIR=firefox-release"
    set "BUILD_DIR=.build-firefox"
    set "OUT=firefox-release\albert-correcteur-firefox.xpi"
)
if "%CIBLE%"=="thunderbird" (
    set "SOURCES=sources-commun sources-thunderbird"
    set "OUT_DIR=thunderbird-release"
    set "BUILD_DIR=.build-thunderbird"
    set "OUT=thunderbird-release\albert-correcteur-thunderbird.xpi"
)
rem Pour Chromium : sources-firefox apporte la logique content/UI, agnostique du
rem navigateur ; sources-chromium passe en dernier et écrase le manifest Firefox
rem par les overrides MV3 : service worker, shim browser.* Le dossier
rem d'assemblage est conservé, il sert au chargement en mode développeur.
if "%CIBLE%"=="chromium" (
    set "SOURCES=sources-commun sources-firefox sources-chromium"
    set "OUT_DIR=chromium-release"
    set "BUILD_DIR=chromium-release\albert-correcteur-chromium"
    set "OUT=chromium-release\albert-correcteur-chromium.zip"
)

rem Vérifier que les dossiers source existent
for %%S in (%SOURCES%) do (
    if not exist "%%S\" (
        echo Erreur : le dossier %%S\ est introuvable.
        exit /b 1
    )
)

rem Nettoyer et préparer le dossier d'assemblage
if exist "%BUILD_DIR%\" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
if errorlevel 1 exit /b 1
if not exist "%OUT_DIR%\" mkdir "%OUT_DIR%"
if errorlevel 1 exit /b 1

for %%S in (%SOURCES%) do (
    xcopy "%%S\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
    if errorlevel 1 exit /b 1
)

rem Créer l'archive (un .xpi est un simple fichier ZIP)
if exist "%OUT%" del /f /q "%OUT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%creer-archive-zip.ps1" -Source "%BUILD_DIR%" -Destination "%OUT%"
if errorlevel 1 exit /b 1

if not "%CIBLE%"=="chromium" rmdir /s /q "%BUILD_DIR%"

echo.
call :message_%CIBLE%
exit /b 0


:message_firefox
echo Extension packagée : %OUT%
echo.
echo Pour installer dans Firefox :
echo   1. Ouvrir about:addons
echo   2. Roue dentée -^> Installer un module depuis un fichier...
echo   3. Sélectionner albert-correcteur-firefox.xpi
exit /b 0

:message_thunderbird
echo Extension packagée : %OUT%
echo.
echo Pour installer dans Thunderbird :
echo   1. Ouvrir le gestionnaire de modules (Menu ^> Modules complémentaires)
echo   2. Roue dentée -^> Installer un module depuis un fichier...
echo   3. Sélectionner albert-correcteur-thunderbird.xpi
exit /b 0

:message_chromium
echo Extension assemblée (dossier) : %BUILD_DIR%
echo Paquet Chrome Web Store (.zip) : %OUT%
echo.
echo Pour tester dans Chromium :
echo   1. Ouvrir chrome://extensions
echo   2. Activer le "Mode développeur" (en haut à droite)
echo   3. "Charger l'extension non empaquetée" -^> sélectionner :
echo      %SCRIPT_DIR%%BUILD_DIR%
echo.
echo Pour publier : envoyer %OUT% sur le Chrome Web Store.
exit /b 0


:erreur
echo.
echo Erreur : la construction du paquet a échoué.
exit /b 1
