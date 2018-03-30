"use strict";

/* tslint:disable */

import * as vscode from "vscode";
import * as os from "os";
// import * as fx_extra from "fs-extra";
// import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import * as fsx from "fs-extra";
// import * as child_process from "child_process"
import { StatusBarAlignment, StatusBarItem } from "vscode";

let ext_dir = path.join(__dirname, "..");
let exec = require('child_process').exec;
let execSync = require('child_process').execSync;

let mkdirp = require('mkdirp');
// let ext_context: vscode.ExtensionContext;
let min_required_mono = '5.0.1';
let ver_file: string;
// let cscs_exe: string;
let _user_dir: string;
export let statusBarItem: StatusBarItem;

let _environment_compatible = false;
let _environment_ready = false;
let _ready = false;
let _busy = false;

export let ext_version: string;
export let omnisharp_dir: string;
export let isWin: boolean = (os.platform() == 'win32');
export let settings: Settings;
export let diagnosticCollection: vscode.DiagnosticCollection;

declare global {
    interface String {
        contains(text: string): boolean;
        lines(limit?: number): string[];
        pathNormalize(): string;
    }

    interface Array<T> {
        where<T>(filter: (T) => boolean): Array<T>;
        any<T>(filter?: (T) => boolean): boolean;
        select<U>(convert: (T) => U): Array<U>;
        cast<U>(): Array<U>;
        first<T>(filter?: (T) => boolean): T;
        firstOrDefault<T>(filter?: (T) => boolean): T;
    }
}

String.prototype.lines = function (limit?: number) {
    return this.split(/\r?\n/g, limit);
}

String.prototype.contains = function (text) {
    return this.indexOf(text) >= 0;
}
String.prototype.pathNormalize = function () {
    return path.normalize(this).split(/[\\\/]/g).join(path.posix.sep);
}

Array.prototype.firstOrDefault = function <T>(predicate?): T {
    for (var index = 0; index < this.length; index++) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return element;
    }
    return null;
}
Array.prototype.first = function (predicate) {
    for (var index = 0; index < this.length; index++) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return element;
    }
    throw new Error('The collection is empty');
}

Array.prototype.where = function <T>(predicate): Array<T> {
    return this.filter(predicate);
}

Array.prototype.cast = function <U>(): Array<U> {
    return this.select(x => x as U);
}

Array.prototype.any = function <T>(predicate?): boolean {

    for (var i = 0; i < this.length; i++) {
        let item: T = this[i];
        if (predicate) {
            if (predicate(item))
                return true;
        }
        else {
            return true;
        }
    }
    return false;
}

Array.prototype.select = function <T, U>(convert: (item: T) => U): Array<U> {
    var result = [];
    for (var i = 0; i < this.length; i++) {
        var item = this[i];
        var ci = convert(item);
        result.push(ci);
    }
    return result;
};

export function with_lock(callback: () => void): void {
    if (lock())
        try {
            callback();
        } catch (error) {
            unlock();
        }
}

export function is_ready(): boolean {
    return _ready;
}

export function is_busy(): boolean {
    return _busy;
}

export function lock(): boolean {

    if (!_environment_ready) {
        if (_environment_compatible)
            vscode.window.showErrorMessage(`Cannot detect required Mono version (${min_required_mono}). Install it from http://www.mono-project.com/download/`);
        return false;
    }

    if (!_ready) {
        vscode.window.showInformationMessage('CS-Script initialization is in progress.');
        return false;
    }

    if (_busy) {
        vscode.window.showInformationMessage('CS-Script is busy.');
        return false;
    }
    _busy = true;
    return true;
}

export function unlock(): void {
    _busy = false;
}

export function create_dir(dir: string): void {
    // fs.mkdirSync can only create the top level dir but mkdirp creates all child sub-dirs that do not exist  
    const allRWEPermissions = parseInt("0777", 8);
    mkdirp.sync(dir, allRWEPermissions);
}

export function delete_dir(dir: string): void {
    try {

        let files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {

            let file_path = path.join(dir, files[i]);

            if (fs.lstatSync(file_path).isFile())
                try {
                    fs.unlinkSync(file_path);
                } catch (error) {
                }
        }

        fs.rmdir(dir);

    } catch (error) {
    }
}

export function copy_file(src: string, dest: string): void {
    fs.createReadStream(src).pipe(fs.createWriteStream(dest));
}

