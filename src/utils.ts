import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { platform } from "os";
import { exec } from 'child_process';

import { processCallStack } from './callstack';
import { extensionContext } from './extension'; // 引入扩展上下文

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

function parseCallStack(addr2linePath: string, outPath: string, callstackInfo: string) {
    if (addr2linePath === undefined || outPath === undefined || callstackInfo === undefined) {
        vscode.window.showErrorMessage("请输入完整的路径和调用栈信息！");
        return;
    }
    if (validatePath(addr2linePath).type !== 'file') {
        vscode.window.showErrorMessage("addr2line路径错误,请检查!");
        return;
    }
    if (validatePath(outPath).type !== 'directory') {
        vscode.window.showErrorMessage("out路径需要包含generic_generic_arm_64only/general_all_phone_standard");
        return;
    }
    if (callstackInfo.trim() === '') {
        vscode.window.showErrorMessage("调用栈信息不能为空！");
        return;
    }
    console.log('开始解析调用栈信息...');
    processCallStack();
}

function handleMessage(message: any) {
    if (message.type === 'submit') {
        // 处理提交
        console.log('addr2line:', message.addr2line);
        console.log('outpath:', message.outpath);
        console.log('callstack:', message.callstack);
        extensionContext.workspaceState.update('webviewState', {
            addr2line: message.addr2line,
            outpath: message.outpath,
            callstack: message.callstack
        });
        // 解析调用栈信息
        parseCallStack(message.addr2line, message.outpath, message.callstack);
    } else if (message.type === 'stateUpdate') {
        // 接收到 Webview 状态更新
        extensionContext.workspaceState.update('webviewState', {
            addr2line: message.addr2line,
            outpath: message.outpath,
            callstack: message.callstack
        });
    }
}

function getWebviewContent(initialState: any): string {
    const initState = JSON.stringify(initialState || {});
    const filePath = path.join(extensionContext.extensionPath, 'media', 'webview.html');
    try {
        let html = fs.readFileSync(filePath, 'utf8');
        html = html.replace(/\/\/\[strip\]/g, "")  // 删除修剪注释行
            .replace(/{{initState}}/g, initState); // 替换变量
        return html;
    } catch (err) {
        console.error('Failed to load webview HTML', err);
        return `<html><body><h1>Error loading HTML</h1></body></html>`;
    }

}

// 创建和显示 WebviewPanel
let panel: vscode.WebviewPanel | undefined = undefined; // 单例模式
export function setCallInfoCommand() {
    // 如果已有面板，则显示
    if (panel) {
        console.log('页面再次打开...');
        panel.reveal(vscode.ViewColumn.One);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'exampleWebview',
        'My Webview',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // 从全局状态中读取之前保存的数据
    const savedState = extensionContext.workspaceState.get('webviewState');
    panel.webview.html = getWebviewContent(savedState);

    panel.webview.onDidReceiveMessage(handleMessage);


    // 监听 Webview 面板的状态变化事件
    panel.onDidChangeViewState(() => {
        if (panel && panel.visible) {
            console.log('页面切换到可见状态，刷新页面...');
            const newState = extensionContext.workspaceState.get('webviewState');
            panel.webview.html = getWebviewContent(newState); // 重新加载 HTML 内容
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
        console.log('页面关闭...');
    });
}