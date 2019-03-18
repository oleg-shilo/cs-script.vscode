"use strict";

/* tslint:disable */

import * as fs from "fs";
import * as os from "os";
import * as utils from "./utils";
import * as syntaxer from "./syntaxer";
import * as vscode from "vscode";
import * as path from "path";
import { Uri, commands, DiagnosticSeverity, TextEditorSelectionChangeKind, Location, window, TextEditor, workspace, Terminal, TextEditorSelectionChangeEvent, Selection, TextDocument, TextDocumentChangeEvent, ExtensionContext } from "vscode";
import { ErrorInfo, Utils, unlock, is_busy, with_lock, actual_output, settings, vsc_config, user_dir, create_dir, select_line, ActiveEditorTracker } from "./utils";
import { Syntaxer } from "./syntaxer";

export let syntax_readme: string = path.join(user_dir(), "cs-script.syntax.txt");
let ext_context: ExtensionContext;
let cscs_exe: string = path.join(user_dir(), "cscs.exe");
let readme: string = path.join(user_dir(), "cs-script.help.txt");
let csproj_template = __dirname + "/../bin/script.csproj";
let outputChannel = window.createOutputChannel("CS-Script");

// it is extremely important to keep project file name in sync with the activation event trigger in manifest file )"workspaceContains:script.csproj")
let script_proj_name = "script.csproj";
let startup_file_key = "cs-script.open_file_at_startup";
export let csproj_dir = path.join(os.tmpdir(), "CSSCRIPT", "VSCode", "cs-script - OmniSharp");

function extra_args(): string { return vsc_config.get("cs-script.extra_args_for_debug", "-co:/debug:pdbonly"); }
// -----------------------------------
export function load_project() {
  with_lock(() => {
    unlock(); //release lock immediately as otherwise it can interfere with loading workspace

    // bpasero commented on Apr 5, 2016
    // https://github.com/Microsoft/vscode/issues/58
    // "Note that opening a folder will replace the current running instance and this means
    // the currently executing extension host will go down and restart."
    //
    // The described above limitation makes it impossible to open a folder and then open a file
    // from a single routine. Thus on the first 'load_project' prepare and open the folder. And on the
    // second request load the project primary source file (script)

    // Note: os.tmpdir() for some reason returns lower cased root so Utils.IsSamePath needs to be used
    // let proj_dir = path.join(os.tmpdir(), 'CSSCRIPT', 'VSCode', 'cs-script.vscode');
    // let current_folder = vscode.workspace.rootPath;

    let editor = window.activeTextEditor;

    let workspaceIsAlreadyLoaded = Utils.IsSamePath(workspace.rootPath, csproj_dir);

    if (workspaceIsAlreadyLoaded) {
      if (editor != null && !Utils.IsScript(editor.document.fileName)) {
        window.showErrorMessage("The active document is not a C# code file. Please open a C# document and try again.");
      }
      else {
        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine("Loading script...");
        try {

          if (editor == null) {
            let scriptFile = parse_proj_dir(csproj_dir);
            commands.executeCommand("vscode.open", Uri.file(scriptFile));
          }
          else {
            if (editor.document.isDirty) {
              editor.document.save();
              return;
            }
            generate_proj_file(csproj_dir, editor.document.fileName);
          }

        }
        finally {
          setTimeout(() => outputChannel.clear(), 700);
        }
      }
    }
    else {
      if (editor == null) {
        window.showErrorMessage("No active document found. Please open a C# document and try again.");
      }
      else if (!Utils.IsScript(editor.document.fileName)) {
        window.showErrorMessage("The active document is not a C# code file. Please open a C# document and try again.");
      }
      else {
        outputChannel.clear();
        outputChannel.appendLine("Loading OmniSharp project...");

        if (editor.document.isDirty) {
          editor.document.save();
          return;
        }

        generate_proj_file(csproj_dir, editor.document.fileName);

        // When folder is opened the whole execution context is recreated. It's like restarting VSCode.
        // Thus any attempt to openFile after calling openFolder from the same routine will lead to the folder being opened
        // but not the file.
        // As a work around indicate that the file needs to be opened at startup.
        // set_startup_file(ext_context, editor.document.fileName);

        // The feature request has also been logged:
        // https://github.com/Microsoft/vscode/issues/27990
        // "There is no way to open a folder with a specific file opened and active" #27990

        ext_context.globalState.update(startup_file_key, editor.document.fileName);

        if (settings.show_load_proj_info) {
          let info_msg = "In order to activate intellisense an OmniSharp project will be initialized and the current script file will be loaded in its context.\n\n";
          let ok_dont_show_again = "OK, Don't show this message again";
          let ok = "OK";

          window
            .showInformationMessage(info_msg, { modal: true }, ok, ok_dont_show_again)
            .then(response => {
              if (response == ok) {
                setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.parse(csproj_dir)), 100);
              }
              else if (response == ok_dont_show_again) {
                // VSCode doesn't allow saving settings from the extension :(
                // let configuration = vscode.workspace.getConfiguration('cs-script');
                // configuration.set('show_load_proj_info', false);

                settings.show_load_proj_info = false;
                settings.Save();

                setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.parse(csproj_dir)), 100);
              }
            });
        }
        else {
          setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.parse(csproj_dir)), 100);
        }
      }
    }
  });
}

