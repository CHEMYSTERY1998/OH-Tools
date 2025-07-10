import * as vscode from 'vscode';

let g_extensionContext: vscode.ExtensionContext | undefined;

export function setContext(context: vscode.ExtensionContext) {
  g_extensionContext = context;
}

export function getContext(): vscode.ExtensionContext {
  if (!g_extensionContext) {
    throw new Error('ExtensionContext 未初始化');
  }
  return g_extensionContext;
}
