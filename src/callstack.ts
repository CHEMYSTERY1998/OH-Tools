import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import { platform } from 'os';

import { getContext } from './context';
import { getTerminalType, validatePath, winPathToGitBashPath } from './utils';
import { OHLOG } from './logger';

function readDirectoryRecursively(dir: string): string[] {
    const files: string[] = [];
    const directories: string[] = [];

    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch (err) {
        OHLOG.instance.log(`无法读取目录: ${dir}`, err);
        return files;
    }

    for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        let stat: fs.Stats;
        try {
            stat = fs.statSync(entryPath);
        } catch (err) {
            OHLOG.instance.log(`无法获取文件信息: ${entryPath}`, err);
            continue;
        }

        if (stat.isDirectory()) {
            directories.push(entryPath);
        } else {
            files.push(entryPath);
        }
    }
    for (const subDir of directories) {
        files.push(...readDirectoryRecursively(subDir));
    }
    return files;
}

function collectZippedSharedLibraries(directory: string): Record<string, string> {
    const zippedLibraries: Record<string, string> = {};
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
                OHLOG.instance.log(`Parsed call stack: ${frameNumber} ${address} ${libraryName}`);
            }
        }
    }
    return callStackMap;
}

let terminal = vscode.window.createTerminal('OH-Tools');
async function parseCallStackInner(addr2linePath: string, libraryPaths: Record<string, string>, callStackMap: Record<string, [string, string]>):
    Promise<void> {
    if (Object.keys(callStackMap).length === 0) {
        vscode.window.showErrorMessage("调用栈信息格式不正确，请检查输入！");
        return;
    }

    let formattedCallStack = 'stack info:\n';
    for (const address of Object.keys(callStackMap)) {
        const libraryName = callStackMap[address][1];
        const libraryPath = libraryPaths[libraryName];
        if (!libraryPath) {
            continue;
        }
        try {
            // 使用 execSync 执行命令并捕获输出
            OHLOG.instance.log(`${addr2linePath} -Cfpie ${libraryPath} ${address}`);
            const stdout = child_process.execSync(`${addr2linePath} -Cfpie ${libraryPath} ${address}`).toString();
            if (stdout) {
                formattedCallStack += `\x1b[31m${callStackMap[address][0]}\x1b[32m ${stdout}\x1b[0m`;
            }
        } catch (error) {
            OHLOG.instance.log(`Error processing address ${address}:${error}`);
        }
    }

    const filePath = `${addr2linePath}_parse.txt`;
    // 使用 fs 写入文件
    fs.writeFile(filePath, formattedCallStack, (err) => {
        if (!err) {
            if (!terminal || terminal.exitStatus) { // 检查终端是否已经关闭
                terminal = vscode.window.createTerminal('OH-Tools');
            }
            // 如果是cmd，需将 Windows 路径转换为 Git Bash 路径再输出
            if (getTerminalType() === 'cmd') {
                terminal.sendText(`type ${filePath}`); // Windows 使用 type
            } else {
                terminal.sendText(`cat ${winPathToGitBashPath(filePath)}`); // Linux 和 macOS 使用 cat
            }
            terminal.show();
        }
    });
}

export async function processCallStack() {
    // 从config中获取信息
    const webviewState = getContext().workspaceState.get<{ addr2line: string; outpath: string; callstack: string }>('webviewState');
    if (!webviewState) {
        OHLOG.instance.log('webviewState does not exist or is undefined');
        return;
    }
    const addr2linePath = isPluginAddr2lineAvailable ? getExecutablePath() : webviewState.addr2line;
    const outPath = webviewState.outpath;
    const callStackInfo = webviewState.callstack;

    const sharedLibraryPath = path.join(outPath, 'lib.unstripped');
    const executablePath = path.join(outPath, 'exe.unstripped');
    const sharedLibraries = fs.existsSync(sharedLibraryPath)
        ? collectZippedSharedLibraries(sharedLibraryPath)
        : collectZippedSharedLibraries(outPath);

    const executables = fs.existsSync(executablePath)
        ? collectExecutableFiles(executablePath)
        : collectExecutableFiles(outPath);

    const libraryPaths = { ...sharedLibraries, ...executables };
    const callStackMap = getCallStackMap(callStackInfo);
    parseCallStackInner(addr2linePath, libraryPaths, callStackMap);
}

