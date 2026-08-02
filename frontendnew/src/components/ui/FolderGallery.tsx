import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSiteData } from '../../store/useSiteData'

export interface GalleryPhoto {
  id: string | number
  image: string
  title?: string
  slug?: string
}

interface FolderGalleryProps {
  photos?: GalleryPhoto[]
  folderName?: string
  dragHintText?: string
  className?: string
}

export default function FolderGallery({
  photos,
  folderName = '我们的作品',
  dragHintText = '向下拖拽图片关闭',
  className,
}: FolderGalleryProps) {
  const { projects: apiProjects } = useSiteData()
  const items = photos || apiProjects.map((p) => ({ id: p.id, image: p.coverImage, title: p.name, slug: p.slug }))
  const [isFolderOpen, setIsFolderOpen] = useState(false)
  const [hoverFolder, setHoverFolder] = useState(false)
  const isDraggingRef = useRef(false)

  // Dynamic spread: fewer items = wider spacing, more items = tighter
  // Max 7 visible at once; beyond that, paginate
  const MAX_VISIBLE = 7
  const needsPagination = items.length > MAX_VISIBLE
  const [pageIndex, setPageIndex] = useState(0)

  const visibleItems = needsPagination
    ? items.slice(pageIndex * MAX_VISIBLE, (pageIndex + 1) * MAX_VISIBLE)
    : items

  const totalPages = Math.ceil(items.length / MAX_VISIBLE)

  // Spread distance: scales down as visible count increases
  const spreadX = Math.min(130, Math.max(70, 900 / visibleItems.length))

  const pageForward = () => {
    setPageIndex((p) => Math.min(p + 1, totalPages - 1))
  }
  const pageBack = () => {
    setPageIndex((p) => Math.max(p - 1, 0))
  }
  // Reset page when closing
  const closeFolder = () => {
    setIsFolderOpen(false)
    setHoverFolder(false)
    setPageIndex(0)
  }

  return (
    <div className={`w-full py-20 relative ${className || ''}`}>
      <div className="relative w-full min-h-[500px] flex flex-col items-center justify-center">
        <div className="relative w-[400px] h-[500px] flex justify-center pointer-events-none z-0">
          {/* === Closed folder backing === */}
          <motion.div
            className="absolute bottom-6 w-80 h-56 drop-shadow-2xl"
            animate={{ opacity: isFolderOpen ? 0 : 1, scale: isFolderOpen ? 0.9 : 1 }}
          >
            {/* Folder tab */}
            <div className="absolute top-0 left-0 w-32 h-10 bg-gradient-to-t from-[#e8e4dc] to-[#f0ece6] rounded-t-xl border-t border-l border-r border-[rgba(0,0,0,0.05)]" />
            {/* Folder body */}
            <div className="absolute top-8 left-0 right-0 bottom-0 bg-gradient-to-b from-[#e8e4dc] to-[#ddd8ce] rounded-b-xl rounded-tr-xl border border-[rgba(0,0,0,0.05)] shadow-[inset_0_0_40px_rgba(0,0,0,0.04)]" />
            {/* Inner shadow */}
            <div className="absolute top-10 left-2 right-2 bottom-2 bg-white/30 rounded-lg pointer-events-none" />
          </motion.div>

          {/* === Stacked / spread photos === */}
          <div className="absolute bottom-10 z-10 flex justify-center">
            {visibleItems.map((photo, i) => {
              // Offset relative to center of VISIBLE items
              const visibleCenter = (visibleItems.length - 1) / 2
              const offset = i - visibleCenter

              // Closed: tight stack (all items stack together)
              const totalCenter = (items.length - 1) / 2
              const globalIndex = needsPagination ? pageIndex * MAX_VISIBLE + i : i
              const stackOffset = globalIndex - totalCenter
              const stackY = hoverFolder ? stackOffset * -10 - 40 : stackOffset * -5
              const stackX = hoverFolder ? stackOffset * 30 : stackOffset * 3
              const stackRotate = hoverFolder ? stackOffset * 8 : stackOffset * 3
              const stackScale = 1 - Math.abs(stackOffset) * 0.03

              // Open: linear spread with dynamic spacing
              const openY = -130
              const openX = offset * spreadX
              const openRotate = 0
              const openScale = 1.05

              return (
                <motion.div
                  key={photo.id}
                  drag={isFolderOpen ? true : false}
                  dragSnapToOrigin={true}
                  onDragStart={() => { isDraggingRef.current = true }}
                  onDragEnd={(_e, info) => {
                    if (info.offset.y > 50 && isFolderOpen) {
                      closeFolder()
                    }
                    // Reset flag after a tick so onClick can check
                    setTimeout(() => { isDraggingRef.current = false }, 0)
                  }}
                  onClick={() => {
                    if (isDraggingRef.current) {
                      isDraggingRef.current = false
                      return
                    }
                    if (isFolderOpen && photo.slug) {
                      window.location.href = `/project/${photo.slug}`
                    }
                  }}
                  className={`absolute bottom-0 w-56 h-72 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden border border-white/60 origin-bottom bg-white ${
                    isFolderOpen
                      ? 'cursor-grab active:cursor-grabbing pointer-events-auto'
                      : 'pointer-events-none'
                  }`}
                  animate={
                    !isFolderOpen
                      ? { y: stackY, x: stackX, rotate: stackRotate, scale: stackScale, zIndex: i + 10 }
                      : { y: openY, x: openX, rotate: openRotate, scale: openScale, zIndex: 50 }
                  }
                  whileHover={isFolderOpen ? { scale: openScale + 0.05, zIndex: 100 } : {}}
                  whileDrag={isFolderOpen ? { scale: openScale + 0.1, rotate: 5, zIndex: 150 } : {}}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                  <img src={photo.image} alt={photo.title || '作品'} className="w-full h-full object-cover pointer-events-none" />
                  {/* Title overlay */}
                  {isFolderOpen && photo.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#051A24]/80 to-transparent p-3 pt-8 pointer-events-none">
                      <span className="text-white text-xs font-medium">{photo.title}</span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* === Folder lid — click to open === */}
          <motion.div
            className="absolute bottom-0 w-[340px] h-44 drop-shadow-lg cursor-pointer z-20 pointer-events-auto"
            style={{ transformOrigin: 'bottom' }}
            animate={{
              opacity: isFolderOpen ? 0 : 1,
              rotateX: hoverFolder ? -25 : 0,
              y: hoverFolder ? 10 : 0,
              pointerEvents: isFolderOpen ? 'none' : 'auto',
            }}
            onMouseEnter={() => setHoverFolder(true)}
            onMouseLeave={() => setHoverFolder(false)}
            onClick={() => setIsFolderOpen(true)}
          >
            <div className="w-full h-full bg-gradient-to-b from-white to-[#f0ece6] rounded-2xl border border-[rgba(0,0,0,0.05)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.03)] relative overflow-hidden flex items-end justify-center pb-8">
              {/* Top highlight line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#051A24]/10 to-transparent" />
              {/* Label */}
              <div className="px-5 py-2.5 bg-white rounded-lg border border-[rgba(0,0,0,0.05)] shadow-sm flex items-center justify-center">
                <span className="text-[#051A24] text-sm font-medium tracking-wide">
                  {folderName}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* === Click hint — outside folder, arrow pointing to it === */}
        <motion.div
          animate={{ opacity: isFolderOpen ? 0 : 1, y: isFolderOpen ? -10 : 0 }}
          className="flex flex-col items-center gap-1 mt-2 z-30 pointer-events-none"
        >
          {/* Animated arrow pointing up to folder */}
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg className="w-5 h-5 text-[#273C46]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </motion.div>
          <span className="text-[11px] text-[#273C46]/40 font-medium tracking-wide">
            点击展开查看
          </span>
        </motion.div>

        {/* === Pagination arrows === */}
        {needsPagination && (
          <motion.div
            animate={{ opacity: isFolderOpen ? 1 : 0, y: isFolderOpen ? 0 : 10 }}
            className="flex items-center justify-center gap-4 mt-4 z-30 pointer-events-auto"
          >
            <button
              className="w-8 h-8 rounded-full border border-[rgba(0,0,0,0.1)] bg-white/80 backdrop-blur-md flex items-center justify-center text-[#051A24]/50 hover:text-[#051A24]/80 hover:border-[rgba(0,0,0,0.2)] transition-colors disabled:opacity-30"
              onClick={pageBack}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-xs text-[#273C46]/50 font-mono">
              {pageIndex + 1} / {totalPages}
            </span>
            <button
              className="w-8 h-8 rounded-full border border-[rgba(0,0,0,0.1)] bg-white/80 backdrop-blur-md flex items-center justify-center text-[#051A24]/50 hover:text-[#051A24]/80 hover:border-[rgba(0,0,0,0.2)] transition-colors disabled:opacity-30"
              onClick={pageForward}
              disabled={pageIndex === totalPages - 1}
              aria-label="Next page"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </motion.div>
        )}

        {/* === Drag hint === */}
        <motion.div
          animate={{ opacity: isFolderOpen ? 1 : 0, y: isFolderOpen ? 0 : 20 }}
          className="flex flex-col items-center gap-2 mt-4 z-50 pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg className="w-5 h-5 text-[#273C46]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </motion.div>
          <span className="text-xs text-[#273C46]/50 font-medium tracking-wider">
            {dragHintText}
          </span>
        </motion.div>
      </div>
    </div>
  )
}