export function parse_proj_dir(proj_dir: string): string | null {
  let proj_file = path.join(proj_dir, script_proj_name);
  let prefix = '<Compile Include="';
  let suffix = '"/>';
  for (let line of fs.readFileSync(proj_file, "utf8").split(os.EOL)) {
    line = line.trim();

    if (line.startsWith(prefix)) {
      let file = line.slice(prefix.length, -suffix.length);
      return file;
    }
  }
  return null;
}

function generate_proj_file(proj_dir: string, scriptFile: string): void {
  try {
    let proj_file = path.join(proj_dir, script_proj_name);
    let command = build_command(`"${cscs_exe}" -proj:dbg "${scriptFile}"`);

    let output = Utils.RunSynch(command);

    let lines: string[] = output
      .trim()
      .lines()
      .filter(actual_output);
    let refs = "";
    let includes = "";

    let System_ValueTuple_dll = null;
    if (utils.isWin) {
      System_ValueTuple_dll = path.join(user_dir(), "roslyn", "System.ValueTuple.dll").pathNormalize();
    }
    else {
      refs += '    <Reference Include="System.Runtime.dll" />' + os.EOL;
      System_ValueTuple_dll = path.join(utils.omnisharp_dir, "System.ValueTuple.dll").pathNormalize();
    }

    refs +=
      '    <Reference Include="' + System_ValueTuple_dll + '" />' + os.EOL;

    lines.forEach((line, i) => {
      if (line.startsWith("ref:")) {
        if (!line.trim().endsWith("System.ValueTuple.dll")) // System.ValueTuple.dll is already added from the Omnisharp package
          refs += '    <Reference Include="' + line.substr(4).pathNormalize() + '" />' + os.EOL;
      }
      else if (line.startsWith("file:"))
        includes += '    <Compile Include="' + line.substr(5).pathNormalize() + '"/>' + os.EOL;

      // else if (line.startsWith('searchDir:'))
      //     includes += '    <Probing Dir="' + line.substr(10).pathNormalize() + '"/>' + os.EOL;
    });

    create_dir(proj_dir);

    let content = fs.readFileSync(csproj_template, "utf8")
      .replace('<Reference Include="$ASM$"/>', refs.trim())
      .replace('<Compile Include="$FILE$"/>', includes.trim());

    fs.writeFileSync(proj_file, content, { encoding: "utf8" });

    let launch_content = `
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "CS-Script (console)",
            "type": "mono",
            "request": "launch",
            "program": "${cscs_exe}",
            "args": ["-d", "-inmem:0", "${extra_args()}", "-ac:2", "${scriptFile}"],
            "cwd": "${path.dirname(scriptFile)}",
            "console": "internalConsole"
        }
    ]
}`;

    let launch_dir = path.join(proj_dir, ".vscode");
    utils.create_dir(launch_dir);

    fs.writeFileSync(path.join(launch_dir, "launch.json"), launch_content.pathNormalize(), { encoding: "utf8" });

    commands.executeCommand("cs-script.refresh_tree");
  }
  catch (error) {
    window.showErrorMessage(`Cannot generate project from the script. Check the //css_ref and //css_in directives.`);
    throw error;
  }
}
// -----------------------------------
export function print_project() {
  if (Utils.IsSamePath(workspace.rootPath, csproj_dir)) { // cs-script workspace
    let proj_file = path.join(csproj_dir, "script.csproj");
    let file = Utils.getScriptName(proj_file);
    print_project_for(file);
  }
  else {
    print_project_for_document();
  }
}
// -----------------------------------
export function print_project_for_document() {
  let editor = window.activeTextEditor;
  let file = editor.document.fileName;

  editor.document.save();
  outputChannel.show(true);
  outputChannel.clear();
  outputChannel.appendLine("Analyzing...");

  if (!print_project_for(file))
    outputChannel.clear();
}
// -----------------------------------
export function print_project_for(file: string): boolean {
  if (Utils.IsScript(file)) {
    with_lock(() => {
      let command = build_command(`"${cscs_exe}" -l -proj:dbg "${file}"`);

      Utils.Run(command, (code, output) => {
        let lines: string[] = output.lines().filter(actual_output);

        outputChannel.clear();
        lines.forEach((line, i) => outputChannel.appendLine(line));

        unlock();
      });
    });
    return true;
  }
  else {
    window.showErrorMessage(`"${file}" is not a valid C# script file.`);
    return false;
  }
}
// -----------------------------------
export function get_project_tree_items() {
  let lines: string[];
  let editor = window.activeTextEditor;
  let file: string;

  if (Utils.IsSamePath(workspace.rootPath, csproj_dir)) { // cs-script workspace
    let proj_file = path.join(csproj_dir, "script.csproj");
    file = Utils.getScriptName(proj_file);
  }
  else if (editor && Utils.IsScript(editor.document.fileName)) {
    file = editor.document.fileName;
    editor.document.save();
  }

  if (file) {
    if (!is_busy())
      with_lock(() => {
        // no need to include debug.cs into the view so drop the ':dbg' switch
        let output: string = Utils.RunSynch(build_command(`"${cscs_exe}" -l -proj "${file}"`));
        lines = output.lines().filter(actual_output);
        unlock();
      });
    else {
      setTimeout(() => commands.executeCommand("cs-script.refresh_tree"), 500);
    }
  }
  return lines;
}
// -----------------------------------
export function check() {
  with_lock(() => {
    let editor = window.activeTextEditor;
    let file = editor.document.fileName;

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine("Checking...");

    let command = build_command(`"${cscs_exe}" -check "${file}"`);

    // Utils.Run(command, (code, output) => {

    //     let lines = output.split(/\r?\n/g).filter(actual_output);

    //     outputChannel.clear();

    //     let errors: ErrorInfo[] = [];
    //     lines.forEach((line, i) => {
    //         outputChannel.appendLine(line);
    //         let error = ErrorInfo.parse(line);
    //         if (error && (error.severity == DiagnosticSeverity.Error || error.severity == DiagnosticSeverity.Warning)) {
    //             errors.push(error);
    //         }
    //     });

    //     Utils.SentToDiagnostics(errors);

    //     unlock();
    // });

    let cleared = false;
    Utils.Run2(
      command,

      data => {
        if (!cleared) {
          cleared = true;
          outputChannel.clear();
        }

        outputChannel.append(data);
      },

      (code, output) => {
        let lines = output.split(/\r?\n/g).filter(actual_output);

        let errors: ErrorInfo[] = [];
        lines.forEach((line, i) => {
          let error = ErrorInfo.parse(line);
          if (error && (error.severity == DiagnosticSeverity.Error || error.severity == DiagnosticSeverity.Warning)) {
            errors.push(error);
          }
        });

        Utils.SentToDiagnostics(errors);

        unlock();
      });
  });
}
// -----------------------------------
export async function find_references() {
  let editor = window.activeTextEditor;
  let document = editor.document;
  let position = editor.selection.active;

  with_lock(async () => {
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine("Resolving references...");

    if (document.languageId == "csharp" || document.languageId == "vb") {
      try {
        let data = await Syntaxer.getReferencesAsync(document.getText(), document.fileName, document.offsetAt(position));
        outputChannel.clear();

        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {
          let lines: string[] = data.lines();

          outputChannel.clear();
          outputChannel.appendLine(`${lines.length} references:`);

          lines.forEach(line => outputChannel.appendLine(line));
        }
      }
      catch (error) {
        outputChannel.clear();
      }
    }
    else {
      try {
        let locations = await commands.executeCommand("vscode.executeReferenceProvider", Uri.file(document.fileName), position);
        let lines = locations as Location[];
        outputChannel.clear();
        outputChannel.appendLine(`Found ${lines.length} references:`);

        let lastLocationFile = "";
        let lastLocationLines: string[];

        lines.forEach(location => {
          let hint = "...";

          if (lastLocationFile != location.uri.fsPath) {
            lastLocationLines = [];

            if (fs.existsSync(location.uri.fsPath)) {
              try {
                lastLocationLines = fs.readFileSync(location.uri.fsPath, "utf8").lines();
              }
              catch { }
            }
          }

          if (lastLocationLines.length > location.range.start.line)
            try {
              hint = lastLocationLines[location.range.start.line].substring(location.range.start.character);
            }
            catch { }

          outputChannel.appendLine(`${location.uri.fsPath}(${location.range.start.line + 1},${location.range.start.character + 1}): ${hint}`);
        });
      }
      catch {
        outputChannel.clear();
      }
    }
    unlock();
  });
}
// -----------------------------------
export function css_config() {
  utils.ensure_default_config(cscs_exe,
    async config_file => {

      const opts: vscode.TextDocumentShowOptions = {
        preserveFocus: true,
        preview: true,
        viewColumn: vscode.ViewColumn.Two
      };

      let mono_config = config_file;
      let net_config = config_file.replace("css_config.mono.xml", "css_config.xml");
      await commands.executeCommand("vscode.open", Uri.file(mono_config));
      await commands.executeCommand("vscode.open", Uri.file(net_config), opts);
    }
  );
}
// -----------------------------------
export function about() {
  with_lock(() => {
    // let editor = vscode.window.activeTextEditor;
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine("Analyzing...");

    let command = build_command(`"${cscs_exe}" -ver`);

    Utils.Run(command, (code, output) => {
      outputChannel.clear();
      outputChannel.appendLine("CS-Script.VSCode - v" + utils.ext_version);
      outputChannel.appendLine("-------------------------------------------------------");
      outputChannel.appendLine(output.trim());
      outputChannel.appendLine("-------------------------------------------------------");
      outputChannel.appendLine("Syntaxer");
      outputChannel.append("   " + syntaxer.SERVER);

      unlock();
    });
  });
}
// -----------------------------------

