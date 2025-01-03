"use strict";

/* tslint:disable */

import * as vscode from "vscode";
import * as os from "os";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import * as fsx from "fs-extra";
import * as child_process from "child_process";
import { StatusBarAlignment, StatusBarItem, TextEditor, window, Disposable, commands, MarkdownString, ParameterInformation, SignatureInformation, Uri } from "vscode";
import { start_syntaxer, stop_syntaxer, Syntaxer } from "./syntaxer";
import { start_build_server } from "./cs-script";

let outputChannel = vscode.window.createOutputChannel("CS-Script");

export class vsc_config {
    public static get<T>(section_value: string, defaultValue?: T): T {
        let tokens = section_value.split('.')
        return vscode
            .workspace
            .getConfiguration(tokens[0])
            .get(tokens[1], defaultValue) as T;
    }

    public static set<T>(section_value: string, value?: T): void {
        let tokens = section_value.split('.')
        vscode
            .workspace
            .getConfiguration(tokens[0])
            .update(tokens[1], value);
    }
}

export let ext_dir = path.join(__dirname, "..");
let exec = require('child_process').exec;
let execSync = require('child_process').execSync;

let mkdirp = require('mkdirp');
let _user_dir: string;
export let statusBarItem: StatusBarItem;

// let _environment_compatible = false;
let _environment_ready = false;
let _ready = false;
let _busy = false;

export let ext_version: string;
export let omnisharp_dir: string;
export let isWin: boolean = (os.platform() == 'win32');
export let settings: Settings;
export let diagnosticCollection: vscode.DiagnosticCollection;

let sources_temp_dir = path.join(os.tmpdir(), "Roslyn.Intellisense", "sources");
create_dir(sources_temp_dir);

declare global {
    interface String {
        contains(text: string): boolean;
        lines(limit?: number): string[];
        pathNormalize(): string;
    }

    interface Array<T> {
        where<T>(filter: (arg0: T) => boolean): Array<T>;
        any<T>(filter?: (arg0: T) => boolean): boolean;
        contains<T>(item: T): boolean;
        select<U>(convert: (arg0: T) => U): Array<U>;
        cast<U>(): Array<U>;
        first<T>(filter?: (arg0: T) => boolean): T;
        firstOrDefault<T>(filter?: (arg0: T) => boolean): T;
        last<T>(filter?: (arg0: T) => boolean): T;
        remove<T>(item: T): Array<T>;
        lastOrDefault<T>(filter?: (arg0: T) => boolean): T;
    }
}

String.prototype.lines = function (limit?: number) {
    return this.split(/\r?\n/g, limit);
}

String.prototype.contains = function (text) {
    return this.indexOf(text) >= 0;
}
String.prototype.pathNormalize = function () {
    // zos
    return path.normalize(this.toString()).split(/[\\\/]/g).join(path.posix.sep);
}

// "cscs_path" and "syntaxer_path" are special fields of the settings object that are not to be saved in the settings.json file.
// This is because they are derived from the global settings and not the plugin settings.
// These fields are because they have to be saved in the VSCode settings as user needs to be able to modify these fields (as opposite to the rest ov the fields).
// And yet these fields are in the Settings object because they are to be accessed by the extension the same way as any other fields.
export function UpdateFromJSON(target, json) {
    var obj = JSON.parse(json, (key, value) => {
        // Exclude the 'password' field
        if (key === "cscs_path" || key === "syntaxer_path") {
            return undefined;
        }
        return value;
    });

    for (var prop in obj)
        target[prop] = obj[prop];
    return target;
}
export function ToJSON(target) {
    return JSON.stringify(target, (key, value) => {
        // Exclude the 'password' field
        if (key === "cscs_path" || key === "syntaxer_path") {
            return undefined;
        }
        return value;
    });
}

// --------------------
// LINQ - light equivalent
Array.prototype.firstOrDefault = function <T>(predicate: any): T {
    for (var index = 0; index < this.length; index++) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return element;
    }
    return null!;
}
Array.prototype.first = function <T>(predicate: any): T {
    for (var index = 0; index < this.length; index++) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return element;
    }
    throw new Error('The collection is empty');
}

