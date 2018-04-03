# CS-Script - VSCode Extension (CS-Script.VSCode)

Execution, debugging and editing C# scripts that target .NET and Mono (no .NET Core required).</br>
A single C# file is all that is required to run the script. Support for VB.NET scripts is currently limited to Windows only.

<hr/>
Note this extension depends on "ms-vscode.mono-debug" and "ms-vscode.csharp". Thus if these extensions are installed/function incorrectly please log error reports at their web sites.
<hr/>

## Overview

_The extension implements its own Roslyn-based _Intellisense_ functionality fully integrated with VSCode  infrastructure. Though you can always opt to the VSCode built-in _Intellisense_ engine OmniSharp. See **_Using CS-Script IntelliSense_** section for details._

Currently VSCode support for C# is heavily oriented on development for .NET Core (e.g. ASP.NET Core). This imposes serious limitations on developers who is developing for desktop and server using C#. This project is aiming for filling this gap.

The extension is powered by the [CS-Script engine](https://github.com/oleg-shilo/cs-script/blob/master/README.md) - popular Open Source script engine that delivers Python scripting experience but for C# syntax. CS-Script uses ECMA-compliant C# as a programming language and it can be hosted by applications or run standalone. CS-Script is already a core of the plugins for some other popular editors/IDEs:

- Sublime Text 3 - [CS-Script.ST3](https://github.com/oleg-shilo/cs-script-sublime/blob/master/README.md)
- Notepad++  -  [CS-Script.Npp](https://github.com/oleg-shilo/cs-script.npp/blob/master/README.md)
- Visual Studio 2015/2017 - [CS-Script.VSIX](https://github.com/oleg-shilo/CS-Script.VSIX/blob/master/README.md)

The extension provides a very thin layer of own functionality. Its primary responsibility is bringing together OmniSharp IntelliSense services, a full scale debugger (curtesy of "Mono Debug" team) and CS-Script seamless C# script execution. This page contains only a light overview of the extension functionality. The complete description can be found at the [project Wiki](https://github.com/oleg-shilo/cs-script.vscode/wiki).

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

<hr>

## Minimal set of dependencies (third-party extensions)
Latest Mono from http://www.mono-project.com/download/ and the following VSCode extensions:

Note, you may need to add Mono to the system path manually if it didn't happen for you during the Mono installation.

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/dependencies.png)
<hr>

## Functionality

- _**Editing**_ <br>
All C# editing support available with OmniSharp, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.

- _**Debugging**_<br>
Debugging support for .NET (Mono and Desktop CLR). This is something that currently  is impossible with other extensions.

- _**Execution**_<br>
All CS-Script features:
    - Direct execution of "plain vanilla" C# files without defining any project infrastructure.
    - Converting/Building a script into an assembly or a self contained executable.
    - Inclusion of the dependency scripts via CS-Script directives:
        - Importing other C# scripts
        - Referencing assemblies either explicitly or implicitly via automatic resolving namespaces into assemblies
        - Referencing NuGet packages

- _**Portability**_<br>
The extension is supported on all OSs where VSCode can run.

### **Road map (highlights)**
Below are the road map highlights only. Some more detailed information are available in the last section of this document.
- Add support fro C# 7 just out of box. (**_Done in v1.2.0_**)
- Add toolbar buttons for most frequent CS-Script commands. (**_Done in v1.2.0_**)
- Adding a [custom view](https://code.visualstudio.com/updates/v1_13#_custom-views)  containing all script dependencies (e.g. imported scripts, DLLs) (**_Done in v1.3.0_**)
- Integrate CS-Script specific autocompletion with default C# autocompletion (OmniSharp). (**_Done in v1.3.0_**)
- Integrate CS-Script run/debug commands with the default launch actions. (**_Done in v1.3.0_**)
- Allow fallback autocompletion (similar to Sublime Text) when OmniSharp is not activated.
- Allow OmniSharp autocompletion to be integrated without loading the folder. May not be possible due to the OmniSharp limitations.

<hr>

## C# scripting with VSCode

_CS-Script.VSCode_ allows convenient editing and execution of the C# code directly from the editor. A "C# script" is a file containing any ECMA-compliant C# code. While other C# based runtimes require C# code to be compiled into assemblies CS-Script allows direct C# execution by generating the assemblies on-fly. Thus you don't need to have any script specific configuration for executing your script. A single script file is fully sufficient as it contains everything that CS-Script needs to know to execute the script.

When your C# script depend on other (source code or compiled) C# modules you can express this in your code in a very simple way via `//css_*` directives. These directives are conceptually similar to Python `import *`, which appear on top of the script. CS-Script has only a handful directives that are easy to remember. And of course you can find the complete CS-Script documentation on GigHub: https://github.com/oleg-shilo/cs-script/wiki

The following is the overview of the CS-Script functionality available with VS Code. The overview also highlights the major CS-Script featured:

Note: the most frequently used CS-Script command can also be accessed directly via toolbar buttons without using 'command palette':

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/toolbar.png)

Be aware that apart from allowing typical C# Intellisense this extension also provides C-Script specific code assistance features (mouse hover, go-to-definition and autocompletion):

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

## Usage

_**Installing**_<br>
While the extension is already published on VSCode marketplace it may take some time until it becomes publicly available. Until then you can install the extension from VSIX (from GitGub).

_**Executing**_<br>
_Command: `cs-script: run`<br>_
Open the C# file and execute "run" command (Ctrl+F5):

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_run1.gif)

_**Check for syntax errors**_<br>
_Command: `cs-script: check`<br>_
Open the C# file and execute "check" command (F7):

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_check.gif)

_**Debugging**_<br>
_Command: `Debug: Start Debugging`<br>_
Open the C# file and load it with "cs-script: load project" command (Ctrl+F7). After that you can start debugging the same way as with any VSCode workspace/language: by pressing F5 (Debug: Start Debugging command):

_**Debugging (without workspace)**_<br>
_Command: `cs-script: debug`<br>_
Open the C# file and execute "debug" command (Alt+F5):

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_debug1.gif)

