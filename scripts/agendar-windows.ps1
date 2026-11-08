# Agenda a fábrica para rodar todo dia no Windows (Agendador de Tarefas). Rode no PowerShell como usuário normal.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\agendar-windows.ps1 -Hora 17:30
param([string]$Hora = "17:30")
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$node = (Get-Command node).Source
$acao = New-ScheduledTaskAction -Execute $node -Argument "fabrica\cli.js diario" -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
$config = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 5) -StartWhenAvailable -WakeToRun
Register-ScheduledTask -TaskName "Fabrica POV Viral" -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null
Write-Host "Tarefa 'Fabrica POV Viral' criada: todo dia às $Hora, em $raiz. Veja o histórico no Agendador de Tarefas."
Write-Host "Para testar agora: Start-ScheduledTask -TaskName 'Fabrica POV Viral'"
