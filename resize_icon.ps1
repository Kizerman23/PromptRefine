
Add-Type -AssemblyName System.Drawing

$sourcePath = "f:\ComputerScience\GitHub\PromptRefine\assets\icons\icon.png"
$destPath = "f:\ComputerScience\GitHub\PromptRefine\assets\icons\icon_resized.png"

if (Test-Path $sourcePath) {
    try {
        $img = [System.Drawing.Image]::FromFile($sourcePath)
        $callback = { return $false }
        $newImg = $img.GetThumbnailImage(128, 128, $callback, [IntPtr]::Zero)
        $img.Dispose()
        
        $newImg.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $newImg.Dispose()
        
        Move-Item -Path $destPath -Destination $sourcePath -Force
        Write-Host "Image resized successfully."
    } catch {
        Write-Error "Failed to resize image: $_"
        exit 1
    }
} else {
    Write-Error "Source image not found."
    exit 1
}
