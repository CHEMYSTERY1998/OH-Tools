import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { platform } from "os";
import { exec } from 'child_process';

const DEFAULT_BIN_PATH = "gn";

/**
 * 获取当前活动编辑器中光标所在行的文本内容
 * @returns 当前行的文本，如果没有活动编辑器则返回 undefined
 */
export function getCurrentLineText(): string | undefined {
    const editor = vscode.window.activeTextEditor; // 获取当前活动的编辑器
    if (!editor) {
        return undefined; // 如果没有活动编辑器，返回 undefined
    }

    const document = editor.document; // 当前文档
    const selection = editor.selection; // 当前光标或选择范围
    const currentLine = document.lineAt(selection.active.line); // 获取光标所在行
    return currentLine.text; // 返回当前行的文本
}

export function getCurrentLineNum(useRelativePath: boolean = false): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    let separator = "\\";
    if (platform() !== "win32") {
        separator = "/";
    }
    const document = editor.document; // 当前文档
    const fileName = editor.document.fileName.split(separator).pop();
    const selection = editor.selection;
    const currentLine = document.lineAt(selection.active.line);
    const filePath = useRelativePath ? vscode.workspace.asRelativePath(document.fileName) : fileName;
    return filePath + ":" + currentLine.lineNumber.toString();
}

// 校验可执行文件路径是否有效
async function validateBinaryPath(BinPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        exec(`${BinPath} --version`, (error) => {
            if (error) {
                vscode.window.showErrorMessage(`Error: Bin path is incorrect, please input the correct path.`);
                resolve(false);  // 路径无效
            } else {
                resolve(true);  // 路径有效
            }
        });
    });
}

/**
 * 检查路径是否合法
 * @param inputPath 要验证的路径
 * @returns 返回路径是否合法以及类型（文件/目录/无效）
 */
export function validatePath(inputPath: string): { type: 'file' | 'directory' | 'invalid' } {
    try {
        const resolvedPath = path.resolve(inputPath); // 解析成绝对路径
        const stats = fs.statSync(resolvedPath); // 获取路径信息

        if (stats.isFile()) {
            return { type: 'file' };
        } else if (stats.isDirectory()) {
            return { type: 'directory' };
        } else {
            return { type: 'invalid' };
        }
    } catch (error) {
        // 如果路径不存在或者出错，则视为无效路径
        return { type: 'invalid' };
    }
}


// 弹出输入框让用户输入路径
async function setPathToConfig(configPath: string, defalutPath: string, fileType: string, prompt: string): Promise<string> {
    const config = vscode.workspace.getConfiguration();
    let binPath = await vscode.window.showInputBox({
        placeHolder: prompt,
        prompt: prompt,
        value: defalutPath,
    });
    if (!binPath) {
        return defalutPath;
    }
    const ret = validatePath(binPath);
    // 如果用户输入了合法路径，则保存到配置中
    if (ret.type === fileType) {
        config.update(configPath, binPath, vscode.ConfigurationTarget.Workspace);
    }

    return binPath;
}

