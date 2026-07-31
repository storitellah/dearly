/**
 * Where the pages break.
 *
 * One routine, used by the writing surface and by printing, so the break the
 * writer sees is the break the printer makes. Keeping two copies of this rule
 * is how a preview starts lying.
 *
 * The flow is one continuous column whose top padding is the first page's top
 * margin. Two rules decide the breaks:
 *
 *  1. A block that would straddle a boundary is pushed past it with a top
 *     margin, so a paragraph is never cut in half.
 *  2. A block too tall to fit on any page has to be split, and it is split
 *     between two of its own lines — never through the middle of one.
 */

export interface Pagination {
  /**
   * Where each page begins, in the flow's own pixel coordinates. The first
   * entry is the flow's top padding; `starts.length` is the page count.
   */
  starts: number[];
  /** Height of each page, in CSS pixels. Never more than the usable band. */
  heights: number[];
  /** The full usable band, before any line-boundary trimming. */
  maxHeightPx: number;
}

/**
 * Measures a flow and inserts the spacers that keep blocks whole.
 *
 * `flow` must be laid out — in the document, with a real width — or the result
 * is a single page.
 */
export function paginateFlow(flow: HTMLElement, maxHeightPx: number): Pagination {
  const blocks: HTMLElement[] = [];
  for (const child of Array.from(flow.children)) {
    if (child instanceof HTMLElement) {
      child.style.removeProperty('margin-top');
      blocks.push(child);
    }
  }

  if (maxHeightPx <= 0 || blocks.length === 0) {
    return { starts: [0], heights: [maxHeightPx], maxHeightPx };
  }

  const origin = blocks[0]!.offsetTop;
  const starts = [origin];
  const heights: number[] = [];

  const openPage = (at: number): void => {
    heights.push(at - starts[starts.length - 1]!);
    starts.push(at);
  };

  for (const block of blocks) {
    const pageTop = starts[starts.length - 1]!;
    const limit = pageTop + maxHeightPx;
    const top = block.offsetTop;
    const height = block.offsetHeight;

    if (block.dataset.blockType === 'page-break') {
      if (top > pageTop) {
        block.style.setProperty('margin-top', `${limit - top}px`);
        openPage(limit);
      }
      continue;
    }

    if (top >= limit) {
      // Whatever came before already ran past the boundary.
      openPage(limit);
      continue;
    }

    if (top + height <= limit) continue;

    if (height <= maxHeightPx) {
      // It fits on a page, just not this one: push the whole block over.
      block.style.setProperty('margin-top', `${limit - top}px`);
      openPage(limit);
      continue;
    }

    // Taller than any page. Split it, but only between its own lines, and
    // carry on until what is left of it fits.
    let cursor = pageTop;
    const bottom = block.offsetTop + block.offsetHeight;
    while (bottom > cursor + maxHeightPx) {
      const breakAt = lastLineBottomWithin(block, cursor + maxHeightPx);
      const next = breakAt > cursor ? breakAt : cursor + maxHeightPx;
      openPage(next);
      cursor = next;
    }
  }

  heights.push(maxHeightPx);
  return { starts, heights, maxHeightPx };
}

/**
 * The bottom of the last line of `block` that finishes at or above `limit`,
 * in the same coordinates as `offsetTop`.
 *
 * Returns 0 when the block has no measurable lines, which tells the caller to
 * fall back to cutting at the limit.
 */
function lastLineBottomWithin(block: HTMLElement, limit: number): number {
  const range = document.createRange();
  range.selectNodeContents(block);
  const rects = Array.from(range.getClientRects());
  if (rects.length === 0) return 0;

  // Client rects are viewport-relative; offsetTop is not. One shared reference
  // point converts between them.
  const blockRect = block.getBoundingClientRect();
  const offset = block.offsetTop - blockRect.top;

  let best = 0;
  for (const rect of rects) {
    const bottom = rect.bottom + offset;
    if (bottom <= limit && bottom > best) best = bottom;
  }
  return best;
}
