@echo off
rem Construit le fichier .xpi pour installation directe dans Firefox.
rem Assemble sources-commun\ (code partage) + sources-firefox\ (code specifique).
rem Usage : build-firefox.bat
rem
rem Equivalent Windows de build-firefox.sh. Le batch n'a pas d'equivalent de
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
set "OUT_DIR=%SCRIPT_DIR%firefox-release"
set "BUILD_DIR=%SCRIPT_DIR%.build-firefox"
set "OUT=%OUT_DIR%\albert-correcteur-firefox.xpi"

rem Vérifier que les dossiers source existent
if not exist "%COMMON_DIR%\" (
    echo Erreur : le dossier sources-commun\ est introuvable.
    exit /b 1
)
if not exist "%FIREFOX_DIR%\" (
    echo Erreur : le dossier sources-firefox\ est introuvable.
    exit /b 1
)

rem Nettoyer et préparer le dossier d'assemblage
if exist "%BUILD_DIR%\" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
if errorlevel 1 goto :erreur

rem Copier le code partagé puis le code spécifique Firefox (écrase si conflit)
xcopy "%COMMON_DIR%\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
if errorlevel 1 goto :erreur
xcopy "%FIREFOX_DIR%\*" "%BUILD_DIR%\" /E /I /Q /Y > nul
if errorlevel 1 goto :erreur

rem Créer le dossier de release et supprimer l'ancien .xpi
if not exist "%OUT_DIR%\" mkdir "%OUT_DIR%"
if errorlevel 1 goto :erreur
if exist "%OUT%" del /f /q "%OUT%"

rem Créer le .xpi (c'est un simple fichier ZIP)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%creer-archive-zip.ps1" -Source "%BUILD_DIR%" -Destination "%OUT%"
if errorlevel 1 goto :erreur

rem Nettoyer
rmdir /s /q "%BUILD_DIR%"

echo.
echo Extension packagée : %OUT%
echo.
echo Pour installer dans Firefox :
echo   1. Ouvrir about:addons
echo   2. Roue dentée → Installer un module depuis un fichier...
echo   3. Sélectionner albert-correcteur-firefox.xpi
exit /b 0

:erreur
echo.
echo Erreur : la construction du paquet Firefox a échoué.
exit /b 1