let terminal: Terminal = null;
export function run_in_terminal() {
  with_lock(() => {
    let editor = window.activeTextEditor;
    let file = editor.document.fileName;
    editor.document.save();

    if (terminal == null)
      terminal = window.createTerminal("Ext Terminal cs-script");

    let dir = path.dirname(file);

    terminal.show(false);
    terminal.sendText(`cd "${dir}"`);
    if (os.platform() == "win32")
      terminal.sendText("cls");
    terminal.sendText(build_command(`"${cscs_exe}" "${file}"`));

    unlock();
  });
}

// function test_activate(context: ExtensionContext) {
//     let terminalStack: Terminal[] = [];

//     context.subscriptions.push(commands.registerCommand('terminalTest.createTerminal', () => {
//         terminalStack.push(window.createTerminal(`Ext Terminal #${terminalStack.length + 1}`));
//     }));

//     context.subscriptions.push(commands.registerCommand('terminalTest.hide', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().hide();
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.show', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().show();
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.showPreserveFocus', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().show(true);
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.sendText', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().sendText("echo 'Hello world!'");
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.sendTextNoNewLine', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().sendText("echo 'Hello world!'", false);
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.dispose', () => {
//         if (terminalStack.length === 0) {
//             window.showErrorMessage('No active terminals');
//         }
//         getLatestTerminal().dispose();
//         terminalStack.pop();
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.createAndSend', () => {
//         terminalStack.push(window.createTerminal(`Ext Terminal #${terminalStack.length + 1}`));
//         getLatestTerminal().sendText("echo 'Sent text immediately after creating'");
//     }));

