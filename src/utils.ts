'use strict';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Uri, commands, DiagnosticCollection, DiagnosticSeverity } from "vscode";

let exec = require('child_process').exec;
let mkdirp = require('mkdirp');
let ext_context: vscode.ExtensionContext

export let settings: Settings;
export let diagnosticCollection: vscode.DiagnosticCollection;

export function ActivateDiagnostics(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('c#');
    context.subscriptions.push(diagnosticCollection);
    ext_context = context;
    
    if (!fs.existsSync(context.storagePath)) {
        fs.mkdirSync(context.storagePath);
    }
    settings = Settings.Load();
    return diagnosticCollection;
}

export function create_dir(dir: string): void {
    const allRWEPermissions = parseInt("0777", 8);
    mkdirp.sync(dir, allRWEPermissions);
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

        let file_path = path.join(ext_context.storagePath, 'settings.json');

        if (file != null) file_path = file;
        else if (this._file != null) file_path = this._file;

        fs.writeFile(file_path, JSON.stringify(this), 'utf8')
    }

    public static Load(file?: string) {

        let file_path = path.join(ext_context.storagePath, 'settings.json');
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