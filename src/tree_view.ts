import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands } from "vscode";
import * as utils from "./utils";

export class ProjectTreeProvider implements vscode.TreeDataProvider<Dependency> {

	private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;

	constructor(private aggregateScriptItems: () => string[]) {
		vscode.window.onDidChangeActiveTextEditor(editor => {
			// no need to do it so often
			// this._onDidChangeTreeData.fire();
		});
		vscode.workspace.onDidChangeTextDocument(e => {
		})
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Dependency): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Dependency): Thenable<Dependency[]> {
		return new Promise(resolve => {
			if (element) {
				if (element.children)
					resolve(this.getScriptRefs(element.children));
				else
					resolve([]);
			} else {
				resolve(this.getScriptItems());
			}
		});
	}

	private getScriptRefs(asms: string[]): Dependency[] {
		return asms.map(asm => {
			return new Dependency(asm, vscode.TreeItemCollapsibleState.None,
				null,
				null, 'assembly');
		});
	}

	private getScriptItems(): Dependency[] {

		let refsNode = new Dependency('References', vscode.TreeItemCollapsibleState.Collapsed, null, [], 'assembly_group');

		let nodes = [];
		nodes.push(refsNode);

		if (!utils.is_ready()) {
			setTimeout(() => commands.executeCommand('cs-script.refresh_tree') , 500);
		}
		else {
			let items = this.aggregateScriptItems();

			if (items)
				items.forEach(item => {
					if (item.startsWith('file:')) {
						let file = item.substr(5);
						let role = "Primary";

						if (nodes.length > 1)
							role = "Imported";

						let node = new Dependency(
							path.basename(file),
							vscode.TreeItemCollapsibleState.None,
							{
								command: 'vscode.open',
								title: '',
								tooltip: role + ' script: ' + file,
								arguments: [Uri.file(file)],
							},
							null,
							role.toLowerCase()
						)

						nodes.push(node);
					}
					else if (item.startsWith('ref:'))
						refsNode.children.push(item.substr(4));

				});
		}

		return nodes;
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

class Dependency extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command,
		public readonly children?: string[],
		public readonly context?: string,
	) {
		super(label, collapsibleState);

		if (context) {
			this.contextValue = context;

			let icon = null;
			if (context == 'imported')
				icon = 'cs';
			else if (context == 'primary')
				icon = 'css';
			else if (context == 'assembly' || context == 'assembly_group')
				icon = 'asm';
			if (icon)
				this.iconPath = {
					light: path.join(__filename, '..', '..', '..', 'images', 'icons', icon + '.light.svg'),
					dark: path.join(__filename, '..', '..', '..', 'images', 'icons', icon + '.svg')
				};
		}
	}

	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'images', 'icons', 'document.light.svg'),
		dark: path.join(__filename, '..', '..', '..', 'images', 'icons', 'document.svg')
	};

	contextValue = 'dependency';
}