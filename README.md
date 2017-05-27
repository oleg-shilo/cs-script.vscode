# CS-Script VSCode Extension

Currently the extension is at the early development stage and it is just not ready yet for the distribution. However, as a temporary and partial equivalent of the upcoming extension you can configure VSCode to execute and debug the scripts without waiting for the extension release. Below are the step-by-step instructions on how to configure VSCode for the execution and debugging C# scripts with CS-Script. So far the solution has been tested on Windows but it should work on Linux straight away, though it may require specifying `mono` as a runtime in `code-runner.executorMap` value of the settings file.  

Below is the minimal set of extensions that is required for this technique to work: 

![](https://github.com/oleg-shilo/cs-script.vscode/tree/master/images/dependencies.png)

## Script execution

Implementing on-fly project structure in VSCode is difficult. VSCode still uses a folder instead of a project file as a project specification. This paradigm contradicts with CS-Script's execution promise ("file run") - "free standing script run"

So far running the script has been achieved via "Code Runner" extension. This extension follows "file run" paradigm. The following is the set of steps that need to be performed to configure CS-Script execution in VSCode:

* Install "Code Runner" extension:
* Update user settings (`settings.json`) to create a code-runner task for *.cs files to run with cs-script:
    ```js
    {
         "code-runner.executorMap": {
            // "csharp": "%CSSCRIPT_DIR%/cscs -config:none -nl"
            "csharp": "cscs -config:none -nl"
          },
          "code-runner.saveFileBeforeRun": true,
          "code-runner.clearPreviousOutput": true
    }
    ```
* Optionally map new task (from prev step) with "ctrl+f5" shortcut:
    ```js
    // Place your key bindings in this file to overwrite the defaults
    [
        {
            "key": "ctrl+f5",
            "command": "code-runner.run"
        },
        ...
    ```
* Optionally map new task (from prev step) with "ctrl+f5" shortcut.
* Open script file and execute it (e.g. "ctrl+f5")
    ![](https://github.com/oleg-shilo/cs-script.vscode/tree/master/images/vscode_run.gif)   

## Debugging

Debugging scripts is done with Mono debugger. Thus you need to install Mono Debug extension.

You also need to create and load the folder containing the corresponding `launch.json` config file with the debugging instructions: 

```js
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch",
            "type": "mono",
            "request": "launch",
            "program": "${workspaceRoot}/cscs.exe",
            "args": ["-nl", "-d", "-l", "-ac:0", "-config:none", "${file}"],
            "cwd": "${workspaceRoot}",
            "runtimeExecutable": null,
            "env": {}
        },
        {
            "name": "Attach",
            "type": "mono",
            "request": "attach",
            "address": "localhost",
            "port": 55555
        }
    ]
}
```

You can download the pre-configured folder [cs-script.dev.7z](dev/cs-script.dev.7z). Extract it and load in VSCode. Apart from `launch.json` it also contains a copy of CS-Script engine (`cscs.exe`) as well as a test script (`test.cs`).

IMPORTANT: in order for this solution to work you need to load folder (cs-script.dev) in VSCode it creates a workspace as `Mono Debug` extension can only work within a workspace. This limitation is going to be removed when CS-Script extension is released.

![](https://github.com/oleg-shilo/cs-script.vscode/tree/master/images/vscode_debug.gif)   

