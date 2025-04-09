import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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

async function parseCallStack(addr2linePath: string, libraryPaths: Record<string, string>, callStackMap: Record<string, [string, string]>):
    Promise<void> {
    let formattedCallStack = '';
    for (const address of Object.keys(callStackMap)) {
        const libraryName = callStackMap[address][1];
        const libraryPath = libraryPaths[libraryName];
        if (!libraryPath) {
            continue;
        }
        try {
            // exec(`${ADDR2LINE_TOOL_PATH} -Cfpie ${libraryPath} ${address}`, (error, stdout, stderr) => {
            //     if (stdout) {
            //         formattedCallStack += `\x1b[31m${callStackMap[address][0]}\x1b[32m ${stdout}\x1b[0m`
            //     }
            // });
            OHLOG.instance.log(`${addr2linePath} -Cfpie ${libraryPath} ${address}`);
        } catch (error) {
            console.error(`Error processing address ${address}:`, error);
        }
    }

    // OHLOG.logger.log(formattedCallStack);
    OHLOG.instance.show();
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
    const libraryPaths = { ...collectZippedSharedLibraries(sharedLibraryPath), ...collectExecutableFiles(executablePath) };
    const callStackMap = getCallStackMap(callStackInfo);
    parseCallStack(addr2linePath, libraryPaths, callStackMap);
}

