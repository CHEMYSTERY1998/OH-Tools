import * as vscode from 'vscode';

import { getCurrentLineNum, getCurrentLineText } from './utils';
import { setCallInfoCommand } from './webProvider';


export namespace Commander {

    export function getSingleTestCommand() {
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
    }

    export function getLineNumCommand() {
        const currentLineNum = getCurrentLineNum(false); // 获取当前行号
        if (currentLineNum === undefined) {
            vscode.window.showInformationMessage('未找到活动编辑器。');
            return;
        }
        vscode.env.clipboard.writeText(currentLineNum).then(() => {
            vscode.window.showInformationMessage('文件所在行已复制到剪贴板！');
        });
    }

    export function getPathLineNumCommand() {
        const currentLineNum = getCurrentLineNum(true); // 获取当前行号
        if (currentLineNum === undefined) {
            vscode.window.showInformationMessage('未找到活动编辑器。');
            return;
        }
        vscode.env.clipboard.writeText(currentLineNum).then(() => {
            vscode.window.showInformationMessage('文件所在行已复制到剪贴板！');
        });
    }

    export function sortAtoZCommand() {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesAscending').then(() => {
            vscode.window.showInformationMessage('已按行升序序排序！');
        });
    }

    export function sortZtoACommand() {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesDescending').then(() => {
            vscode.window.showInformationMessage('已按行降序排序！');
        });
    }

    export function getCallLineCommand() {
        setCallInfoCommand();
    }
}
