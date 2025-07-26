"use strict";

/* tslint:disable */

import * as fs from "fs";
import * as os from "os";
import * as utils from "./utils";
// import * as syntaxer from "./syntaxer";
import * as vscode from "vscode";
import * as path from "path";
import { Uri, commands, DiagnosticSeverity, TextEditorSelectionChangeKind, Location, window, TextEditor, workspace, TextEditorSelectionChangeEvent, Selection, TextDocument, TextDocumentChangeEvent, ExtensionContext } from "vscode";
import { ErrorInfo, Utils, unlock, is_busy, with_lock, actual_output, settings, vsc_config, user_dir, create_dir, ext_dir, select_line, ActiveEditorTracker } from "./utils";
import { Syntaxer } from "./syntaxer";

export let syntax_readme: string = path.join(user_dir(), 'dotnet', "cs-script.syntax.txt");
let ext_context: ExtensionContext;
let cscs_exe: string = path.join(user_dir(), 'dotnet', "cscs.dll");
let readme: string = path.join(user_dir(), 'dotnet', "cs-script.help.txt");
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

        let workspaceIsAlreadyLoaded = workspace.workspaceFolders != null && Utils.IsSamePath(workspace.workspaceFolders![0].uri.fsPath ?? '', csproj_dir);

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
                        commands.executeCommand("vscode.open", Uri.file(scriptFile!));
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
                                setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.file(csproj_dir)), 100); // Uri.parse does not work with path but requires schema
                            }
                            else if (response == ok_dont_show_again) {
                                // VSCode doesn't allow saving settings from the extension :(
                                // let configuration = vscode.workspace.getConfiguration('cs-script');
                                // configuration.set('show_load_proj_info', false);

                                settings.show_load_proj_info = false;
                                utils.Settings.Save(settings);

                                setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.file(csproj_dir)), 100);
                            }
                        });
                }
                else {
                    setTimeout(() => commands.executeCommand("vscode.openFolder", Uri.file(csproj_dir)), 100);
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

        let command = `dotnet "${settings.cscs}" -proj:csproj "${scriptFile}"`;

        let output = Utils.RunSynch(command);

        let lines: string[] = output
            .trim()
            .lines()
            .filter(actual_output)
            .filter(obj => obj.startsWith('project:'));

        // proj_dir:"C:\Users\user\AppData\Roaming\Code\User\cs-script.user\"
        // lines[0]:"project:C:\cs-script\sample.csproj"

        let src_proj_file = lines[0].replace("project:", "");
        let proj_name = "script" + path.extname(src_proj_file);
        let src_proj_dir = path.dirname(src_proj_file);

        let src_vscode_dir = path.join(ext_dir, 'bin', 'dotnet', '.vscode');

        create_dir(proj_dir);

        utils.copy_file_to_sync2(path.basename(src_proj_file), proj_name, src_proj_dir, proj_dir);
        utils.copy_dir_to_sync(src_vscode_dir, path.join(proj_dir, '.vscode'));

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
    let file = editor?.document.fileName;

    editor?.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine("Analyzing...");

    if (!print_project_for(file))
        outputChannel.clear();
}
// -----------------------------------
export function print_project_for(file: string | undefined): boolean {
    if (Utils.IsScript(file)) {
        with_lock(() => {
            let command = `dotnet "${settings.cscs}" -l -proj:dbg "${file}"`;

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
        window.showErrorMessage(`"${file}" is not a valid C# script file. Ensure that the active document is a C# script file.`);
        return false;
    }
}
// -----------------------------------
export function get_project_tree_items() {
    let lines: string[] = [];
    let editor = window.activeTextEditor;
    let file: string = "";

    if (Utils.IsSamePath(workspace.rootPath, csproj_dir)) { // cs-script workspace
        let proj_file = path.join(csproj_dir, "script.csproj");
        file = Utils.getScriptName(proj_file);
    }
    else if (editor && Utils.IsScript(editor.document.fileName)) {
        file = editor.document.fileName;
        editor.document.save();
    }

    if (file != "") {
        if (!is_busy())
            with_lock(() => {
                // no need to include debug.cs into the view so drop the ':dbg' switch

                let command = `dotnet "${settings.cscs}"  -l -proj "${file}"`;

                let output: string = Utils.RunSynch(command);
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
        let editor = window.activeTextEditor!;
        let file = editor?.document.fileName;

        editor.document.save();
        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine("Checking...");


        let extra_args = vsc_config.get("cs-script.extra_args");

        let command = `dotnet "${settings.cscs}" ${extra_args} -check "${file}"`;

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
    let document = editor!.document;
    let position = editor!.selection.active;

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

    utils.ensure_default_core_config(settings.cscs,
        config_file => {
            commands.executeCommand("vscode.open", Uri.file(config_file));
        });
}
// -----------------------------------
export function about() {
    with_lock(() => {
        // let editor = vscode.window.activeTextEditor;
        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine("Analyzing...");

        let command = `dotnet "${settings.cscs}" -ver`;

        Utils.Run(command, (code, output) => {
            outputChannel.clear();
            outputChannel.appendLine("CS-Script.VSCode - v" + utils.ext_version);
            outputChannel.appendLine("-------------------------------------------------------");
            outputChannel.appendLine("Script engine: v" + output.trim());
            outputChannel.appendLine("-------------------------------------------------------");
            outputChannel.appendLine("Syntaxer");
            outputChannel.appendLine("   " + settings.syntaxer);
            outputChannel.appendLine("Extension");
            outputChannel.appendLine("   " + __dirname);

            unlock();
        });
    });
}
// -----------------------------------


export function run_in_terminal() {
    with_lock(() => {
        let editor = window.activeTextEditor!;
        let file = editor.document.fileName;
        editor.document.save();

        let css_terminalName = "Ext Terminal cs-script";
        let terminal = vscode.window.terminals.find(term => term.name === css_terminalName);

        if (terminal == null)
            terminal = window.createTerminal(css_terminalName);

        let dir = path.dirname(file);

        terminal.show(false);
        terminal.sendText(`cd "${dir}"`);
        if (os.platform() == "win32")
            terminal.sendText("cls");

        let extra_args = vsc_config.get("cs-script.extra_args");
        if (extra_args != '') extra_args += " ";

        if (settings.is_global_css)
            terminal.sendText(`css ${extra_args}"${file}"`);
        else
            terminal.sendText(`dotnet "${settings.cscs}"${extra_args} "${file}"`);

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

        let command = `dotnet "${settings.cscs}" -help`;

        Utils.Run(command, (code, output) => {
            fs.writeFileSync(readme, output, { encoding: "utf8" });
            commands.executeCommand("vscode.open", Uri.file(readme));

            unlock();
        });
    });
}
// -----------------------------------
export function generate_syntax_help(force: boolean = false): string {

    let command = `dotnet "${settings.cscs}" -syntax`;

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

        let command = `dotnet "${settings.cscs}" -new:toplevel \"${new_file_path}\"`;

        Utils.RunSynch(command);

        if (fs.existsSync(new_file_path)) {
            let content = fs.readFileSync(new_file_path, { encoding: 'utf8' });

            let backup_comment = "";
            if (backup_file)
                backup_comment =
                    "// The previous content of this file has been saved into \n" +
                    "// " + backup_file + " \n\n";

            content = backup_comment + content;

            fs.writeFileSync(new_file_path, content);

            if (fs.existsSync(new_file_path))
                commands.executeCommand("vscode.open", Uri.file(new_file_path));
        }
        unlock();
    });
}
// -----------------------------------
// export function new_script_vb() {
//     with_lock(() => {

//         vscode.window.showErrorMessage(
//             "Executing VB.NET scripts is only supported for C# script hosted on Mono but this version CS-Script extension is configured to be run on .NET 5/.NET Core. VB support will be available in teh future releases");
//         return;

//         let new_file_path = path.join(user_dir(), "new_script.vb");

//         let backup_file = null;
//         if (fs.existsSync(new_file_path))
//             backup_file = new_file_path + ".bak";

//         if (backup_file && fs.existsSync(backup_file)) {
//             fs.unlinkSync(backup_file);
//             fs.renameSync(new_file_path, backup_file);
//         }

//         let backup_comment = "";
//         if (backup_file)
//             backup_comment =
//                 "' // The previous content of this file has been saved into \n" +
//                 "' // " + backup_file + " \n";

//         let content = utils.prepare_new_script_vb()
//             .replace("$backup_comment$", backup_comment);

//         fs.writeFileSync(new_file_path, content);

//         if (fs.existsSync(new_file_path))
//             commands.executeCommand("vscode.open", Uri.file(new_file_path));

//         unlock();
//     });
// }
// -----------------------------------
export function build_exe() {
    with_lock(() => {

        let editor = window.activeTextEditor!;
        let file = editor.document.fileName;

        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine('Building executable from the script "' + file + '"');
        outputChannel.appendLine("---------------------");

        let command = `dotnet "${cscs_exe}" -e "${file}"`;

        Utils.Run(command, (code, output) => {
            outputChannel.appendLine(output);
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
                // workspace is loaded so use its launch config
                const launchFile = workspace.getConfiguration("launch");
                const configs = launchFile.get<any[]>("configurations");
                vscode.debug.onDidTerminateDebugSession(session => {
                    debugging = false;
                });
                if (!debugging) {
                    debugging = true;
                    await vscode.debug.startDebugging(workspace.workspaceFolders[0], configs![0]);
                }
            }
        }
        return;
    }

    let editor = window.activeTextEditor!;
    editor.document.save();
    if (!fs.existsSync(editor.document.fileName)) {
        window.showInformationMessage('Cannot find file "' + editor.document.fileName + '"');
        return;
    }

    with_lock(() => {

        let launchConfig = {
            name: ".NET Core Launch (console)",
            type: "coreclr",
            request: "launch",
            program: "dotnet",
            args: [settings.cscs, "-d", extra_args().replace("-co:/debug:pdbonly", ""), vsc_config.get("cs-script.extra_args"), "", "-l", "-ac:2", editor.document.fileName],
            cwd: path.dirname(editor.document.fileName),
            console: "internalConsole",
            stopAtEntry: false
        }

        // vscode.startDebug has been deprecated
        vscode.debug.startDebugging(undefined, <vscode.DebugConfiguration>launchConfig).then(
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
    let editor = window.activeTextEditor!;
    let file = editor.document.fileName;

    if (!dependencies_only) {
        editor.document.save();
    }

    let command = `dotnet "${settings.cscs}" -proj:dbg "${file}"`;

    let response = Utils.RunSynch(command);

    let dependencies = response.lines()
        .where<string>(l => l.startsWith("file:"))
        .select(l => l.substring(5));

    // do not include current file in dirty_docs as it is either saved 10 lines above
    // or doesn't need to be saved because of `dependencies_only`
    // Note 'where' filter is case sensitive
    let dirty_docs = unsaved_documents
        .where<string>(x => x != file)
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
        // Only visibleTextEditors does. but it is useless for this test.
        // vscode.window.openTextEditors.forEach(ed => {

        openTextEditors.forEach(ed => {
            let isActiveDoc = ed == editor;
            let tabFileName = ed.document.fileName.toLocaleLowerCase();

            if (!isActiveDoc && dependencies.any<string>(x => x.toLocaleLowerCase() == tabFileName)) {
                ed.document.save();
            }
        });
    }
}

// -----------------------------------
export function reset_busy() {
    unlock();
}

export function redeploy() {
    utils.integrate();
}

export function start_build_server() {
    // `-speed` is great for starting the build server
    // if build server is enabled then this command will start it; if it is already started, then it will simply exit right away.
    // if it is not enabled then the command will be executed without starting the server and exit right away. 
    let exec = require("child_process").exec;
    let command = `dotnet "${settings.cscs}" -speed`;
    exec(command);
}

export function run() {
    with_lock(async () => {
        // todo
        // - check if process is already running
        // - read cscs location from config

        let editor = window.activeTextEditor!;

        let exec = require("child_process").exec;
        let showExecutionMessage = true;

        outputChannel.clear();

        let file = editor.document.fileName;
        await save_script_project(false);

        let extra_args = vsc_config.get("cs-script.extra_args");
        if (extra_args != '') extra_args += " ";

        let command = settings.is_global_css ? 'css' : `dotnet "${settings.cscs}"`;
        command += ` ${extra_args}"${file}"`;

        if (showExecutionMessage) {
            outputChannel.appendLine("[Running] " + command);
        }

        outputChannel.show(true);

        let startTime = new Date();
        let p = exec(command);
        p.stdout.on("data", (data: string) => {
            // ignore mono test output that comes from older releases(s)  (known Mono issue)
            if (!data.startsWith("failed to get 100ns ticks"))
                outputChannel.append(data);
        });

        p.stderr.on("data", (data: string) => {
            outputChannel.append(data);
        });

        p.on("close", (code: any) => {
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
function onActiveEditorChange(editor: TextEditor | undefined) {
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
    // Always navigating on a single click on a text line in the output window works fine but interfere with the selection operations.
    // Thus let's do navigation if no current selection is made.

    if (event.kind == TextEditorSelectionChangeKind.Mouse &&
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
                                    let editor = window.activeTextEditor!;
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
    }
}
// -----------------------------------
var unsaved_documents: string[] = [];

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
        if (scripts.any<string>(x => x.pathNormalize() == document.fileName.pathNormalize()))
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

        utils.ActivateDiagnostics(context);

        start_build_server();
    }
    catch (error) {
        window.showErrorMessage("CS-Script: " + String(error));
    }
}
// -----------------------------------
