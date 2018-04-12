/* tslint:disable */

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';
import { HoverProvider, Position, CompletionItem, CancellationToken, TextDocument, Hover, Definition, ProviderResult, Range, Location, ReferenceContext, FormattingOptions, TextEdit, DocumentLink, WorkspaceEdit } from "vscode";
// import * as cs_script from "./cs-script";
import * as utils from "./utils";
import { Syntaxer } from "./syntaxer";
import { ErrorInfo, select_line, VSCodeSettings } from './utils';
import { save_script_project } from './cs-script';
// import { Utils } from "./utils";
// import { Syntaxer } from "./syntaxer";


function isWorkspace(): boolean { return vscode.workspace.rootPath != undefined; }

function isCssDirective(document: TextDocument, position: Position): boolean {
    return getCssDirective(document, position) != undefined;
}

function getCssDirective(document: TextDocument, position: Position): string {

    let word_range = document.getWordRangeAtPosition(position);
    if (word_range) {
        let word_start = word_range.start;
        var word = document.getText(word_range).lines()[0];

        if (word.startsWith('css_') && word_start.character >= 2) {
            // "//css_include"
            let prefix_range = new Range(word_start.translate(0, -word_start.character), word_start);
            let prefix = document.getText(prefix_range).lines()[0];

            let directive = (prefix + word).trim();

            if (directive.startsWith('//css_'))
                return directive;
        }
    }
    return null;
}

function trimWordDelimeters(word: string): string {
    if (word.startsWith('//'))
        return word.substring(2);
    else
        return word;
}

// let help_map: { [id: string]: HelpSection; };

// function parseSyntaxHelp(help: string): void {
//     if (help) {
//         let section_r = /-+\r?\n\/\/css_/g;
//         let trim_r = /-+\r?\n/g;

//         let match;
//         let prev_index: number;

//         help_map = {};

//         while (match = section_r.exec(help)) {
//             if (prev_index) {
//                 let section = help.substr(prev_index, match.index - prev_index).split(trim_r)[1];

//                 let section_lines = section.lines(5);

//                 let id = section_lines[0].split(' ', 1)[0]; // '//css_include <file>;'
//                 let alt_id = section_lines
//                     .where(x => x.startsWith('Alias - //css'))
//                     .select(x => x.replace('Alias - ', '').trim())
//                     .firstOrDefault() as string;

//                 if (alt_id)
//                     help_map[alt_id] = { docOffset: prev_index, text: section };

//                 help_map[id] = { docOffset: prev_index, text: section };
//             }
//             prev_index = match.index;
//         }
//     }
// }

export class CSScriptHoverProvider implements HoverProvider {

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {

        // Some info: https://github.com/Microsoft/vscode-docker/blob/00ed8c801d9a36c81efc2cf22dfd686294d08656/dockerHoverProvider.ts

        let result: Hover;

        let is_workspace = isWorkspace();
        let is_css_directive = isCssDirective(document, position);

        if (!is_workspace || is_css_directive) {
            return new Promise((resolve, reject) =>

                Syntaxer.getTooltip(document.getText(), document.fileName, document.offsetAt(position),
                    data => {
                        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {
                            // data = data.replace(/\${r}\${n}/g, "\n")
                            //            .replace(/\${n}/g, "\n");
                            result = new Hover(data);
                        }
                        resolve(result);
                    },
                    error => {
                    })
            );
        }

        return null;
    }
}

export class CSScriptCompletionItemProvider implements vscode.CompletionItemProvider {

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {

        let items: CompletionItem[] = [];

        let is_workspace = isWorkspace();
        let is_css_directive = isCssDirective(document, position);

        if (!is_workspace || is_css_directive) {

            return new Promise((resolve, reject) =>

                Syntaxer.getCompletions(document.getText(), document.fileName, document.offsetAt(position),
                    data => {
                        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {
                            let lines: string[] = data.lines();
                            lines.forEach(line => {
                                let parts = line.split("\t");
                                let info = parts[1].split("|");
                                let memberKind: vscode.CompletionItemKind;
                                switch (info[0]) {
                                    case "method":
                                        memberKind = vscode.CompletionItemKind.Method;
                                        break;
                                    case "extension_method":
                                        memberKind = vscode.CompletionItemKind.Method;
                                        break;
                                    case "constructor":
                                        memberKind = vscode.CompletionItemKind.Constructor;
                                        break;
                                    case "field":
                                        memberKind = vscode.CompletionItemKind.Field;
                                        break;
                                    case "property":
                                        memberKind = vscode.CompletionItemKind.Property;
                                        break;
                                    case "_event":
                                        memberKind = vscode.CompletionItemKind.Event;
                                        break;
                                    default:
                                        memberKind = vscode.CompletionItemKind.Text;
                                        break;
                                }
                                items.push({ label: parts[0], kind: memberKind, insertText: trimWordDelimeters(info[1]), sortText: '01' });
                            });
                        }
                        resolve(items);
                    },
                    error => {
                    })
            );
        }

        return null;
    }
}

let syntaxer_navigate_selectedLine = -1;

vscode.window.onDidChangeActiveTextEditor(editor => {

    // 'new Location(...' in CSScriptDefinitionProvider does scrolling correctly but does not do the selection

    if (syntaxer_navigate_selectedLine != -1) {

        let line = syntaxer_navigate_selectedLine;
        setTimeout(() => {
            select_line(line);
        }, 100);
        syntaxer_navigate_selectedLine = -1;
    }
});

export class CSScriptDocFormattingProvider implements vscode.DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {

        let result: TextEdit[] = [];
        let is_workspace = isWorkspace();