//     // Below coming in version v1.6
//     context.subscriptions.push(commands.registerCommand('terminalTest.createZshLoginShell', () => {
//         terminalStack.push((<any>window).createTerminal(`Ext Terminal #${terminalStack.length + 1}`, '/bin/zsh', ['-l']));
//     }));
//     context.subscriptions.push(commands.registerCommand('terminalTest.processId', () => {
//         (<any>getLatestTerminal()).processId.then((processId) => {
//             console.log(`Shell process ID: ${processId}`);
//         });
//     }));
//     if ('onDidCloseTerminal' in <any>window) {
//         (<any>window).onDidCloseTerminal((terminal) => {
//             console.log('Terminal closed', terminal);
//         });
//     }

//     function getLatestTerminal() {
//         return terminalStack[terminalStack.length - 1];
//     }
// }

// -----------------------------------
export function engine_help() {
  with_lock(() => {
    // let editor = vscode.window.activeTextEditor;
    // let file = editor.document.fileName;

    let command = build_command(`"${cscs_exe}" -help`);

    Utils.Run(command, (code, output) => {
      fs.writeFileSync(readme, output, { encoding: "utf8" });
      commands.executeCommand("vscode.open", Uri.file(readme));

      unlock();
    });
  });
}
// -----------------------------------
export function generate_syntax_help(force: boolean = false): string {
  let command = build_command(`"${cscs_exe}" -syntax`);
  let output = Utils.RunSynch(command);
  fs.writeFileSync(syntax_readme, output, { encoding: "utf8" });
  return output;
}
// -----------------------------------
export function new_script() {
  with_lock(() => {
    let new_file_path = path.join(user_dir(), "new_script.cs");

    let backup_file = null;
    if (fs.existsSync(new_file_path))
      backup_file = new_file_path + ".bak";

    if (backup_file && fs.existsSync(backup_file)) {
      fs.unlinkSync(backup_file);
      fs.renameSync(new_file_path, backup_file);
    }

    let backup_comment = "";
    if (backup_file)
      backup_comment =
        "// The previous content of this file has been saved into \n" +
        "// " + backup_file + " \n";

    let content = utils.prepare_new_script()
      .replace("$backup_comment$", backup_comment);

    fs.writeFileSync(new_file_path, content);

    if (fs.existsSync(new_file_path))
      commands.executeCommand("vscode.open", Uri.file(new_file_path));

    unlock();
  });
}
// -----------------------------------
export function new_script_vb() {
  with_lock(() => {
    let new_file_path = path.join(user_dir(), "new_script.vb");

    let backup_file = null;
    if (fs.existsSync(new_file_path))
      backup_file = new_file_path + ".bak";

    if (backup_file && fs.existsSync(backup_file)) {
      fs.unlinkSync(backup_file);
      fs.renameSync(new_file_path, backup_file);
    }

    let backup_comment = "";
    if (backup_file)
      backup_comment =
        "' // The previous content of this file has been saved into \n" +
        "' // " + backup_file + " \n";

    let content = utils.prepare_new_script_vb()
      .replace("$backup_comment$", backup_comment);

    fs.writeFileSync(new_file_path, content);

    if (fs.existsSync(new_file_path))
      commands.executeCommand("vscode.open", Uri.file(new_file_path));

    unlock();
  });
}
// -----------------------------------
export function build_exe() {
  with_lock(() => {
    let editor = window.activeTextEditor;
    let file = editor.document.fileName;

    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine('Building executable from the script "' + file + '"');
    outputChannel.appendLine("---------------------");

    let ext = path.extname(file);
    let exe_file = file.replace(ext, ".exe");

    let command = build_command(`"${cscs_exe}" -e "${file}"`);

    Utils.Run(command, (code, output) => {
      outputChannel.appendLine(output);
      if (fs.existsSync(exe_file))
        outputChannel.appendLine("The script is converted into executable " + exe_file);
      outputChannel.appendLine("\n[Done]");

      unlock();
    });
  });
}

