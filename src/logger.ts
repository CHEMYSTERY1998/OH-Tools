import * as vscode from 'vscode';

export class OutputLogger {
    private outputChannel: vscode.OutputChannel;

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    /**
     * 记录日志信息到输出通道
     * @param message 日志信息
     */
    public log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * 显示输出通道
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * 释放输出通道资源
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}

export namespace OHLOG {
    export const instance = new OutputLogger('OH-Tools');
}