import HeroSection from '../sections/HeroSection'
import AboutSection from '../sections/AboutSection'
import AnnouncementSection from '../sections/AnnouncementSection'
import MembersSection from '../sections/MembersSection'
import ProjectsSection from '../sections/ProjectsSection'
import AwardsSection from '../sections/AwardsSection'
import JoinSection from '../sections/JoinSection'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <AboutSection />
      <AnnouncementSection />
      <MembersSection />
      <ProjectsSection />
      <AwardsSection />
      <JoinSection />
    </main>
  )
}