var debugging = false;
// -----------------------------------
export async function debug() {

  let workspace_loaded = workspace.workspaceFolders != undefined;
  let suppress_for_workspaces = vsc_config.get("cs-script.suppress_script_debug_for_workspaces");
  let fallback_to_launch_json = vsc_config.get("cs-script.fallback_to_launch_json");

  if (workspace_loaded && !suppress_for_workspaces) {

    if (fallback_to_launch_json) {
      if (workspace.workspaceFolders != undefined) {
        // workspace is loaded so use its launch confg
        const launchFile = workspace.getConfiguration("launch");
        const configs = launchFile.get<any[]>("configurations");
        vscode.debug.onDidTerminateDebugSession(session => {
          debugging = false;
        });
        if (!debugging) {
          debugging = true;
          await vscode.debug.startDebugging(workspace.workspaceFolders[0], configs[0]);
        }
      }
    }
    return;
  }

  let editor = window.activeTextEditor;
  editor.document.save();
  if (!fs.existsSync(editor.document.fileName)) {
    window.showInformationMessage('Cannot find file "' + editor.document.fileName + '"');
    return;
  }

  with_lock(() => {
    // todo
    // + check if document is saved or untitled (and probably save it)
    // - check if process is already running
    // - read cscs location from config
    // - clear dbg output
    // - ensure running via mono (at least on Linux) - CONFIG BASED

    let config = "";
    if (os.platform() == "win32") {
      // to allow assemblies to be resolved on Windows Mono build the same way as under .NET
      let run_as_dotnet = vsc_config.get("cs-script.dotnet_run_host_on_win", false);
      if (run_as_dotnet) {
        config = `-config:css_config.xml`;
        // config = `-config:${path.join(path.dirname(cscs_exe), "css_config.xml")}`;
        // let command = `"${cscs_exe}" -ca -d -inmem:0 ${extra_args()} -ac:2 "${editor.document.fileName}"`;
        // let output: string = execSync(command).toString();
      }
    }

    // "externalConsole": "true", // shows external console. Full equivalent of Ctrl+F5 in VS.
    let debug_as_external_console = vsc_config.get(
      "cs-script.debug_as_external_console",
      false
    );

    let launchConfig = {
      name: "Launch",
      type: "mono",
      request: "launch",
      program: cscs_exe,
      externalConsole: debug_as_external_console.toString(),
      showOutput: "always",
      // mono debugger requires non-inmemory asms and injection of the breakpoint ("-ac:2)
      args: ["-d", "-inmem:0", extra_args(), config, "-ac:2", editor.document.fileName],
      env: {
        // "css_vscode_roslyn_dir": process.env.css_vscode_roslyn_dir
        // "cscs_exe_dir": path.dirname(cscs_exe)
        // "CSS_PROVIDER_TRACE": 'true'
      }
    };

    // vscode.startDebug has been deprecated
    vscode.debug.startDebugging(undefined, launchConfig).then(
      () => {
        commands.executeCommand("workbench.debug.action.focusRepl");
      },
      err => {
        window.showInformationMessage("Error: " + err.message);
      }
    );

    unlock();
  });
}
// -----------------------------------
async function getOpenEditors(): Promise<TextEditor[]> {
  const editorTracker = new ActiveEditorTracker();

  let active = window.activeTextEditor;
  let editor = active;
  const openEditors: TextEditor[] = [];

  function same(lhs: any, rhs: any): boolean {
    return lhs._id == rhs._id && lhs.viewColumn == rhs.viewColumn;
  }

  do {
    if (editor !== undefined) {
      // If we didn't start with a valid editor, set one once we find it
      if (active === undefined) {
        active = editor;
      }

      openEditors.push(editor);
    }

    editor = await editorTracker.awaitNext(500);

    if (editor !== undefined && openEditors.any(x => same(x, editor)))
      break;
  }
  while ((active === undefined && editor === undefined) || !same(active, editor));

  editorTracker.dispose();
  return openEditors;
}

