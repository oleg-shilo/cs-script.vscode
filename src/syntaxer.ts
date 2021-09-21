
import * as fs from 'fs';
import * as net from "net";
import * as path from "path";
import * as process from "process";
import * as child_process from "child_process";
import { save_as_temp, clear_temp_file_suffixes } from "./utils";
import * as utils from "./utils";

// export function init(cscs: string, server: string): void {
//     CSCS = cscs;
//     SERVER = server;
// }



export function server(): string {
    return path.join(utils.user_dir(), "dotnet", "syntaxer", "syntaxer.dll")
}

function cscs(): string {
    return path.join(utils.user_dir(), "dotnet", "cscs.dll")
}

let PORT = 18003;

export function start_syntaxer(): void {

    let runtime = "dotnet";

    let SERVER = server();
    let CSCS = cscs();

    // let CSCS = path.join(utils.user_dir(), "dotnet", "cscs.dll");
    // let SERVER = path.join(utils.user_dir(), "dotnet", "syntaxer", "syntaxer.dll");

    let args = [SERVER, `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`];
    child_process.execFile(runtime, args,
        (error, stdout, stderr) => {
            console.log(stderr);
            console.log(stdout);
        }
    );
}

export class Syntaxer {

    public static init(): void {
    }

    public static sentStopRequest(): void {

        let client = new net.Socket();
        client.connect(PORT, '127.0.0.1', function () {
            client.write('-exit');
        });
    }

    private static send(request: string, onData: (data: string) => void): void {

        // 18000 - Sublime Text 3
        // 18001 - Notepad++
        // 18002 - VSCode.CodeMap
        // 18003 - VSCode.CS-Script

        let client = new net.Socket();
        client.connect(PORT, '127.0.0.1', function () {
            client.write(request);
        });

        client.on('error', function (error) {
            let server_exe = server();
            if (fs.existsSync(server_exe)) { // may not started yet (or crashed)
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

    public static send_request(request: string, code: string, file: string, resolve: any, inject_source_info: boolean = true): void {
        let temp_file = save_as_temp(code, file, inject_source_info);

        Syntaxer.send(request.replace("$temp_file$", temp_file),
            data => {
                // possibly it is a temp file reference
                resolve(clear_temp_file_suffixes(data));
                fs.unlink(temp_file, error => { });
            });
    }

    public static getCompletions(code: string, file: string, position: number, resolve: any): void {

        let request = `-client:${process.pid}\n-op:completion\n-script:$temp_file$\n-pos:${position}\n-doc`;
        Syntaxer.send_request(request, code, file, resolve);
    }

    public static suggestUsings(code: string, file: string, word: string, resolve: any): void {

        let request = `-client:${process.pid}\n-op:suggest_usings:${word}\n-script:$temp_file$`;
        Syntaxer.send_request(request, code, file, resolve);
    }

    public static getSignatureHelp(code: string, file: string, position: number, resolve: any): void {
        let request = `-client:${process.pid}\n-op:signaturehelp\n-script:$temp_file$\n-pos:${position}`;

        Syntaxer.send_request(request, code, file, resolve);
    }

    public static getTooltip(code: string, file: string, position: number, resolve: any,): void {

        let hint = '';
        let request = `-client:${process.pid}\n-op:tooltip:${hint}\n-script:$temp_file$\n-pos:${position}`;
        Syntaxer.send_request(request, code, file, resolve);
    }

    public static getRefrences(code: string, file: string, position: number, resolve: any): void {

        let request = `-client:${process.pid}\n-op:references\n-script:$temp_file$\n-pos:${position}`;
        Syntaxer.send_request(request, code, file, resolve);
    }

    // Just to show that it's possible to go Thenable. Used in `find_references()`.
    // Unfortunately all intellisense providers cannot take advantage of this as their signatures are not async.  
    public static getReferencesAsync(code: string, file: string, position: number): Thenable<string> {

        return new Promise((resolve, reject) => {
            let request = `-client:${process.pid}\n-op:references\n-script:$temp_file$\n-pos:${position}`;
            Syntaxer.send_request(request, code, file, resolve);
        });
    }

    public static getRenamingInfo(code: string, file: string, position: number, resolve: any): void {

        let request = `-client:${process.pid}\n-op:references\n-context:all\n-script:$temp_file$\n-pos:${position}`;
        Syntaxer.send_request(request, code, file, resolve);
    }

    public static ping(resolve: any): void {

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

    public static doDocFormat(code: string, file: string, position: number, resolve: any): void {

        let request = `-client:${process.pid}\n-op:format\n-script:$temp_file$\n-pos:${position}`;
        Syntaxer.send_request(request, code, file, resolve, false);
    }

    public static getDefinition(code: string, file: string, position: number, resolve: any): void {

        let request = `-client:${process.pid}\n-op:resolve\n-script:$temp_file$\n-pos:${position}`;
        Syntaxer.send_request(request, code, file, resolve);
    }
}
