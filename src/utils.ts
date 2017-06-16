'use strict';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Uri, commands, DiagnosticCollection, DiagnosticSeverity, StatusBarAlignment, StatusBarItem } from "vscode";

let ext_dir = path.join(__dirname, "..", "..");
let exec = require('child_process').exec;
let execSync = require('child_process').execSync;
let mkdirp = require('mkdirp');
let ext_context: vscode.ExtensionContext;
let ext_version: string;
let cscs_exe: string;
let _user_dir: string;
let statusBarItem: StatusBarItem;

export let settings: Settings;
export let diagnosticCollection: vscode.DiagnosticCollection;

export function create_dir(dir: string): void {
    // fs.mkdirSync can only create the top level dir but mkdirp creates all child sub-dirs that do not exist  
    const allRWEPermissions = parseInt("0777", 8);
    mkdirp.sync(dir, allRWEPermissions);
}

export function delete_dir(dir: string): void {
    try {

        let files = fs.readdirSync(dir);
        for (var i = 0; i < files.length; i++) {

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

export function user_dir(): string {

    // ext_context.storagePath cannot be used as it is undefined if no workspace loaded

    // vscode:
    // Windows %APPDATA%\Code\User\settings.json
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
    diagnosticCollection = vscode.languages.createDiagnosticCollection('c#');
    statusBarItem = vscode.window.createStatusBarItem(StatusBarAlignment.Left);
    context.subscriptions.push(diagnosticCollection);
    ext_version = context.globalState.get('version').toString();
    ext_context = context;
    settings = Settings.Load();

    deploy_engine();

    setTimeout(preload_roslyn, 2000);

    return diagnosticCollection;
}

export function deploy_engine(): void {
    // all copy_file* calls are  async operations
    statusBarItem.text = '$(versions) Deploying CS-Script...';
    statusBarItem.show();

    copy_file_to("cscs.exe", path.join(ext_dir, 'bin'), user_dir());
    copy_file_to("CSSRoslynProvider.dll", path.join(ext_dir, 'bin'), user_dir());

    if (os.platform() == 'win32')
        deploy_roslyn();

    statusBarItem.hide();

    ensure_default_config(path.join(user_dir(), 'cscs.exe'));
}

export function deploy_roslyn(): void {
    // Copy all roslyn related files
    // Dest folder must be versioned as Roslyn server may stay in memory between the sessions so the
    // extension update would not be interfered with.
    let src_dir = path.join(ext_dir, 'bin', 'roslyn');
    let dest_dir = path.join(user_dir(), 'roslyn');
    let ver_file = path.join(dest_dir, 'vscode.css_version.txt');

    // process.env.css_vscode_roslyn_dir = dest_dir;

    let uptodate = false;
    if (fs.existsSync(dest_dir) && fs.existsSync(ver_file)) {
        try {
            let version = fs.readFileSync(ver_file, 'utf8');
            uptodate = (version == ext_version);
        } catch (error) {
        }
    }

    if (fs.existsSync(dest_dir) && !uptodate) {
        // var command = 'mono "' + path.join(user_dir(), 'cscs.exe') + '" -stop';
        var command = '"' + path.join(ext_dir, 'bin', 'cscs.exe') + '" -stop';
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

    if (!fs.existsSync(dest_dir)) {
        create_dir(dest_dir);
        fs.readdirSync(src_dir).forEach(file => {
            copy_file_to(file, src_dir, dest_dir); // async operation
        });

        fs.writeFileSync(ver_file, ver_file, 'utf8');
    }
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
        fs.writeFileSync(template_file, template, 'utf8');

    try {
        template = fs.readFileSync(template_file, 'utf8');
    } catch (error) {
    }

    return template
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
                    result.file = parts[0];
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

        fs.writeFile(file_path, JSON.stringify(this), 'utf8')
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

    public static Run(command: string, on_done: (number, string) => void) {

        let output: string = '';

        let p = exec(command);
        p.stdout.on('data', data => output += data);
        p.stderr.on('data', data => output += data);
        p.on('close', code => on_done(code, output));
    }
}

export function preload_roslyn() {
    try {
        let exe = path.join(user_dir(), 'cscs.exe');
        var command = 'mono "' + exe + '" -nl -preload';
         Utils.Run(command, (code, output) => {
            // console.log(output);
         });
    } catch (error) {

    }
}
export function ensure_default_config(cscs_exe: string, on_done?: (file: string) => void) {

    let config_file = path.join(path.dirname(cscs_exe), 'css_config.mono.xml');

    if (!fs.existsSync(config_file)) {

        // deployed file may still be unavailable so use the original one

        let original_cscs_exe = path.join(ext_dir, 'bin', 'cscs.exe');
        var command = 'mono "' + original_cscs_exe + '" -config:default';

        Utils.Run(command, (code, output) => {

            // C:\Program Files (x86)\Mono\lib\mono\4.5\Facades</searchDirs>

            let updated_config = output
                .replace("</defaultArguments>", " -ac:1</defaultArguments>")
                .replace("</searchDirs>", "%MONO%/4.5/Facades</searchDirs>")
                .replace("<useAlternativeCompiler></useAlternativeCompiler>", "<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>")
                .replace("</defaultRefAssemblies>", "System.dll;System.ValueTuple.dll</defaultRefAssemblies>");

            fs.writeFileSync(config_file, updated_config, 'utf8');

            if (os.platform() == 'win32') {
                let config_file_win = path.join(path.dirname(cscs_exe), 'css_config.xml');
                let updated_config = output
                    .replace("</defaultArguments>", " -ac:1</defaultArguments>")
                    .replace("</searchDirs>", "%cscs_exe_dir%/roslyn</searchDirs>")
                    .replace("<useAlternativeCompiler></useAlternativeCompiler>", "<useAlternativeCompiler>CSSRoslynProvider.dll</useAlternativeCompiler>")
                    .replace("</defaultRefAssemblies>", "System.dll;System.ValueTuple.dll</defaultRefAssemblies>");

                fs.writeFileSync(config_file_win, updated_config, 'utf8');
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

interface String {
    lines(): string[];
}

// use eval as having the prototype extended directly triggers false VSCode TS validator error
eval(`
String.prototype.lines = function() {
    return this.split(/\\r?\\n/g)
}
`);