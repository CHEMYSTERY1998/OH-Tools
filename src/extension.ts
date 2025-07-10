import * as vscode from 'vscode';

import { Commander } from './command';
import { webView } from './webProvider';
import { setContext } from './context'

export function activate(context: vscode.ExtensionContext) {
    setContext(context);

    console.log('Congratulations, your extension "oh-tools" is now active!');
    // 获取GTest单个用例命令
    const getSingleTest = vscode.commands.registerCommand('oh-tools.getSingleTest', Commander.getSingleTestCommand);
    // 获取当前活动行号
    const getLineNum = vscode.commands.registerCommand('oh-tools.getLineNum', Commander.getLineNumCommand);
    // 获取当前活动行号(带路径)
    const getPathLineNum = vscode.commands.registerCommand('oh-tools.getPathLineNum', Commander.getPathLineNumCommand);
    // @command:editor.action.sortLinesAscending
    const sortAtoZ = vscode.commands.registerCommand('oh-tools.sortAtoZ', Commander.sortAtoZCommand);
    // @command:editor.action.sortLinesDescending
    const sortZtoA = vscode.commands.registerCommand('oh-tools.sortZtoA', Commander.sortZtoACommand);
    // getCallLine
    const getCallLine = vscode.commands.registerCommand('oh-tools.getCallLine', Commander.getCallLineCommand);

    // 注册主侧栏面板
    const webview = vscode.window.registerWebviewViewProvider('myWebView', webView.getInstance(context),
        {
            webviewOptions: {
                retainContextWhenHidden: true // 保留上下文
            }
        });

    // 注册命令
    context.subscriptions.push(getSingleTest, sortAtoZ, sortZtoA, getLineNum, getPathLineNum, getCallLine, webview);
}

export function deactivate() { }
