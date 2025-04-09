import * as vscode from 'vscode';

import { Comander } from './comand';

export let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context; // 现在可以重新赋值了
    console.log('Congratulations, your extension "oh-tools" is now active!');
    // 获取GTest单个用例命令
    const getSingleTest = vscode.commands.registerCommand('oh-tools.getSingleTest', Comander.getSingleTestCommand);
    // 获取当前活动行号
    const getLineNum = vscode.commands.registerCommand('oh-tools.getLineNum', Comander.getLineNumCommand);
    // 获取当前活动行号(带路径)
    const getPathLineNum = vscode.commands.registerCommand('oh-tools.getPathLineNum', Comander.getPathLineNumCommand);
    // @command:editor.action.sortLinesAscending
    const sortAtoZ = vscode.commands.registerCommand('oh-tools.sortAtoZ', Comander.sortAtoZCommand);
    // @command:editor.action.sortLinesDescending
    const sortZtoA = vscode.commands.registerCommand('oh-tools.sortZtoA', Comander.sortZtoACommand);
    // getCallLine
    const getCallLine = vscode.commands.registerCommand('oh-tools.getCallLine', Comander.getCallLineComand);

    // 注册命令
    context.subscriptions.push(getSingleTest, sortAtoZ, sortZtoA, getLineNum, getPathLineNum, getCallLine);
}

export function deactivate() { }
