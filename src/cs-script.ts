'use strict';
import * as fs from 'fs';
import * as os from 'os';
import * as utils from "./utils";
import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { Uri, commands, DiagnosticCollection, DiagnosticSeverity, TextEditorSelectionChangeKind, Selection } from "vscode";
import { ErrorInfo, Utils, diagnosticCollection, actual_output, settings, VSCodeSettings, user_dir, ensure_default_config, create_dir } from "./utils";

let ext_context: vscode.ExtensionContext;
let cscs_exe = path.join(user_dir(), 'cscs.exe');
let csproj_template = __dirname + "/../../bin/script.csproj";
let outputChannel = vscode.window.createOutputChannel('Code');
let last_process = null;

// it is extremely important to keep project file name in sync with the activation event trigger in manifest file )"workspaceContains:script.csproj")
let script_proj_name = 'script.csproj';
let startup_file_key = 'cs-script.open_file_at_startup';

// -----------------------------------
export function load_project() {
    // bpasero commented on Apr 5, 2016
    // https://github.com/Microsoft/vscode/issues/58
    // "Note that opening a folder will replace the current running instance and this means
    // the currently executing extension host will go down and restart."
    // 
    // The described above limitation makes it impossible to open a folder and then open a file 
    // from a single routine. Thus on the first 'load_project' prepare and open the folder. And on the 
    // second request load the project primary source file (script)

    // Note: os.tmpdir() for some reason returns lower cased root so Utils.IsSamePath needs to be used 
    let proj_dir = path.join(os.tmpdir(), 'CSSCRIPT', 'VSCode', 'cs-script.vscode');
    let current_folder = vscode.workspace.rootPath;
    let editor = vscode.window.activeTextEditor;

    if (Utils.IsSamePath(vscode.workspace.rootPath, proj_dir)) { //already loaded
        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine("Loading script...");

        if (editor == null) {
            let scriptFile = parse_proj_dir(proj_dir);
            commands.executeCommand('vscode.open', Uri.file(scriptFile));
        }
        else {
            editor.document.save();
            generate_proj_file(proj_dir, editor.document.fileName);
        }

        setTimeout(() => outputChannel.clear(), 700);
    }
    else {
        if (editor == null) {
            vscode.window.showErrorMessage('No active document found. Please open a C# document and try again.');
        } else {

            outputChannel.clear();
            outputChannel.appendLine("Loading OmniSharp project...");

            editor.document.save();

            generate_proj_file(proj_dir, editor.document.fileName);

            // When folder is opened the whole execution context is recreated. It's like restarting VSCode.
            // Thus any attempt to openFile after calling openFolder from the same routine will lead to the folder being opened
            // but not the file.
            // As a work around indicate that the file needs to be opened at startup.
            // set_startup_file(ext_context, editor.document.fileName);
            ext_context.globalState.update(startup_file_key, editor.document.fileName);

            if (settings.show_load_proj_info) {

                let info_msg = "In order to activate intellisense an OmniSharp project will be initialized and \nthe current script file will be loaded in its context.\n\n";
                let ok_dont_show_again = "OK, Don't show this message again";
                let ok = "OK";

                vscode.window.showInformationMessage(info_msg, { modal: true }, ok, ok_dont_show_again)
                    .then(response => {
                        if (response == ok) {
                            setTimeout(() => commands.executeCommand('vscode.openFolder', Uri.parse(proj_dir)), 100);
                        }
                        else if (response == ok_dont_show_again) {
                            // VSCode doesn't allow saving settings from the extension :(
                            // let configuration = vscode.workspace.getConfiguration('cs-script');
                            // configuration.set('show_load_proj_info', false);

                            settings.show_load_proj_info = false;
                            settings.Save();

                            setTimeout(() => commands.executeCommand('vscode.openFolder', Uri.parse(proj_dir), ), 100);
                        }
                    });
            }
            else {
                setTimeout(() => commands.executeCommand('vscode.openFolder', Uri.parse(proj_dir)), 100);
            }
        }
    }
}

