# CS-Script - VSCode Extension (CS-Script.VSCode)

Execution, debugging and editing C# scripts (powered by CS-Script engine) that target .NET and Mono (no .NET Core required).
A single C# file is all that is required to run the script. </br>
This extension Intellisense support for VB.NET scripts is currently limited to Windows only.</br>

---

Note this extension depends on "ms-vscode.mono-debug" and "ms-vscode.csharp". Thus if these extensions are installed but function incorrectly please log error reports at their corresponding web sites. Read section "Minimal set of dependencies" for more details.

---

## Overview

_The extension implements its own Roslyn-based Intellisense functionality fully integrated with VSCode  infrastructure. Though you can always opt to the VSCode built-in Intellisense engine OmniSharp. See **Using CS-Script IntelliSense** section for details._

Currently VSCode support for C# is heavily oriented on development for .NET Core (e.g. ASP.NET Core). This imposes serious limitations on developers who is developing for desktop and server using C#. This project is aiming for filling this gap.

The extension is powered by the [CS-Script engine](https://github.com/oleg-shilo/cs-script/blob/master/README.md) - popular Open Source script engine that delivers Python scripting experience but for C# syntax. CS-Script uses ECMA-compliant C# as a programming language and it can be hosted by applications or run standalone. CS-Script is already a core of the plugins for some other popular editors/IDEs:

- Sublime Text 3          - [CS-Script.ST3](https://github.com/oleg-shilo/cs-script-sublime/blob/master/README.md)
- Notepad++               - [CS-Script.Npp](https://github.com/oleg-shilo/cs-script.npp/blob/master/README.md)
- Visual Studio 2015/2017 - [CS-Script.VSIX](https://github.com/oleg-shilo/CS-Script.VSIX/blob/master/README.md)

The extension provides a thin layer of own functionality. Its primary responsibility is bringing together IntelliSense services, a full scale debugger (curtesy of "Mono Debug" team) and CS-Script seamless C# script execution. This page contains only a light overview of the extension functionality. The complete description can be found at the [project Wiki](https://github.com/oleg-shilo/cs-script.vscode/wiki).

## Quick start

1. Close any opened folder (workspace)
2. Create new C# script (command: `CS-Script: New C# script`)
3. Edit script to meet your requirements
4. Execute or debug script in VSCode
5. If required, execute the script outside of VSCode (see next section)

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/quick_start.gif)

#### Executing script outside of VSCode

The extension comes with the complete CS-Script package. You can find the location of the script engine `cscs.exe` by executing `CS-Script: About` command.
It may be a good idea to add the location of the `cscs.exe` into the system PATH environment variable.
This is how you can execute the script from the command shell:

_Windows:_
``` txt
cscs.exe my_script.cs
```

_Linux:_
``` txt
mono cscs.exe my_script.cs
```

You can also install CS-Script system wide. For Windows it is recommended to use [Chocolaty](https://chocolatey.org/) (Windows equivalent of Linux apt-get).
On Linux you can install Debian package. See instructions here: [https://github.com/oleg-shilo/cs-script/wiki/CS-Script-on-Linux](https://github.com/oleg-shilo/cs-script/wiki/CS-Script-on-Linux)

---

Apart from the common VSCode C# functionality the extension brings CS-Script specific user activities in the picture.

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

---

## Minimal set of dependencies (third-party extensions)

You will need the latest Mono from [http://www.mono-project.com/download/](http://www.mono-project.com/download/) and the following VSCode extensions:

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/dependencies.png)

Note, you may need to add Mono to the system path manually if it didn't happen for you during the Mono installation.

---

## Functionality

- _**Editing**_

  All C# editing support available with VSCode, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.

- _**Debugging**_

  Debugging support for .NET (Mono and Desktop CLR). This is something that currently  is impossible with other extensions.

- _**Execution**_

  All CS-Script features:

  - Direct execution of "plain vanilla" C# files without defining any project infrastructure.
  - You can also execute classless script without entry any point. See [auto-class](https://github.com/oleg-shilo/cs-script/wiki/CLI---User-Guide#command-auto-class) for details.
  - Converting/Building a script into an assembly or a self contained executable.
  - Inclusion of the dependency scripts via CS-Script directives:
    - Importing other C# scripts
    - Referencing assemblies either explicitly or implicitly via automatic resolving namespaces into assemblies
    - Referencing NuGet packages

- _**Portability**_

  The extension is supported on all OSs where VSCode can run.

### **Road map**

Below are the road map highlights only. Some more detailed information are available in the last section of this document.

- Add support fro C# 7 just out of box. (**_Done in v1.2.0_**)
- Add toolbar buttons for most frequent CS-Script commands. (**_Done in v1.2.0_**)
- Adding a [custom view](https://code.visualstudio.com/updates/v1_13#_custom-views) (script project tree) containing all script dependencies (e.g. imported scripts, DLLs) (**_Done in v1.3.0_**)
- Integrate CS-Script specific autocompletion with default C# autocompletion (OmniSharp). (**_Done in v1.3.0_**)
- Integrate CS-Script run/debug commands with the default launch actions. (**_Done in v1.3.0_**)
- Allow fallback autocompletion (similar to Sublime Text) when OmniSharp is not activated. (**_Done in v1.4.0_**)
- Full scale Intellisense support (via its own Intellisense services) without loading the folder. (**_Done in v1.5.0_**)

---

## C# scripting with VSCode

_CS-Script.VSCode_ allows convenient editing and execution of the C# code directly from the editor. A "C# script" is a file containing any ECMA-compliant C# code. While other C# based runtimes require C# code to be compiled into assemblies CS-Script allows direct C# execution by generating the assemblies on-fly. Thus you don't need to have any script specific configuration for executing your script. A single script file is fully sufficient as it contains everything that CS-Script needs to know to execute the script.

When your C# script depend on other (source code, assembly or NuGet package) C# modules you can express this in your code in a very simple way via `//css_*` directives. These directives are conceptually similar to Python `import *`, which appear on top of the script. CS-Script has only a handful directives that are easy to remember. And of course you can find the complete CS-Script documentation on GigHub: [https://github.com/oleg-shilo/cs-script/wiki](https://github.com/oleg-shilo/cs-script/wiki)

The following is the overview of the CS-Script functionality available with VS Code. The overview also highlights the major CS-Script featured:

Note: the most frequently used CS-Script command can also be accessed directly via toolbar buttons without using 'command palette':

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/toolbar.png)

Be aware that apart from allowing typical C# Intellisense this extension also provides C-Script specific code assistance features (mouse hover, go-to-definition and autocompletion) as well as the script project tree `CS-SCRIPT- ACTIVE`:

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

## Usage

_**Installing**_

While the extension is published on [VSCode marketplace](https://marketplace.visualstudio.com/items?itemName=oleg-shilo.cs-script) the latest unpublished[releases can be accesses on GitHub [releases page](https://github.com/oleg-shilo/cs-script.vscode/releases).

_**Executing**_

_Command: `cs-script: run`_

Open the C# file and execute "run" command (Ctrl+F5):

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_run1.gif)

_**Check for syntax errors**_

_Command: `cs-script: check`_

Open the C# file and execute "check" command (F7):

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_check.gif)

_**Debugging**_

_Command: `cs-script: debug`_

Open the C# file and execute "debug" command (Alt+F5):

_Note: you can use standard VSCode debugging triggers (e.g. F5) if you load the script as a workspace. See 'Load as workspace' section._

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_debug1.gif)

_**Managing Dependencies**_

_Command: `cs-script: print project`_

Open the C# file and execute "print project" command (Alt+F7):

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projA.gif)

_**Using CS-Script IntelliSense**_

_Command: `N/A`_

Open the C# file and start using normal intellisense triggers with CS-Script specific symbols: _hover, go-to-definition, autocompletion, find references_.

---

_Please note that CS-Script IntelliSense is only enabled when no workspace loaded. This is done in order to avoid any interference with the standard VSCode Intellisense for workspaces._

---

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

The supported _Intellisense_ features are:

1. Suggest completion (autocompletion)
2. Go to definition
3. Find all references
4. Find all references (classic)
5. Show symbol info as tooltip on mouse over the expression
6. Format document
7. Rename symbol
8. Signature help
9. Assignment autocomplete

"Find all references (classic)" is an alternative result representation of the standard VSCode "Find all references" for C#, TypeScript and VB.NET code (supported syntaxes can be extended). This presentation in conjunction with a single-click navigation is more consistent with the traditional Visual Studio experience:

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/find_refs_classic.gif)

_**Load as workspace**_

_Command: `cs-script: load project`_

Open the C# file and execute "load project" command (ctrl+F7)

CS-Script and VSCode are following completely different _project_ paradigm.

- _CS-Script_

  A single C#/VB.NET file is self-sufficient. It contains all the information about the dependencies required for execution/editing/debugging the script application:
  - referenced scripts (directly in code)
  - referenced assemblies (directly in code)
  - referenced NuGet packages (directly in code)
  - CS-Script.VSCode _Intellisense_ functionality

- _VSCode_

  A project file (*.sprog) and a project folder is required to fully define the dependencies required for execution/editing/debugging the application:
  - referenced scripts (in project file)
  - referenced assemblies (in project file)
  - referenced NuGet packages (in project file)
  - OmniSharp _Intellisense_ functionality

By default, when you just open a C#/VB.NET file the all development activities are handled by the CS-Script extension infrastructure. However sometimes you may prefer to use OmniSharp Intellisense. If it is the case you can open the script file and generate on-fly the all traditional project infrastructure - workspace (project file and folder). This can be achieved by executing the "load project" command (ctrl+F7).

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projB.gif)

## Limitations

_**C# 7**_

The extension comes with C# 7 support (via Roslyn) enabled by default. However Roslyn has an unfortunate limitation - it is extremely heavy and slow on startup. Thus it can take ~3-5 seconds to do the first compilation of a script or an _Intellisense_ request. Any further successive operations do not exhibit any delays.

A good indication of the extension being ready for Intellisense operations is the script project tree being populated and the status bar having "CS-Script ready" message at status bar. Note, the message stays only for 5 seconds:

![image](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/syntaxer_ready.png) 

Roslyn team did a good job by caching runtime instances of the compilers thus any consequent compilations will require only milliseconds to be accomplished. Unfortunately on Linux/Mono the same caching mechanism is not available so the compilation will consistently take up to 1.5 seconds (tested on VMWare Mint 18.1 4GB RAM on i7-5500U 2*2.40 GHz). Hopefully Roslyn team will extend runtime caching in the future releases of Mono.

Note, the Roslyn startup delay has no affect on script **execution**. CS-Script uses application level JIT compilation (similar to Python caching) that avoids compiling scripts if they are not changed since the last execution.