Array.prototype.last = function <T>(predicate: any): T {
    for (var index = this.length - 1; index >= 0; index--) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return element;
    }
    throw new Error('The collection is empty');
}

Array.prototype.lastOrDefault = function <T>(predicate: any): T {
    for (var index = this.length - 1; index >= 0; index--) {
        var element = this[index];
        if (predicate == null || predicate(element))
            return <T>element;
    }
    return null!;
}

Array.prototype.remove = function <T>(item: T): Array<T> {
    while (true) {
        var index = this.indexOf(item, 0);
        if (index > -1)
            this.splice(index, 1);
        else
            break;
    }
    return this;
}
Array.prototype.where = function <T>(predicate: any): Array<T> {
    return this.filter(predicate);
}

Array.prototype.cast = function <U>(): Array<U> {
    return this.select(x => x as U);
}

Array.prototype.contains = function <T>(item: T): boolean {
    return this.any(x => x == item);
}

Array.prototype.any = function <T>(predicate: any): boolean {

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
// -----------------
export function with_lock(callback: () => void): void {
    if (lock())
        try {
            callback();
        } catch (error) {
            unlock();
        }
}

export function get_line_indent(text: string): number {
    let line_indent = 0;
    let curr_line = text;
    for (; line_indent < curr_line.length; line_indent++) {
        if (curr_line.charAt(line_indent) != " ")
            break;
    }
    return line_indent;
}

export function css_unescape_linebreaks(text: string, eol: string = "\n"): string {
    return text.replace(/\${r}\${n}/g, "\n").replace(/\${n}/g, eol);
}
export function is_ready(): boolean {
    return _ready;
}

export function is_busy(): boolean {
    return _busy;

}

export function run_async(callback: (...args: any[]) => void): void {
    setTimeout(callback, 100);
}

export function lock(): boolean {

    if (!_environment_ready) {
        return false;
    }

    if (!_ready) {
        vscode.window.showInformationMessage('CS-Script initialization is in progress.');
        return false;
    }

    if (_busy) {

        let resetStatus = "Reset the busy status";

        vscode.window.showInformationMessage('CS-Script is busy. Often the reason for this is the running script that takes longer than expected. ' +
            'It is safe to reset the status and try again if you do not want to wait.', resetStatus)
            .then(selection => {

                if (selection === resetStatus) {
                    commands.executeCommand("cs-script.reset_busy");
                }
            });

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

export function delete_dir(dir: string): boolean {
    let success = true;
    try {


        let files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {

            let item_path = path.join(dir, files[i]);

            if (fs.lstatSync(item_path).isFile())
                try {
                    fs.unlinkSync(item_path);
                } catch (error) {
                    success = false;
                    console.log(error);
                }
            else
                delete_dir(item_path);
        }
        fs.rmdir(dir, () => { });
    } catch (error) {
        success = false;
        console.log(error);
    }
    return success;
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

export function copy_dir_to_sync(srcDir: string, destDir: string): void {

    try {
        fsx.copySync(srcDir, destDir);
    } catch (error) {
        console.log(error.toString());
    }
}

export function copy_file_to_sync2(fileName: string, newFileName: string, srcDir: string, destDir: string): void {

    try {
        fsx.copySync(path.join(srcDir, fileName), path.join(destDir, newFileName));
    } catch (error) {
        console.log(error.toString());
    }
}

export function del_file(filePath: string): void {
    fs.unlink(
        filePath,
        err => {
            if (err) console.log(err);
        });
}

export function user_dir(): string {

    // ext_context.storagePath cannot be used as it is undefined if no workspace loaded

    // vscode:
    // Windows %appdata%\Code\User\settings.json
    // Mac $HOME/Library/Application Support/Code/User/settings.json
    // Linux $HOME/.config/Code/User/settings.json

    // extension location:
    //   portable:  <VSCode-dir>\data\extensions\oleg-shilo.cs-script-1.5.9\out
    //   installed: c:\Users\<user>\.vscode\extensions\oleg-shilo.cs-script-1.5.9\out
    //   debug:     <repo>\Projects\cs-script.vscode\out"

    let extensionRoot = path.dirname(path.dirname(path.dirname(__dirname)));
    let isPortable = path.basename(extensionRoot).toLowerCase() == "data" || path.basename(extensionRoot).toLowerCase() == "code-portable-data";

    if (!_user_dir) {

        if (isPortable) {
            _user_dir = path.join(extensionRoot, 'user-data', 'cs-script.user');
        } else {
            if (os.platform() == 'win32') { // win
                _user_dir = path.join(process.env.APPDATA!, 'Code', 'User', 'cs-script.user');
            }
            else if (os.platform() == 'darwin') { // mac
                _user_dir = path.join(process.env.HOME!, 'Library', 'Application Support', 'Code', 'User', 'cs-script.user');
            }
            else { // linux
                _user_dir = path.join(process.env.HOME!, '.config', 'Code', 'User', 'cs-script.user');
            }
        }
    }

    create_dir(_user_dir);
    return _user_dir;
}

function check_syntaxer_ready(ms: number): void {

    let attempts_count = 0;

    setTimeout(() =>
        Syntaxer.ping((data: string) => {

            attempts_count++;

            if (data == "ready") {
                statusBarItem.text = 'CS-Script Intellisense services are ready...';
                statusBarItem.show();
                setTimeout(() => statusBarItem.hide(), 5000);
            }
            else {
                statusBarItem.text = 'CS-Script initializing...';
                statusBarItem.show();
                let delay = 1000;
                if (attempts_count < (10000 / delay))
                    check_syntaxer_ready(delay);
                else
                    statusBarItem.hide();
            }

        })
        , ms);
}

async function disable_legacy_integration() {
    if (settings.cscs.startsWith(user_dir())) {
        settings.cscs = "<default>";
        settings.syntaxer = "<default>";
    }
}

export async function start_services(): Promise<void> {

    return new Promise((resolve) => {

        child_process.execFile('css', ['-self'],
            (error, stdout, stderr) => {
                if (error == null) {
                    var cscs = stdout.trim();
                    settings.is_global_css = (settings.cscs == cscs);
                }
            });

        start_build_server();
        start_syntaxer();
        check_syntaxer_ready(500);

        resolve();
    });
}

export function integrate() {
    integrate_with_environment()
        .then(() => {
            if (settings.CssIntegrated()) {
                ShowIntegrationInfo();
                stop_syntaxer(); // ensure any old version is stopped
                start_services();
            }
            else {
                let isWarningDisabled = vscode.workspace.getConfiguration("cs-script").get('disableIntegrationWarning', false);
                if (!isWarningDisabled) {
                    ShowIntegrationWarning();
                }
            }
        });
}

export async function integrate_with_environment(): Promise<void> {

    return new Promise((resolve) => {
        child_process.execFile('syntaxer', ['-detect'],
            (error, stdout, stderr) => {

                if (error == null) {

                    let lines: string[] = stdout.lines();

                    var cscs = lines.firstOrDefault<string>(x => x.startsWith("css:"))?.substring("css:".length).trim();
                    var syntaxer = lines.firstOrDefault<string>(x => x.startsWith("syntaxer:"))?.substring("syntaxer:".length).trim();

                    settings.cscs = cscs;
                    settings.syntaxer = syntaxer;

                    _environment_ready = true;
                    _ready = true;
                }

                resolve();
            });
    });
}

export function clear_temp_file_suffixes(content: string): string {
    // "c:\Users\<user>\AppData\Roaming\Code\User\cs-script.user\new_script.$temp$.cs(16,9): Test();
    return content.replace(/.\$temp\$/g, '');
}

export function select_line(line: number): void {
    let editor = vscode.window.activeTextEditor!;
    if (line != -1) {
        editor.selection = new vscode.Selection(line, editor.document.lineAt(line).text.length, line, 0);
        editor.revealRange(editor.selection);
    }
}

export function save_as_temp(content: string, script_file: string, inject_source_info: boolean): string {

    let id = crypto.randomBytes(16).toString("hex");

    let ext = path.extname(script_file);
    let link_info = "//css_syntaxer source:" + script_file;
    let temp_file = path.join(sources_temp_dir, id + ext);

    if (inject_source_info)
        content = link_info + "\n" + content;

    fs.writeFileSync(temp_file, content, { encoding: 'utf8' });

    return temp_file;
}

export function toSignatureInfo(data: string): SignatureInformation {

    let result: SignatureInformation;
    let sig_lines = css_unescape_linebreaks(data).lines();

    sig_lines.forEach(line => {

        if (line.length > 1) {

            if (line.startsWith("label:")) {
                result = new SignatureInformation(line.substr("label:".length));
            }
            else if (line.startsWith("doc:")) {
                result.documentation = line.substr("doc:".length);
            }
            else if (line.startsWith("param_label:")) {
                result.parameters.push(new ParameterInformation(line.substr("param_label:".length)));
            }
            else if (line.startsWith("param_doc:")) {
                let param: ParameterInformation = result.parameters.lastOrDefault();
                if (param != null) {
                    param.documentation = new MarkdownString(`\`${param.label}\` - ${line.substr("param_doc:".length)}`);
                }
            }
            else {
                // continuation of the previous text aggregation 

                if (result != null && result.parameters.any() && result.parameters.last<ParameterInformation>().documentation != null) {
                    result.parameters.last<ParameterInformation>().documentation += "\n" + line;
                }
                else if (result != null && result.parameters.any()) {
                    result.parameters.last<ParameterInformation>().label += "\n" + line;
                }
                else if (result != null && result.documentation != null) {
                    result.documentation += "\n" + line;
                }
                else if (result != null) {
                    result.label += "\n" + line;
                }
            }
        }
    });

    if (result! != null && result.documentation)
        result.documentation = new MarkdownString(`_${result.documentation}_`);

    return result!;
}

export class ErrorInfo {
    public file!: string;
    public description!: string;
    public range!: vscode.Range;
    public severity!: vscode.DiagnosticSeverity;

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
                    return null!;
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
            return null!;
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

// Writable extension settings
export class Settings {

    public is_global_css: boolean = false; // cscs might be a valid path but not the global one
    public show_load_proj_info: boolean = true;
    public show_readme: boolean = true;
    public need_check_roslyn_on_OSX: boolean = true;
    public cscs_path: string = "";
    public syntaxer_path: string = "";

    private _file!: string;

    public static saveVscSetting(name, value) {
        try {
            vscode.workspace
                .getConfiguration("cs-script")
                .update(name, value, vscode.ConfigurationTarget.Global); // Save to global settings
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update setting: ${error.message}`);
        }
    };

    public static readVscSetting(name, defaultValue) {
        return vscode.workspace
            .getConfiguration("cs-script")
            .get(name, defaultValue);
    };

    public static Save(_this: Settings, file?: string): void {
        // needs to be a static as for Settings.Load can possibly return json object without any methods
        let file_path = path.join(user_dir(), 'settings.json');

        if (file != null) file_path = file;
        else if (_this._file != null) file_path = _this._file;

        fs.writeFileSync(file_path, ToJSON(_this), { encoding: 'utf8' })
    }

    public static Load(file?: string): Settings {

        let file_path = path.join(user_dir(), 'settings.json');
        if (file != null) file_path = file;

        let settings: Settings;

        try {
            settings = new Settings();

            let json = fs.readFileSync(file_path, 'utf8');

            UpdateFromJSON(settings, json);
        }
        catch (e) {
            // do nothing, just continue with the fresh settings object
        }

        settings._file = file_path;
        return settings;
    }

    public CssIntegrated(): boolean {
        return this.cscs &&
            this.cscs != "<default>" &&
            this.cscs != "" &&
            fs.existsSync(this.cscs_path) &&
            this.syntaxer &&
            this.syntaxer != "<default>" &&
            this.syntaxer != "" &&
            fs.existsSync(this.syntaxer);
    }

    public set cscs(path: string) {
        this.cscs_path = path;
        vscode.workspace.getConfiguration().update("cs-script.engine.cscs", path, vscode.ConfigurationTarget.Global);
    }

    public get cscs(): string {

        if (this.cscs_path == "") {
            this.cscs_path = vscode.workspace.getConfiguration("cs-script").get("engine.cscs", "<default>");
            outputChannel.appendLine(`CSS path: ${this.cscs_path}`);
            outputChannel.show(true);
        }

        return this.cscs_path;
    }

    public get syntaxer(): string {

        if (this.syntaxer_path == "") {
            this.syntaxer_path = vscode.workspace.getConfiguration("cs-script").get("engine.syntaxer", "<default>");
            outputChannel.appendLine(`Syntaxer path: ${this.syntaxer_path}`);
            outputChannel.show(true);
        }

        return this.syntaxer_path;
    }

    public set syntaxer(path: string) {
        this.syntaxer_path = path;
        vscode.workspace
            .getConfiguration("cs-script")
            .update("engine.syntaxer", path, vscode.ConfigurationTarget.Global);
    }

    public get syntaxerPort() {
        return vscode.workspace.getConfiguration("cs-script").get("engine.syntaxer_port", 18003);
    }
}

export class Utils {

    public static IsScript(file: string | undefined): boolean {
        if (file == undefined)
            return false;
        else
            return file.toLowerCase().endsWith('.cs') || file.toLowerCase().endsWith('.vb');
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
        return null!;
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

    public static IsSamePath(abs_path1: string | undefined, abs_path2: string | undefined): boolean {

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

    public static Run(command: string, on_done?: (arg0: number, arg1: string) => void) {

        let output: string = '';

        let p = exec(command);
        p.stdout.on('data', (data: string) => {
            let buf: string = data;
            output += data;
            if (buf.indexOf('Processing NuGet packages...') != -1)
                vscode.window.showInformationMessage('Restoring NuGet packages...');
        });
        p.stderr.on('data', (data: string) => output += data);
        p.on('close', (code: number) => {
            if (on_done) on_done(code, output);
        });
    }

    public static Run2(command: string, on_data: (arg0: string) => void, on_done?: (arg0: number, arg1: string) => void) {

        let output: string = '';

        let p = exec(command);
        p.stdout.on('data', (data: string) => {
            output += data;
            on_data(data);
        });
        p.stderr.on('data', (data: string) => output += data);
        p.on('close', (code: number) => {
            if (on_done) on_done(code, output);
        });
    }
}

export function preload_roslyn() {
    try {

        let exe = path.join(user_dir(), 'mono', 'cscs.exe');
        let command = 'mono "' + exe + '" -preload';
        Utils.Run(command);

    } catch (error) {
    }
}

export function disable_roslyn_on_osx() {

    if (os.platform() == 'darwin' && settings.need_check_roslyn_on_OSX) {

        let config_file = path.join(user_dir(), 'mono', 'css_config.mono.xml');

        if (fs.existsSync(config_file)) {

            let config_data = fs.readFileSync(config_file, 'utf8');
            let patched = false;

            if (config_data.includes("<useAlternativeCompiler></useAlternativeCompiler>")) {
                config_data = config_data.replace("<useAlternativeCompiler></useAlternativeCompiler>", "<useAlternativeCompiler>none</useAlternativeCompiler>");
                patched = true;
            }
            if (config_data.includes("<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>")) {
                config_data = config_data.replace("<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>", "<useAlternativeCompiler>none</useAlternativeCompiler>");
                patched = true;
            }

            if (patched) {
                window.showErrorMessage("CS-Script: Due to the problems with Mono implementation of 'ICodeCompiler' on OSX the supported script syntax is reduced to C#6.");
                settings.need_check_roslyn_on_OSX = false;
                Settings.Save(settings);
                fs.writeFileSync(config_file, config_data, { encoding: 'utf8' })
            }
        }
    }
}

export function ensure_default_core_config(cscs_exe: string, on_done?: (file: string) => void) {

    let config_file = path.join(path.dirname(cscs_exe), 'css_config.xml');

    if (!fs.existsSync(config_file)) {

        let command = `dotnet "${cscs_exe}" -config:default`;
        Utils.Run(command, (code, output) => {
            fs.writeFileSync(config_file, output, { encoding: 'utf8' });
            if (on_done)
                on_done(config_file);
        });
    }
    else if (on_done)
        on_done(config_file);
}

export function ensure_default_config(cscs_exe: string, on_done?: (file: string) => void) {

    let config_file = path.join(path.dirname(cscs_exe), 'css_config.mono.xml');

    if (!fs.existsSync(config_file)) {

        // deployed file may still be unavailable so use the original one

        let original_cscs_exe = path.join(ext_dir, 'bin', 'cscs.dll');
        let command = 'dotnet "' + original_cscs_exe + '" -config:default';

        Utils.Run(command, (code, output) => {
            if (on_done)
                on_done(config_file);
        });

    }
    else {
        if (on_done)
            on_done(config_file);
    }
}

export function actual_output(element: string, index: any, array: any) {
    // ignore mono test output that comes from older releases(s)  (known Mono issue)
    return (
        !element.startsWith('failed to get 100ns ticks') &&
        !element.startsWith('Mono pdb to mdb debug symbol store converter') &&
        !element.startsWith('Usage: pdb2mdb assembly'));
}

// -------------------
// Curtesy of https://github.com/eamodio/vscode-restore-editors

export type BuiltInCommands = 'vscode.open' | 'setContext' | 'workbench.action.closeActiveEditor' | 'workbench.action.nextEditor';
export const BuiltInCommands = {
    CloseActiveEditor: 'workbench.action.closeActiveEditor' as BuiltInCommands,
    NextEditor: 'workbench.action.nextEditor' as BuiltInCommands,
    Open: 'vscode.open' as BuiltInCommands,
    SetContext: 'setContext' as BuiltInCommands
};



export function ActivateDiagnostics(context: vscode.ExtensionContext) {
    console.log("Loading CS-Script extension from " + __dirname);

    // check extension dependencies
    if (vscode.extensions.getExtension('ms-vscode.csharp') == null &&
        vscode.extensions.getExtension('ms-dotnettools.csharp') == null) {
        let message = 'The required extension "C# for Visual Studio Code" is not found. Ensure it is installed.';
        vscode.window.showErrorMessage(message);
        throw message;
    }

    // if (vscode.extensions.getExtension('ms-vscode.mono-debug') == null) {
    //     let message = 'The required extension "Mono-Debug" is not found. Ensure it is installed.';
    //     vscode.window.showErrorMessage(message);
    //     throw message;
    // }

    // _environment_compatible = true;

    diagnosticCollection = vscode.languages.createDiagnosticCollection('c#');
    statusBarItem = vscode.window.createStatusBarItem(StatusBarAlignment.Left);
    context.subscriptions.push(diagnosticCollection);
    // ext_context = context;
    ext_version = vscode.extensions.getExtension('oleg-shilo.cs-script')?.packageJSON.version
    omnisharp_dir = path.join(vscode.extensions.getExtension('ms-dotnettools.csharp')?.extensionPath!, '.omnisharp', 'omnisharp');

    settings = Settings.Load();

    disable_legacy_integration();

    if (!settings.CssIntegrated()) {
        integrate();
    } else {
        _environment_ready = true;
        _ready = true;
        start_services();
    }
    return diagnosticCollection;
}

function ShowIntegrationInfo() {

    let file_name = 'integration-info.md';
    let file = path.join(user_dir(), file_name);

    let content =
        '# CS-Script VSCode extension integration' + os.EOL +
        '' + os.EOL +
        'Detected CS-Script tools:' + os.EOL +
        '' + os.EOL +
        '- Script engine: `' + settings.cscs + '`' + os.EOL +
        '- Syntaxer: `' + settings.syntaxer + '`' + os.EOL +
        '' + os.EOL +
        'The extension settings have been updated.' + os.EOL +
        'You may need to restart VSCode for the changes to take effect' + os.EOL +
        '' + os.EOL +
        '---------------' + os.EOL +
        '' + os.EOL +
        'You can always update (or install) CS-Script tools:' + os.EOL +
        '' + os.EOL +
        '- Script engine: `dotnet tool update --global cs-script.cli`' + os.EOL +
        '- Syntaxer: `dotnet tool update --global cs-syntaxer`' + os.EOL +
        '' + os.EOL +
        'Configure tools by executing the extension command "CS-Script: Integrate with CS-Script tools"' + os.EOL +
        '' + os.EOL +
        '---------------' + os.EOL +
        '' + os.EOL +
        'You can always check the version of the CS-SCript tools from the terminal by executing the command:' + os.EOL +
        'Script engine: `css`' + os.EOL +
        'Syntaxer: `syntaxer`' + os.EOL;

    fs.writeFileSync(file, content, { encoding: 'utf8' });
    commands.executeCommand("vscode.open", Uri.file(file));

    outputChannel.appendLine('CS-Script tools are detected and integrated.');
    outputChannel.appendLine('CSS path: ' + settings.cscs);
    outputChannel.appendLine('Syntaxer path: ' + settings.syntaxer);
    outputChannel.show(true);
}

function ShowIntegrationWarning() {
    let file_name = 'integration-error.md';
    let file = path.join(user_dir(), file_name);

    let content =
        '# CS-Script VSCode extension integration' + os.EOL +
        '' + os.EOL +
        'The extension requires CS-Script tools to function properly.' + os.EOL +
        'This is the most reliable way of managing their updates independently from the extension releases (e.g. update with new .NET version).' + os.EOL +
        '' + os.EOL +
        '## Installation' + os.EOL +
        '' + os.EOL +
        '1. Install/Update tools' + os.EOL +
        '    - Script engine: `dotnet tool install --global cs-script.cli`' + os.EOL +
        '    - Syntaxer: `dotnet tool install --global cs-syntaxer`' + os.EOL +
        '' + os.EOL +
        '2. Configure tools' + os.EOL +
        '    Execute extension command "CS-Script: Detect and integrate CS-Script"' + os.EOL +
        '' + os.EOL +
        'Note: you need to have .NET SDK installed for using CS-Script (see https://dotnet.microsoft.com/en-us/download)' + os.EOL;

    fs.writeFileSync(file, content, { encoding: 'utf8' });
    commands.executeCommand("vscode.open", Uri.file(file));

    // -------

    let disableWarning = "Do not show this warning again";
    vscode.window
        .showWarningMessage(
            `Cannot find CS-Script tools on your system. These tools are required for the extension to function properly'.
            The instruction on how to install the tools are provided in the opened document '`+ file_name + `'.`,
            disableWarning)

        .then(selection => {

            if (selection === disableWarning) {
                Settings.saveVscSetting('cs-script.disableIntegrationWarning', true);
            }
        });
}

export class ActiveEditorTracker extends Disposable {

    private _disposable: vscode.Disposable;
    private _resolver: ((value?: TextEditor | PromiseLike<TextEditor>) => void) | undefined;

    constructor() {
        super(() => this.dispose());

        this._disposable = window.onDidChangeActiveTextEditor(e => this._resolver && this._resolver(e));
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    async awaitClose(timeout: number = 500): Promise<TextEditor> {
        this.close();
        return this.wait(timeout);
    }

    async awaitNext(timeout: number = 500): Promise<TextEditor> {
        this.next();
        return this.wait(timeout);
    }

    async close(): Promise<{} | undefined> {
        return commands.executeCommand(BuiltInCommands.CloseActiveEditor);
    }

    async next(): Promise<{} | undefined> {
        return commands.executeCommand(BuiltInCommands.NextEditor);
    }

    async wait(timeout: number = 500): Promise<TextEditor> {
        const editor = await new Promise<TextEditor>((resolve, reject) => {
            let timer: any;

            // this._resolver = (value?: TextEditor | PromiseLike<TextEditor>) => { // zos
            // @ts-ignore
            this._resolver = (value: TextEditor) => { // zos
                if (timer) {
                    clearTimeout(timer as any);
                    timer = 0;
                    resolve(value);
                }
            };

            timer = setTimeout(() => {
                resolve(window.activeTextEditor!);
                timer = 0;
            }, timeout) as any;
        });
        this._resolver = undefined;
        return editor;
    }
}