_**Managing Dependencies**_<br>
_Command: `cs-script: print project`<br>_
Open the C# file and execute "print project" command (Alt+F7):

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projA.gif)


![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projB.gif)

_**Using CS-Script IntelliSense**_<br>
_Command: `N/A`<br>_
Open the C# file and start using normal intellisense triggers with CS-Script specific symbols: _hover, go-to-definition, autocompletion, find references_.

<hr/>

_Please note that CS-Script IntelliSense is only enabled when no workspace loaded. This is done in order to avoid any interference with the standard VSCode Intellisense for workspaces._

<hr/>

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)

The supported _Intellisense_ features are:
1. Suggest completion (autocompletion)
2. Go to definition
3. Find all references
4. Find all references (classic)
5. Show symbol info as tooltip on mouse over the expression
6. Format document (in next release)
7. Rename symbol (in next release)

"Find all references (classic)" is an alternative result representation of the standard VSCode "Find all references" for C#, TypeScript and VB.NET code. This presentation in conjunction with a single-click navigation is more consistent with the traditional Visual Studio experience:

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/find_refs_classic.gif)


_**Load as workspace**_<br>
_Command: `cs-script: load project`<br>_
Open the C# file and execute "load project" command (ctrl+F7)

CS-Script and VSCode are following completely different _project_ paradigm.
- _CS-Script_</br>
  A single C#/VB.NET file is self-sufficient. It contains all the information about the dependencies required for execution/editing/debugging the script application:
   - referenced scripts (directly in code)
   - referenced assemblies (directly in code)
   - referenced NuGet packages (directly in code)
   - CS-Script extension _Intellisense_ functionality

- _VSCode_</br>
  A project file (*.csproj) and a project folder is required to fully define the dependencies required for execution/editing/debugging the application:
   - referenced scripts (in project file)
   - referenced assemblies (in project file)
   - referenced NuGet packages (in project file)
   - Omnisharp _Intellisense_ functionality

By default, when you just open a C#/VB.NET file the all development activities are handled by the CS-Script extension infrastructure. However in some cases you may prefer to use arguably richer Omnisharp Intellisense. If it is the case you can open the script file and generate on-fly the all traditional project infrastructure - workspace (project file and folder). This can be achieved by executing the "load project" command (ctrl+F7).

## Limitations

_**C# 7**_<br>
The extension comes with C# 7 support (via Roslyn) enabled by default. However Roslyn has an unfortunate limitation - it is extremely heavy and slow on startup. Thus it can take ~3-5 seconds to do the first compilation of a script or an _Intellisense_ request. Any further successive operations do not exhibit any delays.

Roslyn team did a good job by caching runtime instances of the compilers thus any consequent compilations will require only milliseconds to be accomplished. Unfortunately on Linux/Mono the same caching mechanism is not available so the compilation will consistently take up to 1.5 seconds (tested on VMWare Mint 18.1 4GB RAM on i7-5500U 2*2.40 GHz). Hopefully Roslyn team will extend runtime caching in the future releases of Mono.

Note, the Roslyn startup delay has no affect on script **execution**. CS-Script uses application level JIT compilation (similar to Python caching) that avoids compiling scripts if they are not changed since the last execution.

<hr>

## Road map (details)
- Extension _Intellisense_ functionality:
  - Document formatting
  - Rename symbol
- VB.NET syntax support on Linux
- VB.NET project tree support
