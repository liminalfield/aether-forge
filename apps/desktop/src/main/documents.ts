import type { IpcResult, ReferenceDocView } from '../shared/ipc';
import type { RegistryHolder } from './import-package';

/**
 * Reading what a move actually says.
 *
 * Every package carries its documents: the full text of each move, imported
 * and hashed alongside the tables. Until now nothing has ever sent one
 * anywhere, so the application held the words that explain what a person is
 * about to do and showed them a sentence it made up instead.
 *
 * Found by the identifier a check already carries as its `docRef`, which is
 * the same identifier the importer gave the document, so the two need no
 * mapping between them.
 *
 * See `design/the-journal-you-play-in.md`.
 */

export function readDocument(holder: RegistryHolder, id: unknown): IpcResult<ReferenceDocView> {
  if (typeof id !== 'string' || id === '') {
    return { ok: false, failure: { kind: 'invalid-request', detail: 'a document needs an id' } };
  }

  for (const box of holder.current.packages) {
    const document = box.documents.find((each) => each.id === id);
    if (document !== undefined) {
      return {
        ok: true,
        value: {
          id: document.id,
          title: document.title,
          text: document.text,
          package: { id: box.manifest.id, version: box.manifest.version },
        },
      };
    }
  }

  // A move whose text this machine does not hold. Real: a campaign can
  // reference a package that has been removed, and a module can declare a
  // check whose content arrived from somewhere else.
  return {
    ok: false,
    failure: { kind: 'unknown-document', detail: `${id} is not something this machine holds` },
  };
}
