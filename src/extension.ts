import * as vscode from 'vscode';

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
        const testCmd = `./testClassName --gtest_filter=${testClassName}.${testName}`;
        vscode.env.clipboard.writeText(testCmd).then(() => {
            vscode.window.showInformationMessage('命令已复制到剪贴板！');
        })
    });


    // @command:editor.action.sortLinesAscending
    const sortAtoZ = vscode.commands.registerCommand('oh-tools.sortAtoZ', () => {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesAscending').then(() => {
            vscode.window.showInformationMessage('已按行升序序排序！');
        })
    });
    // @command:editor.action.sortLinesDescending
    const sortZtoA = vscode.commands.registerCommand('oh-tools.sortZtoA', () => {
        // 调用内置的降序排序命令
        vscode.commands.executeCommand('editor.action.sortLinesDescending').then(() => {
            vscode.window.showInformationMessage('已按行降序排序！');
        })
    })

    context.subscriptions.push(getSingleTest, sortAtoZ, sortZtoA);
}

export function deactivate() {}
