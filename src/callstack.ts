import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import { OHLOG } from './logger';
import { extensionContext } from './extension';

function collectZippedSharedLibraries(directory: string): Record<string, string> {
    const zippedLibraries: Record<string, string> = {};
    const readDirectoryRecursively = (dir: string): string[] => {
        const files: string[] = [];
        const directories: string[] = [];
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            const entryPath = path.join(dir, entry);
            if (fs.statSync(entryPath).isDirectory()) {
                directories.push(entryPath);
            } else {
                files.push(entryPath);
            }
        }
        for (const subDir of directories) {
            files.push(...readDirectoryRecursively(subDir));
        }
        return files;
    };

    const allFiles = readDirectoryRecursively(directory);
    for (const file of allFiles) {
        if (file.endsWith('.z.so')) {
            const fileName = path.basename(file);
            zippedLibraries[fileName] = file;
        }
    }
    return zippedLibraries;
}

function collectExecutableFiles(directory: string): Record<string, string> {
    const executableFiles: Record<string, string> = {};
    const readDirectoryRecursively = (dir: string): string[] => {
        const files: string[] = [];
        const directories: string[] = [];
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            const entryPath = path.join(dir, entry);
            if (fs.statSync(entryPath).isDirectory()) {
                directories.push(entryPath);
            } else {
                files.push(entryPath);
            }
        }
        for (const subDir of directories) {
            files.push(...readDirectoryRecursively(subDir));
        }
        return files;
    };

    const allFiles = readDirectoryRecursively(directory);
    for (const file of allFiles) {
        const fileName = path.basename(file);
        executableFiles[fileName] = file;
    }
    return executableFiles;
}

function getCallStackMap(callStackInfo: string): Record<string, [string, string]> {
    const callStackMap: Record<string, [string, string]> = {};
    const regex = /(#\d+)\s+pc\s+(\w+)\s+.*\/(.*\.z\.so|.*Test)\(.*\)/;
    const lines = callStackInfo.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('#')) {
            const match = regex.exec(line);
            if (match) {
                const frameNumber = match[1];
                const address = match[2];
                const libraryName = match[3];
                callStackMap[address] = [frameNumber, libraryName];
            }
        }
    }
    return callStackMap;
}

let terminal = vscode.window.createTerminal('OH-Tools');
async function parseCallStack(addr2linePath: string, libraryPaths: Record<string, string>, callStackMap: Record<string, [string, string]>):
    Promise<void> {
    let formattedCallStack = 'stack info:\n';
    for (const address of Object.keys(callStackMap)) {
        const libraryName = callStackMap[address][1];
        const libraryPath = libraryPaths[libraryName];
        if (!libraryPath) {
            continue;
        }
        try {
            // 使用 execSync 执行命令并捕获输出
            const stdout = child_process.execSync(`${addr2linePath} -Cfpie ${libraryPath} ${address}`).toString();
            if (stdout) {
                formattedCallStack += `\x1b[31m${callStackMap[address][0]}\x1b[32m ${stdout}\x1b[0m`;
            }
        } catch (error) {
            console.error(`Error processing address ${address}:`, error);
        }
    }

    const filePath = `${addr2linePath}_parse.txt`;
    // 使用 fs 写入文件
    fs.writeFile(filePath, formattedCallStack, (err) => {
        if (!err) {
            if (!terminal || terminal.exitStatus) { // 检查终端是否已经关闭
                terminal = vscode.window.createTerminal('OH-Tools');
            }
            terminal.sendText(`cat ${filePath}`);
            terminal.show();
        }
    });
}

export async function processCallStack() {
    // 从config中获取信息
    const webviewState = extensionContext.workspaceState.get<{ addr2line: string; outpath: string; callstack: string }>('webviewState');
    if (!webviewState) {
        console.log('webviewState does not exist or is undefined');
        return;
    }
    const addr2linePath = webviewState.addr2line;
    const outPath = webviewState.outpath;
    const callStackInfo = webviewState.callstack;

    const sharedLibraryPath = path.join(outPath, 'lib.unstripped');
    const executablePath = path.join(outPath, 'exe.unstripped');
    const sharedLibraries = fs.existsSync(sharedLibraryPath)
        ? collectZippedSharedLibraries(sharedLibraryPath)
        : {};

    const executables = fs.existsSync(executablePath)
        ? collectExecutableFiles(executablePath)
        : {};

    const libraryPaths = { ...sharedLibraries, ...executables };
    const callStackMap = getCallStackMap(callStackInfo);
    parseCallStack(addr2linePath, libraryPaths, callStackMap);
}