export function copy_file_to(fileName: string, srcDir: string, destDir: string): void {
    fs.createReadStream(path.join(srcDir, fileName))
        .pipe(fs.createWriteStream(path.join(destDir, fileName)));
}

export function copy_file_to_sync(fileName: string, srcDir: string, destDir: string): void {

    try {
        fsx.copySync(path.join(srcDir, fileName), path.join(destDir, fileName));
    } catch (error) {
        console.log(error.toString());
    }
}

export function user_dir(): string {

    // ext_context.storagePath cannot be used as it is undefined if no workspace loaded

    // vscode:
    // Windows %appdata%\Code\User\settings.json
    // Mac $HOME/Library/Application Support/Code/User/settings.json
    // Linux $HOME/.config/Code/User/settings.json

    if (!_user_dir) {
        if (os.platform() == 'win32') {
            _user_dir = path.join(process.env.APPDATA, 'Code', 'User', 'cs-script.user');
        }
        else if (os.platform() == 'darwin') {
            _user_dir = path.join(process.env.HOME, 'Library', 'Application Support', 'Code', 'User', 'cs-script.user');
        }
        else {
            _user_dir = path.join(process.env.HOME, '.config', 'Code', 'User', 'cs-script.user');
        }
    }

    create_dir(_user_dir);
    return _user_dir;
}

export function ActivateDiagnostics(context: vscode.ExtensionContext) {
    console.log("Loading CS-Script extension from " + __dirname);

    // check extension dependencies
    if (vscode.extensions.getExtension('ms-vscode.csharp') == null) {
        let message = 'CS-Script: The required extension "C# for Visual Studio Code" is not found. Ensure it is installed.';
        vscode.window.showErrorMessage(message);
        throw message;
    }

    if (vscode.extensions.getExtension('ms-vscode.mono-debug') == null) {
        let message = 'CS-Script: The required extension "Mono-Debug" is not found. Ensure it is installed.';
        vscode.window.showErrorMessage(message);
        throw message;
    }

    _environment_compatible = true;

    diagnosticCollection = vscode.languages.createDiagnosticCollection('c#');
    statusBarItem = vscode.window.createStatusBarItem(StatusBarAlignment.Left);
    context.subscriptions.push(diagnosticCollection);
    // ext_context = context;
    ext_version = vscode.extensions.getExtension('oleg-shilo.cs-script').packageJSON.version
    omnisharp_dir = path.join(vscode.extensions.getExtension('ms-vscode.csharp').extensionPath, '.omnisharp', 'omnisharp');

    ver_file = path.join(user_dir(), 'vscode.css_version.txt');
    settings = Settings.Load();

    check_environment();
    deploy_engine();

    return diagnosticCollection;
}

export function deploy_engine(): void {
    try {
        // all copy_file* calls are  async operations

        let need_to_deploy = true;

        if (fs.existsSync(ver_file)) {
            try {
                let version = fs.readFileSync(ver_file, 'utf8');
                need_to_deploy = (version != ext_version);
            } catch (error) {
            }
        }

        if (need_to_deploy) {
            statusBarItem.text = '$(versions) Deploying CS-Script...';
            statusBarItem.show();
            setTimeout(deploy_files, 100);
        }
        else {
            ensure_default_config(path.join(user_dir(), 'cscs.exe'));
            _ready = true;
            setTimeout(preload_roslyn, 100);
        }
    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage('CS-Script: ' + String(error));
    }
}

export function compare_versions(a: string, b: string): Number {
    let parts_a = a.split('.');
    let parts_b = b.split('.');

    let i = 0;
    for (; i < Math.min(parts_a.length, parts_b.length); i++) {
        let v_a = parseInt(parts_a[i]);
        let v_b = parseInt(parts_b[i]);
        if (v_a > v_b)
            return 1;
        if (v_a < v_b)
            return -1;
    }

    if (parts_a.length > parts_b.length)
        return 1;
    if (parts_a.length < parts_b.length)
        return -1;
    else
        return 0;
}

function check_environment(): void {
    try {

        // let mono_found = true;

        let command = 'mono --version';
        let output: string = execSync(command).toString();

        // Mono JIT compiler version 5.0.1 (Visual Studio built mono)
        let firstLine = output.trim().lines()[0];
        let detected_version = firstLine.split(' ')[4];

        let same_or_newer = compare_versions(detected_version, min_required_mono) >= 0;
        _environment_ready = same_or_newer;
    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage('CS-Script: ' + String(error));
    }
}