export async function save_script_project(dependencies_only: boolean): Promise<void> {
  let editor = window.activeTextEditor;
  let file = editor.document.fileName;

  if (!dependencies_only) {
    editor.document.save();
  }

  let command = build_command(`"${cscs_exe}" -proj:dbg "${file}"`);
  let response = Utils.RunSynch(command);

  let dependencies = response.lines()
    .where(l => l.startsWith("file:"))
    .select(l => l.substring(5));

  // do not include current file in dirty_docs as it is either saved 10 lines above
  // or doesn't need to be saved because of `dependencies_only`
  // Note 'where' filter is case sensetive
  let dirty_docs = unsaved_documents
    .where(x => x != file)
    .select(x => x.toLocaleLowerCase());
  let relevant_files = dependencies.select(x => x.toLocaleLowerCase());

  let there_are_unsaved: boolean = relevant_files.any(x =>
    dirty_docs.contains(x)
  );

  if (there_are_unsaved) {
    let openTextEditors = await getOpenEditors();

    // openTextEditors.forEach(x => {
    //     console.log(x.document.fileName);
    // });

    // Save all opened dependency scripts. Though...
    // Unfortunately `vscode.window.openTextEditors` does not exist yet: "API Access to "Open Editors" #15178"
    // Only visibleTextEditors does. but it is useless for this tast.
    // vscode.window.openTextEditors.forEach(ed => {

    openTextEditors.forEach(ed => {
      let isActiveDoc = ed == editor;
      let tabFileName = ed.document.fileName.toLocaleLowerCase();

      if (!isActiveDoc && dependencies.any(x => x.toLocaleLowerCase() == tabFileName)) {
        ed.document.save();
      }
    });
  }
}

