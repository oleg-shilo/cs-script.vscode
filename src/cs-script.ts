'use strict';
import * as fs from 'fs';
import * as os from 'os';
import * as utils from "./utils";
import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { Uri, commands, DiagnosticCollection, DiagnosticSeverity } from "vscode";
import { ErrorInfo, Utils, diagnosticCollection, create_dir, actual_output, settings } from "./utils";

let ext_context: vscode.ExtensionContext;
let cscs_exe = __dirname + "/../../bin/cscs.exe";
let csproj_template = __dirname + "/../../bin/script.csproj";
let outputChannel = vscode.window.createOutputChannel('Code');
let last_process = null;

// -----------------------------------
export function load_project() {
    // bpasero commented on Apr 5, 2016
    // https://github.com/Microsoft/vscode/issues/58
    // "Note that opening a folder will replace the current running instance and this means
    // the currently executing extension host will go down and restart."
    // 
    // The described above limitation makes it impossible to open a folder and then open a file 
    // from a single routine. Thus on the first 'load_project' prepare and open the folder. And on the 
    // second request loade the project primary source foile (script)

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
            vscode.window.showErrorMessage('No active document found. Please open a C# docuemnt and try again.');
        } else {

            outputChannel.clear();
            outputChannel.appendLine("Loading OmniSharp project...");

            editor.document.save();
            generate_proj_file(proj_dir, editor.document.fileName);

            if (settings.show_load_proj_info) {

                let info_msg = "In order to activate intellisense OmniSharp project will be initialized.\n\nAfter it's done execute 'LoadProject' command again to load the script.";
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

                            setTimeout(() => commands.executeCommand('vscode.openFolder', Uri.parse(proj_dir)), 100);
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
    let proj_file = path.join(proj_dir, 'script.csproj');
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
    let proj_file = path.join(proj_dir, 'script.csproj');
    var command = 'mono "' + cscs_exe + '" -config:none -nl -l -proj -ac:1 "' + scriptFile + '"';

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

    var command = 'mono "' + cscs_exe + '" -config:none -nl -l -proj -ac:1 "' + file + '"';

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

    var command = 'mono "' + cscs_exe + '" -config:none -nl -l -check -ac:1 "' + file + '"';

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
export function on_start() {
    console.log('on_start!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
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
        "args": ["-nl", "-d", "-l", "-inmem:0", "-ac:2", "-config:none", editor.document.fileName]
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

    var command = 'mono "' + cscs_exe + '" -config:none -nl -l -ac:1 "' + file + '"';
    if (showExecutionMessage) {
        outputChannel.appendLine('[Running] ' + command);
    }

    editor.document.save();
    outputChannel.show(true);
    outputChannel.clear();

    var startTime = new Date();
    process = exec(command);
    process.stdout.on('data', data => {
        // igore mono test output that comes from older releases(s)  (known Mono issue)
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
export function ActivateDiagnostics(context: vscode.ExtensionContext) {
    ext_context = context;
    return utils.ActivateDiagnostics(context);
};
// -----------------------------------


