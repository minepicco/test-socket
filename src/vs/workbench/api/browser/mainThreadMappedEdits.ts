/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { reviveWorkspaceEditDto } from 'vs/workbench/api/browser/mainThreadBulkEdits';
import { ExtHostContext, ExtHostMappedEditsShape, IDocumentFilterDto, IMappedEditsContextDto, MainContext, MainThreadMappedEditsShape } from 'vs/workbench/api/common/extHost.protocol';
import { Selection, Range, WorkspaceEdit } from 'vs/workbench/api/common/extHostTypeConverters';
import { IMappedEditsProvider, IMappedEditsService } from 'vs/workbench/contrib/mappedEditsProvider/common/mappedEdits';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(MainContext.MainThreadMappedEdits)
export class MainThreadMappedEdits implements MainThreadMappedEditsShape {

	private readonly proxy: ExtHostMappedEditsShape;

	private providers = new Map<number, IMappedEditsProvider>();

	private providerDisposables = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IMappedEditsService private readonly mappedEditsService: IMappedEditsService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
		this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostMappedEdits);
	}

	$registerMappedEditsProvider(handle: number, selector: IDocumentFilterDto[]): void {
		const provider: IMappedEditsProvider = {
			selector,
			provideMappedEdits: async (document, codeBlocks, context, token) => {

				const contextDto: IMappedEditsContextDto = {
					selections: context.selections.map(s => Selection.to(s)),
					related: context.related.map(r => ({ uri: r.uri, range: r.range })),
					changesBefore: context.changesBefore ? WorkspaceEdit.from(context.changesBefore) : undefined,
				};
				const result = await this.proxy.$provideMappedEdits(handle, document.uri, codeBlocks, contextDto, token);
				return result ? reviveWorkspaceEditDto(result, this.uriIdentityService) : null;
			}
		};
		this.providers.set(handle, provider);
		const disposable = this.mappedEditsService.registerMappedEditsProvider(provider);
		this.providerDisposables.set(handle, disposable);
	}

	$unregisterMappedEditsProvider(handle: number): void {
		if (this.providers.has(handle)) {
			this.providers.delete(handle);
		}
		if (this.providerDisposables.has(handle)) {
			this.providerDisposables.delete(handle);
		}
	}

	dispose(): void {
		this.providers.clear();
		dispose(this.providerDisposables.values());
		this.providerDisposables.clear();
	}
}
