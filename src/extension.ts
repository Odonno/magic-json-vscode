import { ExtensionContext, workspace, TextDocument, window } from 'vscode';
import { convertJsonIntoObject, extractInsights } from './core';

/**
 * this method is called when your extension is activated
 * your extension is activated the very first time the command is executed
 */
export const activate = (_: ExtensionContext) => {
	console.log('The extension "magic-json" is now active!');

	workspace.onDidChangeTextDocument(event => processActiveFile(event.document));
	window.onDidChangeActiveTextEditor(event => event && processActiveFile(event.document));
	if (window.activeTextEditor) {
		processActiveFile(window.activeTextEditor.document);
	}
}

/**
 * this method is called when your extension is deactivated
 */
export const deactivate = () => { }

const processActiveFile = async (document: TextDocument) => {
	const { enable } = workspace.getConfiguration('magic-json');

	if (!enable) {
		return;
	}

	if (document && document.languageId === "json") {
		const text = document.getText();
		console.log(text);

		const o = convertJsonIntoObject(text);
		if (!!o) {
			const insights = extractInsights(o);
			console.log(insights);
		}
	}
}