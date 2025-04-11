import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewContent, handleMessage } from './utils';

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
