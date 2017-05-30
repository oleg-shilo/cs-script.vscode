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
import * as cs_script from '../src/cs-script';
import {ErrorInfo} from '../src/utils';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

    // Defines a Mocha unit test
    test("Can parse compile error string", () => {
        let build_out = "E:\\Projects\\VSCode\\test2.cs(19,11): error CS1525: Unexpected symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal("E:\\Projects\\VSCode\\test2.cs", error.file);
        assert.equal("CS1525: Unexpected symbol `.', expecting `,', `;', or `='", error.description);
        assert.equal(vscode.DiagnosticSeverity.Error, error.severity);
        assert.equal(19, error.range.start.line);
        assert.equal(11, error.range.start.character);
        assert.equal(19, error.range.end.line);
        assert.equal(11, error.range.end.character);
    });

    test("Can parse compile warning string", () => {
        let build_out = "E:\\Projects\\VSCode\\test2.cs(19,11): warning CS1525: Unexpected symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal("E:\\Projects\\VSCode\\test2.cs", error.file);
        assert.equal("CS1525: Unexpected symbol `.', expecting `,', `;', or `='", error.description);
        assert.equal(vscode.DiagnosticSeverity.Warning, error.severity);
        assert.equal(error.range.start.line, 18);
        assert.equal(error.range.start.character, 11);
        assert.equal(error.range.end.line, 18);
        assert.equal(error.range.end.character, 11);
    });

    test("Can handle invalid input", () => {
        let build_out = "E:\\19,11)dfsadfdssvbf  symbol `.', expecting `,', `;', or `='";
        let error = ErrorInfo.parse(build_out);

        assert.equal(null, error);
    });
    
    test("Can handle file ref input", () => {
        let proj_out = "file:"+ __filename;
        let info = ErrorInfo.parse(proj_out);

        assert.equal(info.file, __filename);
    });

    test("Can extract script name from project file", () => {
        let proj_dir = path.join(os.tmpdir(), 'CSSCRIPT', 'VSCode', 'cs-script.vscode'); 
        let script = cs_script.parse_proj_dir(proj_dir);
        assert.ok(fs.existsSync(script));
    });
    
});