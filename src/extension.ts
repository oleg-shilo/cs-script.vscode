'use strict';
// TODO:
// #4 Project fails to load if the script has cs-script directive invalid syntax.
// Ctrl+F5 shows cs-script busy, but executes the script for every run of the modified script


// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands, window, HoverProvider, Position, CancellationToken, TextDocument, Hover } from "vscode";
import * as cs_script from "./cs-script";
import { ProjectTreeProvider } from "./tree_view";
import { CSScriptHoverProvider, CSScriptCompletionItemProvider, CSScriptDefinitionProvider } from "./providers";
import * as providers from "./providers";

export function refresh_tree() {
    console.log('dgfshgsdfg');
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('"cs-script" extension is now active...');

    cs_script.ActivateDiagnostics(context);
    
    const treeViewProvider = new ProjectTreeProvider(cs_script.get_project_tree_items);
    vscode.window.registerTreeDataProvider('cs-script', treeViewProvider);
    
    context.subscriptions.push(vscode.languages.registerHoverProvider('csharp', new CSScriptHoverProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('csharp', new CSScriptCompletionItemProvider(), '.', '_'));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('csharp', new CSScriptDefinitionProvider()));
    
    
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.refresh_tree', () => treeViewProvider.refresh()));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.show_tree_data', () => cs_script.print_project()));

    context.subscriptions.push(vscode.commands.registerCommand('cs-script.debug', cs_script.debug));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.run', cs_script.run));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.run_in_terminal', cs_script.run_in_terminal));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.print_project', cs_script.print_project_for_document));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.load_project', cs_script.load_project));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.check', cs_script.check));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.css_config', cs_script.css_config));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.about', cs_script.about));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.new_script', cs_script.new_script));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.engine_help', cs_script.engine_help));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.build_exe', cs_script.build_exe));

    context.subscriptions.push(vscode.commands.registerCommand("csharp.startSessionCommand", debugConfig => {
        if (Object.keys(debugConfig).length === 0) {
            return {
                status: 'initialConfiguration'
            };
        }
    }));
};


// this method is called when your extension is deactivated
export function deactivate() {
}