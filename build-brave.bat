@echo off
rem Construit le paquet pour Brave / Chromium (Manifest V3).
rem Assemble sources-commun\ (code partage) + sources-firefox\ (logique content/UI,
rem agnostique du navigateur) + sources-brave\ (overrides MV3 : manifest, service
rem worker, shim browser.*). L'ordre de copie fait que sources-brave\ ecrase le
rem manifest de Firefox.
rem
rem Produit :
rem   - un dossier decompresse pret pour « load unpacked » dans brave://extensions
rem   - un .zip pret pour l'envoi sur le Chrome Web Store
rem
rem Usage : build-brave.bat
rem
rem Equivalent Windows de build-brave.sh. Le batch n'a pas d'equivalent de
rem « set -e » : chaque commande critique est donc suivie d'un test explicite
rem d'ERRORLEVEL, sans quoi un xcopy en echec produirait une archive incomplete
rem sans le signaler.

rem Passer la console en UTF-8 pour que les accents s'affichent correctement.
chcp 65001 > nul

setlocal

rem %~dp0 est le dossier du script, avec un antislash final.
set "SCRIPT_DIR=%~dp0"
set "COMMON_DIR=%SCRIPT_DIR%sources-commun"
set "FIREFOX_DIR=%SCRIPT_DIR%sources-firefox"
set "BRAVE_DIR=%SCRIPT_DIR%sources-brave"
set "OUT_DIR=%SCRIPT_DIR%brave-release"
set "BUILD_DIR=%OUT_DIR%\albert-correcteur-brave"
set "OUT=%OUT_DIR%\albert-correcteur-brave.zip"

rem Vérifier que les dossiers source existent
if not exist "%COMMON_DIR%\" (
    echo Erreur : le dossier sources-commun\ est introuvable.
    exit /b 1
)
if not exist "%FIREFOX_DIR%\" (
    echo Erreur : le dossier sources-firefox\ est introuvable.
    exit /b 1
)
if not exist "%BRAVE_DIR%\" (
    echo Erreur : le dossier sources-brave\ est introuvable.
    exit /b 1
)

rem Nettoyer et préparer le dossier d'assemblage
if exist "%BUILD_DIR%\" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
if errorlevel 1 goto :erreur

rem Copier le code partagé, puis la logique content/UI de Firefox (agnostique),
rem puis les overrides Brave/MV3 (écrase le manifest Firefox au passage).
xcopy "%COMMON_DIR%\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
if errorlevel 1 goto :erreur
xcopy "%FIREFOX_DIR%\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
if errorlevel 1 goto :erreur
xcopy "%BRAVE_DIR%\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
if errorlevel 1 goto :erreur

rem Créer le .zip (Chrome Web Store)
if exist "%OUT%" del /f /q "%OUT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%creer-archive-zip.ps1" -Source "%BUILD_DIR%" -Destination "%OUT%"
if errorlevel 1 goto :erreur

echo.
echo Extension assemblée (dossier) : %BUILD_DIR%
echo Paquet Chrome Web Store (.zip) : %OUT%
echo.
echo Pour tester dans Brave :
echo   1. Ouvrir brave://extensions
echo   2. Activer le « Mode développeur » (en haut à droite)
echo   3. « Charger l'extension non empaquetée » → sélectionner :
echo      %BUILD_DIR%
echo.
echo Pour publier : envoyer %OUT% sur le Chrome Web Store.
exit /b 0

:erreur
echo.
echo Erreur : la construction du paquet Brave a échoué.
exit /b 1
