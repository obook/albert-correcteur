<#
    Nom : creer-archive-zip.ps1
    Description : crée une archive ZIP à partir du contenu d'un dossier, en
                  ignorant les fichiers et dossiers cachés (ceux dont le nom
                  commence par un point). Remplace la commande « zip -r ... -x .* »
                  utilisée par les scripts de construction Unix, absente de Windows.
    Auteur : O. Booklage
    Date : septembre 2026
    Licence : MIT

    Usage : powershell -File creer-archive-zip.ps1 -Source <dossier> -Destination <fichier.zip>

    On n'utilise pas Compress-Archive : la version livrée avec Windows PowerShell 5.1
    écrit les séparateurs de chemin en antislash dans l'archive, ce qui rend le paquet
    illisible pour Firefox et le Chrome Web Store. On passe donc directement par
    System.IO.Compression, en normalisant les chemins en slash.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Destination
)

# Toute erreur non gérée interrompt le script avec un code de sortie non nul.
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    Write-Error "Le dossier source est introuvable : $Source"
}

$dossier_source = (Resolve-Path -LiteralPath $Source).Path

# System.IO.Compression n'accepte que des chemins absolus : on résout le dossier
# parent de la destination, qui existe déjà, puis on lui recolle le nom du fichier.
$dossier_destination = (Resolve-Path -LiteralPath (Split-Path -Parent $Destination)).Path
$nom_archive = Split-Path -Leaf $Destination
$chemin_archive = Join-Path $dossier_destination $nom_archive

# Le mode Create refuse d'écraser un fichier existant : on le supprime d'abord.
if (Test-Path -LiteralPath $chemin_archive) {
    Remove-Item -LiteralPath $chemin_archive -Force
}

$fichiers = Get-ChildItem -LiteralPath $dossier_source -Recurse -File -Force

$archive = [System.IO.Compression.ZipFile]::Open(
    $chemin_archive,
    [System.IO.Compression.ZipArchiveMode]::Create
)

try {
    $nombre_ajoutes = 0

    foreach ($fichier in $fichiers) {
        # Chemin du fichier relativement au dossier source, séparateurs Windows.
        $chemin_relatif = $fichier.FullName.Substring($dossier_source.Length + 1)

        # Écarter tout ce qui se trouve dans un dossier caché ou qui est un
        # fichier caché, à n'importe quel niveau de l'arborescence.
        $est_cache = $false
        foreach ($segment in $chemin_relatif.Split([char]'\')) {
            if ($segment.StartsWith(".")) {
                $est_cache = $true
            }
        }
        if ($est_cache) {
            continue
        }

        # Le format ZIP impose le slash comme séparateur de chemin.
        $nom_entree = $chemin_relatif.Replace('\', '/')

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $fichier.FullName,
            $nom_entree,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null

        $nombre_ajoutes = $nombre_ajoutes + 1
    }
}
finally {
    $archive.Dispose()
}

Write-Host "  $nombre_ajoutes fichier(s) archivé(s) dans $nom_archive"
