import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import * as os from 'os';
import { exec } from 'child_process';

import { getContext } from './context'; // 引入扩展上下文
import { OHLOG } from './logger';

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

/**
 * 获取当前活动编辑器中光标所在行的文件名和行号
 * @param useRelativePath 是否使用相对路径（默认为 false，使用文件名）
 * @returns 文件路径:行号（如 main.cpp:10 或 src/main.cpp:10），无编辑器时返回 undefined
 */
export function getCurrentLineNum(useRelativePath: boolean = false): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    let separator = "\\";
    if (os.platform() !== "win32") {
        separator = "/";
    }
    const document = editor.document; // 当前文档
    const fileName = editor.document.fileName.split(separator).pop();
    const selection = editor.selection;
    const currentLine = document.lineAt(selection.active.line);
    const filePath = useRelativePath ? vscode.workspace.asRelativePath(document.fileName) : fileName;
    return filePath + ":" + currentLine.lineNumber.toString();
}

/**
 * 校验可执行文件路径是否有效
 * @param BinPath 可执行文件的路径
 * @returns 如果路径有效返回 true，否则返回 false
 */
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
 * 检查路径是否合法,目录或者文件是否存在
 * @param inputPath 要验证的路径
 * @returns 返回路径是否合法以及类型（文件/目录/无效）
 */
export function validatePath(inputPath: string): { type: 'file' | 'directory' | 'invalid' } {
    if (!inputPath || inputPath.trim() === "") {
        return { type: 'invalid' };
    }
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


/**
 * 弹出输入框让用户输入路径，并验证路径是否合法
 * @param configPath 配置项的路径
 * @param defaultPath 默认路径
 * @param fileType 文件类型（'file' 或 'directory'）
 * @param prompt 输入框提示信息
 * @returns 返回用户输入的合法路径或默认路径
 */
async function setPathToConfig(configPath: string, defaultPath: string, fileType: string, prompt: string): Promise<string> {
    const config = vscode.workspace.getConfiguration();
    let binPath = await vscode.window.showInputBox({
        placeHolder: prompt,
        prompt: prompt,
        value: defaultPath,
    });
    if (!binPath) {
        return defaultPath;
    }
    const ret = validatePath(binPath);
    // 如果用户输入了合法路径，则保存到配置中
    if (ret.type === fileType) {
        config.update(configPath, binPath, vscode.ConfigurationTarget.Workspace);
    }

    return binPath;
}

/**
 * 获取插件的终端类型
 * @returns 返回终端的类型（如 "cmd", "bash" 等）
 */
export function getTerminalType(): string {
    const platform = os.platform();  // 获取当前操作系统
    const terminalShell = vscode.env.shell; // 获取当前终端的 shell 类型
    OHLOG.instance.log(`Current terminal shell: ${terminalShell}`);

    if (platform === 'win32') {
        // 如果是 Windows 系统
        if (terminalShell?.includes('cmd') || terminalShell?.includes('powershell')) {
            return "cmd";
        } else if (terminalShell?.includes('bash')) {
            return "bash";
        } else {
            return "cmd"; // 默认返回cmd
        }
    } else if (platform === 'linux' || platform === 'darwin') {
        return "bash";
    } else {
        return "bash";
    }
}

/**
 * 将 Windows 路径转换为 Git Bash 格式的路径
 * @param filePath Windows 路径
 * @returns 转换后的 Git Bash 格式路径
 */
export function winPathToGitBashPath(filePath: string): string {
    if (os.platform() === 'win32') {
        // 获取驱动器字母并转换为小写
        const driveLetter = filePath.charAt(0).toLowerCase();
        // 替换驱动器字母为 Git Bash 格式
        return filePath.replace(/^[a-zA-Z]:\\/, `/${driveLetter}/`).replace(/\\/g, '/');
    }
    return filePath;
}

// 获取当选中的文本或光标所在单词
export function getSelectedTextOrWord(editor: vscode.TextEditor | undefined): string | undefined {
    if (!editor) {
        return undefined;
    }
    let word: string = editor.document.getText(editor.selection);
    if (!word) {
        // 如果没有选中文本，则获取光标所在单词
        const range = editor.document.getWordRangeAtPosition(editor.selection.start);
        if (range) {
            word = editor.document.getText(range);
        }
    }
    if (!word) {
        vscode.window.showInformationMessage('Nothing selected!');
        return;
    }

    return word.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'); // 转义正则特殊字符
}