let isPluginAddr2lineAvailable: boolean | undefined = undefined;
export function parseCallStack(addr2linePath: string, outPath: string, callstackInfo: string) {
    if (isPluginAddr2lineAvailable === undefined) {
        try {
            setExecutablePermission();
            let pluginBin = getExecutablePath();
            // 使用 execSync 执行命令并捕获输出
            OHLOG.instance.log(`${pluginBin} --help`);
            const stdout = child_process.execSync(`${pluginBin} --help`).toString();
            if (stdout) {
                OHLOG.instance.log("插件自带的 addr2line 可用");
                isPluginAddr2lineAvailable = true; // 如果命令执行成功，则认为插件自带的 addr2line 可用
            }
        } catch (error) {
            isPluginAddr2lineAvailable = false;
            OHLOG.instance.log(`Error checking plugin addr2line availability:${error}`);
        }
    }
    if (isPluginAddr2lineAvailable) {
        addr2linePath = getExecutablePath(); // 使用插件自带的 addr2line
        OHLOG.instance.log(`使用插件自带的 addr2line: ${addr2linePath}`);
    }

    if (addr2linePath === undefined || outPath === undefined || callstackInfo === undefined) {
        vscode.window.showErrorMessage("请输入完整的路径和调用栈信息！");
        return;
    }
    if (validatePath(addr2linePath).type !== 'file') {
        vscode.window.showErrorMessage("addr2line路径错误,请检查!");
        OHLOG.instance.log(`addr2line路径错误: ${addr2linePath}`);
        return;
    }
    if (validatePath(outPath).type !== 'directory') {
        vscode.window.showErrorMessage("out路径需要包含形如generic_generic_arm_64only/general_all_phone_standard");
        OHLOG.instance.log(`out路径错误: ${outPath}`);
        return;
    } else {
        OHLOG.instance.log(`out路径: ${outPath}`);
        OHLOG.instance.log(`out路径类型: ${validatePath(outPath).type}`);
    }
    if (callstackInfo.trim() === '') {
        vscode.window.showErrorMessage("调用栈信息不能为空！");
        OHLOG.instance.log('调用栈信息不能为空');
        return;
    }
    OHLOG.instance.log('开始解析调用栈信息...');
    processCallStack();
}

// 获取平台对应的二进制文件路径
export function getExecutablePath() {
    const curPlatform = platform();
    const resourcePath = path.join(__dirname, '..', 'resources'); // 确保这个路径指向插件的 resources 目录

    if (curPlatform === 'win32') {
        return path.join(resourcePath, 'llvm-addr2line.exe');
    } else if (curPlatform === 'linux') {
        return path.join(resourcePath, 'llvm-addr2line');
    } else if (curPlatform === 'darwin') {
        return path.join(resourcePath, 'llvm-addr2line'); // macOS 和 Linux 使用相同的文件
    }
    throw new Error(`Unsupported platform: ${curPlatform}`);
}

// 给插件的 addr2line 设置可执行权限（Linux 和 macOS）
export function setExecutablePermission() {
    const curPlatform = platform();
    if (curPlatform !== 'linux' && curPlatform !== 'darwin') {
        OHLOG.instance.log(`当前平台 ${curPlatform} 不需要设置可执行权限`);
        return; // 仅在 Linux 和 macOS 上设置可执行权限
    }
    const executablePath = getExecutablePath();
    fs.chmod(executablePath, '755', (err) => {
        if (err) {
            OHLOG.instance.log(`Failed to set executable permission for ${executablePath}:${err}`);
        } else {
            OHLOG.instance.log(`Set executable permission for ${executablePath}`);
        }
    });
}