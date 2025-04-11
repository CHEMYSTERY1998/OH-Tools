import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewContent } from './utils';

/*
  用于创建主测栏的webview
*/
export class webView implements vscode.WebviewViewProvider {
    constructor(private context: vscode.ExtensionContext) { }

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
    }
}
