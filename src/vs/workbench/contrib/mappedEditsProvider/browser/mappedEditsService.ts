/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { ITextModel } from 'vs/editor/common/model';
import { IMappedEditsProvider, IMappedEditsService, MappedEditsContext } from 'vs/workbench/contrib/mappedEditsProvider/common/mappedEdits';
import { score } from 'vs/editor/common/languageSelector';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { WorkspaceEdit } from 'vs/editor/common/languages';

export class MappedEditsService implements IMappedEditsService {
	readonly _serviceBrand: undefined;

	private readonly _providers = new Set<IMappedEditsProvider>();

	constructor(
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService
	) { }

	registerMappedEditsProvider(provider: IMappedEditsProvider) {
		this._providers.add(provider);
		return {
			dispose: () => {
				this._providers.delete(provider);
			}
		};
	}

	async provideMappedEdits(document: ITextModel, codeBlocks: string[], context: MappedEditsContext, token: CancellationToken): Promise<WorkspaceEdit | null> {

		const language = this.codeEditorService.getActiveCodeEditor()?.getModel()?.getLanguageId() ?? '';

		const providers = [...this._providers.values()]
			.map((p): [IMappedEditsProvider, number] => {
				const pts = score(p.selector, document.uri, language, true, undefined, undefined);
				return [p, pts];
			})
			.filter(([p, pts]) => pts > 0)
			.sort((a, b) => b[1] - a[1]);

		if (providers.length === 0) {
			return null;
		}

		const provider = providers[0][0];

		return provider.provideMappedEdits(document, codeBlocks, context, token);
	}
}
