# Change Log

## 1.3.2
- 'Check syntax' action that became in conflict with the new "scripted arg" support.

## 1.3.1
- Issue #4: Project fails to load if the script has cs-script directive invalid syntax.
- Issue #5: Executing detached script (Ctrl+F5) work OK but sometimes trigger "is busy" warning message.
- Updated cs-script engine to v3.27.3 (assorted Linux improvements)

## 1.3.0
- Added project tree view
- Implemented CS-Script execution with standard F5 via on-fly generated specific launch.json
- Implemented CS-Script specific intellisense
  * Added 'Go to definition' for CS-Script directives
  * Added auto-completion for CS-Script directives
  * Added auto-completion for path items in CS-Script `//css_include` directive
  * Added 'on hover' support for CS-Script directives
  * Added "Show project info" tree view button

## 1.2.1
- Fixed problem with generating debug info for Mono-Debug on Windows

## 1.2.0
- C# 7 support out of box
- New commands:
  * "help"
  * "build exe"
  * "new script"
  * "run in terminal"
  * "engine settings"
- Added dedicated toolbar buttons for the most common CS-Script commands.
- Revoked  extensionDependencies to the manifest file. Currently VSCode does not automatically installs specified dependencies but instead silently fails loading the extension if any dependency is not found. This all dependencies in the manifest file are removed so the extension can validate environment and clearly communicate the initialization failure reason(s).

## 1.0.1
- Implemented work around to allow single-step loading of OmniSharp project for enabling IntellisSense.
- Implemented navigation to the file location on a single click (on error info) in the output panel.
- Added `extensionDependencies` to the manifest file. This should bring C# and Mono Debug plugins if they are not installed.

## 1.0.0
- Support for C# script execution (with cscs.exe)
- Support for C# script syntax checking (with cscs.exe)
- Support for C# script debugging (with _Mono Debug_ extension)
- Integration with VSCode IntelliSense (with _OmniSharp_ extension)
- Printing C# script dependencies ('print project' command)