function deploy_files(): void {
    try {
        copy_file_to_sync("cscs.exe", path.join(ext_dir, 'bin'), user_dir());
        copy_file_to_sync("CSSRoslynProvider.dll", path.join(ext_dir, 'bin'), user_dir());

        if (os.platform() == 'win32')
            deploy_roslyn();

        fs.writeFileSync(ver_file, ext_version, { encoding: 'utf8' });

        ensure_default_config(path.join(user_dir(), 'cscs.exe'));

        statusBarItem.hide();

        _ready = true;

        // commands.executeCommand('cs-script.refresh_tree');

    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage('CS-Script: ' + String(error));
    }
}

export function deploy_roslyn(): void {
    // Copy all roslyn related files
    // Dest folder must be versioned as Roslyn server may stay in memory between the sessions so the
    // extension update would not be interfered with.
    let src_dir = path.join(ext_dir, 'bin', 'roslyn');
    let dest_dir = path.join(user_dir(), 'roslyn');

    // process.env.css_vscode_roslyn_dir = dest_dir;

    if (fs.existsSync(dest_dir)) {
        // let command = 'mono "' + path.join(user_dir(), 'cscs.exe') + '" -stop';
        let command = '"' + path.join(ext_dir, 'bin', 'cscs.exe') + '" -stop';
        execSync(command);

        fs.renameSync(dest_dir, dest_dir + ".old." + new Date().getTime());
        // delete old roslyn async
        fs.readdir(user_dir(), (err, items) => {
            items.forEach(item => {
                try {
                    let dir = path.join(user_dir(), item);
                    let is_dir = fs.lstatSync(dir).isDirectory();
                    if (is_dir && item.startsWith('roslyn') && item != 'roslyn') {
                        delete_dir(dir);
                    }
                } catch (error) {
                }
            });
        });
    }

    create_dir(dest_dir);

    fs.readdirSync(src_dir).forEach(file => {
        copy_file_to_sync(file, src_dir, dest_dir); // async operation
    });

}

export function prepare_new_script(): string {
    let template_file = path.join(user_dir(), 'new_script.tmpl');

    let template =
        'using System;' + os.EOL +
        '$backup_comment$' + os.EOL +
        'class Script' + os.EOL +
        '{' + os.EOL +
        '    static void Main(string[] args)' + os.EOL +
        '    {' + os.EOL +
        '        Console.WriteLine("Hello...");' + os.EOL +
        '    }' + os.EOL +
        '}';

    if (!fs.existsSync(template_file))
        fs.writeFileSync(template_file, template, { encoding: 'utf8' });

    try {
        template = fs.readFileSync(template_file, { encoding: 'utf8' });
    } catch (error) {
    }

    return template
}

export function clear_temp_file_suffixes(content: string): string {
    // "c:\Users\<user>\AppData\Roaming\Code\User\cs-script.user\new_script.$temp$.cs(16,9): Test();
    return content.replace(/.\$temp\$/g, '');
}

export function select_line(line: number): void {
    let editor = vscode.window.activeTextEditor;
    if (line != -1) {
        editor.selection = new vscode.Selection(line, editor.document.lineAt(line).text.length, line, 0);
        editor.revealRange(editor.selection);
    }
}

export function save_as_temp(content: string, script_file: string): string {

    let dir = path.dirname(script_file);
    let ext = path.extname(script_file);
    let name = path.basename(script_file, ext);

    let temp_file = path.join(dir, name + '.$temp$' + ext);

    fs.writeFileSync(temp_file, content, { encoding: 'utf8' });

    return temp_file;
}


export class ErrorInfo {
    public file: string;
    public description: string;
    public range: vscode.Range;
    public severity: vscode.DiagnosticSeverity;

