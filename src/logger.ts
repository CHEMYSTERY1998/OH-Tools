import * as vscode from 'vscode';

export class OutputLogger {
    private outputChannel: vscode.OutputChannel;

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    /**
     * 输出日志信息到输出通道并显示
     * @param args 多个日志信息
     */
    public outputLog(...args: any[]): void {
        this.log(...args);
        this.show();
    }

    /**
     * 记录日志信息到输出通道
     * @param args 多个日志信息
     */
    public log(...args: any[]): void {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            try {
                // 尝试转换为字符串（支持对象/数组）
                return typeof arg === 'string' ? arg : JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }).join(''); // 用""连接所有参数

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