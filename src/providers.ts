'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands, window, HoverProvider, Position, CancellationToken, TextDocument, Hover, Definition, ProviderResult, Range, Location } from "vscode";
import * as cs_script from "./cs-script";
import * as utils from "./utils";

function getCssDirective(document: TextDocument, position: Position): string {

    let word_range = document.getWordRangeAtPosition(position);
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
    return null;
}

interface HelpSection {
    docOffset: number;
    text: string;
}

let help_map: { [id: string]: HelpSection; };

function parseSyntaxHelp(help: string): void {

    let section_r = /-+\r?\n\/\/css_/g;
    let trim_r = /-+\r?\n/g;

    let match, indexes = [];
    let prev_index: number;

    help_map = {};

    while (match = section_r.exec(help)) {
        if (prev_index) {
            let section = help.substr(prev_index, match.index - prev_index).split(trim_r)[1];

            let section_lines = section.lines(5);

            let id = section_lines[0].split(' ', 1)[0]; // '//css_include <file>;'
            let alt_id = section_lines
                .where(x => x.startsWith('Alias - //css'))
                .select(x => x.replace('Alias - ', '').trim())
                .firstOrDefault() as string;

            if (alt_id)
                help_map[alt_id] = { docOffset: prev_index, text: section };

            help_map[id] = { docOffset: prev_index, text: section };
        }
        prev_index = match.index;
    }
}

export class CSScriptHoverProvider implements HoverProvider {
    public provideHover(document: TextDocument, position: Position, token: CancellationToken):
        Thenable<Hover> {

        // Some info: https://github.com/Microsoft/vscode-docker/blob/00ed8c801d9a36c81efc2cf22dfd686294d08656/dockerHoverProvider.ts

        var word = getCssDirective(document, position);
        if (word != null) {

            if (!help_map)
                parseSyntaxHelp(cs_script.generate_syntax_help());

            for (var key in help_map) {
                if (key == word) {
                    return Promise.resolve(new Hover(['Directive: ' + word, help_map[key].text]));
                }
            }
        }

        return null;
    }
}

export class CSScriptCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Thenable<vscode.CompletionItem[]> {

        var word = getCssDirective(document, position);
        if (word != null) {

            if (!help_map)
                parseSyntaxHelp(cs_script.generate_syntax_help());

            let items: vscode.CompletionItem[] = [];

            for (var key in help_map) {
                // vscode will be replacing a word so it will ignore '//' prefix. Thus we need to trim the insertion text as well; 
                items.push({ label: key, kind: vscode.CompletionItemKind.Text, insertText:key.substr(2), documentation: help_map[key].text });
            }

            return Promise.resolve(items);
        }

        return null;
    }
}

let syntax_readme_selectedLine = -1;

vscode.window.onDidChangeActiveTextEditor(editor => {
    
    // 'new Location(...' in CSScriptDefinitionProvider does scrolling correctly but does not do the selection

    if (syntax_readme_selectedLine != -1) {
        let line = syntax_readme_selectedLine;
        setTimeout(() => {
            editor.selection = new vscode.Selection(line, 0, line, editor.document.lineAt(line).text.length);
        }, 300);
        syntax_readme_selectedLine = -1;
    }
});

export class CSScriptDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken):
        ProviderResult<Definition> {
        var word = getCssDirective(document, position);
        if (word != null) {
            if (!help_map)
                parseSyntaxHelp(cs_script.generate_syntax_help());

            for (var key in help_map)
                if (key == word) {
                    let text = fs.readFileSync(cs_script.syntax_readme, { encoding: 'utf8' });

                    let line = text.substr(0, help_map[key].docOffset).lines().length;
                    utils.statusBarItem.hide();
                    syntax_readme_selectedLine = line;

                    return new Location(vscode.Uri.file(cs_script.syntax_readme), new Range(new Position(line, 0), new Position(line, 0)));
                }
        }
        // utils.statusBarItem.hide();
        return null;
    }
}