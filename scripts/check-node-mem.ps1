$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.WorkingSetSize -gt 50MB } |
  Select-Object ProcessId, ParentProcessId, @{n='WS_MB';e={[math]::Round($_.WorkingSetSize/1MB,1)}}, CommandLine
$procs | Format-Table -AutoSize -Wrap