import { useSiteData } from '../../store/useSiteData'
import HeroSection from '../sections/HeroSection'
import AboutSection from '../sections/AboutSection'
import AnnouncementSection from '../sections/AnnouncementSection'
import MembersSection from '../sections/MembersSection'
import ProjectsSection from '../sections/ProjectsSection'
import AwardsSection from '../sections/AwardsSection'
import JoinSection from '../sections/JoinSection'

export default function HomePage() {
  const { config } = useSiteData()
  const sections = config.sections || {}
  const enabled = (key: string) => sections[key] !== false

  return (
    <main>
      {enabled('hero_enabled') && <HeroSection />}
      {enabled('about_enabled') && <AboutSection />}
      {enabled('announcement_enabled') && <AnnouncementSection />}
      {enabled('members_enabled') && <MembersSection />}
      {enabled('projects_enabled') && <ProjectsSection />}
      {enabled('awards_enabled') && <AwardsSection />}
      {enabled('join_enabled') && <JoinSection />}
    </main>
  )
}