        if (!is_workspace)
            return new Promise((resolve, reject) => {

                let editor = vscode.window.activeTextEditor;
                let position = editor.selection.start;


                Syntaxer.doDocFormat(document.getText(), document.fileName, document.offsetAt(position),

                    data => {
                        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {
                            // <position>\n<formatted text>   (note '\n' is a hardcodded separator)
                            let info = data.lines(2);

                            let newText = data.substring(info[0].length + 1);
                            let wholeDoc = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));

                            result.push(new TextEdit(wholeDoc, newText));

                            // Syntaxer also returns a new mapped offset but it seems like VSCode is doing a really good job by setting the new 
                            // offset of the formatted test withut any syntaxer assistance. Thus the offset management is disabled.
                            // setTimeout(()=>
                            // {
                            //     let newPosition = document.positionAt(Number(info[0]));
                            //     let newSelection = new vscode.Selection(newPosition, newPosition)
                            //     editor.selection = newSelection;
                            //     editor.revealRange(editor.selection);
                            // }, 300);
                        }

                        resolve(result);
                    },
                    error => {
                    });
            });
        else
            return null;
    }
}
export class CSScriptLinkProvider implements vscode.DocumentLinkProvider {

    private _linkPattern = /.*?\(.*?\):/g; // VS classic link pattern <file>(<line>,<column>): <info>

    public provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<DocumentLink[]> {

        let result: DocumentLink[] = [];

        let enabled = VSCodeSettings.get("cs-script.decorate_file_links_in_output", true);

        if (enabled)
            return new Promise((resolve, reject) => {

                const text = document.getText();

                let match: RegExpMatchArray;

                while ((match = this._linkPattern.exec(text))) {
                    let matchText = match[0];

                    let info = ErrorInfo.parse(matchText);
                    let targetPosUri = vscode.Uri.file(info.file)
                        .with({ fragment: `${1 + info.range.start.line}` })

                    let linkEnd = document.positionAt(this._linkPattern.lastIndex - 1);
                    let linkStart = document.positionAt(this._linkPattern.lastIndex - 1 - matchText.length);

                    result.push(new DocumentLink(
                        new vscode.Range(linkStart, linkEnd),
                        targetPosUri));
                }

                resolve(result);
            });
        else
            return null;
    }
}

export class CSScriptReferenceProvider implements vscode.ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {

        let result: Location[] = [];

        let is_workspace = isWorkspace();

        if (!is_workspace) {

            return new Promise((resolve, reject) =>

                Syntaxer.getRefrences(document.getText(), document.fileName, document.offsetAt(position),

                    data => {
                        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {

                            let lines: string[] = data.lines();

                            lines.forEach(line => {
                                let info = ErrorInfo.parse(line);
                                result.push(new Location(vscode.Uri.file(info.file), info.range));
                            });
                        }
                        resolve(result);
                    },
                    error => {
                    }));

        }
        return null;
    }

}
export class CSScriptRenameProvider implements vscode.RenameProvider {

    public provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): ProviderResult<WorkspaceEdit> {

        let is_workspace = isWorkspace();

        if (!is_workspace) {

            let word = document.getWordRangeAtPosition(position);
            let word_width = word.end.character - word.start.character;

            return new Promise((resolve, reject) =>


                Syntaxer.getRenameingInfo(document.getText(), document.fileName, document.offsetAt(position),

                    data => {
                        let result = new WorkspaceEdit();

                        try {
                            if (!data.startsWith("<null>") && !data.startsWith("<error>")) {

                                var changes: { [id: string]: TextEdit[]; } = {};

                                let lines: string[] = data.lines();

                                lines.forEach(line => {

                                    console.log(line);

                                    let info = ErrorInfo.parse(line);
                                    let range = new vscode.Range(info.range.start, new Position(info.range.start.line, info.range.start.character + word_width));


                                    let edits = changes[info.file];
                                    if (!edits) {
                                        edits = [];
                                        changes[info.file] = edits;
                                    }

                                    edits.push(new TextEdit(range, newName));
                                });

                                for (let file in changes) {
                                    let edits = changes[file];
                                    let uri = vscode.Uri.file(utils.clear_temp_file_suffixes(file));
                                    result.set(uri, edits);
                                }
                            }
                        } catch { }

                        resolve(result);

                        setTimeout(() => save_script_project(false), 700);
                    },
                    error => {
                    }));

        }
        return null;
    }

}

export class CSScriptDefinitionProvider implements vscode.DefinitionProvider {

    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {

        syntaxer_navigate_selectedLine = -1;
        let result: Location = undefined;

        let is_workspace = isWorkspace();
        let is_css_directive = isCssDirective(document, position);

        if (!is_workspace || is_css_directive) {

            return new Promise((resolve, reject) =>

                Syntaxer.getDefinition(document.getText(), document.fileName, document.offsetAt(position),

                    data => {
                        if (!data.startsWith("<null>") && !data.startsWith("<error>")) {

                            let lines: string[] = data.lines();

                            // file:c:\Users\<user>\AppData\Roaming\Code\User\cs-script.user\new_script.cs
                            // line:25

                            let file = lines[0].substr('file:'.length);
                            let line = Number(lines[1].substr('line:'.length)) - 1;

                            if (file.length > 0) {
                                syntaxer_navigate_selectedLine = line;
                                result = new Location(vscode.Uri.file(file), new Range(new Position(line, 0), new Position(line, 0)));

                                // It's the same file so no doc change event will be fired on navigation.
                                // Thus so no line with the cursor will be selected in the event handler.
                                // Meaning, we have to do it explicitly.     
                                if (file.toLowerCase() == document.fileName.toLowerCase()) {
                                    setTimeout(() => select_line(syntaxer_navigate_selectedLine), 30);
                                }
                            }
                        }
                        resolve(result);
                    },
                    error => {
                    }));
        }
        // utils.statusBarItem.hide();
        return null;
    }
}