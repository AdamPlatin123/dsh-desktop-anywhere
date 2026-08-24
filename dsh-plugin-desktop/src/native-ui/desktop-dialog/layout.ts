interface DesktopDialogLayoutElement {
  readonly scrollHeight: number
  getBoundingClientRect(): { readonly height: number }
}

/** Include overflowing descendants such as a footer that finishes after the box. */
export function desktopDialogContentHeight(element: DesktopDialogLayoutElement): number {
  return Math.ceil(Math.max(element.scrollHeight, element.getBoundingClientRect().height))
}
