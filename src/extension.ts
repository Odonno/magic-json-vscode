import { ExtensionContext, workspace, TextDocument, window, Range, Position } from 'vscode';
import { convertJsonIntoObject, extractInsights, convertSizeToString, Node } from './core';

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

const decorationType = window.createTextEditorDecorationType({ after: { margin: '0 0 0 1rem' } });

const processActiveFile = async (document: TextDocument) => {
	const { enable } = workspace.getConfiguration('magic-json');

	if (!enable) {
		return;
	}

	if (document && document.languageId === "json") {
		const text = document.getText();

		const o = convertJsonIntoObject(text);
		if (!!o) {
			const insights = extractInsights(o);

			getEditors(document.fileName).forEach(editor => {
				editor.setDecorations(
					decorationType,
					getDecorations(insights)
				);
			});
		}
	}
}

const getEditors = (fileName: string) => {
	return window.visibleTextEditors.filter(editor => editor.document.fileName === fileName);
}

const getDecorations = (insights: Node) => {
	const line = 1;
	const firstLineDecorationOptions = {
		renderOptions: {
			after: {
				contentText: convertSizeToString(insights.size) + " - " + insights.type,
			}
		},
		range: new Range(new Position(line - 1, 1024), new Position(line - 1, 1024))
	};

	return [firstLineDecorationOptions];
}