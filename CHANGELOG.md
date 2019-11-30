# Change Log

## 1.5.10

- Issue #15: CS-Script for VS Code Portable.

## 1.5.8-9

- Fixed problem with the "Unable to open" error at startup when `open_file_at_startup` is set to empty string.
- Added work around for failure of Roslyn- based `ICodeCompiler` to run on OSX.  Implemented by setting `useAlternativeCompiler:none` and effectively downgrading C# syntax support to version 6.
- Fixed problem with `Settings` not being saved in case of the instance being load from the JSON file.

## 1.5.7

- Added support for debugging classless scripts directly (without decorated source file).
- Added support for freestyle classless scripts without any entry point defined:

```C#
    //css_ac freestyle
    using System;
    using System.IO;

    foreach (var file in Directory.GetFiles(@".\"))
        Console.WriteLine(file);
```

## 1.5.6

- Fixed problem with the injected `//css_syntaxer` directives not being cleared after CS-Script document formatting.

## 1.5.5

- Added option to `cs-script.enable_code_formatting` enable/disable document formatting provider.
- Added handling the case of MONO being installed but not added to PATH. Note, this only helps for running the scripts but not for debugging, which is handled entirely by VSCode. 

## 1.5.4

- Added handling/processing unsaved changes in the source files without creating a `<file>.$temp$.cs` file in the script directory. 

## 1.5.3

- Added "!inDebugMode" condition for "cs-script.debug" command.
- Issue #10: CSSConfig: searchDirs parameter not working. 
- Edit engine setting command now opens both .NET and Mono settings' files  

## 1.5.2

- Add option to suppress execute/debug in workspace mode (`cs-script.suppress_script_debug_for_workspaces`).
- Add option to tunnel CS-Script StartDebug request to the workspace launch.json algorithm (`cs-script.fallback_to_launch_json`).
- Start Debug now activates DebugConsole output panel.
- Issue #9: Add an option to hide "CS-Script: About" from the context menu.
- Default CS-Script config file now contains `-l` switch, which sets the current directory to the location of the script at the start of the execution.

## 1.5.1

- Added the logo icon into the package/distro

## 1.5.0

- Implemented Intellisense for standalone C# files:
  - Rename symbol
  - Signature help
  - Assignment completion
- Reduced embedded Roslyn runtime footprint.

## 1.4.0

- Implemented Intellisense for standalone C# files:
  - Code completion
  - Go to definition
  - Hover/tooltip
  - Find all references
  - VS style of "Find all references" result in output panel
- Added VB.NET syntax support (Windows only)

## 1.3.5

- Added explicit extension dependency on `mono-debug`. Seems the disclaimer "to add Mono" in the extension description does not convince users users to do so.

## 1.3.4

- Fixed problem project tree not being updated on saving the script.

## 1.3.3

- Fixed problem with the original VSCode debugging API being deprecated (vscode.commands.executeCommand("vscode.startDebug") vs vscode.debug.startDebugging(...)).

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
  - Added 'Go to definition' for CS-Script directives
  - Added auto-completion for CS-Script directives
  - Added auto-completion for path items in CS-Script `//css_include` directive
  - Added 'on hover' support for CS-Script directives
  - Added "Show project info" tree view button

## 1.2.1

- Fixed problem with generating debug info for Mono-Debug on Windows

## 1.2.0

- C# 7 support out of box
- New commands:
  - "help"
  - "build exe"
  - "new script"
  - "run in terminal"
  - "engine settings"
- Added dedicated toolbar buttons for the most common CS-Script commands.
- Revoked  extensionDependencies to the manifest file. Currently VSCode does not automatically installs specified dependencies but instead silently fails loading the extension if any dependency is not found. This all dependencies in the manifest file are removed so the extension can validate environment and clearly communicate the initialization failure reason(s).

## 1.0.1

- Implemented work around to allow single-step loading of OmniSharp project for enabling Intellisense.
- Implemented navigation to the file location on a single click (on error info) in the output panel.
- Added `extensionDependencies` to the manifest file. This should bring C# and Mono Debug plugins if they are not installed.

## 1.0.0

- Support for C# script execution (with cscs.exe)
- Support for C# script syntax checking (with cscs.exe)
- Support for C# script debugging (with _Mono Debug_ extension)
- Integration with VSCode IntelliSense (with _OmniSharp_ extension)
- Printing C# script dependencies ('print project' command)

