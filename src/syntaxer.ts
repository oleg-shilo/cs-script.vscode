
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as net from "net";
// import * as fse from "fs-extra"
import * as mkdirp from "mkdirp";
// import * as vscode from "vscode";
import * as process from "process";
import * as child_process from "child_process"
// import { Uri, commands } from "vscode";
import { save_as_temp } from "./utils";

// let exec = require("child_process").exec;

let SYNTAXER_VERSION = "1.2.2.0";

let CSCS = ""; // will be set at the end of this file to the path of the CS-Script engine executable
let SERVER = ""; // will be set at the end of this file to the path of the server executable
let PORT = 18003;

function startServer(): void {
	// let cscs_path = "cscs_path:C:\Users\osh\AppData\Roaming\Code\User\cs-script.user\syntaxer\1.2.2.0\cscs.exe";

	SERVER = "E:\\Galos\\Projects\\Sublime\\cs-script\\syntaxer\\bin\\Debug\\syntaxer.exe";
	child_process.execFile("mono", [SERVER, `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
	// child_process.execFile(SERVER, [`-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
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


	public static Exit(): void {

	}

	// public static isRunning(): boolean {

	// 	let response = Syntaxer.send(`-client:${process.pid}`);
	// 	return response != undefined;
	// }


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
	public static getDefinition(code: string, file: string, position: number, resolve, reject): void {
		let temp_file = save_as_temp(code, file);
		
		let rich = '\n-rich';
		rich = '';

		Syntaxer.send(`-client:${process.pid}\n-op:resolve\n-script:${temp_file}\n-pos:${position}${rich}`,
			data => {
				// possibly it is a temp file reference
				resolve(data.replace('.$temp$', ''));
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

export function DeploySyntaxer() {

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

	let fileName = "syntaxer.exe";
	let ext_dir = path.join(__dirname, "..");
	let sourceDir = path.join(ext_dir, 'bin');
	let destDir = path.join(user_dir(), 'syntaxer', SYNTAXER_VERSION, "Roslyn");

	SERVER = path.join(destDir, fileName);
	CSCS = path.join(destDir, "..", "cscs.exe");

	if (fs.existsSync(SERVER)) {
		startServer();
	}
	else {
		create_dir(destDir);

		fse.copy(path.join(sourceDir, fileName), SERVER)
			.then(startServer)
			.catch(console.error);

		fse.copy(path.join(sourceDir, "CSSRoslynProvider.dll"), path.join(destDir, path.join(destDir, "..", "CSSRoslynProvider.dll")))
			.catch(console.error);

		fse.copy(path.join(sourceDir, "cscs.exe"), CSCS)
			.catch(console.error);
	}
}