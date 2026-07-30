/**
 * Print and export.
 *
 * The heavy modules — canvas rendering, the PDF writer, the archive format — are
 * imported on demand, so opening the editor does not pay for them. Every export
 * runs locally and produces a real file.
 */

import { el } from '../utilities/dom';
import { PAPERS } from '../printing/paper';
import { getPreferences, setPreferences } from '../storage/preferences';
import { putLetter } from '../storage/letters-repo';
import { assessPassword, encryptionAvailable } from '../security/crypto';
import { passwordDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { toast } from '../ui/toast';
import { describe } from '../utilities/events';
import type { EditorContext } from './context';

export interface ExportPanel {
  element: HTMLElement;
  print(): Promise<void>;
}

export function createExportPanel(context: EditorContext): ExportPanel {
  const panel = el('details', { class: 'panel' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Print, export and backup' }));
  const body = el('div', { class: 'panel__body' });

  const preferences = getPreferences();

  /* Print options ---------------------------------------------------------- */

  const paperSelect = el('select', { class: 'input', id: 'print-paper' }) as HTMLSelectElement;
  for (const paper of PAPERS) paperSelect.append(el('option', { value: paper.id, text: paper.name }));
  paperSelect.value = preferences.paperSize;
  paperSelect.addEventListener('change', () => {
    setPreferences({ paperSize: paperSelect.value as 'a4' | 'letter' | 'a5' });
  });

  const scopeSelect = el('select', { class: 'input', id: 'print-scope' }) as HTMLSelectElement;
  for (const [value, label] of [
    ['letter', 'Letter only'],
    ['envelope', 'Envelope only'],
    ['letter-and-envelope', 'Letter and envelope'],
  ] as const) {
    scopeSelect.append(el('option', { value, text: label }));
  }

  const envelopeTarget = el('select', { class: 'input', id: 'print-envelope-target' }) as HTMLSelectElement;
  envelopeTarget.append(
    el('option', { value: 'sheet', text: 'On a sheet, with cut guides' }),
    el('option', { value: 'envelope', text: 'Directly onto the envelope' }),
  );

  const checkbox = (id: string, label: string, checked: boolean): { field: HTMLElement; input: HTMLInputElement } => {
    const input = el('input', { type: 'checkbox', class: 'checkbox', id }) as HTMLInputElement;
    input.checked = checked;
    return {
      field: el('div', { class: 'field field--checkbox' }, [
        input,
        el('label', { class: 'label', for: id, text: label }),
      ]),
      input,
    };
  };

  const pageNumbers = checkbox('print-page-numbers', 'Page numbers', true);
  const foldGuides = checkbox('print-fold-guides', 'Folding guides', false);
  const cutGuides = checkbox('print-cut-guides', 'Cutting guides', false);
  const photographs = checkbox('print-photographs', 'Include photographs', true);
  const duplex = checkbox('print-duplex', 'Double-sided (adds a blank sheet where needed)', false);

  const marginInput = (id: string, label: string, value: number): { field: HTMLElement; input: HTMLInputElement } => {
    const input = el('input', {
      type: 'number',
      class: 'input input--small',
      id,
      min: '5',
      max: '45',
      step: '1',
      value: String(value),
    }) as HTMLInputElement;
    return {
      field: el('div', { class: 'field field--tiny' }, [
        el('label', { class: 'label', for: id, text: label }),
        input,
      ]),
      input,
    };
  };

  const marginsUseStationery = checkbox('print-margins-auto', 'Use the stationery’s own margins', true);
  const top = marginInput('print-margin-top', 'Top mm', 22);
  const right = marginInput('print-margin-right', 'Right mm', 20);
  const bottom = marginInput('print-margin-bottom', 'Bottom mm', 22);
  const left = marginInput('print-margin-left', 'Left mm', 20);

  const marginFields = el('div', { class: 'field-row' }, [
    top.field,
    right.field,
    bottom.field,
    left.field,
  ]);
  const syncMarginState = (): void => {
    const auto = marginsUseStationery.input.checked;
    for (const control of [top.input, right.input, bottom.input, left.input]) control.disabled = auto;
  };
  marginsUseStationery.input.addEventListener('change', syncMarginState);
  syncMarginState();

  const printButton = el('button', { type: 'button', class: 'button button--primary', text: 'Print or save as PDF…' });
  printButton.addEventListener('click', () => void doPrint());

  body.append(
    el('div', { class: 'field-grid' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'print-paper', text: 'Paper size' }),
        paperSelect,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'print-scope', text: 'What to print' }),
        scopeSelect,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'print-envelope-target', text: 'Envelope printing' }),
        envelopeTarget,
      ]),
    ]),
    el('div', { class: 'field-row' }, [
      pageNumbers.field,
      foldGuides.field,
      cutGuides.field,
      photographs.field,
      duplex.field,
    ]),
    marginsUseStationery.field,
    marginFields,
    el('p', {
      class: 'field-hint',
      text:
        'In the print dialog, set scale to 100% and turn off “fit to page”. The Print check ' +
        'section prints a ruler so you can confirm your printer is accurate.',
    }),
    el('div', { class: 'button-row' }, [printButton]),
  );

  /* Exports ---------------------------------------------------------------- */

  const exportRow = el('div', { class: 'button-row' });
  const addExport = (label: string, run: () => Promise<void>): void => {
    const button = el('button', { type: 'button', class: 'button button--quiet', text: label });
    button.addEventListener('click', () => {
      button.disabled = true;
      void run()
        .catch((error: unknown) => toast(`Export failed: ${describe(error)}`, 'error'))
        .finally(() => {
          button.disabled = false;
        });
    });
    exportRow.append(button);
  };

  const options = () => ({
    paperId: paperSelect.value,
    includePhotographs: photographs.input.checked,
    showPageNumbers: pageNumbers.input.checked,
    showFoldGuides: foldGuides.input.checked,
  });

  addExport('PDF', async () => {
    await context.flush();
    const api = await import('../export/index');
    const result = await api.exportPdf(context.letter, context.attachments, {
      ...options(),
      dpi: 220,
    });
    toast(`Saved ${result.fileName}.`, 'success');
  });

  addExport('PNG pages', async () => {
    await context.flush();
    const api = await import('../export/index');
    const results = await api.exportImages(context.letter, context.attachments, 'image/png', options());
    toast(`Saved ${results.length} ${results.length === 1 ? 'image' : 'images'}.`, 'success');
  });

  addExport('JPEG pages', async () => {
    await context.flush();
    const api = await import('../export/index');
    const results = await api.exportImages(context.letter, context.attachments, 'image/jpeg', options());
    toast(`Saved ${results.length} ${results.length === 1 ? 'image' : 'images'}.`, 'success');
  });

  addExport('Plain text', async () => {
    await context.flush();
    const api = await import('../export/index');
    const result = api.exportPlainText(context.letter);
    toast(`Saved ${result.fileName}.`, 'success');
  });

  addExport('HTML letter', async () => {
    await context.flush();
    const api = await import('../export/index');
    const result = await api.exportHtml(context.letter, context.attachments);
    toast(`Saved ${result.fileName}.`, 'success');
  });

  addExport('Backup this letter (.dearly)', async () => {
    await context.flush();
    const api = await import('../export/index');
    const result = await api.exportLetterArchive(context.letter, context.attachments);
    toast(`Saved ${result.fileName}.`, 'success');
  });

  addExport('Encrypted backup (.dearly)', async () => {
    if (!encryptionAvailable()) {
      toast('This browser cannot encrypt here. A secure (https) connection is required.', 'error');
      return;
    }
    const password = await passwordDialog({
      title: 'Encrypt this backup',
      body: [
        'The backup file will be encrypted with AES-GCM, using a key derived from this password.',
        'Dearly cannot recover a forgotten password, and there is no way back into the file without it.',
      ],
      confirmLabel: 'Encrypt and save',
      requireConfirmation: true,
      strengthHint: (value) => {
        const assessment = assessPassword(value);
        return `Strength: ${assessment.label}. ${assessment.hint}`;
      },
      verify: (value) => (assessPassword(value).acceptable ? null : assessPassword(value).hint),
    }).result;
    if (!password) return;

    await context.flush();
    const api = await import('../export/index');
    const result = await api.exportLetterArchive(context.letter, context.attachments, password);
    toast(`Saved ${result.fileName}. Keep the password safe.`, 'success');
  });

  body.append(
    el('h3', { class: 'panel__subheading', text: 'Export a copy' }),
    el('p', {
      class: 'field-hint',
      text: 'Every export is produced on this device and saved straight to your downloads.',
    }),
    exportRow,
  );

  panel.append(body);

  async function doPrint(): Promise<void> {
    printButton.disabled = true;
    try {
      await context.flush();
      const { printLetter } = await import('../printing/print-controller');
      const request = {
        scope: scopeSelect.value as 'letter' | 'envelope' | 'letter-and-envelope',
        paperId: paperSelect.value,
        showPageNumbers: pageNumbers.input.checked,
        showFoldGuides: foldGuides.input.checked,
        showCutGuides: cutGuides.input.checked,
        includePhotographs: photographs.input.checked,
        duplex: duplex.input.checked,
        envelopeTarget: envelopeTarget.value as 'envelope' | 'sheet',
        ...(marginsUseStationery.input.checked
          ? {}
          : {
              margins: {
                top: Number(top.input.value),
                right: Number(right.input.value),
                bottom: Number(bottom.input.value),
                left: Number(left.input.value),
              },
            }),
      };

      const outcome = await printLetter(context.letter, context.attachments, request);
      announce(`Sent ${outcome.pages} ${outcome.pages === 1 ? 'page' : 'pages'} to the printer.`);

      const updated = await putLetter({
        ...context.letter,
        printCount: context.letter.printCount + 1,
        printedAt: new Date().toISOString(),
        status: context.letter.status === 'draft' ? 'printed' : context.letter.status,
      });
      context.replace(updated, 'print');
    } catch (error) {
      toast(`Printing failed: ${describe(error)}`, 'error');
    } finally {
      printButton.disabled = false;
    }
  }

  const sync = (): void => {
    const locked = context.locked;
    for (const control of panel.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
      'button, input, select',
    )) {
      control.disabled = locked;
    }
    if (!locked) syncMarginState();
  };
  sync();
  context.events.on('change', () => sync());

  return {
    element: panel,
    print: doPrint,
  };
}
