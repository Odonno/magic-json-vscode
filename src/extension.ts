import { ExtensionContext } from 'vscode';

/**
 * this method is called when your extension is activated
 * your extension is activated the very first time the command is executed
 */
export const activate = (_: ExtensionContext) => {
	console.log('The extension "magic-json" is now active!');
}

/**
 * this method is called when your extension is deactivated
 */
export const deactivate = () => { }