export function parse_proj_dir(proj_dir: string): string {
    let proj_file = path.join(proj_dir, script_proj_name);
    let prefix = '<Compile Include="';
    let suffix = '"/>';
    for (let line of fs.readFileSync(proj_file, 'utf8').split(os.EOL)) {
        line = line.trim();

        if (line.startsWith(prefix)) {
            let file = line.slice(prefix.length, -suffix.length);
            return file;
        }
    }
    return null;
}

function generate_proj_file(proj_dir: string, scriptFile: string): void {
    let proj_file = path.join(proj_dir, script_proj_name);
    var command = `mono "${cscs_exe}" -nl -l -proj:dbg "${scriptFile}"`;

    Utils.Run(command, (code, output) => {

        let lines: string[] = output.trim().lines().filter(actual_output);
        let refs = '';
        let includes = '';

        lines.forEach((line, i) => {
            if (line.startsWith('ref:'))
                refs += '<Reference Include="' + line.substr(4) + '" />' + os.EOL;
            if (line.startsWith('file:'))
                includes += '<Compile Include="' + line.substr(5) + '"/>' + os.EOL;
        });

        create_dir(proj_dir);

        let content = fs.readFileSync(csproj_template, 'utf8')
            .replace('<Reference Include="$ASM$"/>', refs)
            .replace('<Compile Include="$FILE$"/>', includes);

        fs.writeFileSync(proj_file, content, 'utf8');
    });
}
// -----------------------------------
export function print_project() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine('Analyzing...');

    var command = `mono "${cscs_exe}" -nl -l -proj:dbg "${file}"`;

    Utils.Run(command, (code, output) => {
        let lines: string[] = output.lines().filter(actual_output);

        outputChannel.clear();
        lines.forEach((line, i) => outputChannel.appendLine(line));
    });
}
// -----------------------------------
export function check() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine('Checking...');

    var command = `mono "${cscs_exe}" -nl -l -check "${file}"`;

    Utils.Run(command, (code, output) => {

        let lines = output.split(/\r?\n/g).filter(actual_output);

        outputChannel.clear();

        let errors: ErrorInfo[] = [];
        lines.forEach((line, i) => {
            outputChannel.appendLine(line);
            let error = ErrorInfo.parse(line);
            if (error && (error.severity == DiagnosticSeverity.Error || error.severity == DiagnosticSeverity.Warning)) {
                errors.push(error);
            }
        });

        Utils.SentToDiagnostics(errors);
    });
}
// -----------------------------------
export function css_config() {
    utils.ensure_default_config(cscs_exe,
        config_file =>
            commands.executeCommand('vscode.open', Uri.file(config_file)));
}
// -----------------------------------
export function about() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine('Checking...');

    // vscode.languages.getLanguages().then(l => console.log('languages', l));

    var command = `mono "${cscs_exe}" -ver`;

    Utils.Run(command, (code, output) => {
        outputChannel.clear();
        outputChannel.appendLine('CS-Script.VSCode - v' + ext_context.globalState.get('version', ''));
        outputChannel.appendLine('-------------------------------------------------------');
        outputChannel.append(output);
    });
}
// -----------------------------------

let terminal: vscode.Terminal = null;
export function run_in_terminal() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    if (terminal == null)
        terminal = vscode.window.createTerminal('Ext Terminal cs-script');

    let dir = path.dirname(file);

    terminal.show(false);
    terminal.sendText(`cd "${dir}"`);
    if (os.platform() == 'win32')
        terminal.sendText("cls");
    terminal.sendText(`mono "${cscs_exe}" -nl -l "${file}"`);
}

