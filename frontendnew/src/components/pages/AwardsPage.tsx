import DataState from '../ui/DataState'
import { useState } from 'react'
import { Trophy } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import ContentFilters from '../ui/ContentFilters'
import EmptyState from '../ui/EmptyState'
import { useSiteData } from '../../store/useSiteData'
import type { Award } from '../../types'

const levelLabels: Record<Award['level'], string> = {
  national: '国家级', provincial: '省级', school: '校级', other: '其他',
}

const levelFilters = [
  { key: 'all', label: '全部' },
  { key: 'national', label: '国家级' },
  { key: 'provincial', label: '省级' },
  { key: 'school', label: '校级' },
  { key: 'other', label: '其他' },
]

function groupByYear(items: Award[]) {
  const groups: Record<string, Award[]> = {}
  items.forEach((item) => {
    const year = item.date.split('-')[0]
    if (!groups[year]) groups[year] = []
    groups[year].push(item)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function AwardsPage() {
  const { awards } = useSiteData(['awards'])
  const [activeLevel, setActiveLevel] = useState('all')

  const filtered = awards.filter((a) => activeLevel === 'all' || a.level === activeLevel)
  const yearGroups = groupByYear(filtered)

  return (
    <div className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        比赛<span className="font-mondwest">奖项</span>
      </h1>

      <ContentFilters label="奖项级别" options={levelFilters} active={activeLevel} onChange={setActiveLevel} />

      <DataState resource="awards">
      {yearGroups.length > 0 ? (
        <div className="space-y-16 mt-12">
          {yearGroups.map(([year, items]) => (
            <div key={year}>
              <h3 className="text-2xl font-medium text-[#051A24] mb-6">
                <span className="w-1 h-6 bg-[#051A24] rounded-full inline-block mr-3 align-middle" />
                {year}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((award) => (
                  <a key={award.id} href={`/award/${award.slug}`}>
                    <Card className="p-6 !rounded-[24px] hover:shadow-lg cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-[#051A24]">{award.name}</h4>
                          <p className="text-sm text-[#273C46] mt-1">{award.winner}</p>
                          <p className="text-xs text-[#273C46]/60 mt-1">{award.issuer}</p>
                        </div>
                        <div className="text-right">
                          <TagPill label={levelLabels[award.level]} />
                          <p className="text-xs text-[#273C46]/60 mt-2">{award.date}</p>
                        </div>
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} message="暂无匹配的奖项" />
      )}
      </DataState>
    </div>
  )
}
