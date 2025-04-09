import * as vscode from 'vscode';

export function getWebviewContent(initialState: any): string {
  const initData = JSON.stringify(initialState || {});
  return `
<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <title>Callstack 转换工具</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        body {
            font-family: Arial, sans-serif;
            margin: 0;
            height: 100vh;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .form-group {
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }

        label {
            width: 150px;
            text-align: right;
            margin-right: 10px;
        }

        input[type="text"],
        textarea {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-editorWidget-border);
            font-size: 16px;
            padding: 6px;
        }

        input[type="text"] {
            width: 400px;
            height: 30px;
        }

        textarea {
            width: 600px;
            height: 200px;
            resize: none;
        }

        .submit-button {
            margin-top: 30px;
            text-align: center;
        }

        button {
            font-size: 16px;
            padding: 10px 20px;
            cursor: pointer;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-editorWidget-border);
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="form-group">
            <label for="addr2line">addr2line路径</label>
            <input type="text" id="addr2line" name="addr2line">
        </div>

        <div class="form-group">
            <label for="outpath">编译产物out路径</label>
            <input type="text" id="outpath" name="outpath">
        </div>

        <div class="form-group" style="flex-direction: column; align-items: flex-start;">
            <label for="callstack" style="text-align: left; margin-bottom: 5px;">CallStack信息</label>
            <textarea id="callstack" name="callstack"></textarea>
        </div>

        <div class="submit-button">
            <button onclick="handleSubmit()">解析调用栈信息</button>
        </div>
    </div>

    <script>
        (function () {
            const vscode = acquireVsCodeApi();
            // 恢复扩展端传递的初始状态
            const initialState = ${initData};
            if (initialState) {
                document.getElementById('addr2line').value = initialState.addr2line || '';
                document.getElementById('outpath').value = initialState.outpath || '';
                document.getElementById('callstack').value = initialState.callstack || '';
            }

            function saveState() {
                const state = {
                    addr2line: document.getElementById('addr2line').value,
                    outpath: document.getElementById('outpath').value,
                    callstack: document.getElementById('callstack').value
                };
                vscode.postMessage({
                    type: 'stateUpdate',
                    ...state
                });
            }

            // 监听所有输入变化，保存状态
            document.getElementById('addr2line').addEventListener('input', saveState);
            document.getElementById('outpath').addEventListener('input', saveState);
            document.getElementById('callstack').addEventListener('input', saveState);

            // 定义全局的提交方法，供按钮调用
            window.handleSubmit = function () {
                const addr2line = document.getElementById('addr2line').value;
                const outpath = document.getElementById('outpath').value;
                const callstack = document.getElementById('callstack').value;
                vscode.postMessage({
                    type: 'submit',
                    addr2line,
                    outpath,
                    callstack
                });
            };
        }());
    </script>
</body>

</html>

`;
}