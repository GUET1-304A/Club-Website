export default function DetailError({ message, onRetry, backHref }: { message: string; onRetry: () => void; backHref: string }) {
  return (
    <div className="page-enter mx-auto max-w-[900px] px-6 py-24 text-center" role="alert">
      <h1 className="text-3xl text-[var(--theme-text-strong)]">内容加载失败</h1>
      <p className="mt-4 text-sm text-[var(--theme-text)]">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-6">重试</button>
      <a href={backHref} className="btn-tertiary mt-4 ml-3">返回列表</a>
    </div>
  )
}
