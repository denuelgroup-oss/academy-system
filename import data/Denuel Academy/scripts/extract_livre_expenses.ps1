Set-Location "C:\Users\Administrateur\Denuel Academy"

$workbookPath = Resolve-Path "import data\livre de caisse denuel academy au mois 2025.xlsx"
$outPath = "scripts\livre_expenses_import.json"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($workbookPath)

function Read-EntryText([string]$entryName) {
    $entry = $zip.GetEntry($entryName)
    if (-not $entry) { return "" }
    $sr = New-Object System.IO.StreamReader($entry.Open())
    $content = $sr.ReadToEnd()
    $sr.Close()
    return $content
}

function ExcelSerialToDate([double]$serial) {
    if ($serial -le 0) { return $null }
    return ([datetime]'1899-12-30').AddDays([math]::Floor($serial)).ToString('yyyy-MM-dd')
}

function Parse-DateValue([string]$raw) {
    $v = [string]$raw
    if ($null -eq $v) { $v = '' }
    $v = $v.Trim()
    if ($v -eq '') { return $null }

    $num = 0.0
    if ([double]::TryParse($v, [ref]$num)) {
        return ExcelSerialToDate $num
    }

    $formats = @('d/M/yyyy','dd/MM/yyyy','d-M-yyyy','dd-MM-yyyy','yyyy-MM-dd')
    foreach ($f in $formats) {
        try {
            $d = [datetime]::ParseExact($v, $f, $null)
            return $d.ToString('yyyy-MM-dd')
        } catch {}
    }

    try {
        return ([datetime]::Parse($v)).ToString('yyyy-MM-dd')
    } catch {
        return $null
    }
}

function Parse-Amount([string]$raw) {
    $v = [string]$raw
    if ($null -eq $v) { $v = '' }
    $v = $v.Trim()
    if ($v -eq '') { return 0.0 }
    $v = $v -replace ',', '.'
    $v = $v -replace '[^0-9.\-]', ''
    if ($v -eq '' -or $v -eq '.' -or $v -eq '-') { return 0.0 }
    $n = 0.0
    if ([double]::TryParse($v, [ref]$n)) { return [math]::Round($n, 2) }
    return 0.0
}

function Get-CellColumn([string]$ref) {
    if ($ref -match '^([A-Z]+)') { return $Matches[1] }
    return ''
}

$sharedStrings = @()
$ssText = Read-EntryText 'xl/sharedStrings.xml'
if ($ssText -ne '') {
    [xml]$ss = $ssText
    $ssNsmgr = New-Object System.Xml.XmlNamespaceManager($ss.NameTable)
    $ssNsmgr.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $siNodes = $ss.SelectNodes('//s:si', $ssNsmgr)
    foreach ($si in $siNodes) {
        $tNodes = $si.SelectNodes('.//s:t', $ssNsmgr)
        $parts = @()
        foreach ($tn in $tNodes) { $parts += $tn.InnerText }
        $sharedStrings += (($parts -join '').Trim())
    }
}

[xml]$wb = Read-EntryText 'xl/workbook.xml'
[xml]$rels = Read-EntryText 'xl/_rels/workbook.xml.rels'

$wbNsmgr = New-Object System.Xml.XmlNamespaceManager($wb.NameTable)
$wbNsmgr.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
$wbNsmgr.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

$relsNsmgr = New-Object System.Xml.XmlNamespaceManager($rels.NameTable)
$relsNsmgr.AddNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships')

$relMap = @{}
$relNodes = $rels.SelectNodes('//p:Relationship', $relsNsmgr)
foreach ($rel in $relNodes) {
    $rid = $rel.Id
    $target = $rel.Target
    if ($rid -and $target) {
        $relMap[$rid] = ('xl/' + $target.TrimStart('/'))
    }
}

$sheetNodes = $wb.SelectNodes('//s:sheets/s:sheet', $wbNsmgr)
$records = New-Object System.Collections.Generic.List[object]

foreach ($sheet in $sheetNodes) {
    $sheetName = $sheet.name
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    if (-not $relMap.ContainsKey($rid)) { continue }

    $sheetPath = $relMap[$rid]
    $sheetText = Read-EntryText $sheetPath
    if ($sheetText -eq '') { continue }

    [xml]$sx = $sheetText
    $sxNsmgr = New-Object System.Xml.XmlNamespaceManager($sx.NameTable)
    $sxNsmgr.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')

    $rows = $sx.SelectNodes('//s:sheetData/s:row', $sxNsmgr)
    foreach ($row in $rows) {
        $rowNum = [int]$row.r
        if ($rowNum -lt 5) { continue }

        $cells = @{}
        $cellNodes = $row.SelectNodes('./s:c', $sxNsmgr)
        foreach ($cell in $cellNodes) {
            $ref = $cell.r
            $col = Get-CellColumn $ref
            if ($col -eq '') { continue }
            $t = [string]$cell.t
            $value = ''
            if ($t -eq 's') {
                $idx = [int]$cell.v
                if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) {
                    $value = [string]$sharedStrings[$idx]
                }
            } elseif ($t -eq 'inlineStr') {
                $value = [string]$cell.is.t
            } else {
                $value = [string]$cell.v
            }
            if ($null -eq $value) { $value = '' }
            $cells[$col] = ([string]$value).Trim()
        }

        $date = Parse-DateValue $cells['B']
        if (-not $date) { continue }

        $label = [string]$cells['C']
        if ($null -eq $label) { $label = '' }
        $label = $label.Trim()
        $mode = [string]$cells['D']
        if ($null -eq $mode) { $mode = '' }
        $mode = $mode.Trim()
        if ($label -eq '') { $label = "Imported expense $sheetName row $rowNum" }

        # Strict rule: import expenses from Depenses columns only (G=USD, H=CDF).
        # Never read Recettes columns E/F.
        $usd = Parse-Amount $cells['G']
        $cdf = Parse-Amount $cells['H']

        if ($usd -gt 0) {
            $records.Add([pscustomobject]@{
                expense_date = $date
                title = $label
                amount = $usd
                currency = 'USD'
                mode = $mode
                source_key = "LIVRE2025|$sheetName|R$rowNum|G"
            })
        }
        if ($cdf -gt 0) {
            $records.Add([pscustomobject]@{
                expense_date = $date
                title = $label
                amount = $cdf
                currency = 'CDF'
                mode = $mode
                source_key = "LIVRE2025|$sheetName|R$rowNum|H"
            })
        }
    }
}

$zip.Dispose()

$records | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $outPath
Write-Output ("Extracted entries: " + $records.Count)
Write-Output ("Output: " + (Resolve-Path $outPath))