    public static parse(data: string): ErrorInfo {
        // E:\dev\Projects\VSCode\test2.cs(19,11): error CS1525: Unexpected symbol `.', expecting `,', `;', or `='
        // csscript.CompilerException: c:\Users\user\Desktop\New Script.cs(12,17): error CS0029: Cannot implicitly convert type `string' to `int'

        let result = new ErrorInfo();
        try {

            let cs_script_prefixes = ["csscript.CompilerException: ", "file:"];
            cs_script_prefixes.forEach(element => {
                if (data.startsWith(element))
                    data = data.replace(element, '').trim();
            });

            let parts = data.split(/\):/g, 2);

            if (parts.length != 2) {
                if (fs.existsSync(parts[0])) {
                    result.file = clear_temp_file_suffixes(parts[0]);
                    result.range = new vscode.Range(0, 0, 0, 0);
                }
                else {
                    return null;
                }
            }
            else {
                result.description = parts[1].trim();

                parts = parts[0].split('(');
                result.file = parts[0];

                let nums = parts[1].split(',', 2).map(x => Number(x));
                result.range = new vscode.Range(nums[0] - 1, nums[1] - 1, nums[0] - 1, nums[1] - 1);

                parts = result.description.split(' ');
                result.description = parts.slice(1).join(' ');
                if (parts[0] == "error")
                    result.severity = vscode.DiagnosticSeverity.Error;
                else if (parts[0] == "warning")
                    result.severity = vscode.DiagnosticSeverity.Warning;
                if (parts[0] == "info")
                    result.severity = vscode.DiagnosticSeverity.Information;
            }
        } catch (e) {
            return null;
        }
        return result;
    }

    public constructor(fields?: {
        file?: string,
        description?: string,
        range?: vscode.Range;
        severity?: vscode.DiagnosticSeverity;
    }) {
        if (fields) Object.assign(this, fields);
    }
}

export class VSCodeSettings {
    public static get<T>(section_value: string, defaultValue?: T): T {
        let tokens = section_value.split('.')
        return vscode.workspace.getConfiguration(tokens[0]).get(tokens[1], defaultValue);
    }
}

// Writable extension settings
export class Settings {

    public show_load_proj_info: boolean = true;
    public show_readme: boolean = true;

    private _file: string;

    public Save(file?: string) {

        let file_path = path.join(user_dir(), 'settings.json');

        if (file != null) file_path = file;
        else if (this._file != null) file_path = this._file;

        fs.writeFile(file_path, JSON.stringify(this), { encoding: 'utf8' })
    }

    public static Load(file?: string) {

        let file_path = path.join(user_dir(), 'settings.json');
        if (file != null) file_path = file;

        let settings: Settings;

        try {
            settings = JSON.parse(fs.readFileSync(file_path, 'utf8'));
        }
        catch (e) {
            settings = new Settings();
        }

        settings._file = file_path;
        return settings;
    }

    // alternative approach
    // let config = ext_context.globalState;
    // let val = config.get("show_load_proj_info", true);
    // config.update("show_load_proj_info", true);
}

export class Utils {

    public static IsScript(file: string): boolean {
        if (file == undefined)
            return false;
        else
            return file.toLowerCase().endsWith('.cs');
    }

    public static getScriptName(projectFile: string): string {
        if (fs.existsSync(projectFile)) {
            let lines = fs.readFileSync(projectFile, 'utf8').lines();
            for (var line of lines) {
                if (line.contains('Compile')) {
                    return line.trim()
                        .replace('<Compile Include="', '')
                        .replace('"/>', '');
                }
            }
        }
        return null;
    }

    public static getScriptFiles(projectFile: string): string[] {
        let files: string[] = []
        if (fs.existsSync(projectFile)) {
            let lines = fs.readFileSync(projectFile, 'utf8').lines();
            for (var line of lines) {
                if (line.contains('Compile')) {
                    files.push(line.trim()
                        .replace('<Compile Include="', '')
                        .replace('"/>', ''));
                }
            }
        }
        return files;
    }

    // public static getSearchDirs(projectFile: string): string[] {

    //     let dirs = [];

    //     if (fs.existsSync(projectFile)) {
    //         let lines = fs.readFileSync(projectFile, 'utf8').lines();
    //         for (var line of lines) {
    //             if (line.contains('Probing')) {
    //                 dirs.push(line.trim()
    //                     .replace('<Probing Dir="', '')
    //                     .replace('"/>', ''));
    //             }
    //         }
    //     }
    //     return dirs;
    // }

    public static IsSamePath(abs_path1: string, abs_path2: string): boolean {

        if (abs_path1 != null && abs_path2 != null) {
            if (path.sep == "\\")
                return (abs_path1.toLowerCase() == abs_path2.toLowerCase()); // Windows
            else
                return (abs_path1 == abs_path2); // POSIX
        }

        return false;
    }

