
import * as fs from 'fs';
import * as net from "net";
import * as path from "path";
import * as process from "process";
import * as child_process from "child_process"
import { save_as_temp, clear_temp_file_suffixes } from "./utils";
import * as utils from "./utils";

// export function init(cscs: string, server: string): void {
//     CSCS = cscs;
//     SERVER = server;
// }


function is_dotnet_proj(): Boolean { return utils.vsc_config.get("cs-script.engine_project.dotnet", true); }

export function Server(): string {
    return is_dotnet_proj ?
        path.join(utils.user_dir(), "dotnet", "syntaxer", "syntaxer.core.dll")
        :
        path.join(utils.user_dir(), "mono", "roslyn", "syntaxer.exe");
}

function Cscs(): string {
    return is_dotnet_proj ?
        path.join(utils.user_dir(), "dotnet", "cscs.dll")
        :
        path.join(utils.user_dir(), "mono", "cscs.exe");
}

let PORT = 18003;

export function start_syntaxer(): void {

    let runtime = is_dotnet_proj ? "dotnet" : "mono";

    if (utils.isWin) {
        if (is_dotnet_proj) {


            // let CSCS = path.join(utils.user_dir(), "dotnet", "cscs.dll");
            // let SERVER = path.join(utils.user_dir(), "dotnet", "syntaxer", "syntaxer.core.dll");

            let SERVER = "E:\\PrivateData\\Galos\\Projects\\Sublime\\cs-script\\syntaxer.core\\bin\\Debug\\netcoreapp3.1\\syntaxer.core.dll";
            let CSCS = "E:\\PrivateData\\Galos\\Projects\\cs-script.core\\src\\cscs\\bin\\Debug\\netcoreapp3.1\\cscs.dll";
            CSCS = "E:\\PrivateData\\Galos\\Projects\\cs-script.core\\src\\out\\.NET Core\\cscs.dll";

            SERVER = Server();
            CSCS = Cscs();
            child_process.execFile(runtime, [SERVER, `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${CSCS}`]);
            // child_process.execFile(runtime, [Server(), `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${Cscs()}`]);
        }
        else {
            child_process.execFile(Server(), [`-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${Cscs()}`]);
        }
    }
    else {
        child_process.execFile(runtime, [Server(), `-port:${PORT}`, "-listen", `-client:${process.pid}`, "-timeout:60000", `-cscs_path:${Cscs()}`]);
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
            if (fs.existsSync(Server())) { // may not started yet (or crashed)
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