function test_activate(context: vscode.ExtensionContext) {
    let terminalStack: vscode.Terminal[] = [];

    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.createTerminal', () => {
        terminalStack.push(vscode.window.createTerminal(`Ext Terminal #${terminalStack.length + 1}`));
    }));

    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.hide', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().hide();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.show', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.showPreserveFocus', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().show(true);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.sendText', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().sendText("echo 'Hello world!'");
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.sendTextNoNewLine', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().sendText("echo 'Hello world!'", false);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.dispose', () => {
        if (terminalStack.length === 0) {
            vscode.window.showErrorMessage('No active terminals');
        }
        getLatestTerminal().dispose();
        terminalStack.pop();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.createAndSend', () => {
        terminalStack.push(vscode.window.createTerminal(`Ext Terminal #${terminalStack.length + 1}`));
        getLatestTerminal().sendText("echo 'Sent text immediately after creating'");
    }));

    // Below coming in version v1.6
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.createZshLoginShell', () => {
        terminalStack.push((<any>vscode.window).createTerminal(`Ext Terminal #${terminalStack.length + 1}`, '/bin/zsh', ['-l']));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminalTest.processId', () => {
        (<any>getLatestTerminal()).processId.then((processId) => {
            console.log(`Shell process ID: ${processId}`);
        });
    }));
    if ('onDidCloseTerminal' in <any>vscode.window) {
        (<any>vscode.window).onDidCloseTerminal((terminal) => {
            console.log('Terminal closed', terminal);
        });
    }

    function getLatestTerminal() {
        return terminalStack[terminalStack.length - 1];
    }
}
// -----------------------------------
export function engine_help() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    var command = `mono "${cscs_exe}" -help`;

    Utils.Run(command, (code, output) => {
        let readme = path.join(user_dir(), 'cs-script.help.txt')
        fs.writeFileSync(readme, output, 'utf8');
        commands.executeCommand('vscode.open', Uri.file(readme));
    });
}
// -----------------------------------
export function new_script() {
    var new_file_path = path.join(user_dir(), 'new_script.cs')

    let backup_file = null;
    if (fs.existsSync(new_file_path))
        backup_file = new_file_path + '.bak';

    if (backup_file && fs.existsSync(backup_file)) {
        fs.unlinkSync(backup_file);
        fs.renameSync(new_file_path, backup_file);
    }

    let backup_comment = '';
    if (backup_file)
        backup_comment =
            '// The previous content of this file has been saved into \n' +
            '// ' + backup_file + ' \n';

    let content = utils.prepare_new_script().replace('$backup_comment$', backup_comment)

    fs.writeFileSync(new_file_path, content);

    if (fs.existsSync(new_file_path))
        commands.executeCommand('vscode.open', Uri.file(new_file_path));
}
// -----------------------------------
export function Syntax() {

    // var net = require('net');

    // var client = new net.Socket();
    // client.connect(1337, '127.0.0.1', function () {
    //     console.log('Connected');
    //     client.write('Hello, server! Love, Client.');
    // });

    // client.on('data', function (data) {
    //     console.log('Received: ' + data);
    //     client.destroy(); // kill client after server's response
    // });

    // client.on('close', function () {
    //     console.log('Connection closed');
    // });
}
// -----------------------------------
export function build_exe() {

    var editor = vscode.window.activeTextEditor;
    var file = editor.document.fileName;

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();
    outputChannel.appendLine('Building executable from the script "' + file + '"');
    outputChannel.appendLine("---------------------");

    let ext = path.extname(file);
    let exe_file = file.replace(ext, '.exe');

    var command = `mono "${cscs_exe}" -nl -l -e "${file}"`;

    Utils.Run(command, (code, output) => {
        outputChannel.appendLine(output);
        if (fs.existsSync(exe_file))
            outputChannel.appendLine('The script is converted into executable ' + exe_file);
        outputChannel.appendLine("\n[Done]");
    });
}
// -----------------------------------
export function debug() {
    // todo
    // - check if document is saved or untitled (and probably save it)
    // - check if process is already running
    // - read cscs location from config
    // - clear dbg output
    // - ensure running via mono (at least on Linux) - CONFIG BASED

    var editor = vscode.window.activeTextEditor;
    let launchConfig = {
        "name": "Launch",
        "type": "mono",
        "request": "launch",
        "program": cscs_exe,
        // mono debugger requires non-inmemory asms and injection of the breakpoint ("-ac:2)
        "args": ["-nl", "-d", "-l", "-inmem:0", "-ac:2", editor.document.fileName],
        "env": {
            "css_vscode_roslyn_dir": process.env.css_vscode_roslyn_dir
        }
    };

    vscode.commands.executeCommand('vscode.startDebug', launchConfig).then(() => {
    }, err => {
        vscode.window.showInformationMessage('Error: ' + err.message);
    });
}
// -----------------------------------
export function run() {

    // todo
    // - check if document is saved or untitled (and probably save it)
    // - check if process is already running
    // - read cscs location from config
    // - ensure running via mono (at least on Linux) - CONFIG BASED

    outputChannel.appendLine("data");
    var editor = vscode.window.activeTextEditor;

    var exec = require('child_process').exec;
    var showExecutionMessage = true;

    outputChannel.clear();

    var file = editor.document.fileName;

    var command = `mono "${cscs_exe}" -nl -l "${file}"`;

    if (showExecutionMessage) {
        outputChannel.appendLine('[Running] ' + command);
    }

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();

    var startTime = new Date();
    process = exec(command);
    process.stdout.on('data', data => {
        // ignore mono test output that comes from older releases(s)  (known Mono issue)
        if (!data.startsWith('failed to get 100ns ticks'))
            outputChannel.append(data);
    });

    process.stderr.on('data', data => {
        outputChannel.append(data);
    });

    process.on('close', code => {
        //         _this._isRunning = false;
        var endTime = new Date();
        var elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;
        outputChannel.appendLine('');
        if (showExecutionMessage) {
            outputChannel.appendLine('[Done] exited with code=' + code + ' in ' + elapsedTime + ' seconds');
            outputChannel.appendLine('');
        }
    });
}
// -----------------------------------

