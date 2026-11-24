# Moves the real mouse pointer for the demo recording, so the video shows it travel to each button.
# Reads one command per line on stdin:
#   "x y"  move the pointer to screen point (x, y)
#   "get"  print the pointer's current position as "x y"
#   "quit" exit
# Only the pointer moves; clicks are done by the browser automation.

Add-Type -Name Pointer -Namespace DemoRecorder -MemberDefinition @'
[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
public struct POINT { public int X; public int Y; }
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool SetCursorPos(int x, int y);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool GetCursorPos(out POINT point);
'@

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'quit') { break }
  if ($line -eq 'get') {
    $point = New-Object DemoRecorder.Pointer+POINT
    [void][DemoRecorder.Pointer]::GetCursorPos([ref]$point)
    [Console]::Out.WriteLine("$($point.X) $($point.Y)")
    [Console]::Out.Flush()
    continue
  }
  $parts = $line.Split(' ')
  if ($parts.Length -eq 2) { [void][DemoRecorder.Pointer]::SetCursorPos([int]$parts[0], [int]$parts[1]) }
}
