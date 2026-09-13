/**
 * 轻量富文本渲染器：把 `**关键词**` 渲染为加粗高亮，其余文本原样输出。
 * 用于综合报告 v2 的关键词强调。
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          part.startsWith("!!") && part.endsWith("!!") ? (
            <b key={i} className="font-bold text-terra">
              {part.slice(2, -2)}
            </b>
          ) : (
            <b key={i} className="font-semibold text-olive">
              {part}
            </b>
          )
        ) : (
          <span key={i}>
            {part.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}
