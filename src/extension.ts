'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands, window } from "vscode";
import * as cs_script from "./cs-script";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('"cs-script" extension is now active...');

    cs_script.ActivateDiagnostics(context);

    context.globalState.update('version', '1.0.1');

    context.subscriptions.push(vscode.commands.registerCommand('cs-script.debug', cs_script.debug));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.run', cs_script.run));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.print_project', cs_script.print_project));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.load_project', cs_script.load_project));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.check', cs_script.check));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.about', cs_script.about));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.new_script', cs_script.new_script));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.engine_help', cs_script.engine_help));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.build_exe', cs_script.build_exe));
};


// this method is called when your extension is deactivated
export function deactivate() {
}