interface DesktopDialogLayoutElement {
  readonly scrollHeight: number
  getBoundingClientRect(): {
    readonly bottom: number
    readonly height: number
    readonly top: number
  }
}

interface DesktopDialogBottomElement {
  getBoundingClientRect(): { readonly bottom: number }
}

/** Measure through the last visible footer pixel, including bottom padding. */
export function desktopDialogContentHeight(
  element: DesktopDialogLayoutElement,
  footer?: DesktopDialogBottomElement,
  paddingBottom = 0,
): number {
  const bounds = element.getBoundingClientRect()
  const footerBottom = footer?.getBoundingClientRect().bottom ?? bounds.bottom
  const visibleBottom = footerBottom - bounds.top + Math.max(0, paddingBottom)
  return Math.ceil(Math.max(element.scrollHeight, bounds.height, visibleBottom))
}