function build_command(raw_command: string): string {
  let command = `mono ` + raw_command;

  if (os.platform() == "win32") {
    let run_as_dotnet = vsc_config.get("cs-script.dotnet_run_host_on_win", false);
    if (run_as_dotnet) command = raw_command;
  }

  return command;
}
// -----------------------------------
export function run() {
  with_lock(async () => {
    // todo
    // - check if process is already running
    // - read cscs location from config

    let editor = window.activeTextEditor;

    let exec = require("child_process").exec;
    let showExecutionMessage = true;

    outputChannel.clear();

    let file = editor.document.fileName;
    await save_script_project(false);

    let command = build_command(`"${cscs_exe}" "${file}"`);

    if (showExecutionMessage) {
      outputChannel.appendLine("[Running] " + command);
    }

    outputChannel.show(true);

    let startTime = new Date();
    process = exec(command);
    process.stdout.on("data", data => {
      // ignore mono test output that comes from older releases(s)  (known Mono issue)
      if (!data.startsWith("failed to get 100ns ticks"))
        outputChannel.append(data);
    });

    process.stderr.on("data", data => {
      outputChannel.append(data);
    });

    process.on("close", code => {
      let endTime = new Date();
      let elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;
      outputChannel.appendLine("");
      if (showExecutionMessage) {
        outputChannel.appendLine("[Done] exited with code=" + code + " in " + elapsedTime + " seconds");
        outputChannel.appendLine("");
      }
      unlock();
    });
  });
}
// -----------------------------------

// intercepting Modifier_MouseClick https://github.com/Microsoft/vscode/issues/3130
let current_doc = "";
function onActiveEditorChange(editor: TextEditor) {
  if (editor != null) {
    // if (editor != null && editor.document.languageId == "code-runner-output") {

    // console.log('Active doc: ' + editor.document.fileName);
    current_doc = editor.document.fileName;
  }
}

