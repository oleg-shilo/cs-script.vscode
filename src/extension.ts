"use strict";

/* tslint:disable */

// TODO:
// - Implement saving project before run or any intellisense operations. Still waiting for VSCode feature ("API Access to "Open Editors" #15178") to be implemented:

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cs_script from "./cs-script";
import * as syntaxer from "./syntaxer";
import { ProjectTreeProvider } from "./tree_view";
import { CSScriptHoverProvider, CSScriptCompletionItemProvider, CSScriptDefinitionProvider, CSScriptReferenceProvider, CSScriptDocFormattingProvider, CSScriptLinkProvider, CSScriptRenameProvider, CSScriptSignatureHelpProvider, CSScriptCodeActionProvider } from "./providers";

export function activate(context: vscode.ExtensionContext) {

    try {

        // Use the console to output diagnostic information (console.log) and errors (console.error)
        // This line of code will only be executed once when your extension is activated
        // console.log('"cs-script" extension is now active...');

        cs_script.ActivateDiagnostics(context);
        syntaxer.DeploySyntaxer();

        const treeViewProvider = new ProjectTreeProvider(cs_script.get_project_tree_items);
        vscode.window.registerTreeDataProvider('cs-script', treeViewProvider);

        context.subscriptions.push(vscode.languages.registerHoverProvider('csharp', new CSScriptHoverProvider()));
        context.subscriptions.push(vscode.languages.registerHoverProvider('vb', new CSScriptHoverProvider()));
        // --
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider('csharp', new CSScriptCompletionItemProvider(), '.', '_'));
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider('vb', new CSScriptCompletionItemProvider(), '.', '_'));
        // --
        context.subscriptions.push(vscode.languages.registerDefinitionProvider('csharp', new CSScriptDefinitionProvider()));
        context.subscriptions.push(vscode.languages.registerDefinitionProvider('vb', new CSScriptDefinitionProvider()));
        // --
        context.subscriptions.push(vscode.languages.registerReferenceProvider('csharp', new CSScriptReferenceProvider()));
        context.subscriptions.push(vscode.languages.registerReferenceProvider('vb', new CSScriptReferenceProvider()));
        // --
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider('csharp', new CSScriptCodeActionProvider()));
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider('csharp', new CSScriptSignatureHelpProvider(), '(', ','));
        context.subscriptions.push(vscode.languages.registerRenameProvider('csharp', new CSScriptRenameProvider()));
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('csharp', new CSScriptDocFormattingProvider()));
        // --
        context.subscriptions.push(vscode.languages.registerDocumentLinkProvider('code-runner-output', new CSScriptLinkProvider()));
        // --
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.refresh_tree', () => treeViewProvider.refresh()));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.show_tree_data', () => cs_script.print_project()));
        // --
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.debug', cs_script.debug));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.run', cs_script.run));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.run_in_terminal', cs_script.run_in_terminal));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.print_project', cs_script.print_project_for_document));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.load_project', cs_script.load_project));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.check', cs_script.check));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.find_references', cs_script.find_references));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.css_config', cs_script.css_config));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.about', cs_script.about));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.new_script', cs_script.new_script));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.new_script_vb', cs_script.new_script_vb));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.engine_help', cs_script.engine_help));
        context.subscriptions.push(vscode.commands.registerCommand('cs-script.build_exe', cs_script.build_exe));

        context.subscriptions.push(vscode.commands.registerCommand("csharp.startSessionCommand", debugConfig => {
            if (Object.keys(debugConfig).length === 0) {
                return {
                    status: 'initialConfiguration'
                };
            }
        }));

    } catch (error) {
        console.log(error.toSting());
    }
};


// this method is called when your extension is deactivated
export function deactivate() {
}