// intercepting Modifier_MouseClick https://github.com/Microsoft/vscode/issues/3130

function onActiveEditorChange(editor: vscode.TextEditor) {
    if (editor != null) {
        const position = editor.selection.active;

        var start = position.with(2, 0);
        var end = position.with(2, 5);
        var newSelection = new vscode.Selection(start, end);
        editor.selection = newSelection;

        // console.log('Active doc: ' + editor.document.fileName);
    }
}

function onActiveEditorSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    // clicking file links in output is broken: https://github.com/Microsoft/vscode-go/issues/1002
    // another reason is that C# compiler output <file>(<line>,<col>) is incompatible with VSCode 
    // clickable output <file>:<line>:<col>

    if (event.kind == TextEditorSelectionChangeKind.Mouse &&
        event.textEditor.document.fileName.startsWith("extension-output-") &&
        event.textEditor.selection.isEmpty) {

        let enabled = VSCodeSettings.get("cs-script.single_click_navigate_from_output", true);

        if (enabled) {
            let line = event.textEditor.document.lineAt(event.textEditor.selection.start.line).text;

            let info = ErrorInfo.parse(line);
            if (info != null) {
                commands.executeCommand('vscode.open', Uri.file(info.file))
                    .then(value => {
                        let editor = vscode.window.activeTextEditor;
                        const position = editor.selection.active;

                        var start = position.with(info.range.start.line, info.range.start.character);
                        var newSelection = new vscode.Selection(start, start);
                        editor.selection = newSelection;
                    });
            }
        }
    }
}

export function ActivateDiagnostics(context: vscode.ExtensionContext) {
    ext_context = context;

    vscode.window.onDidChangeActiveTextEditor(onActiveEditorChange);
    vscode.window.onDidChangeTextEditorSelection(onActiveEditorSelectionChange);

    let file = ext_context.globalState.get('cs-script.open_file_at_startup', '');
    if (file != null) {
        ext_context.globalState.update(startup_file_key, '');
        commands.executeCommand('vscode.open', Uri.file(file));
    }

    return utils.ActivateDiagnostics(context);
};
// -----------------------------------


