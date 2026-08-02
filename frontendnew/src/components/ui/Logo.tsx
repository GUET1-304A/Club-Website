import { useState } from 'react'

const LOGO_URL = 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/5ab0547bffef4a0986baac8e245c4401.png'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-6 h-6 rounded-lg text-[8px]',
  md: 'w-8 h-8 rounded-xl text-[10px]',
  lg: 'w-10 h-10 rounded-2xl text-xs',
}

/** 星雨作坊 Logo — 显示远程图片，加载失败回退"星"文字 */
export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = sizeMap[size]

  return (
    <div
      className={`${sizeClass} bg-[#051A24] flex items-center justify-center text-white font-bold shadow-md shadow-[#051A24]/10 shrink-0 overflow-hidden ${className}`}
    >
      {!imgError && (
        <img
          src={LOGO_URL}
          alt="星雨作坊"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {imgError && <span>星</span>}
    </div>
  )
}
