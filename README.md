# CS-Script - VSCode Extension (CS-Script.VSCode)

Execution, debugging and editing C# code that targets .NET and Mono (no .NET Core required).     
<hr/>
Currently VSCode support for C# is heavily oriented on development for .NET Core (e.g. ASP.NET Core). This imposes serious limitations on developers who is developing for desktop and server using C#. This project is aiming for filling this gap.

The extension is powered by the [CS-Script engine](https://github.com/oleg-shilo/cs-script/blob/master/README.md) - popular Open Source script engine that delivers Pythons scripting experience but for C# syntax. CS-Script uses ECMA-compliant C# as a programming language and it can be hosted by the applications or run standalone. CS-Script is already a core of the plugins for some other popular editors/IDEs:

- Sublime Text 3 - [CS-Script.ST3](https://github.com/oleg-shilo/cs-script-sublime/blob/master/README.md) 
- Notepad++  -  [CS-Script.Npp](https://github.com/oleg-shilo/cs-script.npp/blob/master/README.md)
- Visual Studio 2015/2017 - [CS-Script.VSIX](https://github.com/oleg-shilo/CS-Script.VSIX/blob/master/README.md)

The extension provides a very thin layer of own functionality. Its primary responsibility is bringing together OmniSharp IntelliSense services, a full scale debugger (curtesy of "Mono Debug" team) and CS-Script seamless C# script execution all. This page contains only a light overview of the extension functionality. The complete description can be found at the [project Wiki](https://github.com/oleg-shilo/cs-script.vscode/wiki).
<hr>

## Functionality

- _**Editing**_ <br>
All C# editing upport available with OmniSharp, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.

- _**Debugging**_<br>
Debugging support for .NET (Mono and Desktop CLR). This is something that currently  is impossible with other extensions.

- _**Execution**_<br>
All CS-Script features:
    - Direct execution of "plain vanilla" C# files without defining any project infrastructure.
    - Converting/Building a script into an assembly or a self contained executable.
    - Inclusion of the dependency scripts via CS-Script directives:
        - Importing other C# scripts
        - Referencing assemblies either explicitly or implicitly via automatic resolving namesspaces into assemblies
        - Referencing NuGet packages

- _**Portability**_<br>
The extension is supported on all OSs where VSCode can run.

<hr>

## C# scripting with VSCode

_CS-Script.VSCode_ allows convenient editing and execution of the C# code directly from the editor. A "C# script" is a file containing any ECMA-compliant C# code. While other C# based runtimes require C# code to be compiled into assemblies CS-Script allows direct C# execution by generating the assemblies on-fly. Thus you don't need to have any script specific configuration for executing your script. A single script file is fully sufficient as it contains everything that CS-Script needs to know to execute the script.

When your C# script depend on other (source code or compiled) C# modules you can express this in your code in a very simple way via `//css_*` directives. These directives are conceptually similar to Python `import *`, which appear on top of the script. CS-Script has only a handful directives that are easy to remember. And of course you can find the complete CS-Script documentation on GigHub: https://github.com/oleg-shilo/cs-script/wiki

The following is the overview of the CS-Script functionality available with Sublime Text 3. The overview also highlights the major CS-Script featured:


## Usage

_**Installing**_<br>
While the extension is already published on VSCode marketplace it may take some time until it becomes publicly available. Until then you can install the extension from VSIX.

_**Executing**_<br>
_Command: `cs-script: run`<br>_
Open the C# file and execute "run" command (Ctrl+F5):
![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_run1.gif)

_**Check for syntax errors**_<br>
_Command: `cs-script: check`<br>_
Open the C# file and execute "check" command (F7):
![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_check.gif)

_**Debugging**_<br>
_Command: `cs-script: debug`<br>_
Open the C# file and execute "debug" command (F7):
![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_debug1.gif)

_**Managing Dependencies**_<br>
_Command: `cs-script: print project`<br>_
Open the C# file and execute "print project" command (Alt+F7):
![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projA.gif)

_**Enabling IntelliSense**_<br>
_Command: `cs-script: load project`<br>_
Open the C# file and execute "load project" command (ctrl+F7):

_Note: currently VSCode project model does not allow programmatic opening of a project/folder and a file. Thus initially you need to trigger "load project" command twice to achieve the desired outcome. First tome to load the folder and second time to load the file. But after the project/folder is loaded activating a C# IntelliSense is a single step operation. This minor limitation is going to be addressed in teh future releases._   

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_projB.gif)

<hr>

## Limitations
_**Project structure**_<br>
VSCode is a subject to a serious limitation - the project model is based on a folder and doesn't allow any customization. To put it simple, VSCode executes/debugs folders while CS-Script files. While the extension completely overcomes this limitation for execution and debugging, but Intellisense support is only enabled when OmniSharp project is loaded. To make it easier _CS-Script.VSCode_ allows generation and loading required OmniSharp project in a single-step ('load project' command). Though in the future the solution most likely will be extended to overcome this limitation as well.

_**C# 7**_<br>
The initial release of the extension used default Mono runtime, which comes with VSCode. Currently it doesn't support C# 7. But the support will be automatically enabled from the moment the Mono version present on the system supports C#7. 

<hr>

## Road map
- Intelligence support for classless scripts. Currently classless scripts can only be executed and debugged but not "intellisensed": 
    ```C#
    using System;
                         
    void main()
    {
        Console.WriteLine("Hello World!";
    }
    ```      
- All currently hardcoded settings need to be moved to the user editable settings file.
- Integration of the CS-Script setting (loading/editing). 
- Support for non-C# CS-Script specific autocompletion and "Go to Definition". For example CS-Script directives:
    ```
    //css_include <script_path>  
    //css_reference <assembly_path>  
    //css_nuget <package_name>  
    ```
- Depending on the depth of the OmnySharp and VSCode customization the solution will need to support (in one or another way) Intelligence for a single loaded C# file without loading an OmniSharp project.

    Though in the future the solution most likely will be extended with a complimentary CS-Script's own Roslyn-based Intellisense engine. This will allow Intellisesne support for classless and non-project C# scripts.  

