@echo off
echo ===================================================
echo     Subiendo cambios de App Reservas a Internet...
echo ===================================================
echo.

:: Agregar todos los cambios realizados
git add .

:: Crear una versión con fecha y hora automática
git commit -m "Actualizacion automatica: %date% %time%"

:: Empujar a GitHub (lo cual actualiza la web oficial)
git push origin master

echo.
echo ===================================================
echo   ¡Listo! Los cambios están en Internet. 
echo   Espera 1 o 2 minutos y recarga tu pagina publica.
echo ===================================================
pause
