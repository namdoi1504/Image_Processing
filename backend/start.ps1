$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv-web\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Thiếu .venv-web. Tạo môi trường và cài backend/requirements.txt theo README.MD.'
}
Push-Location $projectRoot
try {
    & $pythonExe -c "import cv2, sys; print('Python:', sys.executable); print('OpenCV:', cv2.__version__); sys.exit(0 if callable(getattr(cv2.dnn, 'readNetFromTorch', None)) else 1)"
    if ($LASTEXITCODE -ne 0) {
        throw 'OpenCV không hỗ trợ model .t7. Cài lại bằng .\.venv-web\Scripts\python.exe -m pip install --force-reinstall -r backend/requirements.txt'
    }
    & $pythonExe -m uvicorn backend.app:app --host 0.0.0.0 --port 8002 @args
    if ($LASTEXITCODE -ne 0) { throw "Backend dừng với mã lỗi $LASTEXITCODE." }
}
finally {
    Pop-Location
}