    public static SentToDiagnostics(errors: ErrorInfo[]) {

        diagnosticCollection.clear();

        let diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

        errors.forEach(error => {

            let fileUri = vscode.Uri.file(error.file);
            let canonicalFile = fileUri.toString();

            let diagnostics = diagnosticMap.get(canonicalFile);
            if (!diagnostics) { diagnostics = []; }

            diagnostics.push(new vscode.Diagnostic(error.range, error.description, error.severity));
            diagnosticMap.set(canonicalFile, diagnostics);

            diagnosticMap.forEach((diags, file) => {
                diagnosticCollection.set(fileUri, diags);
            });
        });
    }

    public static RunSynch(command: string): string {
        return execSync(command).toString();
    }

    public static Run(command: string, on_done?: (number, string) => void) {

        let output: string = '';

        let p = exec(command);
        p.stdout.on('data', data => output += data);
        p.stderr.on('data', data => output += data);
        p.on('close', code => {
            if (on_done) on_done(code, output);
        });
    }
}

export function preload_roslyn() {
    try {

        let exe = path.join(user_dir(), 'cscs.exe');
        let command = 'mono "' + exe + '" -nl -preload';
        Utils.Run(command);

    } catch (error) {
    }
}
export function ensure_default_config(cscs_exe: string, on_done?: (file: string) => void) {

    let config_file = path.join(path.dirname(cscs_exe), 'css_config.mono.xml');

    if (!fs.existsSync(config_file)) {

        // deployed file may still be unavailable so use the original one

        let original_cscs_exe = path.join(ext_dir, 'bin', 'cscs.exe');
        let command = 'mono "' + original_cscs_exe + '" -config:default';

        Utils.Run(command, (code, output) => {

            // C:\Program Files (x86)\Mono\lib\mono\4.5\Facades</searchDirs>

            let updated_config = output
                .replace("</defaultArguments>", " -ac:1</defaultArguments>")
                .replace("</searchDirs>", "%MONO%/4.5/Facades</searchDirs>")
                .replace("</defaultRefAssemblies>", "System.dll;System.ValueTuple.dll</defaultRefAssemblies>")
                .replace("<useAlternativeCompiler></useAlternativeCompiler>", "<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>");

            fs.writeFileSync(config_file, updated_config, { encoding: 'utf8' });

            if (os.platform() == 'win32') {
                let config_file_win = path.join(path.dirname(cscs_exe), 'css_config.xml');
                let updated_config = output
                    .replace("</defaultArguments>", " -ac:1</defaultArguments>")
                    .replace("</searchDirs>", "%cscs_exe_dir%/roslyn</searchDirs>")
                    // after .NET4.7 referencing System.dll;System.ValueTuple.dll is no longer required
                    // .replace("</defaultRefAssemblies>", "System.dll;System.ValueTuple.dll</defaultRefAssemblies>") 
                    .replace("<useAlternativeCompiler></useAlternativeCompiler>", "<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>");

                fs.writeFileSync(config_file_win, updated_config, { encoding: 'utf8' });
            }

            if (on_done)
                on_done(config_file);
        });

    }
    else {
        if (on_done)
            on_done(config_file);
    }
}

export function actual_output(element, index, array) {
    // ignore mono test output that comes from older releases(s)  (known Mono issue)
    return (!element.startsWith('failed to get 100ns ticks'));
}


// let SYNTAXER_VERSION = "1.2.2.0";

// let SEVER = ""; // will be set at the end of this file
// let HOST = '127.0.0.1';
// let PORT = 18002;

// function startServer():void{
// 	child_process.execFile("mono", [SEVER, "-port:" + PORT, "-listen", "-client:" + process.pid, "-timeout:60000"]);
// }


// export class Syntaxer {

//     public static send(request: string, on_data: (data: string) => void, on_error: (error: any) => void): void {

//         var client = new net.Socket();
//         client.connect(PORT, HOST, function () {
//             // let request = "-client:" + process.pid + "\n-op:codemap_vscode\n-script:" + file;
//             client.write(request);
//         });

//         client.on('error', function (error) {
//             if (fs.existsSync(SEVER)) { // may not be deployed yet
//                 // child_process.execFile(SEVER, SEVER_CMD);
//                 startServer();
//                 // setTimeout(() => vscode.commands.executeCommand('codemap.refresh'), 500);
//                 on_error("Syntaxer server is not ready yet...");
//             }
//             else{
//                 on_error(error.toString());
//             }
//         });

//         client.on('data', function (data) {
//             on_data(data.toString())
//             client.destroy();
//         });
//     }
// }