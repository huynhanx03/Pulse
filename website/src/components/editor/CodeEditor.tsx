import { json } from '@codemirror/lang-json'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

const syntax = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.propertyName, color: 'var(--ink)' },
    { tag: tags.string, color: 'var(--success)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--info)' },
    { tag: tags.punctuation, color: 'var(--ink-muted)' },
    { tag: tags.invalid, color: 'var(--danger)' },
  ]),
)

const theme = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'transparent' },
  '.cm-content': { caretColor: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--surface-hover)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--accent-soft)',
  },
})

interface CodeEditorProps {
  value: string
  onChange(value: string): void
  label: string
  language?: 'json' | 'text'
}

/** Shared, semantic-token editor: syntax stays readable in both colour themes. */
export const CodeEditor = ({ value, onChange, label, language = 'json' }: CodeEditorProps) => {
  const extensions = useMemo(
    () => [
      ...(language === 'json' ? [json()] : []),
      syntax,
      EditorView.contentAttributes.of({ 'aria-label': label }),
    ],
    [label, language],
  )

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={theme}
      extensions={extensions}
      basicSetup={{ lineNumbers: true, foldGutter: false }}
      height="100%"
      aria-label={label}
    />
  )
}
