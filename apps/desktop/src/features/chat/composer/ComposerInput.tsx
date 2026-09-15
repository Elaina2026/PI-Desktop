import type {
  ClipboardEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import type { useComposerAutocomplete } from "../../../hooks/use-composer-autocomplete";
import { editorSelectionRange, readEditorValue } from "./editor";

type AutocompleteController = ReturnType<typeof useComposerAutocomplete>;

export type ComposerInputProps = {
  inputRef: RefObject<HTMLDivElement | null>;
  value: string;
  placeholderText: string;
  placeholderKey: string;
  inputBlocked: boolean;
  pasting: boolean;
  enterToSend: boolean;
  runActive: boolean;
  composerAc: AutocompleteController;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onAcceptCompletion: (index: number) => void;
  onSubmit: (steering?: boolean) => void;
  onInsertNewline: () => void;
  onInput: (source: string, caret: number) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (event: FormEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onHistoryPrevious?: () => void;
  onHistoryNext?: () => void;
};

/** Rich contenteditable input; draft state and async operations stay outside. */
export function ComposerInput({
  inputRef,
  value,
  placeholderText,
  placeholderKey,
  inputBlocked,
  pasting,
  enterToSend,
  runActive,
  composerAc,
  onPaste,
  onAcceptCompletion,
  onSubmit,
  onInsertNewline,
  onInput,
  onCompositionStart,
  onCompositionEnd,
  onFocus,
  onBlur,
  onHistoryPrevious,
  onHistoryNext,
}: ComposerInputProps) {
  return (
    <div className="composer-input-wrap">
      <div className="composer-input-stage">
        {/* React does not render children into this node; the editor module
          paints atomic attachment chips imperatively. */}
        <div
          ref={inputRef}
          className="composer-input"
          role="textbox"
          aria-multiline="true"
          aria-readonly={inputBlocked}
          aria-busy={pasting}
          aria-placeholder={placeholderText}
          contentEditable={!inputBlocked}
          suppressContentEditableWarning
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          translate="no"
          onPaste={onPaste}
          onBeforeInput={(event) => {
            const native = event.nativeEvent as InputEvent;
            if (
              native.inputType === "insertParagraph" ||
              native.inputType === "insertLineBreak"
            ) {
              event.preventDefault();
              onInsertNewline();
            }
          }}
          onInput={(event) => {
            const element = event.currentTarget;
            const source = readEditorValue(element);
            const { start } = editorSelectionRange(element);
            onInput(source, start);
          }}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            // An Enter that confirms an IME candidate must commit text, never
            // send it or drive autocomplete (D125).
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === "Enter" && event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              composerAc.close();
              onSubmit(runActive);
              return;
            }
            if (composerAc.open && event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              composerAc.close();
              return;
            }
            if (composerAc.hasItems) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const delta = event.key === "ArrowDown" ? 1 : -1;
                const count = composerAc.items.length;
                composerAc.setHighlight(
                  (composerAc.highlight + delta + count) % count,
                );
                return;
              }
              if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
                event.preventDefault();
                onAcceptCompletion(composerAc.highlight);
                return;
              }
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              const sel = editorSelectionRange(event.currentTarget);
              const atStart = sel.start === 0 && !value.slice(0, sel.start).includes("\n");
              if (event.key === "ArrowUp" && (value.length === 0 || atStart) && onHistoryPrevious) {
                event.preventDefault();
                onHistoryPrevious();
                return;
              }
              if (event.key === "ArrowDown" && onHistoryNext) {
                const atEnd = sel.end === value.length;
                if (value.length === 0 || atEnd) {
                  event.preventDefault();
                  onHistoryNext();
                  return;
                }
              }
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              (enterToSend || event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        {value.length === 0 ? (
          <span
            key={placeholderKey}
            className="composer-placeholder"
            aria-hidden="true"
          >
            {placeholderText}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export type ComposerInputStateSetters = {
  setComposing: Dispatch<SetStateAction<boolean>>;
  setInputFocused: Dispatch<SetStateAction<boolean>>;
};
