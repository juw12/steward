; Steward for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Steward> /DOutputDir=<dist> /DIconFile=<build\steward.ico> steward.iss
; Installs to %LOCALAPPDATA%\Programs\Steward, adds Steward to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Steward, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Steward"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\steward.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Steward
AppVersion={#AppVersion}
AppVerName=Steward {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/steward/
AppSupportURL=https://github.com/juw12/steward
DefaultDirName={autopf}\Steward
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Steward-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Steward.exe
UninstallDisplayName=Steward
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Steward"; Filename: "{app}\Steward.exe"; Comment: "Guard a business AI assistant: allow on-mission requests"
Name: "{userdesktop}\Steward"; Filename: "{app}\Steward.exe"; Comment: "Guard a business AI assistant: allow on-mission requests"; Tasks: desktopicon

[Run]
Filename: "{app}\Steward.exe"; Description: "{cm:LaunchProgram,Steward}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Steward.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopSteward"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Steward window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Steward.exe')) then
    Exec(ExpandConstant('{app}\Steward.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
