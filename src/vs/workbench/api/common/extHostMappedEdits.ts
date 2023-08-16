/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { ExtHostMappedEditsShape, IMainContext, IMappedEditsContextDto, IWorkspaceEditDto, MainContext, MainThreadMappedEditsShape } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostDocuments } from 'vs/workbench/api/common/extHostDocuments';
import { Range, Selection, DocumentSelector, WorkspaceEdit } from 'vs/workbench/api/common/extHostTypeConverters';
import type * as vscode from 'vscode';

export class ExtHostMappedEdits implements ExtHostMappedEditsShape {

	private static handlePool: number = 0;

	private proxy: MainThreadMappedEditsShape;
	private providers = new Map<number, vscode.MappedEditsProvider>();

	constructor(
		mainContext: IMainContext,
		private readonly _documents: ExtHostDocuments,
		private readonly uriTransformer: IURITransformer | undefined
	) {
		this.proxy = mainContext.getProxy(MainContext.MainThreadMappedEdits);
	}

	async $provideMappedEdits(handle: number, docUri: UriComponents, codeBlocks: string[], context: IMappedEditsContextDto, token: CancellationToken): Promise<IWorkspaceEditDto | null> {
		const provider = this.providers.get(handle);
		if (!provider) {
			return null;
		}
		const uri = URI.revive(docUri);
		const doc = this._documents.getDocumentData(uri)?.document;
		if (!doc) {
			console.debug(`Unable to find document for ${uri.toString()}`);
			return null;
		}
		const ctx = {
			selections: context.selections.map(s => Selection.to(s)),
			related: context.related.map(r => ({ uri: URI.revive(r.uri), range: Range.to(r.range) })),
			changesBefore: context.changesBefore ? WorkspaceEdit.to(context.changesBefore) : undefined,
		};
		// TODO@ulugbekna: fixme
		const r = await provider.provideMappedEdits(doc, codeBlocks, ctx, token);
		if (!r) {
			return null;
		}

		return WorkspaceEdit.from(r);
	}

	registerMappedEditsProvider(selector: vscode.DocumentSelector, provider: vscode.MappedEditsProvider): vscode.Disposable {
		const handle = ExtHostMappedEdits.handlePool++;
		this.providers.set(handle, provider);
		this.proxy.$registerMappedEditsProvider(handle, DocumentSelector.from(selector, this.uriTransformer));
		return {
			dispose: () => {
				ExtHostMappedEdits.handlePool--;
				this.proxy.$unregisterMappedEditsProvider(handle);
				this.providers.delete(handle);
			}
		};
	}

}
