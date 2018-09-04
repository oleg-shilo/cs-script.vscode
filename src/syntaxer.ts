
import * as fs from 'fs';
import * as net from "net";
import * as process from "process";
import * as child_process from "child_process"
import { save_as_temp, clear_temp_file_suffixes } from "./utils";
import * as utils from "./utils";

export let CSCS; // will be set at the end of this file to the path of the CS-Script engine executable
export var SERVER; // will be set at the end of this file to the path of the server executable

export function init(cscs: string, server: string): void {
	CSCS = cscs;
	SERVER = server;
}
// export let SERVER = path.join(utils.user_dir(), "Roslyn", "syntaxer.exe");
// export let CSCS = path.join(utils.user_dir(), "cscs.exe");
let PORT = 18003;

export function start_syntaxer(): void {

	if (utils.isWin) {
		// SERVER = "E:\\<company_name>\\Projects\\Sublime\\cs-script\\syntaxer\\bin\\Debug\\syntaxer.exe";

		// On Windows Syntaxer:RoslynIntellisense.AutoCompleter.FindReferences throws Roslyn..CodeAnalysis exception
		// when run under mono. And yet everything is OK on Linux
		child_process.execFile(SERVER, [`-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
	}
	else {
		child_process.execFile("mono", [SERVER, `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
	}
}

export class Syntaxer {

	public static init(): void {
		// DeploySyntaxer();
	}

	public static sentStopRequest(): void {

		let client = new net.Socket();
		client.connect(PORT, '127.0.0.1', function () {
			client.write('-exit');
		});
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
				start_syntaxer();
			}
		});

		client.on('data', function (data) {
			let response = data.toString();
			client.destroy();
			if (onData)
				onData(response);
		});
	}

	public static send_request(request: string, code: string, file: string, resolve, reject, inject_source_info: boolean = true): void {
		let temp_file = save_as_temp(code, file, inject_source_info);

		Syntaxer.send(request.replace("$temp_file$", temp_file),
			data => {
				// possibly it is a temp file reference
				resolve(clear_temp_file_suffixes(data));
				fs.unlink(temp_file, error => { });
			});
	}

	public static getCompletions(code: string, file: string, position: number, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:completion\n-script:$temp_file$\n-pos:${position}\n-doc`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	public static suggestUsings(code: string, file: string, word: string, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:suggest_usings:${word}\n-script:$temp_file$`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	public static getSignatureHelp(code: string, file: string, position: number, resolve, reject): void {
		let request = `-client:${process.pid}\n-op:signaturehelp\n-script:$temp_file$\n-pos:${position}`;

		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	public static getTooltip(code: string, file: string, position: number, resolve, reject): void {

		let hint = '';
		let request = `-client:${process.pid}\n-op:tooltip:${hint}\n-script:$temp_file$\n-pos:${position}`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	public static getRefrences(code: string, file: string, position: number, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:references\n-script:$temp_file$\n-pos:${position}`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	// Just to show that it's possible to go Thenable. Used in `find_references()`.
	// Unfortunately all intellisense providers cannot take advantage of this as their signatures are not async.  
	public static getReferencesAsync(code: string, file: string, position: number): Thenable<string> {

		return new Promise((resolve, reject) => {
			let request = `-client:${process.pid}\n-op:references\n-script:$temp_file$\n-pos:${position}`;
			Syntaxer.send_request(request, code, file, resolve, reject);
		});
	}

	public static getRenameingInfo(code: string, file: string, position: number, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:references\n-context:all\n-script:$temp_file$\n-pos:${position}`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

	public static ping(resolve): void {

		let request = `-client:${process.pid}\n-op:ping`;

		let client = new net.Socket();

		client.connect(PORT, '127.0.0.1', () =>
			client.write(request)
		);

		client.on('data', data => {
			let response = data.toString();
			client.destroy();
			resolve(response);
		});

		client.on('error', () => resolve("error"));
	}

	public static doDocFormat(code: string, file: string, position: number, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:format\n-script:$temp_file$\n-pos:${position}`;
		Syntaxer.send_request(request, code, file, resolve, reject, false);
	}

	public static getDefinition(code: string, file: string, position: number, resolve, reject): void {

		let request = `-client:${process.pid}\n-op:resolve\n-script:$temp_file$\n-pos:${position}`;
		Syntaxer.send_request(request, code, file, resolve, reject);
	}

}
