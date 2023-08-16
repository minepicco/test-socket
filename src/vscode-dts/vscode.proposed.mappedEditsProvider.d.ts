/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	export interface RelatedContextItem {

		// @ulugbekna: can context item be outside of the current file? e.g., type def used in this fn comes from another file
		readonly uri: Uri;
		readonly range: Range;
	}

	export interface MappedEditsContext {
		selections: Selection[];

		/**
		 * VS folks suggest this array to be sorted from highest to lowest priority.
		 *
		 * If there's no context, the array should be empty. It's also empty until we figure out how to compute this or retrieve from an extension (eg, copilot chat)
		 */
		related: RelatedContextItem[];

		/**
		 * Changes that should be applied to the workspace by the mapper before performing the mapping operation. (suggested by VS folks for inline chat use-case)
		 */
		changesBefore?: WorkspaceEdit;
	}

	/**
	 * Interface for providing mapped edits for a given document.
	 */
	export interface MappedEditsProvider {
		/**
		 * Provide mapped edits for a given document.
		 * @param document The document to provide mapped edits for.
		 * @param codeBlocks Code blocks that come from an LLM's reply.
		 * 						"Insert at cursor" in the panel chat only sends one edit that the user clicks on, but inline chat can send multiple blocks and let the lang server decide what to do with them.
		 * @param context The context for providing mapped edits.
		 * @param token A cancellation token.
		 * @returns A provider result of text edits.
		 */
		provideMappedEdits(
			document: TextDocument,
			codeBlocks: string[],
			context: MappedEditsContext,
			token: CancellationToken
		): ProviderResult<WorkspaceEdit | null>;
	}

	namespace chat {

		export function registerMappedEditsProvider(documentSelector: DocumentSelector, provider: MappedEditsProvider): Disposable;
	}
}
