
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as net from "net";
import * as vscode from 'vscode';
import * as mkdirp from "mkdirp";
import * as process from "process";
import * as child_process from "child_process"
import { save_as_temp, clear_temp_file_suffixes } from "./utils";
import * as utils from "./utils";

let SYNTAXER_VERSION = "1.2.5.0";

let CSCS = ""; // will be set at the end of this file to the path of the CS-Script engine executable
export let SERVER = ""; // will be set at the end of this file to the path of the server executable
let PORT = 18003;

function startServer(): void {

	if (utils.isWin) {
		// SERVER = "E:\\<company_name>\\Projects\\Sublime\\cs-script\\syntaxer\\bin\\Debug\\syntaxer.exe";

		// On Windows Syntaxer:RoslynIntellisense.AutoCompleter.FindReferences throws Roalyn..CodeAnalysis exception
		// when run under mono. And yet everything is OK on Linux
		child_process.execFile(SERVER, [`-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
	}
	else {
		
		child_process.execFile("mono", [SERVER, `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
	}
}

export class Syntaxer {

	public static init(): void {
		DeploySyntaxer();
	}

	private static send(request: string, onData: (data: string) => void): void {

		// 18000 - Subline Text 3
		// 18001 - Notepad++
		// 18002 - VSCode.CodeMap
		// 18003 - VSCode.CS-Script

		let client = new net.Socket();
		client.connect(PORT, '127.0.0.1', function () {
			client.write(request);
		});

		client.on('error', function (error) {
			if (fs.existsSync(SERVER)) { // may not started yet (or crashed)
				startServer();
			}
		});

		client.on('data', function (data) {
			let response = data.toString();
			client.destroy();
			if (onData)
				onData(response);
		});
	}

	public static getCompletions(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		Syntaxer.send(`-client:${process.pid}\n-op:completion\n-script:${temp_file}\n-pos:${position}\n-rich`,
			data => {
				resolve(data);
				fs.unlink(temp_file, error => { });
			});
	}

	public static getTooltip(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		let hint = '';
		Syntaxer.send(`-client:${process.pid}\n-op:tooltip:${hint}\n-script:${temp_file}\n-pos:${position}`,
			data => {
				resolve(data);
				fs.unlink(temp_file, error => { });
			});
	}
	
	public static getRefrences(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		Syntaxer.send(`-client:${process.pid}\n-op:references\n-script:${temp_file}\n-pos:${position}`,
			data => {
				resolve(clear_temp_file_suffixes(data));
				fs.unlink(temp_file, error => { });
			});
	}

	public static doDocFormat(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		Syntaxer.send(`-client:${process.pid}\n-op:format\n-script:${temp_file}\n-pos:${position}`,
			data => {
				resolve(clear_temp_file_suffixes(data));
				fs.unlink(temp_file, error => { });
			});
	}

	public static getDefinition(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		Syntaxer.send(`-client:${process.pid}\n-op:resolve\n-script:${temp_file}\n-pos:${position}`,
			data => {
				// possibly it is a temp file reference
				resolve(clear_temp_file_suffixes(data));
				fs.unlink(temp_file, error => { });
			});
	}

	public static getMemberInfo(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);

		Syntaxer.send(`-client:${process.pid}\n-op:memberinfo\n-script:${temp_file}\n-pos:${position}\n-rich\n-collapseOverloads`,
			data => {
				resolve(data);
				fs.unlink(temp_file, error => { });
			});
	}
}

export async function DeploySyntaxer() {

	function create_dir(dir: string): void {
		// fs.mkdirSync can only create the top level dir but mkdirp creates all child sub-dirs that do not exist
		const allRWEPermissions = parseInt("0777", 8);
		mkdirp.sync(dir, allRWEPermissions);
	}

	function user_dir(): string {
		// ext_context.storagePath cannot be used as it is undefined if no workspace loaded

		// vscode:
		// Windows %appdata%\Code\User\settings.json
		// Mac $HOME/Library/Application Support/Code/User/settings.json
		// Linux $HOME/.config/Code/User/settings.json

		if (os.platform() == 'win32') {
			return path.join(process.env.APPDATA, 'Code', 'User', 'cs-script.user');
		}
		else if (os.platform() == 'darwin') {
			return path.join(process.env.HOME, 'Library', 'Application Support', 'Code', 'User', 'script.user');
		}
		else {
			return path.join(process.env.HOME, '.config', 'Code', 'User', 'script.user');
		}
	}

	function purge_old_syntaxer(): void {
		let syntaxer_dir = path.join(user_dir(), 'syntaxer');

		const is_dir = source => fs.lstatSync(source).isDirectory();

		fs.readdir(syntaxer_dir, (err, items) => {
			items.forEach(item => {
				if (item != SYNTAXER_VERSION) {
					let dir = path.join(syntaxer_dir, item);
					if (is_dir(dir))
						utils.delete_dir(dir);
				}
			});
		});
	}

	let fileName = "syntaxer.exe";
	let ext_dir = path.join(__dirname, "..");
	let sourceDir = path.join(ext_dir, 'bin');
	let destDir = path.join(user_dir(), 'syntaxer', SYNTAXER_VERSION, "Roslyn");

	SERVER = path.join(destDir, fileName);
	CSCS = path.join(destDir, "..", "cscs.exe");
	let provider = path.join(destDir, "..", "CSSRoslynProvider.dll");

	try {

		if (fs.existsSync(SERVER)) {
			startServer();
		}
		else {

			create_dir(destDir);
			
			try {
				
				await fse.copy(path.join(sourceDir, "CSSRoslynProvider.dll"), provider);
				await fse.copy(path.join(sourceDir, "cscs.exe"), CSCS);
				await fse.copy(path.join(sourceDir, fileName), SERVER);
				vscode.window.showInformationMessage('New version of CS-Script Syntaxer has been deployed.');

				startServer();

			} catch (error) {
				console.error(error);
			}
			
		}

		purge_old_syntaxer();
	} catch (error) {
		vscode.window.showInformationMessage(error.toString());
	}
}