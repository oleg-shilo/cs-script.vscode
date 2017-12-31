//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as cs_script from '../cs-script';
import { ErrorInfo } from '../utils';
import * as utils from '../utils';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

    // Defines a Mocha unit test
    test("Can parse compile error string", () => {
        let build_out = "E:\\Projects\\VSCode\\test2.cs(19,11): error CS1525: Unexpected symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal("E:\\Projects\\VSCode\\test2.cs", error.file);
        assert.equal("CS1525: Unexpected symbol `.', expecting `,', `;', or `='", error.description);
        assert.equal(vscode.DiagnosticSeverity.Error, error.severity);
        assert.equal(18, error.range.start.line);
        assert.equal(10, error.range.start.character);
        assert.equal(18, error.range.end.line);
        assert.equal(10, error.range.end.character);
    });

    test("Can parse compile warning string", () => {
        let build_out = "E:\\Projects\\VSCode\\test2.cs(19,11): warning CS1525: Unexpected symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal("E:\\Projects\\VSCode\\test2.cs", error.file);
        assert.equal("CS1525: Unexpected symbol `.', expecting `,', `;', or `='", error.description);
        assert.equal(vscode.DiagnosticSeverity.Warning, error.severity);
        assert.equal(error.range.start.line, 18);
        assert.equal(error.range.start.character, 10);
        assert.equal(error.range.end.line, 18);
        assert.equal(error.range.end.character, 10);
    });

    test("Can handle invalid input", () => {
        let build_out = "E:\\19,11)dfsadfdssvbf  symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal(null, error);
    });

    test("Can handle compare versions", () => {
        assert.equal(utils.compare_versions('1.2.3.4', '1.2.3.4'), 0);
        assert.equal(utils.compare_versions('001.2.3', '1.002.3-alpha'), 0);

        assert.equal(utils.compare_versions('1.2.3', '1.2.3.1'), -1);
        assert.equal(utils.compare_versions('1.2.3.2', '1.2.3.1'), 1);

        assert.equal(utils.compare_versions('2.2.3.4', '1.2.3.4'), 1);
        assert.equal(utils.compare_versions('1.2.3.4', '2.2.3.4'), -1);

        assert.equal(utils.compare_versions('1.3.3.4', '1.2.3.4'), 1);
        assert.equal(utils.compare_versions('1.2.3.4', '1.3.3.4'), -1);

        assert.equal(utils.compare_versions('1.2.4.4', '1.2.3.4'), 1);
        assert.equal(utils.compare_versions('1.2.3.4', '1.2.4.4'), -1);

        assert.equal(utils.compare_versions('1.2.3.5', '1.2.3.4'), 1);
        assert.equal(utils.compare_versions('1.2.3.4', '1.2.3.5'), -1);
    });

    test("Can handle file ref input", () => {
        let proj_out = "file:" + __filename;
        let info = ErrorInfo.parse(proj_out);

        assert.equal(info.file, __filename);
    });

    test("Can split lines in the output", () => {
        let output = `file:c:\\Users\\usr\\Desktop\\New Script.cs
file:C:\\Users\\usr\\AppData\\Local\\Temp\\CSSCRIPT\\Cache\\dbg.cs
ref:System
ref:C:\\Program Files (x86)\\Mono\\lib\\mono/4.5/Facades\\System.ValueTuple.dll
ref:C:\\Program Files (x86)\\Mono\\lib\\mono/4.5/Facades\\System.Linq.dll
searcDir:c:\\Users\\usr\\Desktop
searcDir:C:\\ProgramData\\chocolatey\\lib\\cs-script\\tools\\cs-script\\lib
searcDir:C:\\ProgramData\\CS-Script\\inc
searcDir:C:\\Program Files (x86)\\Mono\lib\\mono/4.5/Facades
searcDir:C:\\Users\\usr\\AppData\\Roaming\\Code\\User\\cs-script.user\\lib
searcDir:C:\\Program Files (x86)\\Mono\\lib\\mono\\4.5\\Facades`;

        let lines = output.lines();

        assert.equal(lines.length, 11);
    });

    test("Can extract script name from project file", () => {
        let proj_dir = path.join(os.tmpdir(), 'CSSCRIPT', 'VSCode', 'cs-script.vscode');
        let script = cs_script.parse_proj_dir(proj_dir);
        assert.ok(fs.existsSync(script));
    });

    test("Can prepare CS-Script syntax tooltips", () => {
        //    var ttt = content.match(/-+\r?\n\/\/css_/igm)[0];
        let section_r = /-+\r?\n\/\/css_/g;
        let trim_r = /-+\r?\n/g;

        let help = cs_script.generate_syntax_help();
        let match, indexes = [];
        let prev_index: number;

        let help_map: { [id: string]: [number, string]; } = {};

        while (match = section_r.exec(help)) {
            if (prev_index) {
                let section = help.substr(prev_index, match.index - prev_index).split(trim_r)[1];
                let id = section.lines(1)[0].split(' ', 1)[0];

                help_map[id] = [prev_index, section];
            }
            prev_index = match.index;
        }

        assert.ok(help_map.keys.length > 0);
    });

});