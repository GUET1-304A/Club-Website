import { motion } from 'framer-motion'

export default function ThemeSwitcher() {
  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="hidden lg:block fixed right-8 top-6 z-[150] pointer-events-none">
      <motion.div
        drag="y"
        dragDirectionLock
        onDragEnd={(_event, info) => {
          if (info.offset.y > 30) {
            toggleDarkMode()
          }
        }}
        dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 15 }}
        dragElastic={0.075}
        whileDrag={{ cursor: 'grabbing' }}
        className="flex flex-col items-center pointer-events-auto"
      >
        {/* Chain line */}
        <div className="w-px h-28 bg-gradient-to-b from-transparent via-[#051A24]/15 to-[#051A24]/30 dark:from-transparent dark:via-white/15 dark:to-white/30" />

        {/* Light bulb */}
        <div
          className="relative w-8 h-8 rounded-full cursor-grab active:cursor-grabbing
            bg-[radial-gradient(circle_at_center,_#facc15,_#fcd34d,_#fef9c3)]
            dark:bg-[radial-gradient(circle_at_center,_#6366f1,_#4f46e5,_#312e81)]
            shadow-[0_0_20px_8px_rgba(250,204,21,0.5)]
            dark:shadow-[0_0_20px_6px_rgba(99,102,241,0.6)]"
        >
          <div className="absolute top-1.5 left-2 w-2 h-1.5 rounded-full bg-white/60 dark:bg-white/30" />
        </div>

        {/* Label */}
        <span className="text-[10px] text-[#051A24]/30 dark:text-white/30 mt-2 font-mono select-none">
          下拉切换
        </span>
      </motion.div>
    </div>
  )
}
