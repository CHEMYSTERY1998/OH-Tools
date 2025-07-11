import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getContext } from './context';
import { parseCallStack } from './callstack';
import { OHLOG } from './logger';

/*
  用于创建主测栏的webview
*/
export class webView implements vscode.WebviewViewProvider {
    private static instance: webView;

    private constructor(private context: vscode.ExtensionContext) { }

    public static getInstance(context: vscode.ExtensionContext): webView {
        if (!webView.instance) {
            webView.instance = new webView(context);
        }
        return webView.instance;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        const webview = webviewView.webview;
        webview.options = {
            enableScripts: true,
        };
        webview.html = getWebviewContent(this.context.workspaceState.get('webviewState'));
        webview.onDidReceiveMessage(handleMessage);
    }
}

export function handleMessage(message: any) {
    if (message.type === 'submit') {
        // 处理提交
        OHLOG.instance.log('addr2line:', message.addr2line);
        OHLOG.instance.log('outpath:', message.outpath);
        OHLOG.instance.log('callstack:', message.callstack);
        getContext().workspaceState.update('webviewState', {
            addr2line: message.addr2line,
            outpath: message.outpath,
            callstack: message.callstack
        });        
        // 解析调用栈信息
        parseCallStack(message.addr2line, message.outpath, message.callstack);
    } else if (message.type === 'stateUpdate') {
        // 接收到 Webview 状态更新
        getContext().workspaceState.update('webviewState', {
            addr2line: message.addr2line,
            outpath: message.outpath,
            callstack: message.callstack
        });
    } else if (message.type === 'getState') {
        const newState = getContext().workspaceState.get('webviewState');
        if (panel) {
            panel.webview.postMessage({
                command: 'returnState',
                value: newState
            });
        }
    }
}

let cachedHtml: string | undefined;
export function getWebviewContent(initialState: any): string {
    if (cachedHtml) {
        return cachedHtml;
    }
    const initState = JSON.stringify(initialState || {});
    const filePath = path.join(getContext().extensionPath, 'media', 'webview.html');
    try {
        let html = fs.readFileSync(filePath, 'utf8');
        cachedHtml = html.replace(/\/\/\[strip\]/g, "")  // 删除修剪注释行
            .replace(/{{initState}}/g, initState); // 替换变量
        return cachedHtml;
    } catch (err) {
        OHLOG.instance.log('Failed to load webview HTML', err);
        return `<html><body><h1>Error loading HTML</h1></body></html>`;
    }
}

// 创建和显示 WebviewPanel
let panel: vscode.WebviewPanel | undefined = undefined; // 单例模式
export function createParseWebPanel() {
    // 如果已有面板，则显示
    if (panel) {
        OHLOG.instance.log('页面再次打开...');
        panel.reveal(vscode.ViewColumn.One);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'exampleWebview',
        '调用栈解析',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // 从全局状态中读取之前保存的数据
    const savedState = getContext().workspaceState.get('webviewState');
    panel.webview.html = getWebviewContent(savedState).replace('600px', '300px'); // 设置 HTML 内容

    // 监听消息事件
    panel.webview.onDidReceiveMessage(handleMessage);

    // 监听 Webview 面板的状态变化事件
    panel.onDidChangeViewState(() => {
        if (panel && panel.visible) {
            OHLOG.instance.log('页面切换到可见状态，刷新页面...');
            const newState = getContext().workspaceState.get('webviewState');
            panel.webview.html = getWebviewContent(newState).replace('600px', '300px'); // 设置 HTML 内容
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
        OHLOG.instance.log('页面关闭...');
    });
}