import { Fragment } from 'react'
import type { ReactNode } from 'react'

/**
 * 轻量富文本，供后台配置的标题/描述使用：
 *   **文字**  → 庆科黄油体强调（font-mondwest 为历史类名）
 *   \n        → 换行
 * 不解析 HTML，避免后台输入带来 XSS 风险。
 */
export function renderRichText(text: string): ReactNode {
  return text.split('\n').map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <span key={partIndex} className="font-mondwest">
            {part.slice(2, -2)}
          </span>
        ) : (
          <Fragment key={partIndex}>{part}</Fragment>
        ),
      )}
    </Fragment>
  ))
}
