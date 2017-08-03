'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands, window } from "vscode";
import * as cs_script from "./cs-script";
import { DepNodeProvider } from "./tree_view";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('"cs-script" extension is now active...');

    const nodeDependenciesProvider = new DepNodeProvider(cs_script.get_project_tree_items);
    
    vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
    vscode.commands.registerCommand('nodeDependencies.refresh', () => nodeDependenciesProvider.refresh());

    cs_script.ActivateDiagnostics(context);
    
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.debug', cs_script.debug));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.run', cs_script.run));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.run_in_terminal', cs_script.run_in_terminal));
    context.subscriptions.push(vscode.commands.registerCommand('cs-script.print_project', cs_script.print_project));
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

        // Attach any properties that weren't explicitly set.			
        // debugConfig.cwd = debugConfig.cwd || "${workspaceRoot}";
        // debugConfig.args = debugConfig.args || [];
        // debugConfig.sdkPath = debugConfig.sdkPath || this.sdks.dart;
        // debugConfig.debugSdkLibraries = debugConfig.debugSdkLibraries || config.debugSdkLibraries;
        // debugConfig.debugExternalLibraries = debugConfig.debugExternalLibraries || config.debugExternalLibraries;
        // if (debugConfig.checkedMode === undefined)
        //     debugConfig.checkedMode = true;

        // vs.commands.executeCommand('vscode.startDebug', debugConfig);
        // return {
        //     status: 'ok'
        // };
    }));
};


// this method is called when your extension is deactivated
export function deactivate() {
}