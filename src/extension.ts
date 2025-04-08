import * as vscode from 'vscode';
import {platform} from "os";

import { processCallStack } from './utils';

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

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "oh-tools" is now active!');

    const getSingleTest = vscode.commands.registerCommand('oh-tools.getSingleTest', () => {
        const currentLineText = getCurrentLineText();
        if (currentLineText === undefined) {
            vscode.window.showInformationMessage('未找到活动编辑器。');
            return;
        }
        // vscode.window.showInformationMessage(`当前行内容: ${currentLineText}`);
        const regex = /\((\w+?),\s*(\w+),\s+([\w|\.]+)\)/; // 定义正则表达式
        const match = currentLineText.match(regex); // 匹配字符串
        if (!match) {
            vscode.window.showErrorMessage("未匹配到测试用例.");
            return;
        }
        const [, testClassName, testName, testLevel] = match; // 使用数组解构将三个组存储到变量中
        const testCmd = `--gtest_filter=${testClassName}.${testName}`;
        vscode.env.clipboard.writeText(testCmd).then(() => {
            vscode.window.showInformationMessage('命令已复制到剪贴板！');
        });
    });

    // 获取当前活动行号
    const getLineNum = vscode.commands.registerCommand('oh-tools.getLineNum', () => {
        const currentLineNum =getCurrentLineNum(false); // 获取当前行号
        if (currentLineNum === undefined) {
            vscode.window.showInformationMessage('未找到活动编辑器。');
            return;
        }
        vscode.env.clipboard.writeText(currentLineNum).then(() => {
            vscode.window.showInformationMessage('文件所在行已复制到剪贴板！');
        });
    });

    const getPathLineNum = vscode.commands.registerCommand('oh-tools.getPathLineNum', () => {
        const currentLineNum =getCurrentLineNum(true); // 获取当前行号
        if (currentLineNum === undefined) {
            vscode.window.showInformationMessage('未找到活动编辑器。');
            return;
        }
        vscode.env.clipboard.writeText(currentLineNum).then(() => {
            vscode.window.showInformationMessage('文件所在行已复制到剪贴板！');
        });
    });

    // @command:editor.action.sortLinesAscending
    const sortAtoZ = vscode.commands.registerCommand('oh-tools.sortAtoZ', () => {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesAscending').then(() => {
            vscode.window.showInformationMessage('已按行升序序排序！');
        });
    });
    // @command:editor.action.sortLinesDescending
    const sortZtoA = vscode.commands.registerCommand('oh-tools.sortZtoA', () => {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesDescending').then(() => {
            vscode.window.showInformationMessage('已按行降序排序！');
        });
    });

    // getline
    const getCallLine = vscode.commands.registerCommand('oh-tools.getCallLine', () => {
        processCallStack();
    })

    context.subscriptions.push(getSingleTest, sortAtoZ, sortZtoA, getLineNum, getPathLineNum, getCallLine);
}

export function deactivate() {}
