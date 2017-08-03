import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Uri } from "vscode";


export class DepNodeProvider implements vscode.TreeDataProvider<Dependency> {

	private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;

	constructor(private aggregateScriptItems: () => string[]) {
		vscode.window.onDidChangeActiveTextEditor(editor => {
			// this._onDidChangeTreeData.fire();
		});
		vscode.workspace.onDidChangeTextDocument(e => {
		})
	}

	refresh(): void {
		vscode.window.showInformationMessage('Script View is refreshed - START...');
		this._onDidChangeTreeData.fire();
		vscode.window.showInformationMessage('Script View is refreshed - END...');
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
				// const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
				// let scriptFile = null;

				// if (this.workspaceRoot) {
				// 	console.log(this.workspaceRoot);
				// }

				resolve(this.getScriptItems());
			}
		});
	}

	private getScriptRefs(asms: string[]): Dependency[] {
		return asms.map(asm => {
			return new Dependency(asm, vscode.TreeItemCollapsibleState.None,
				// {
				// 	command: 'vscode.open',
				// 	title: '',
				// 	tooltip: 'Script Assembly: ',
				// 	arguments: [Uri.file(asm)],
				// },
				null,
				null, 'assembly');
		});
	}

	private getScriptItems(): Dependency[] {

		let refsNode = new Dependency('References', vscode.TreeItemCollapsibleState.Collapsed, null, [], 'assembly_group');

		let nodes = [];
		nodes.push(refsNode);

		this.aggregateScriptItems().forEach(item => {

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

		return nodes;

		// let deps = [
		// 	new Dependency('References', vscode.TreeItemCollapsibleState.Collapsed,
		// 		null, [asm1, asm2, asm3], 'assembly_group'
		// 	),
		// 	new Dependency(
		// 		'script.cs',
		// 		vscode.TreeItemCollapsibleState.None,
		// 		{
		// 			command: 'vscode.open',
		// 			title: '',
		// 			tooltip: 'Primary script: ' + path.basename(scriptFile),
		// 			arguments: [Uri.file(scriptFile)],
		// 		},
		// 		null,
		// 		'script'
		// 	),
		// 	new Dependency(
		// 		'utils.cs',
		// 		vscode.TreeItemCollapsibleState.None,
		// 		{
		// 			command: 'vscode.open',
		// 			title: '',
		// 			tooltip: 'Imported script: ' + path.basename(impScriptFile),
		// 			arguments: [Uri.file(impScriptFile)],
		// 		},
		// 		null,
		// 		'imported_script'
		// 	)];

		// return deps;
	}

	// private getDepsInPackageJson(packageJsonPath: string): Dependency[] {
	// 	if (this.pathExists(packageJsonPath)) {
	// 		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

	// 		const toDep = (moduleName: string): Dependency => {
	// 			if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
	// 				return new Dependency(moduleName, vscode.TreeItemCollapsibleState.Collapsed);
	// 			} else {
	// 				return new Dependency(moduleName, vscode.TreeItemCollapsibleState.None, {
	// 					command: 'extension.openPackageOnNpm',
	// 					title: '',
	// 					arguments: [moduleName],
	// 				});
	// 			}
	// 		}

	// 		const deps = packageJson.dependencies
	// 			? Object.keys(packageJson.dependencies).map(toDep)
	// 			: [];
	// 		const devDeps = packageJson.devDependencies
	// 			? Object.keys(packageJson.devDependencies).map(toDep)
	// 			: [];
	// 		return deps.concat(devDeps);
	// 	} else {
	// 		return [];
	// 	}
	// }

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
				// icon = 'document';
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