// let output_line_last_click = -1;
function onActiveEditorSelectionChange(
  event: TextEditorSelectionChangeEvent
) {
  // The idea is to allow user to click the link (e.g. `script.cs (10, 23)`) printed in the output window
  // and navigate to the file location defined in the printed link.

  // In VSCode clicking file links in output is broken: https://github.com/Microsoft/vscode-go/issues/1002
  // another reason is that C# compiler output <file>(<line>,<col>) is incompatible with VSCode
  // clickable output <file>:<line>:<col>

  // Attempting to implement a work around. A good approach is to detect Ctrl being pressed and do the navigation.
  //
  // https://github.com/Microsoft/vscode/issues/3130
  // And if it is not pressed then lat it be just a simple click. However, VSCode does not let to test
  // Ctrl button state (vscode/#3130)  :o(
  //
  // Always navigating on a sinle click on a text line in the ouput window works fine but interfere with the selection operations.
  // Thus let's do navigation if no current selection is made.

  if (
    event.kind == TextEditorSelectionChangeKind.Mouse &&
    event.textEditor.document.fileName.startsWith("extension-output-") &&
    event.textEditor.selection.isEmpty
  ) {
    let enabled = vsc_config.get("cs-script.single_click_navigate_from_output", true);
    let select_whole_line = vsc_config.get("select_line_on_navigate_from_output", true);
    let single_line_in_selection = (event.textEditor.selection.start.line == event.textEditor.selection.end.line);

    // if (enabled && single_line_selection && output_line_last_click != event.textEditor.selection.start.line) {
    if (enabled && single_line_in_selection) {
      let line = event.textEditor.document.lineAt(event.textEditor.selection.start.line).text;

      let info = ErrorInfo.parse(line);

      if (info != null && fs.existsSync(info.file)) {
        let already_active = current_doc == info.file;
        if (!already_active)
          setTimeout(
            () =>
              commands
                .executeCommand("vscode.open", Uri.file(info.file))
                .then(value => {
                  let editor = window.activeTextEditor;
                  const position = editor.selection.active;

                  if (select_whole_line) {
                    select_line(info.range.start.line);
                  }
                  else {
                    let start = position.with(info.range.start.line, info.range.start.character);
                    let newSelection = new Selection(start, start);
                    editor.selection = newSelection;
                  }
                }),
            100
          );
      }
    }
    // output_line_last_click = event.textEditor.selection.start.line;
  }
}
// -----------------------------------
var unsaved_documents = [];

function add_to_unsaved(file: string): void {
  if (fs.existsSync(file)) {
    var index = unsaved_documents.indexOf(file, 0);
    if (index == -1) {
      unsaved_documents.push(file);
    }
  }
}

function remove_from_unsaved(file: string): void {
  if (fs.existsSync(file)) {
    var index = unsaved_documents.indexOf(file, 0);
    if (index > -1)
      unsaved_documents.splice(index, 1);
  }
}

function onDidSaveTextDocument(document: TextDocument) {
  if (Utils.IsSamePath(workspace.rootPath, csproj_dir)) {
    let proj_file = path.join(csproj_dir, "script.csproj");

    let scripts = Utils.getScriptFiles(proj_file);
    if (scripts.any(x => x.pathNormalize() == document.fileName.pathNormalize()))
      generate_proj_file(csproj_dir, scripts.first());
  }

  remove_from_unsaved(document.fileName);
}

function onDidCloseTextDocument(document: TextDocument) {
  remove_from_unsaved(document.fileName);
}

function onDidChangeTextDocument(documentEvent: TextDocumentChangeEvent) {
  add_to_unsaved(documentEvent.document.fileName);
}
// -----------------------------------

export function ActivateDiagnostics(context: ExtensionContext) {
  try {
    ext_context = context;
    window.onDidChangeActiveTextEditor(onActiveEditorChange);
    window.onDidChangeTextEditorSelection(onActiveEditorSelectionChange);

    workspace.onDidSaveTextDocument(onDidSaveTextDocument);
    workspace.onDidChangeTextDocument(onDidChangeTextDocument);
    workspace.onDidCloseTextDocument(onDidCloseTextDocument);

    let file = ext_context.globalState.get("cs-script.open_file_at_startup", "");

    if (file != null && file != "") {
      ext_context.globalState.update(startup_file_key, "");
      commands.executeCommand("vscode.open", Uri.file(file));
    }

    return utils.ActivateDiagnostics(context);
  }
  catch (error) {
    // console.log(error);
    window.showErrorMessage("CS-Script: " + String(error));

  }
}
// -----------------------------------
