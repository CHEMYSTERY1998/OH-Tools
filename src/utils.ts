import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

import { OHLOG } from './logger';

const CODE_BASE_PATH = '/srv/workspace/dev_0324_cc471034f/code';
const ADDR2LINE_TOOL_PATH = path.join(CODE_BASE_PATH, 'prebuilts/clang/ohos/linux-x86_64/llvm/bin/llvm-addr2line');
const ABI_TYPE = 'generic_generic_arm_64only';
const DEVICE_TYPE = 'general_all_phone_standard';
const CALLSTACK_INFO = `
#00 pc 00000000001c04fc /system/lib/ld-musl-aarch64.so.1(__timedwait_cp+192)(b1d75fe0aeacc10814a52e8e7263a527)
#01 pc 00000000001c2650 /system/lib/ld-musl-aarch64.so.1(pthread_cond_timedwait+188)(b1d75fe0aeacc10814a52e8e7263a527)
#02 pc 00000000000c11f8 /system/lib64/libc++.so(std::__h::condition_variable::__do_timed_wait(std::__h::unique_lock<std::__h::mutex>&, std::__h::chrono::time_point<std::__h::chrono::system_clock, std::__h::chrono::duration<long long, std::__h::ratio<1l, 1000000000l>>>)+108)(636474219bd868a0ae4d237e71f55db2c72e3149)
#03 pc 00000000001c055c /data/test/HmlV1ProcessorTest(27f1829a3a1274c60db6e270dd305886)
#04 pc 00000000001bfd60 /data/test/HmlV1ProcessorTest(OHOS::SoftBus::WifiDirectContext::CheckResult(int, OHOS::SoftBus::WifiDirectContext::ResultType)+464)(27f1829a3a1274c60db6e270dd305886)
#05 pc 00000000001db234 /data/test/HmlV1ProcessorTest(OHOS::SoftBus::HmlV1ProcessorTest_ProcessConnectCommandForCreate01_Test::TestBody()+432)(27f1829a3a1274c60db6e270dd305886)
#06 pc 000000000020fccc /data/test/HmlV1ProcessorTest(testing::Test::Run()+212)(27f1829a3a1274c60db6e270dd305886)
#07 pc 0000000000210924 /data/test/HmlV1ProcessorTest(testing::TestInfo::Run()+568)(27f1829a3a1274c60db6e270dd305886)
#08 pc 000000000021137c /data/test/HmlV1ProcessorTest(testing::TestSuite::Run()+476)(27f1829a3a1274c60db6e270dd305886)
#09 pc 000000000021e718 /data/test/HmlV1ProcessorTest(testing::internal::UnitTestImpl::RunAllTests()+1224)(27f1829a3a1274c60db6e270dd305886)
#10 pc 000000000021e0ac /data/test/HmlV1ProcessorTest(testing::UnitTest::Run()+120)(27f1829a3a1274c60db6e270dd305886)
#11 pc 000000000022e904 /data/test/HmlV1ProcessorTest(main+96)(27f1829a3a1274c60db6e270dd305886)
#12 pc 00000000000a159c /system/lib/ld-musl-aarch64.so.1(libc_start_main_stage2+80)(b1d75fe0aeacc10814a52e8e7263a527)
`;

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

function getCallStackMap(callStackInfo:string): Record<string, [string, string]> {
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

async function parseCallStack(libraryPaths: Record<string, string>, callStackMap: Record<string,[string, string]>):
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
            OHLOG.instance.log(`${ADDR2LINE_TOOL_PATH} -Cfpie ${libraryPath} ${address}`);
        } catch (error) {
            console.error(`Error processing address ${address}:`, error);
        }
    }

    // OHLOG.logger.log(formattedCallStack);
    OHLOG.instance.show();
}

export async function processCallStack() {
    const sharedLibraryPath = path.join(CODE_BASE_PATH, 'out', ABI_TYPE, DEVICE_TYPE, 'lib.unstripped');
    const executablePath = path.join(CODE_BASE_PATH, 'out', ABI_TYPE, DEVICE_TYPE, 'exe.unstripped');
    const libraryPaths = { ...collectZippedSharedLibraries(sharedLibraryPath), ...collectExecutableFiles(executablePath) };
    const callStackMap = getCallStackMap(CALLSTACK_INFO);
    parseCallStack(libraryPaths, callStackMap);
}

